// hooks/useCoupGame.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';

// Фишер-Йейтс
const shuffleDeck = (deck: Role[]): Role[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export function useCoupGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const stateRef = useRef<{ lobbyId: string | null; userId: string | undefined; gameState: GameState | null }>({
    lobbyId, userId, gameState: null
  });

  useEffect(() => {
    stateRef.current = { lobbyId, userId, gameState };
  }, [lobbyId, userId, gameState]);

  // --- SYNC ---
  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data } = await supabase.from('lobbies').select('name, code, host_id, game_state').eq('id', lobbyId).single();
      if (data) {
        setRoomMeta({ name: data.name, code: data.code, isHost: data.host_id === userId });
        if (data.game_state) setGameState(data.game_state);
      } else {
        setGameState(null); // Лобби удалено
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [lobbyId, userId]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchLobbyState();

    const ch = supabase.channel(`lobby-coup:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => {
          if (payload.new.game_state) {
            setGameState(prev => {
                // ВАЖНО: В лобби (waiting) всегда принимаем обновление, чтобы видеть новых игроков
                if (payload.new.status === 'waiting') {
                    return payload.new.game_state;
                }
                // В игре (playing) защищаемся от старых пакетов (Race Conditions)
                if (prev && (payload.new.game_state.version || 0) < (prev.version || 0)) return prev;
                return payload.new.game_state;
            });
          }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      () => {
          setGameState(null);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [lobbyId, fetchLobbyState]);

  const updateState = async (newState: GameState) => {
    newState.version = (newState.version || 0) + 1;
    newState.lastActionTime = Date.now();

    setGameState(newState);
    if (stateRef.current.lobbyId) {
       await supabase.from('lobbies').update({ game_state: newState }).eq('id', stateRef.current.lobbyId);
    }
  };

  const addLog = (state: GameState, user: string, action: string) => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute:'2-digit' });
    state.logs.unshift({ user, action, time });
    state.logs = state.logs.slice(0, 50);
  };

  const getRoleName = (role: Role) => DICTIONARY['ru'].roles[role]?.name || role;

  const nextTurn = (state: GameState) => {
    const alivePlayers = state.players.filter(p => !p.isDead);
    if (alivePlayers.length <= 1) {
      state.status = 'finished';
      state.winner = alivePlayers[0]?.name || 'Unknown';
      state.phase = 'choosing_action';
      state.turnDeadline = undefined;
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
    state.turnDeadline = Date.now() + (60 * 1000); // Таймер на ход
  };

  // --- ACTIONS ---
  const performAction = async (actionType: string, targetId?: string) => {
    const currentGs = stateRef.current.gameState;
    if (!currentGs || !userId) return;

    const newState: GameState = JSON.parse(JSON.stringify(currentGs));
    const player = newState.players.find(p => p.id === userId);
    if (!player) return;

    if (targetId) {
        const targetPlayer = newState.players.find(p => p.id === targetId);
        if (!targetPlayer || targetPlayer.isDead) return;
    }

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
      newState.phase = 'waiting_for_blocks'; // Иностранную помощь можно только блочить
    } else {
      newState.phase = 'waiting_for_challenges'; // Остальное можно оспорить
    }

    newState.turnDeadline = Date.now() + (30 * 1000); // Таймер на реакцию
    await updateState(newState);
  };

  const pass = async () => {
    const currentGs = stateRef.current.gameState;
    if (!currentGs || !userId) return; // Нужен userId чтобы проверить, кто пасует
    const newState: GameState = JSON.parse(JSON.stringify(currentGs));
    if (!newState.currentAction) return;

    // В MVP мы считаем, что если кто-то нажал PASS, он просто скрывает кнопки у себя.
    // НО для действий типа Steal/Assassinate, если ЦЕЛЬ нажала PASS, действие проходит.
    // Если это фаза waiting_for_challenges, PASS от цели не всегда завершает фазу (другие могут оспорить),
    // но для упрощения, если никто не оспорил за время, или если цель сказала "ок", можно продолжать.

    // Улучшенная логика:
    // Если это фаза 'waiting_for_blocks' (например, steal), и ЦЕЛЬ нажала pass -> действие выполняется.
    // Если это фаза 'waiting_for_challenges' и действие направлено на конкретного игрока (steal/assassinate),
    // и этот игрок нажал pass -> переходим к фазе блока (steal) или выполнения (tax/exchange - тут нет цели).

    // Для MVP сделаем так: кнопка Pass работает как "Я не возражаю".
    // Реальный переход хода происходит по таймеру ИЛИ если это действие направленное на меня и я согласился.

    const isTarget = newState.currentAction.target === userId;

    if (isTarget) {
        if (newState.phase === 'waiting_for_challenges') {
             // Если цель не оспаривает Steal/Assassinate, переходим к фазе Блока
             if (['steal', 'assassinate'].includes(newState.currentAction.type)) {
                 newState.phase = 'waiting_for_blocks';
                 addLog(newState, 'Система', 'Цель не оспаривает роль. Ждем блок.');
             } else {
                 // Для остальных действий (tax, exchange) нет конкретной цели, поэтому pass одного игрока не должен решать всё.
                 // Но здесь isTarget будет false.
                 // Если я цель Assassinate и не челленджем, то переходим к блоку.
             }
        } else if (newState.phase === 'waiting_for_blocks') {
             // Если цель не блокирует, действие выполняется
             applyActionEffect(newState);
        }
    } else {
        // Если я просто наблюдатель, мой PASS ничего не меняет в глобальном стейте (только скрывает UI локально, что не требует updateState),
        // либо мы можем реализовать счетчик пасов.
        // Для простоты, пока оставим без изменений для наблюдателей, пусть ждут таймера или действий цели.
        return;
    }

    // Если это 'waiting_for_block_challenges' и я (активный игрок) не челленджем блок -> блок успешен
    if (newState.phase === 'waiting_for_block_challenges' && newState.currentAction.player === userId) {
        addLog(newState, 'Система', 'Блок принят. Действие отменено.');
        nextTurn(newState);
    }

    await updateState(newState);
  };

  const challenge = async () => {
    const currentGs = stateRef.current.gameState;
    if (!currentGs || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(currentGs));
    const challenger = newState.players.find(p => p.id === userId);
    if (!challenger || !newState.currentAction) return;

    const isBlockChallenge = newState.phase === 'waiting_for_block_challenges';
    const accusedId = isBlockChallenge ? newState.currentAction.blockedBy : newState.currentAction.player;

    if (challenger.id === accusedId) return; // Нельзя челенджить себя

    const accused = newState.players.find(p => p.id === accusedId);
    if (!accused) return;

    addLog(newState, challenger.name, `НЕ ВЕРИТ игроку ${accused.name}!`);

    const requiredRoles = getRequiredRoles(newState.currentAction.type, isBlockChallenge);
    const hasRole = accused.cards.some(c => !c.revealed && requiredRoles.includes(c.role));

    if (hasRole) {
      // Обвиняемый доказал правоту
      const cardIdx = accused.cards.findIndex(c => !c.revealed && requiredRoles.includes(c.role));
      const oldRole = accused.cards[cardIdx].role;
      addLog(newState, accused.name, `Показал карту: ${getRoleName(oldRole)}!`);

      // Замешиваем карту и берем новую
      newState.deck.push(oldRole);
      newState.deck = shuffleDeck(newState.deck);
      accused.cards[cardIdx].role = newState.deck.pop() as Role;

      // Челленджер теряет влияние
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = challenger.id;

      // Логика после потери карты челленджером:
      // Если это был челлендж действия -> действие продолжается
      // Если это был челлендж блока -> блок остается в силе (действие отменено)
      newState.currentAction.nextPhase = isBlockChallenge ? 'blocked_end' : 'continue_action';

    } else {
      // Обвиняемый солгал
      addLog(newState, accused.name, `БЛЕФОВАЛ! (Нет нужной карты)`);
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = accused.id;

      // Логика после потери карты лжецом:
      // Если это был челлендж действия (лжец делал действие) -> действие отменяется
      // Если это был челлендж блока (лжец блокировал) -> блок снимается, действие продолжается
      newState.currentAction.nextPhase = isBlockChallenge ? 'continue_action' : 'action_cancelled';
    }

    newState.turnDeadline = Date.now() + (60 * 1000); // Время на выбор карты для потери
    await updateState(newState);
  };

  const block = async () => {
    const currentGs = stateRef.current.gameState;
    if (!currentGs || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(currentGs));
    if (!newState.currentAction) return;
    if (newState.currentAction.blockedBy) return;

    newState.currentAction.blockedBy = userId;
    newState.phase = 'waiting_for_block_challenges';
    newState.turnDeadline = Date.now() + (30 * 1000);

    const blockerName = newState.players.find(p => p.id === userId)?.name || '?';
    addLog(newState, blockerName, `БЛОКИРУЕТ действие`);

    await updateState(newState);
  };

  const resolveLoss = async (cardIndex: number) => {
    const currentGs = stateRef.current.gameState;
    if (!currentGs || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(currentGs));

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
        // Если это была потеря от Coup или Assassinate (успешного)
        if (action.type === 'coup') {
            nextTurn(newState);
        }
        else if (action.type === 'assassinate' && newState.phase === 'losing_influence' && !action.nextPhase) {
            // Это была жертва ассасина, потерявшая карту. Ход завершен.
            nextTurn(newState);
        }
        else if (action.nextPhase) {
             const next = action.nextPhase;
             delete action.nextPhase;

             if (next === 'action_cancelled') {
                 addLog(newState, 'Система', 'Действие отменено из-за неудачного блефа');
                 nextTurn(newState);
             } else if (next === 'blocked_end') {
                 addLog(newState, 'Система', 'Блок успешен (челлендж провален), действие отменено');
                 nextTurn(newState);
             } else if (next === 'continue_action') {
                 // Если блок был снят (челлендж успешен) или действие подтверждено (челлендж провален)
                 if (action.blockedBy) {
                     // Блокирующий потерял карту, значит блока нет -> выполняем действие
                     // Но если действие Steal/Assassinate, нужно проверить, не хочет ли кто еще заблокировать?
                     // (В упрощенной версии считаем, что блок снят и действие проходит)
                     addLog(newState, 'Система', 'Блок провалился, действие выполняется');
                     applyActionEffect(newState);
                 } else {
                     // Действующий игрок доказал правоту -> действие продолжается
                     // Если это Steal/Assassinate, теперь жертва может заблокировать
                     if (['steal', 'assassinate'].includes(action.type)) {
                         newState.phase = 'waiting_for_blocks';
                         newState.turnDeadline = Date.now() + (30 * 1000);
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

  const resolveExchange = async (selectedIndices: number[]) => {
      const currentGs = stateRef.current.gameState;
      if (!currentGs || !userId) return;
      const newState: GameState = JSON.parse(JSON.stringify(currentGs));
      if (newState.phase !== 'resolving_exchange' || newState.pendingPlayerId !== userId) return;

      const player = newState.players.find(p => p.id === userId);
      if (!player || !newState.exchangeBuffer) return;

      const buffer = newState.exchangeBuffer;
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

      const remainingRoles = buffer.filter((_, idx) => !selectedIndices.includes(idx));
      newState.deck.push(...remainingRoles);
      newState.deck = shuffleDeck(newState.deck);

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
                  // Важно: убираем nextPhase, чтобы resolveLoss не зациклился
                  delete action.nextPhase;
                  addLog(state, 'Система', `Покушение успешно! ${target.name} теряет карту`);
                  state.turnDeadline = Date.now() + (60 * 1000);
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
              state.turnDeadline = Date.now() + (60 * 1000);
              break;
          default:
              nextTurn(state);
      }
  };

  const getRequiredRoles = (action: string, isBlock: boolean): Role[] => {
    if (isBlock) {
        if (action === 'foreign_aid') return ['duke'];
        if (action === 'assassinate') return ['contessa'];
        if (action === 'steal') return ['captain', 'ambassador'];
        return ['duke'];
    } else {
        if (action === 'tax') return ['duke'];
        if (action === 'steal') return ['captain'];
        if (action === 'assassinate') return ['assassin'];
        if (action === 'exchange') return ['ambassador'];
        return ['duke'];
    }
  };

  const skipTurn = async () => {
      const currentGs = stateRef.current.gameState;
      if (!currentGs) return;
      const newState: GameState = JSON.parse(JSON.stringify(currentGs));

      addLog(newState, 'Система', 'Время вышло! Ход пропущен.');
      nextTurn(newState);
      await updateState(newState);
  };

  const startGame = async () => {
    const currentGs = stateRef.current.gameState;
    if (!currentGs) return;
    const roles: Role[] = ['duke', 'duke', 'duke', 'assassin', 'assassin', 'assassin', 'captain', 'captain', 'captain', 'ambassador', 'ambassador', 'ambassador', 'contessa', 'contessa', 'contessa'];
    const shuffled = shuffleDeck(roles);

    const newPlayers = currentGs.players.map(p => ({
      ...p, coins: 2, isDead: false,
      cards: [{ role: shuffled.pop()!, revealed: false }, { role: shuffled.pop()!, revealed: false }]
    }));

    const newState: GameState = {
      ...currentGs, status: 'playing', players: newPlayers, deck: shuffled, turnIndex: 0,
      phase: 'choosing_action', currentAction: null, logs: [], winner: undefined,
      lastActionTime: Date.now(), version: 1, turnDeadline: Date.now() + (60 * 1000)
    };
    addLog(newState, 'Система', 'Игра началась! Всем удачи.');
    await updateState(newState);
  };

  const leaveGame = async () => {
     const currentGs = stateRef.current.gameState;
     if (!lobbyId || !userId || !currentGs) return;

     const newState = JSON.parse(JSON.stringify(currentGs));
     newState.players = newState.players.filter((p: Player) => p.id !== userId);

     if (newState.players.length === 0) {
         await supabase.from('lobbies').delete().eq('id', lobbyId);
     } else {
         if (roomMeta?.isHost) {
            newState.players[0].isHost = true;
            addLog(newState, 'Система', `Хост вышел. Новый хост: ${newState.players[0].name}`);
         }

         if (newState.status === 'playing') addLog(newState, 'Система', 'Игрок покинул матч');
         await updateState(newState);
     }
  };

  return { gameState, roomMeta, loading, performAction, startGame, leaveGame, pass, challenge, block, resolveLoss, resolveExchange, skipTurn };
}