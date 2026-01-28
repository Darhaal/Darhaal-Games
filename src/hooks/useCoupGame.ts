import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role, GamePhase } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';

// Константы Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amemndrojsaccfhtbsxc.supabase.com';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function useCoupGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const stateRef = useRef<{ lobbyId: string | null; userId: string | undefined; status: string }>({
    lobbyId, userId, status: 'waiting'
  });

  useEffect(() => {
    stateRef.current = { lobbyId, userId, status: gameState?.status || 'waiting' };
  }, [lobbyId, userId, gameState]);

  // --- 1. Синхронизация ---
  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data } = await supabase.from('lobbies').select('name, code, host_id, game_state').eq('id', lobbyId).single();
      if (data) {
        setRoomMeta({ name: data.name, code: data.code, isHost: data.host_id === userId });
        if (data.game_state) setGameState(data.game_state);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [lobbyId, userId]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchLobbyState();
    const ch = supabase.channel(`lobby:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => { if (payload.new.game_state) setGameState(payload.new.game_state); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lobbyId, fetchLobbyState]);

  // --- 2. Логика Игры (State Machine) ---

  const updateState = async (newState: GameState) => {
    setGameState(newState);
    await supabase.from('lobbies').update({ game_state: newState }).eq('id', lobbyId);
  };

  const addLog = (state: GameState, user: string, action: string) => {
    state.logs.unshift({ user, action, time: new Date().toLocaleTimeString() });
    state.logs = state.logs.slice(0, 50);
  };

  const nextTurn = (state: GameState) => {
    let next = (state.turnIndex + 1) % state.players.length;
    while (state.players[next].isDead) {
      next = (next + 1) % state.players.length;
    }
    state.turnIndex = next;
    state.phase = 'choosing_action';
    state.currentAction = null;
  };

  // -- MAIN ACTIONS --

  const performAction = async (actionType: string, targetId?: string) => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const player = newState.players.find(p => p.id === userId);
    if (!player) return;

    // Инициализация действия
    const action = { type: actionType, player: userId, target: targetId };
    newState.currentAction = action;

    // Логика фаз
    if (actionType === 'income') {
      player.coins++;
      addLog(newState, player.name, 'Income (+1)');
      nextTurn(newState);
    }
    else if (actionType === 'coup') {
      if (player.coins < 7) return;
      player.coins -= 7;
      addLog(newState, player.name, `Coup on ${newState.players.find(p => p.id === targetId)?.name}`);
      newState.phase = 'losing_influence'; // Цель должна выбрать карту
    }
    else if (actionType === 'foreign_aid') {
      newState.phase = 'waiting_for_blocks'; // Может блочить Duke
    }
    else {
      // Tax, Steal, Assassinate, Exchange - все можно оспорить
      if (actionType === 'assassinate') {
         if (player.coins < 3) return;
         player.coins -= 3;
      }
      newState.phase = 'waiting_for_challenges';
    }

    await updateState(newState);
  };

  // -- REACTIONS --

  const pass = async () => {
    if (!gameState) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const action = newState.currentAction;
    if (!action) return;

    const actor = newState.players.find(p => p.id === action.player);
    const target = newState.players.find(p => p.id === action.target);

    // Если фаза челленджей прошла успешно (никто не оспорил)
    if (newState.phase === 'waiting_for_challenges') {
        if (['steal', 'assassinate'].includes(action.type)) {
            newState.phase = 'waiting_for_blocks'; // Теперь можно блокировать
        } else {
            resolveActionEffect(newState); // Выполняем (Tax, Exchange)
        }
    }
    // Если фаза блоков прошла (никто не заблокировал)
    else if (newState.phase === 'waiting_for_blocks') {
        resolveActionEffect(newState); // Выполняем (Steal, Assassinate, Aid)
    }
    // Если фаза челленджей блока прошла
    else if (newState.phase === 'waiting_for_block_challenges') {
        // Блок успешен, действие отменяется
        addLog(newState, 'System', 'Action Blocked');
        nextTurn(newState);
    }

    await updateState(newState);
  };

  const challenge = async () => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const challenger = newState.players.find(p => p.id === userId);

    // Определяем кого проверяем (того кто сделал действие или того кто блокирует)
    const isBlockChallenge = newState.phase === 'waiting_for_block_challenges';
    const accusedId = isBlockChallenge ? newState.currentAction?.blockedBy : newState.currentAction?.player;
    const accused = newState.players.find(p => p.id === accusedId);

    if (!challenger || !accused || !newState.currentAction) return;

    addLog(newState, challenger.name, `Challenged ${accused.name}!`);

    // Проверка наличия карты (Упрощенная автоматическая проверка для скорости)
    // В реальной игре игрок выбирает какую карту показать. Тут мы проверим программно:
    // Есть ли у него нужная роль?
    const requiredRole = getRequiredRole(newState.currentAction.type, isBlockChallenge, newState.currentAction.type);
    const hasRole = accused.cards.some(c => !c.revealed && c.role === requiredRole);

    if (hasRole) {
        // Челлендж провален -> Челленджер теряет карту
        addLog(newState, accused.name, `Has ${requiredRole}!`);
        addLog(newState, challenger.name, 'Lost challenge');

        // Обмен карты обвиняемого (он доказал, но карту надо сменить)
        const cardIdx = accused.cards.findIndex(c => !c.revealed && c.role === requiredRole);
        accused.cards[cardIdx].role = newState.deck.pop() as Role;
        newState.deck.push(requiredRole);
        newState.deck.sort(() => Math.random() - 0.5);

        // Наказание
        // В идеале: challenger выбирает карту. Тут упростим: авто-сброс первой живой
        const lostCardIdx = challenger.cards.findIndex(c => !c.revealed);
        if (lostCardIdx !== -1) challenger.cards[lostCardIdx].revealed = true;
        checkDeath(challenger);

        // Если челленджер умер, а действие продолжается?
        // Возвращаемся к фазе, которая была прервана, или завершаем ход
        if (isBlockChallenge) {
             // Блок устоял -> действие отменено
             nextTurn(newState);
        } else {
             // Действие устояло -> продолжаем (например к блокам или эффекту)
             if (['steal', 'assassinate'].includes(newState.currentAction.type)) {
                 newState.phase = 'waiting_for_blocks';
             } else {
                 resolveActionEffect(newState);
             }
        }
    } else {
        // Челлендж успешен -> Обвиняемый теряет карту и действие отменяется
        addLog(newState, accused.name, `Caught bluffing! (No ${requiredRole})`);

        const lostCardIdx = accused.cards.findIndex(c => !c.revealed);
        if (lostCardIdx !== -1) accused.cards[lostCardIdx].revealed = true;
        checkDeath(accused);

        if (isBlockChallenge) {
            // Блок был блефом -> действие проходит
            resolveActionEffect(newState);
        } else {
            // Действие было блефом -> отмена
            nextTurn(newState);
        }
    }

    await updateState(newState);
  };

  const block = async () => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    if (!newState.currentAction) return;

    newState.currentAction.blockedBy = userId;
    newState.phase = 'waiting_for_block_challenges';
    addLog(newState, newState.players.find(p => p.id === userId)?.name || '?', `Blocked ${newState.currentAction.type}`);

    await updateState(newState);
  };

  const resolveActionEffect = (state: GameState) => {
      const action = state.currentAction;
      if (!action) return;
      const actor = state.players.find(p => p.id === action.player);
      const target = state.players.find(p => p.id === action.target);

      if (!actor) return;

      switch (action.type) {
          case 'tax':
              actor.coins += 3;
              break;
          case 'foreign_aid':
              actor.coins += 2;
              break;
          case 'steal':
              if (target) {
                  const amount = Math.min(2, target.coins);
                  target.coins -= amount;
                  actor.coins += amount;
                  addLog(state, actor.name, `Stole ${amount} from ${target.name}`);
              }
              break;
          case 'assassinate':
              if (target) {
                  state.phase = 'losing_influence';
                  // Подменяем currentAction чтобы знать кого убиваем в фазе сброса
                  // Но проще сразу переключить, если мы реализуем ручной выбор
                  // Пока упростим: авто-килл (для MVP)
                  const cardIdx = target.cards.findIndex(c => !c.revealed);
                  if (cardIdx !== -1) target.cards[cardIdx].revealed = true;
                  checkDeath(target);
                  addLog(state, actor.name, `Assassinated ${target.name}`);
              }
              break;
          case 'exchange':
              // В полной версии тут UI выбора. В MVP - автообмен
              if (state.deck.length >= 2) {
                  const hand = actor.cards.filter(c => !c.revealed).map(c => c.role);
                  state.deck.push(...hand);
                  state.deck.sort(() => Math.random() - 0.5);
                  actor.cards.forEach(c => { if(!c.revealed) c.role = state.deck.pop()!; });
                  addLog(state, actor.name, 'Exchanged cards');
              }
              break;
      }

      // Если фаза не losing_influence (где игрок должен выбрать карту), то ход закончен
      if (state.phase !== 'losing_influence') {
          nextTurn(state);
      }
  };

  // Утилиты
  const checkDeath = (p: Player) => {
      if (p.cards.every(c => c.revealed)) {
          p.isDead = true;
          p.coins = 0;
      }
  };

  const getRequiredRole = (action: string, isBlock: boolean, blockType?: string): Role => {
      if (!isBlock) {
          if (action === 'tax') return 'duke';
          if (action === 'steal') return 'captain';
          if (action === 'assassinate') return 'assassin';
          if (action === 'exchange') return 'ambassador';
      } else {
          if (action === 'foreign_aid') return 'duke';
          if (action === 'assassinate') return 'contessa';
          if (action === 'steal') return 'captain'; // или ambassador, тут упростим
      }
      return 'duke'; // fallback
  };

  // --- Start & Leave ---
  const startGame = async () => {
    if (!gameState) return;
    const roles: Role[] = ['duke', 'duke', 'duke', 'assassin', 'assassin', 'assassin', 'captain', 'captain', 'captain', 'ambassador', 'ambassador', 'ambassador', 'contessa', 'contessa', 'contessa'];
    const shuffled = roles.sort(() => Math.random() - 0.5);

    const newPlayers = (gameState.players || []).map(p => ({
      ...p, coins: 2, isDead: false,
      cards: [{ role: shuffled.pop()!, revealed: false }, { role: shuffled.pop()!, revealed: false }]
    }));

    const newState: GameState = {
      ...gameState, status: 'playing', players: newPlayers, deck: shuffled, turnIndex: 0,
      phase: 'choosing_action', currentAction: null, logs: []
    };
    await updateState(newState);
  };

  const leaveGame = async () => {
      // Упрощенный выход, так как код уже разрастается
      if (lobbyId) await supabase.from('lobbies').delete().eq('id', lobbyId);
  };

  return { gameState, roomMeta, loading, performAction, startGame, leaveGame, pass, challenge, block };
}