import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role } from '@/types/coup';

export function useCoupGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  // Стейт реф для доступа внутри функций без зависимостей
  const stateRef = useRef<{ lobbyId: string | null; userId: string | undefined }>({
    lobbyId, userId
  });

  useEffect(() => {
    stateRef.current = { lobbyId, userId };
  }, [lobbyId, userId]);

  // --- Синхронизация ---
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

  const addLog = (state: GameState, user: string, action: string) => {
    state.logs.unshift({ user, action, time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit' }) });
    state.logs = state.logs.slice(0, 50);
  };

  // --- Переход хода ---
  const nextTurn = (state: GameState) => {
    // Проверяем победу
    const alivePlayers = state.players.filter(p => !p.isDead);
    if (alivePlayers.length === 1) {
      state.status = 'finished';
      state.winner = alivePlayers[0].name;
      state.phase = 'choosing_action';
      return;
    }

    let next = (state.turnIndex + 1) % state.players.length;
    // Пропускаем мертвых
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

    // Списание монет сразу, если это Coup или Assassinate
    if (actionType === 'coup') {
      if (player.coins < 7) return;
      player.coins -= 7;
    } else if (actionType === 'assassinate') {
      if (player.coins < 3) return;
      player.coins -= 3;
    }

    const action = { type: actionType, player: userId, target: targetId };
    newState.currentAction = action;
    addLog(newState, player.name, `${actionType.toUpperCase()}${targetId ? ' -> target' : ''}`);

    if (actionType === 'income') {
      player.coins++;
      nextTurn(newState);
    } else if (actionType === 'coup') {
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = targetId; // Цель должна сбросить карту
    } else if (actionType === 'foreign_aid') {
      newState.phase = 'waiting_for_blocks'; // Блокирует Duke
    } else {
      // Все остальные (Tax, Steal, Assassinate, Exchange) можно оспорить
      newState.phase = 'waiting_for_challenges';
    }

    await updateState(newState);
  };

  // --- REACTIONS ---
  const pass = async () => {
    if (!gameState) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    if (!newState.currentAction) return;

    if (newState.phase === 'waiting_for_challenges') {
      if (['steal', 'assassinate'].includes(newState.currentAction.type)) {
        newState.phase = 'waiting_for_blocks';
      } else {
        applyActionEffect(newState);
      }
    } else if (newState.phase === 'waiting_for_blocks') {
       applyActionEffect(newState);
    } else if (newState.phase === 'waiting_for_block_challenges') {
       // Блок успешный (никто не оспорил) -> действие отменено
       addLog(newState, 'System', 'Action blocked');
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

    addLog(newState, challenger.name, `Challenged ${accused.name}!`);

    // Проверка наличия карты
    const requiredRole = getRequiredRole(newState.currentAction.type, isBlockChallenge);
    const hasRole = accused.cards.some(c => !c.revealed && c.role === requiredRole);

    if (hasRole) {
      // ОБВИНЯЕМЫЙ ПРАВ
      addLog(newState, accused.name, `Revealed ${requiredRole}!`);

      // 1. Обвиняемый меняет эту карту (замешивает и берет новую)
      const cardIdx = accused.cards.findIndex(c => !c.revealed && c.role === requiredRole);
      const oldRole = accused.cards[cardIdx].role;
      newState.deck.push(oldRole);
      newState.deck.sort(() => Math.random() - 0.5);
      accused.cards[cardIdx].role = newState.deck.pop() as Role;

      // 2. Челленджер теряет влияние
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = challenger.id;
      // Сохраняем контекст, что делать ПОСЛЕ потери карты
      // Если это был блок-челлендж и блок устоял -> действие отменяется
      // Если это был экшн-челлендж и экшн устоял -> продолжаем экшн
      newState.currentAction.nextPhase = isBlockChallenge ? 'blocked_end' : 'continue_action';

    } else {
      // ОБВИНЯЕМЫЙ ВРАЛ
      addLog(newState, accused.name, `Caught bluffing! (No ${requiredRole})`);

      // Обвиняемый теряет влияние
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = accused.id;

      // Если врал про блок -> блок снимается, действие продолжается
      // Если врал про действие -> действие отменяется
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
    addLog(newState, newState.players.find(p => p.id === userId)?.name || '?', `Blocked action`);
    await updateState(newState);
  };

  // --- RESOLUTION UTILS ---

  const resolveLoss = async (cardIndex: number) => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));

    // Проверяем, что это тот игрок, который должен сбросить
    if (newState.pendingPlayerId !== userId) return;

    const player = newState.players.find(p => p.id === userId);
    if (!player || player.cards[cardIndex].revealed) return;

    // Сбрасываем карту
    player.cards[cardIndex].revealed = true;
    addLog(newState, player.name, `Lost influence: ${player.cards[cardIndex].role}`);

    // Проверяем смерть
    if (player.cards.every(c => c.revealed)) {
       player.isDead = true;
       player.coins = 0; // Деньги сгорают или идут в банк
    }

    // Определяем, что делать дальше, основываясь на currentAction и nextPhase
    const action = newState.currentAction;
    if (!action) {
       nextTurn(newState); // Fallback
    } else {
        // 1. Если это был Coup или успешный Assassination (жертва сбросила)
        if (action.type === 'coup' || (action.type === 'assassinate' && newState.phase === 'losing_influence' && !action.nextPhase)) {
            nextTurn(newState);
        }
        // 2. Если это результат Челленджа
        else if (action.nextPhase) {
             const next = action.nextPhase;
             // Очищаем флаг
             delete action.nextPhase;

             if (next === 'action_cancelled' || next === 'blocked_end') {
                 nextTurn(newState);
             } else if (next === 'continue_action') {
                 // Продолжаем прерванное действие
                 // Если это был блок, который провалился (блок снят), то выполняем эффект действия
                 // Если это было действие, которое устояло, то идем к блокам или эффекту

                 // Была ли это фаза блоков?
                 if (['steal', 'assassinate'].includes(action.type) && !action.blockedBy) {
                     newState.phase = 'waiting_for_blocks';
                 } else {
                     applyActionEffect(newState);
                 }
             }
        } else {
          // Fallback
          nextTurn(newState);
        }
    }

    await updateState(newState);
  };

  const resolveExchange = async (selectedRoles: Role[]) => {
      if (!gameState || !userId) return;
      const newState: GameState = JSON.parse(JSON.stringify(gameState));
      if (newState.phase !== 'resolving_exchange' || newState.pendingPlayerId !== userId) return;

      const player = newState.players.find(p => p.id === userId);
      if (!player || !newState.exchangeBuffer) return;

      // Валидация: игрок должен выбрать столько карт, сколько у него "жизней"
      const lives = player.cards.filter(c => !c.revealed).length;
      if (selectedRoles.length !== lives) return; // Must pick exactly required amount

      // Формируем новые карты игрока
      // Мы берем selectedRoles и назначаем их в нераскрытые слоты
      let selectedIdx = 0;
      for (let i = 0; i < player.cards.length; i++) {
          if (!player.cards[i].revealed) {
              player.cards[i].role = selectedRoles[selectedIdx];
              selectedIdx++;
          }
      }

      // Остальное возвращаем в колоду
      // Буфер содержал (lives + 2) карт. Мы забрали lives. Осталось 2.
      // Но для простоты: соберем все карты (рука + буфер), уберем выбранные, остаток в колоду
      // В MVP реализации мы просто пушим остаток буфера, если UI гарантирует правильность
      // Здесь мы полагаемся на UI, что он вернул правильные роли из буфера.

      // Найдем, какие роли вернули в колоду
      const usedRoles = [...selectedRoles];
      const rolesToReturn: Role[] = [];

      // Копия буфера
      const buffer = [...newState.exchangeBuffer];

      // Вычитаем использованные
      for (const role of buffer) {
          const idx = usedRoles.indexOf(role);
          if (idx !== -1) {
              usedRoles.splice(idx, 1);
          } else {
              rolesToReturn.push(role);
          }
      }

      newState.deck.push(...rolesToReturn);
      newState.deck.sort(() => Math.random() - 0.5);

      newState.exchangeBuffer = undefined;
      addLog(newState, player.name, 'Exchanged cards');
      nextTurn(newState);

      await updateState(newState);
  };

  // Внутренняя функция применения эффекта
  const applyActionEffect = (state: GameState) => {
      const action = state.currentAction;
      if (!action) return;
      const actor = state.players.find(p => p.id === action.player);
      const target = state.players.find(p => p.id === action.target);
      if (!actor) return;

      switch(action.type) {
          case 'tax':
              actor.coins += 3;
              nextTurn(state);
              break;
          case 'foreign_aid':
              actor.coins += 2;
              nextTurn(state);
              break;
          case 'steal':
              if (target) {
                  const amount = Math.min(2, target.coins);
                  target.coins -= amount;
                  actor.coins += amount;
                  addLog(state, actor.name, `Stole ${amount} from ${target.name}`);
              }
              nextTurn(state);
              break;
          case 'assassinate':
              if (target) {
                  state.phase = 'losing_influence';
                  state.pendingPlayerId = target.id;
                  // Assassinate успешен -> жертва теряет карту.
                  // Деньги уже списаны в начале.
              } else {
                  nextTurn(state);
              }
              break;
          case 'exchange':
              // Берем 2 карты из колоды
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
        if (action === 'steal') return 'captain'; // Или Ambassador, но упростим для челенджа
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
    await updateState(newState);
  };

  const leaveGame = async () => {
     if (lobbyId) await supabase.from('lobbies').delete().eq('id', lobbyId);
  };

  return { gameState, roomMeta, loading, performAction, startGame, leaveGame, pass, challenge, block, resolveLoss, resolveExchange };
}