import { useEffect } from 'react';
import { GameState, Player, Role } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';
import { updatePlayerStats } from '@/lib/playerStats';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { requireGame, roomCapacity } from '@/games/registry';
import { shuffleDeck, buildDeck, getRequiredRoles } from '@/lib/gameLogic/coup';

// Module-level helper: sidesteps the react-compiler purity heuristic
// (Date.now inside event handlers is a legitimate use)
const now = () => Date.now();

const GAME = requireGame('coup');

/** A turn runs for a minute; a response window is half that. */
const TURN_MS = 60 * 1000;
const RESPONSE_MS = 30 * 1000;

/** Phases in which other players may pass on the action on the table. */
const RESPONSE_PHASES = ['waiting_for_challenges', 'waiting_for_blocks', 'waiting_for_block_challenges'];

export function useCoupGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<GameState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-coup'
  });

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
      state.winnerId = alivePlayers[0]?.id;
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
    state.passedPlayers = [];
    state.turnDeadline = now() + (60 * 1000);
  };

  /**
   * Resolves an expired turn, kicking the player who let it expire when the
   * phase has a single responsible player.
   *
   * Callable by anyone: the deadline is the authority, not the caller. The
   * screen used to let only the responsible player fire this, which meant the
   * AFK kick could only be triggered by the very player who had gone AFK —
   * so a disconnect in `choosing_action`, `losing_influence` or
   * `resolving_exchange` stopped the match for good.
   */
  const skipTurn = async () => {
      await updateState((current) => {
      // The move that beat the clock may already have moved the phase on, in
      // which case there is nothing left to time out.
      if (current.status !== 'playing') return null;
      // A caller whose clock runs early writes nothing, and once this lands the
      // fresh deadline makes any second caller a no-op.
      if (!current.turnDeadline || Date.now() < current.turnDeadline) return null;
      const newState: GameState = JSON.parse(JSON.stringify(current));

      if (['choosing_action', 'losing_influence', 'resolving_exchange'].includes(newState.phase)) {
          let culpritId = newState.players[newState.turnIndex].id;
          if (newState.phase === 'losing_influence' || newState.phase === 'resolving_exchange') {
             if (newState.pendingPlayerId) culpritId = newState.pendingPlayerId;
          }

          const culprit = newState.players.find(p => p.id === culpritId);
          if (culprit) {
             addLog(newState, 'Система', `Игрок ${culprit.name} кикнут за AFK.`);

             const culpritIdx = newState.players.findIndex(p => p.id === culpritId);
             newState.players = newState.players.filter(p => p.id !== culpritId);

             if (culpritIdx < newState.turnIndex) {
                 newState.turnIndex--;
             }

             if (newState.turnIndex >= newState.players.length) {
                 newState.turnIndex = 0;
             }

             const alive = newState.players.filter(p => !p.isDead);
             if (alive.length <= 1) {
                 newState.status = 'finished';
                 newState.winner = alive[0]?.name || 'Unknown';
                 newState.winnerId = alive[0]?.id;
                 addLog(newState, '🏆', `Победитель: ${newState.winner}!`);
             } else {
                 while (newState.players[newState.turnIndex].isDead) {
                    newState.turnIndex = (newState.turnIndex + 1) % newState.players.length;
                 }

                 newState.phase = 'choosing_action';
                 newState.currentAction = null;
                 newState.pendingPlayerId = undefined;
                 newState.exchangeBuffer = undefined;
                 newState.passedPlayers = [];
                 newState.turnDeadline = now() + (60 * 1000);
             }
          }
      }
      else if (['waiting_for_challenges', 'waiting_for_blocks', 'waiting_for_block_challenges'].includes(newState.phase)) {
          if (newState.phase === 'waiting_for_blocks') {
              applyActionEffect(newState);
          } else if (newState.phase === 'waiting_for_challenges') {
              if (['steal', 'assassinate'].includes(newState.currentAction?.type || '')) {
                  newState.phase = 'waiting_for_blocks';
                  newState.passedPlayers = [];
                  newState.turnDeadline = now() + (30 * 1000);
              } else {
                  applyActionEffect(newState);
              }
          } else if (newState.phase === 'waiting_for_block_challenges') {
              addLog(newState, 'Система', 'Время вышло. Блок принят.');
              nextTurn(newState);
          }
      }

      return newState;
      });
  };

  const performAction = async (actionType: string, targetId?: string) => {
    if (!userId) return;

    await updateState((current) => {
    // Re-checked against fresh state: a timeout or a leave can have moved the
    // turn on between the button rendering and the write landing.
    if (current.phase !== 'choosing_action') return null;
    if (current.players[current.turnIndex]?.id !== userId) return null;

    const newState: GameState = JSON.parse(JSON.stringify(current));
    const player = newState.players.find(p => p.id === userId);
    if (!player) return null;

    if (targetId) {
        const targetPlayer = newState.players.find(p => p.id === targetId);
        if (!targetPlayer || targetPlayer.isDead) return null;
    }

    const targetName = targetId ? newState.players.find(p => p.id === targetId)?.name : '';

    if (actionType === 'coup') {
      if (player.coins < 7) return null;
      player.coins -= 7;
    } else if (actionType === 'assassinate') {
      if (player.coins < 3) return null;
      player.coins -= 3;
    }

    const action = { type: actionType, player: userId, target: targetId };
    newState.currentAction = action;
    newState.passedPlayers = [];

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
      newState.phase = 'waiting_for_blocks';
    } else {
      newState.phase = 'waiting_for_challenges';
    }

    newState.turnDeadline = now() + RESPONSE_MS;
    return newState;
    });
  };

  /**
   * Retryable, and this is the one that needed it most: once an action is on
   * the table every other player can pass at the same instant, so these writes
   * collide by design. Losing one used to drop that player's pass and leave
   * the table waiting on a response that had already been given.
   */
  const pass = async () => {
    if (!userId) return;

    await updateState((current) => {
    if (!RESPONSE_PHASES.includes(current.phase)) return null;
    if (!current.currentAction) return null;
    if (current.passedPlayers?.includes(userId)) return null; // already passed

    const newState: GameState = JSON.parse(JSON.stringify(current));
    const action = newState.currentAction;
    if (!action) return null;
    if (!newState.passedPlayers) newState.passedPlayers = [];
    newState.passedPlayers.push(userId);

    const activePlayersCount = newState.players.filter(p => !p.isDead).length;
    const allOthersPassed = newState.passedPlayers.length >= (activePlayersCount - 1);
    const isTarget = action.target === userId;

    if (isTarget || allOthersPassed) {
        if (newState.phase === 'waiting_for_challenges') {
             if (['steal', 'assassinate'].includes(action.type)) {
                 newState.phase = 'waiting_for_blocks';
                 newState.passedPlayers = [];
                 newState.turnDeadline = now() + RESPONSE_MS;
             } else {
                 applyActionEffect(newState);
             }
        } else if (newState.phase === 'waiting_for_blocks') {
             applyActionEffect(newState);
        } else if (newState.phase === 'waiting_for_block_challenges') {
             addLog(newState, 'Система', 'Блок принят. Действие отменено.');
             nextTurn(newState);
        }
    }

    return newState;
    });
  };

  const challenge = async () => {
    if (!userId) return;

    await updateState((current) => {
    // Two players can hit "challenge" together; the first one to land owns it,
    // and the phase has moved to losing_influence by the time the second
    // recomputes.
    if (current.phase !== 'waiting_for_challenges' && current.phase !== 'waiting_for_block_challenges') return null;

    const newState: GameState = JSON.parse(JSON.stringify(current));
    const challenger = newState.players.find(p => p.id === userId);
    if (!challenger || !newState.currentAction) return null;

    const isBlockChallenge = newState.phase === 'waiting_for_block_challenges';
    const accusedId = isBlockChallenge ? newState.currentAction.blockedBy : newState.currentAction.player;

    if (challenger.id === accusedId) return null;

    const accused = newState.players.find(p => p.id === accusedId);
    if (!accused) return null;

    addLog(newState, challenger.name, `НЕ ВЕРИТ игроку ${accused.name}!`);

    const requiredRoles = getRequiredRoles(newState.currentAction.type, isBlockChallenge);
    const hasRole = accused.cards.some(c => !c.revealed && requiredRoles.includes(c.role));

    if (hasRole) {
      const cardIdx = accused.cards.findIndex(c => !c.revealed && requiredRoles.includes(c.role));
      const oldRole = accused.cards[cardIdx].role;
      addLog(newState, accused.name, `Показал карту: ${getRoleName(oldRole)}!`);

      newState.deck.push(oldRole);
      newState.deck = shuffleDeck(newState.deck);
      accused.cards[cardIdx].role = newState.deck.pop() as Role;

      newState.phase = 'losing_influence';
      newState.pendingPlayerId = challenger.id;

      newState.currentAction.nextPhase = isBlockChallenge ? 'blocked_end' : 'continue_action';

    } else {
      addLog(newState, accused.name, `БЛЕФОВАЛ! (Нет нужной карты)`);
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = accused.id;

      newState.currentAction.nextPhase = isBlockChallenge ? 'continue_action' : 'action_cancelled';
    }

    newState.turnDeadline = now() + TURN_MS;
    return newState;
    });
  };

  const block = async () => {
    if (!userId) return;

    await updateState((current) => {
    if (current.phase !== 'waiting_for_blocks') return null;

    const newState: GameState = JSON.parse(JSON.stringify(current));
    if (!newState.currentAction) return null;
    // Whoever blocks first owns it — a second blocker arriving a moment later
    // must not overwrite the first.
    if (newState.currentAction.blockedBy) return null;

    newState.currentAction.blockedBy = userId;
    newState.phase = 'waiting_for_block_challenges';
    newState.passedPlayers = [];
    newState.turnDeadline = now() + RESPONSE_MS;

    const blockerName = newState.players.find(p => p.id === userId)?.name || '?';
    addLog(newState, blockerName, `БЛОКИРУЕТ действие`);

    return newState;
    });
  };

  const resolveLoss = async (cardIndex: number) => {
    if (!userId) return;

    await updateState((current) => {
    if (current.phase !== 'losing_influence') return null;

    const newState: GameState = JSON.parse(JSON.stringify(current));

    if (newState.pendingPlayerId !== userId) return null;

    const player = newState.players.find(p => p.id === userId);
    if (!player || player.cards[cardIndex]?.revealed) return null;

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
        if (action.type === 'coup') {
            nextTurn(newState);
        }
        else if (action.type === 'assassinate' && newState.phase === 'losing_influence' && !action.nextPhase) {
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
                 if (action.blockedBy) {
                     addLog(newState, 'Система', 'Блок провалился, действие выполняется');
                     applyActionEffect(newState);
                 } else {
                     if (['steal', 'assassinate'].includes(action.type)) {
                         newState.phase = 'waiting_for_blocks';
                         newState.turnDeadline = now() + (30 * 1000);
                     } else {
                         applyActionEffect(newState);
                     }
                 }
             }
        } else {
          nextTurn(newState);
        }
    }

    return newState;
    });
  };

  const resolveExchange = async (selectedIndices: number[]) => {
      if (!userId) return;

      await updateState((current) => {
      const newState: GameState = JSON.parse(JSON.stringify(current));
      if (newState.phase !== 'resolving_exchange' || newState.pendingPlayerId !== userId) return null;

      const player = newState.players.find(p => p.id === userId);
      if (!player || !newState.exchangeBuffer) return null;

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

      return newState;
      });
  };

  const applyActionEffect = (state: GameState) => {
      const action = state.currentAction;
      if (!action) return;
      const actor = state.players.find(p => p.id === action.player);
      const target = state.players.find(p => p.id === action.target);
      if (!actor) {
          // The actor left the game — do not hang in the phase, advance the turn
          addLog(state, 'Система', 'Автор действия вышел. Действие отменено.');
          nextTurn(state);
          return;
      }

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
                  delete action.nextPhase;
                  addLog(state, 'Система', `Покушение успешно! ${target.name} теряет карту`);
                  state.turnDeadline = now() + (60 * 1000);
              } else {
                  nextTurn(state);
              }
              break;
          case 'exchange': {
              // Guard against an exhausted deck (should not happen, but never hang)
              if (state.deck.length < 2) {
                  addLog(state, 'Система', 'В колоде недостаточно карт для обмена.');
                  nextTurn(state);
                  break;
              }
              const drawn = [state.deck.pop()!, state.deck.pop()!];
              const currentHand = actor.cards.filter(c => !c.revealed).map(c => c.role);
              state.exchangeBuffer = [...currentHand, ...drawn];
              state.phase = 'resolving_exchange';
              state.pendingPlayerId = actor.id;
              state.turnDeadline = now() + (60 * 1000);
              break;
          }
          default:
              nextTurn(state);
      }
  };

  // Self-join when the game is opened via a direct link
  /**
   * Seat the player. Retryable on purpose: an invite link posted in a group
   * chat gets opened by everyone at once, and the old read-then-write form
   * meant whoever lost that race simply never appeared in the room.
   */
  const initGame = async (userProfile: { name: string; avatarUrl: string }) => {
    if (!userId || !lobbyId) return;

    await updateState((current) => {
      if (!Array.isArray(current.players)) return null;
      if (current.players.find(p => p.id === userId)) return null; // already seated
      if (current.status !== 'waiting') return null;
      if (current.players.length >= roomCapacity(GAME, current.settings?.maxPlayers)) return null;

      const newState: GameState = JSON.parse(JSON.stringify(current));
      newState.players.push({
        id: userId,
        name: userProfile.name,
        avatarUrl: userProfile.avatarUrl,
        coins: 2,
        cards: [],
        isDead: false,
        isHost: newState.players.length === 0,
        isReady: true
      });
      return newState;
    });
  };

  const startGame = async () => {
    await updateState((current) => {
      if (current.status !== 'waiting') return null;
      if (current.players.length < 2) return null;

      const shuffled = shuffleDeck(buildDeck());
      const newPlayers = current.players.map(p => ({
        ...p, coins: 2, isDead: false,
        cards: [{ role: shuffled.pop()!, revealed: false }, { role: shuffled.pop()!, revealed: false }]
      }));

      const newState: GameState = {
        ...current, status: 'playing', players: newPlayers, deck: shuffled, turnIndex: 0,
        phase: 'choosing_action', currentAction: null, logs: [], winner: undefined, winnerId: undefined,
        lastActionTime: now(), turnDeadline: now() + TURN_MS,
        startTime: now(),
        passedPlayers: []
        // NOTE: `version` is deliberately inherited from `current` and never
        // reset. It used to be pinned to 1 here, which made the compare-and-swap
        // ask the database for version 1 — true only in a room nobody had
        // joined. As soon as a second player arrived the row was at version 2
        // and every attempt to start was rejected, so the match simply never
        // began. Verified against the live database: the RPC returns false for
        // exactly that call.
      };
      addLog(newState, 'Система', 'Игра началась! Всем удачи.');
      return newState;
    });
  };

  const leaveGame = async () => {
     if (!lobbyId || !userId) return;

     // A finished match is a record, not live state: leaving must not rewrite
     // the results the other players are still looking at. Just walk away —
     // the page navigates us out.
     const snapshot = gameStateRef.current;
     if (!snapshot || snapshot.status === 'finished') return;

     const others = (snapshot.players || []).filter((p: Player) => p.id !== userId);
     if (others.length === 0) {
         await deleteLobby();
         return;
     }

     await updateState((current) => {
         if (current.status === 'finished') return null;

         const newState: GameState = JSON.parse(JSON.stringify(current));
         const wasHost = newState.players.find((p: Player) => p.id === userId)?.isHost;
         const leaverIdx = newState.players.findIndex((p: Player) => p.id === userId);
         if (leaverIdx === -1) return null;
         const wasCurrentTurn = leaverIdx === newState.turnIndex;

         newState.players = newState.players.filter((p: Player) => p.id !== userId);

         if (newState.players.length === 0) return null;

         if (wasHost) {
            newState.players[0].isHost = true;
            addLog(newState, 'Система', `Хост вышел. Новый хост: ${newState.players[0].name}`);
         }

         if (newState.status === 'playing') {
             addLog(newState, 'Система', 'Игрок покинул матч');

             // Re-base the turn index after removing the player from the array
             if (leaverIdx !== -1 && leaverIdx < newState.turnIndex) {
                 newState.turnIndex--;
             }
             if (newState.turnIndex >= newState.players.length) {
                 newState.turnIndex = 0;
             }

             const alivePlayers = newState.players.filter((p: Player) => !p.isDead);
             if (alivePlayers.length === 1) {
                 newState.status = 'finished';
                 newState.winner = alivePlayers[0].name;
                 newState.winnerId = alivePlayers[0].id;
                 addLog(newState, '🏆', `Победитель: ${newState.winner}!`);
             } else {
                 // If the leaver was involved in the current action (acting, targeted,
                 // blocking, or pending a card loss) — reset the phase to a fresh turn
                 const action = newState.currentAction;
                 const wasInvolved = wasCurrentTurn ||
                     newState.pendingPlayerId === userId ||
                     action?.player === userId ||
                     action?.target === userId ||
                     action?.blockedBy === userId;

                 if (wasInvolved) {
                     while (newState.players[newState.turnIndex].isDead) {
                         newState.turnIndex = (newState.turnIndex + 1) % newState.players.length;
                     }
                     newState.phase = 'choosing_action';
                     newState.currentAction = null;
                     newState.pendingPlayerId = undefined;
                     newState.exchangeBuffer = undefined;
                     newState.passedPlayers = [];
                     newState.turnDeadline = now() + TURN_MS;
                 }
             }
         }
         return newState;
     });
  };

  // TRACK GAME END TO RECORD STATISTICS
  useEffect(() => {
      if (gameState?.status === 'finished' && userId && !lobbyDeleted) {
          const me = gameState.players.find(p => p.id === userId);
          // The winner is identified by id (robust to duplicate names);
          // falls back to "I am alive" for legacy states without winnerId
          const isWinner = gameState.winnerId ? gameState.winnerId === userId : (me && !me.isDead);

          if (me) {
              // Actual match duration; 900s fallback for legacy states
              const duration = gameState.startTime
                  ? Math.max(1, Math.round((now() - gameState.startTime) / 1000))
                  : 900;
              updatePlayerStats(userId, {
                  gameType: 'coup',
                  result: isWinner ? 'win' : 'loss',
                  durationSeconds: duration
              });
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the match finishes; adding gameState.players would re-record stats
  }, [gameState?.status, userId, lobbyDeleted]);

  return { gameState, roomMeta, loading, lobbyDeleted, initGame, performAction, startGame, leaveGame, pass, challenge, block, resolveLoss, resolveExchange, skipTurn };
}