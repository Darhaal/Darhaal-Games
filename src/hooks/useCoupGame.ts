import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';

export function useCoupGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const stateRef = useRef<{ lobbyId: string | null; userId: string | undefined }>({
    lobbyId, userId
  });

  useEffect(() => {
    stateRef.current = { lobbyId, userId };
  }, [lobbyId, userId]);

  // --- 1. Sync ---
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

  const updateState = async (newState: GameState) => {
    setGameState(newState);
    if (stateRef.current.lobbyId) {
       await supabase.from('lobbies').update({ game_state: newState }).eq('id', stateRef.current.lobbyId);
    }
  };

  // --- Logs ---
  const addLog = (state: GameState, user: string, action: string) => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute:'2-digit' });
    state.logs.unshift({ user, action, time });
    state.logs = state.logs.slice(0, 50);
  };

  const getRoleName = (role: Role) => DICTIONARY['ru'].roles[role]?.name || role;

  const nextTurn = (state: GameState) => {
    const alivePlayers = state.players.filter(p => !p.isDead);
    if (alivePlayers.length === 1) {
      state.status = 'finished';
      state.winner = alivePlayers[0].name;
      state.phase = 'choosing_action';
      addLog(state, '🏆', `Победитель: ${state.winner}!`);
      return;
    }

    let next = (state.turnIndex + 1) % state.players.length;
    while (state.players[next].isDead) {
      next = (next + 1) % state.players.length;
    }

    state.turnIndex = next;
    state.phase = 'choosing_action';
    state.currentAction = null;
    state.pendingPlayerId = undefined;
    state.exchangeBuffer = undefined;
  };

  // --- ACTIONS ---
  const performAction = async (actionType: string, targetId?: string) => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const player = newState.players.find(p => p.id === userId);
    if (!player) return;

    const targetName = targetId ? newState.players.find(p => p.id === targetId)?.name : '';

    if (actionType === 'coup') {
      if (player.coins < 7) return;
      player.coins -= 7;
    } else if (actionType === 'assassinate') {
      if (player.coins < 3) return;
      player.coins -= 3;
    }

    const action = { type: actionType, player: userId, target: targetId };
    newState.currentAction = action;

    switch (actionType) {
        case 'income': addLog(newState, player.name, 'Взял Доход (+1)'); break;
        case 'foreign_aid': addLog(newState, player.name, 'Хочет взять Помощь (+2)'); break;
        case 'tax': addLog(newState, player.name, 'Объявил Налог (+3) (Герцог)'); break;
        case 'steal': addLog(newState, player.name, `Хочет украсть у ${targetName} (Капитан)`); break;
        case 'exchange': addLog(newState, player.name, 'Хочет сменить карты (Посол)'); break;
        case 'assassinate': addLog(newState, player.name, `Платит убийце за ${targetName} (-3)`); break;
        case 'coup': addLog(newState, player.name, `УСТРАИВАЕТ ПЕРЕВОРОТ против ${targetName}!`); break;
    }

    if (actionType === 'income') {
      player.coins++;
      nextTurn(newState);
    } else if (actionType === 'coup') {
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = targetId;
    } else if (actionType === 'foreign_aid') {
      // Foreign Aid нельзя оспорить (это не действие персонажа), его можно только заблокировать
      newState.phase = 'waiting_for_blocks';
    } else {
      // Остальные действия (Tax, Steal, Assassinate, Exchange) можно оспорить
      newState.phase = 'waiting_for_challenges';
    }

    await updateState(newState);
  };

  const pass = async () => {
    if (!gameState) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    if (!newState.currentAction) return;

    if (newState.phase === 'waiting_for_challenges') {
      // Если никто не оспорил действие
      if (['steal', 'assassinate'].includes(newState.currentAction.type)) {
        newState.phase = 'waiting_for_blocks'; // Переходим к блокам
      } else {
        applyActionEffect(newState); // Выполняем (Tax, Exchange)
      }
    }
    else if (newState.phase === 'waiting_for_blocks') {
       // Никто не заблокировал
       applyActionEffect(newState);
    }
    else if (newState.phase === 'waiting_for_block_challenges') {
       // Блок не оспорен -> Блок успешен -> Действие отменено
       addLog(newState, 'Система', 'Блок успешен, действие отменено');
       nextTurn(newState);
    }

    await updateState(newState);
  };

  const challenge = async () => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const challenger = newState.players.find(p => p.id === userId);
    if (!challenger || !newState.currentAction) return;

    const isBlockChallenge = newState.phase === 'waiting_for_block_challenges';
    const accusedId = isBlockChallenge ? newState.currentAction.blockedBy : newState.currentAction.player;
    const accused = newState.players.find(p => p.id === accusedId);
    if (!accused) return;

    addLog(newState, challenger.name, `НЕ ВЕРИТ игроку ${accused.name}!`);

    const requiredRole = getRequiredRole(newState.currentAction.type, isBlockChallenge);
    const hasRole = accused.cards.some(c => !c.revealed && c.role === requiredRole);

    if (hasRole) {
      // Обвиняемый доказал правоту
      addLog(newState, accused.name, `Показал карту: ${getRoleName(requiredRole)}!`);

      // Замена карты (возвращаем старую в колоду, мешаем, берем новую)
      const cardIdx = accused.cards.findIndex(c => !c.revealed && c.role === requiredRole);
      const oldRole = accused.cards[cardIdx].role;

      newState.deck.push(oldRole);
      newState.deck.sort(() => Math.random() - 0.5);

      accused.cards[cardIdx].role = newState.deck.pop() as Role;

      // Наказание челленджера
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = challenger.id;
      // Если это был блок и он устоял -> действие отменено
      // Если это было действие и оно устояло -> продолжаем
      newState.currentAction.nextPhase = isBlockChallenge ? 'blocked_end' : 'continue_action';

    } else {
      // Обвиняемый блефовал
      addLog(newState, accused.name, `БЛЕФОВАЛ! (Нет карты ${getRoleName(requiredRole)})`);

      newState.phase = 'losing_influence';
      newState.pendingPlayerId = accused.id;
      // Если блок был блефом -> действие продолжается
      // Если действие было блефом -> действие отменяется
      newState.currentAction.nextPhase = isBlockChallenge ? 'continue_action' : 'action_cancelled';
    }

    await updateState(newState);
  };

  const block = async () => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    if (!newState.currentAction) return;

    newState.currentAction.blockedBy = userId;
    newState.phase = 'waiting_for_block_challenges';

    const blockerName = newState.players.find(p => p.id === userId)?.name || '?';
    addLog(newState, blockerName, `БЛОКИРУЕТ действие`);

    await updateState(newState);
  };

  const resolveLoss = async (cardIndex: number) => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));

    if (newState.pendingPlayerId !== userId) return;

    const player = newState.players.find(p => p.id === userId);
    if (!player || player.cards[cardIndex].revealed) return;

    player.cards[cardIndex].revealed = true;
    const lostRole = getRoleName(player.cards[cardIndex].role);
    addLog(newState, player.name, `СБРОСИЛ КАРТУ: ${lostRole}`);

    if (player.cards.every(c => c.revealed)) {
       player.isDead = true;
       player.coins = 0;
       addLog(newState, player.name, 'Выбывает из игры ☠️');
    }

    const action = newState.currentAction;
    if (!action) {
       nextTurn(newState);
    } else {
        if (action.type === 'coup' || (action.type === 'assassinate' && newState.phase === 'losing_influence' && !action.nextPhase)) {
            nextTurn(newState);
        }
        else if (action.nextPhase) {
             const next = action.nextPhase;
             delete action.nextPhase;

             if (next === 'action_cancelled') {
                 addLog(newState, 'Система', 'Действие отменено');
                 nextTurn(newState);
             } else if (next === 'blocked_end') {
                 addLog(newState, 'Система', 'Блок успешен, действие отменено');
                 nextTurn(newState);
             } else if (next === 'continue_action') {
                 // Если продолжаем после...
                 if (action.blockedBy) {
                     // ...провала блока (блок был блефом) -> выполняем действие
                     applyActionEffect(newState);
                 } else {
                     // ...победы над челенджем действия -> идем к блокам или выполняем
                     if (['steal', 'assassinate'].includes(action.type)) {
                         newState.phase = 'waiting_for_blocks';
                     } else {
                         applyActionEffect(newState);
                     }
                 }
             }
        } else {
          nextTurn(newState);
        }
    }

    await updateState(newState);
  };

  // ИСПРАВЛЕНО: Принимаем индексы карт в буфере, чтобы различать дубликаты
  const resolveExchange = async (selectedIndices: number[]) => {
      if (!gameState || !userId) return;
      const newState: GameState = JSON.parse(JSON.stringify(gameState));
      if (newState.phase !== 'resolving_exchange' || newState.pendingPlayerId !== userId) return;

      const player = newState.players.find(p => p.id === userId);
      if (!player || !newState.exchangeBuffer) return;

      const buffer = newState.exchangeBuffer;

      // 1. Обновляем руку игрока выбранными картами
      let selectionPtr = 0;
      for (let i = 0; i < player.cards.length; i++) {
          if (!player.cards[i].revealed) {
              if (selectionPtr < selectedIndices.length) {
                  const bufferIndex = selectedIndices[selectionPtr];
                  player.cards[i].role = buffer[bufferIndex];
                  selectionPtr++;
              }
          }
      }

      // 2. Все невыбранные карты из буфера возвращаем в колоду
      const remainingRoles = buffer.filter((_, idx) => !selectedIndices.includes(idx));
      newState.deck.push(...remainingRoles);
      newState.deck.sort(() => Math.random() - 0.5);

      newState.exchangeBuffer = undefined;
      addLog(newState, player.name, 'Обменял карты');
      nextTurn(newState);

      await updateState(newState);
  };

  const applyActionEffect = (state: GameState) => {
      const action = state.currentAction;
      if (!action) return;
      const actor = state.players.find(p => p.id === action.player);
      const target = state.players.find(p => p.id === action.target);
      if (!actor) return;

      switch(action.type) {
          case 'tax':
              actor.coins += 3;
              addLog(state, actor.name, 'Получил налог (+3)');
              nextTurn(state);
              break;
          case 'foreign_aid':
              actor.coins += 2;
              addLog(state, actor.name, 'Получил помощь (+2)');
              nextTurn(state);
              break;
          case 'steal':
              if (target) {
                  const amount = Math.min(2, target.coins);
                  target.coins -= amount;
                  actor.coins += amount;
                  addLog(state, actor.name, `Украл ${amount} у ${target.name}`);
              }
              nextTurn(state);
              break;
          case 'assassinate':
              if (target) {
                  state.phase = 'losing_influence';
                  state.pendingPlayerId = target.id;
                  addLog(state, 'Система', `Покушение успешно! ${target.name} теряет карту`);
              } else {
                  nextTurn(state);
              }
              break;
          case 'exchange':
              const drawn = [state.deck.pop()!, state.deck.pop()!];
              const currentHand = actor.cards.filter(c => !c.revealed).map(c => c.role);
              state.exchangeBuffer = [...currentHand, ...drawn];
              state.phase = 'resolving_exchange';
              state.pendingPlayerId = actor.id;
              break;
          default:
              nextTurn(state);
      }
  };

  const getRequiredRole = (action: string, isBlock: boolean): Role => {
    if (isBlock) {
        if (action === 'foreign_aid') return 'duke';
        if (action === 'assassinate') return 'contessa';
        if (action === 'steal') return 'captain';
        return 'duke';
    } else {
        if (action === 'tax') return 'duke';
        if (action === 'steal') return 'captain';
        if (action === 'assassinate') return 'assassin';
        if (action === 'exchange') return 'ambassador';
        return 'duke';
    }
  };

  const startGame = async () => {
    if (!gameState) return;
    // 3 копии каждой роли
    const roles: Role[] = ['duke', 'duke', 'duke', 'assassin', 'assassin', 'assassin', 'captain', 'captain', 'captain', 'ambassador', 'ambassador', 'ambassador', 'contessa', 'contessa', 'contessa'];
    const shuffled = roles.sort(() => Math.random() - 0.5);

    const newPlayers = gameState.players.map(p => ({
      ...p, coins: 2, isDead: false,
      cards: [{ role: shuffled.pop()!, revealed: false }, { role: shuffled.pop()!, revealed: false }]
    }));

    const newState: GameState = {
      ...gameState, status: 'playing', players: newPlayers, deck: shuffled, turnIndex: 0,
      phase: 'choosing_action', currentAction: null, logs: [], winner: undefined
    };
    addLog(newState, 'Система', 'Игра началась! Всем удачи.');
    await updateState(newState);
  };

  const leaveGame = async () => {
     if (lobbyId) await supabase.from('lobbies').delete().eq('id', lobbyId);
  };

  return { gameState, roomMeta, loading, performAction, startGame, leaveGame, pass, challenge, block, resolveLoss, resolveExchange };
}