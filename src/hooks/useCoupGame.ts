import { useEffect } from 'react';
import { GameState, Player, Role } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';
import { SYSTEM, type LocalizedText } from '@/types/coup';
import { updatePlayerStats } from '@/lib/playerStats';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { requireGame, roomCapacity } from '@/games/registry';
import { randomIndex } from '@/lib/turnOrder';
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

  // Written once into the shared state and read by players in either
  // language, so every entry carries both.
  const addLog = (state: GameState, user: string, action: LocalizedText) => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute:'2-digit' });
    state.logs.unshift({ user, action, time });
    state.logs = state.logs.slice(0, 50);
  };

  const roleName = (role: Role): LocalizedText => ({
    ru: DICTIONARY.ru.roles[role]?.name || role,
    en: DICTIONARY.en.roles[role]?.name || role
  });

  const nextTurn = (state: GameState) => {
    const alivePlayers = state.players.filter(p => !p.isDead);
    if (alivePlayers.length <= 1) {
      state.status = 'finished';
      state.winner = alivePlayers[0]?.name || 'Unknown';
      state.winnerId = alivePlayers[0]?.id;
      state.phase = 'choosing_action';
      state.turnDeadline = undefined;
      addLog(state, '🏆', { ru: `Победитель: ${state.winner}!`, en: `Winner: ${state.winner}!` });
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
    state.turnDeadline = now() + TURN_MS;
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
             addLog(newState, SYSTEM, { ru: `${culprit.name} выбывает за бездействие`, en: `${culprit.name} was removed for being idle` });
             dropPlayer(newState, culpritId);
          }
      }
      else if (['waiting_for_challenges', 'waiting_for_blocks', 'waiting_for_block_challenges'].includes(newState.phase)) {
          if (newState.phase === 'waiting_for_blocks') {
              applyActionEffect(newState);
          } else if (newState.phase === 'waiting_for_challenges') {
              if (['steal', 'assassinate'].includes(newState.currentAction?.type || '')) {
                  newState.phase = 'waiting_for_blocks';
                  newState.passedPlayers = [];
                  newState.turnDeadline = now() + RESPONSE_MS;
              } else {
                  applyActionEffect(newState);
              }
          } else if (newState.phase === 'waiting_for_block_challenges') {
              addLog(newState, SYSTEM, { ru: 'Время вышло. Блок принят.', en: 'Time is up. The block stands.' });
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
        case 'income': addLog(newState, player.name, { ru: 'Взял доход (+1)', en: 'Took income (+1)' }); break;
        case 'foreign_aid': addLog(newState, player.name, { ru: 'Хочет взять помощь (+2)', en: 'Wants foreign aid (+2)' }); break;
        case 'tax': addLog(newState, player.name, { ru: 'Объявил налог (+3) — Герцог', en: 'Claims tax (+3) — Duke' }); break;
        case 'steal': addLog(newState, player.name, { ru: `Хочет украсть у ${targetName} — Капитан`, en: `Wants to steal from ${targetName} — Captain` }); break;
        case 'exchange': addLog(newState, player.name, { ru: 'Хочет сменить карты — Посол', en: 'Wants to exchange cards — Ambassador' }); break;
        case 'assassinate': addLog(newState, player.name, { ru: `Платит убийце за ${targetName} (−3)`, en: `Pays an assassin for ${targetName} (−3)` }); break;
        case 'coup': addLog(newState, player.name, { ru: `Устраивает переворот против ${targetName}!`, en: `Launches a coup against ${targetName}!` }); break;
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

    if (action.target === userId || allOthersPassed(newState)) settleUnanswered(newState);

    return newState;
    });
  };

  /** Everyone who could answer the action on the table has passed. */
  const allOthersPassed = (state: GameState) => {
    const activePlayersCount = state.players.filter(p => !p.isDead).length;
    return (state.passedPlayers?.length ?? 0) >= activePlayersCount - 1;
  };

  /** Moves a response phase on as if nobody objected. */
  const settleUnanswered = (state: GameState) => {
    const action = state.currentAction;
    if (!action) return;
    if (state.phase === 'waiting_for_challenges') {
         if (['steal', 'assassinate'].includes(action.type)) {
             state.phase = 'waiting_for_blocks';
             state.passedPlayers = [];
             state.turnDeadline = now() + RESPONSE_MS;
         } else {
             applyActionEffect(state);
         }
    } else if (state.phase === 'waiting_for_blocks') {
         applyActionEffect(state);
    } else if (state.phase === 'waiting_for_block_challenges') {
         addLog(state, SYSTEM, { ru: 'Блок принят. Действие отменено.', en: 'Block accepted. The action is cancelled.' });
         nextTurn(state);
    }
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

    addLog(newState, challenger.name, { ru: `Не верит игроку ${accused.name}!`, en: `Challenges ${accused.name}!` });

    const requiredRoles = getRequiredRoles(newState.currentAction.type, isBlockChallenge);
    const hasRole = accused.cards.some(c => !c.revealed && requiredRoles.includes(c.role));

    if (hasRole) {
      const cardIdx = accused.cards.findIndex(c => !c.revealed && requiredRoles.includes(c.role));
      const oldRole = accused.cards[cardIdx].role;
      addLog(newState, accused.name, { ru: `Показал карту: ${roleName(oldRole).ru}!`, en: `Shows a card: ${roleName(oldRole).en}!` });

      newState.deck.push(oldRole);
      newState.deck = shuffleDeck(newState.deck);
      accused.cards[cardIdx].role = newState.deck.pop() as Role;

      newState.phase = 'losing_influence';
      newState.pendingPlayerId = challenger.id;

      newState.currentAction.nextPhase = isBlockChallenge ? 'blocked_end' : 'continue_action';

    } else {
      addLog(newState, accused.name, { ru: 'Блефовал — нужной карты нет!', en: 'Was bluffing — no such card!' });
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
    addLog(newState, blockerName, { ru: 'Блокирует действие', en: 'Blocks the action' });

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
    const lostRole = roleName(player.cards[cardIndex].role);
    addLog(newState, player.name, { ru: `Сбросил карту: ${lostRole.ru}`, en: `Lost a card: ${lostRole.en}` });

    if (player.cards.every(c => c.revealed)) {
       player.isDead = true;
       player.coins = 0;
       addLog(newState, player.name, { ru: 'Выбывает из игры ☠️', en: 'Is out of the game ☠️' });
    }

    afterCardLost(newState);
    return newState;
    });
  };

  /**
   * Carries the action on once the card owed has been given up: the
   * challenge that caused it decides whether the action, or the block against
   * it, goes ahead. Also used when the player owing the card walks out.
   */
  const afterCardLost = (state: GameState) => {
    const action = state.currentAction;
    if (!action) {
       nextTurn(state);
    } else {
        if (action.type === 'coup') {
            nextTurn(state);
        }
        else if (action.type === 'assassinate' && state.phase === 'losing_influence' && !action.nextPhase) {
            nextTurn(state);
        }
        else if (action.nextPhase) {
             const next = action.nextPhase;
             delete action.nextPhase;

             if (next === 'action_cancelled') {
                 addLog(state, SYSTEM, { ru: 'Действие отменено', en: 'The action is cancelled' });
                 nextTurn(state);
             } else if (next === 'blocked_end') {
                 addLog(state, SYSTEM, { ru: 'Блок устоял, действие отменено', en: 'The block holds, the action is cancelled' });
                 nextTurn(state);
             } else if (next === 'continue_action') {
                 if (action.blockedBy) {
                     addLog(state, SYSTEM, { ru: 'Блок не устоял, действие выполняется', en: 'The block fails, the action goes ahead' });
                     applyActionEffect(state);
                 } else {
                     if (['steal', 'assassinate'].includes(action.type)) {
                         // A fresh window: passes given before the challenge
                         // answered a different question.
                         state.phase = 'waiting_for_blocks';
                         state.pendingPlayerId = undefined;
                         state.passedPlayers = [];
                         state.turnDeadline = now() + RESPONSE_MS;
                     } else {
                         applyActionEffect(state);
                     }
                 }
             }
        } else {
          nextTurn(state);
        }
    }
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
      addLog(newState, player.name, { ru: 'Обменял карты', en: 'Exchanged cards' });
      nextTurn(newState);

      return newState;
      });
  };

  const passHost = (state: GameState, leaver: Player) => {
    if (!leaver.isHost || state.players.length === 0) return;
    state.players[0].isHost = true;
    addLog(state, SYSTEM, { ru: `Хост вышел. Новый хост: ${state.players[0].name}`, en: `The host left. New host: ${state.players[0].name}` });
  };

  /** A fresh turn for whoever sits at `turnIndex`, skipping the dead. */
  const startTurn = (state: GameState) => {
    while (state.players[state.turnIndex].isDead) {
      state.turnIndex = (state.turnIndex + 1) % state.players.length;
    }
    state.phase = 'choosing_action';
    state.currentAction = null;
    state.pendingPlayerId = undefined;
    state.exchangeBuffer = undefined;
    state.passedPlayers = [];
    state.turnDeadline = now() + TURN_MS;
  };

  /**
   * Takes a player out of a running match — they left, or the clock removed
   * them — and carries the table on from where it was. What happens to the
   * action on the table depends on the part they had in it:
   *
   * - their own turn: it goes with them, and the next player moves;
   * - the action was aimed at them: nothing is left to act on, the turn passes;
   * - they blocked someone else's action: the block goes with them;
   * - they lost a challenge and still owed a card: the challenge has already
   *   decided the outcome, so it is carried out as if the card had been given;
   * - they could only answer: their silence no longer holds the table up.
   *
   * Leaving used to reset every one of these to a fresh turn for the player
   * who acted, which handed them a second turn and undid claims they had
   * already proved.
   */
  const dropPlayer = (state: GameState, id: string) => {
    const idx = state.players.findIndex(p => p.id === id);
    if (idx === -1) return;
    const leaver = state.players[idx];
    const action = state.currentAction;
    const wasTurn = idx === state.turnIndex;
    const wasTarget = action?.target === id;
    const wasBlocker = action?.blockedBy === id;
    const owedCard = state.phase === 'losing_influence' && state.pendingPlayerId === id;

    // The hand leaves with its owner; the two cards an exchange drew go back.
    if (wasTurn && state.exchangeBuffer) {
      const live = leaver.cards.filter(c => !c.revealed).length;
      state.deck = shuffleDeck([...state.deck, ...state.exchangeBuffer.slice(live)]);
    }

    state.players.splice(idx, 1);
    if (idx < state.turnIndex) state.turnIndex--;
    if (state.turnIndex >= state.players.length) state.turnIndex = 0;
    state.passedPlayers = (state.passedPlayers || []).filter(p => p !== id);
    passHost(state, leaver);

    if (state.players.filter(p => !p.isDead).length <= 1) {
      nextTurn(state); // declares the winner
      return;
    }

    if (wasTurn) {
      startTurn(state);
    } else if (wasTarget) {
      addLog(state, SYSTEM, { ru: 'Цель вышла из игры — действие отменено', en: 'The target has left — the action is cancelled' });
      nextTurn(state);
    } else if (wasBlocker) {
      addLog(state, SYSTEM, { ru: 'Блокирующий вышел — действие выполняется', en: 'The blocker has left — the action goes ahead' });
      applyActionEffect(state);
    } else if (owedCard) {
      state.pendingPlayerId = undefined;
      afterCardLost(state);
    } else if (RESPONSE_PHASES.includes(state.phase) && allOthersPassed(state)) {
      settleUnanswered(state);
    }
  };

  const applyActionEffect = (state: GameState) => {
      const action = state.currentAction;
      if (!action) return;
      const actor = state.players.find(p => p.id === action.player);
      const target = state.players.find(p => p.id === action.target);
      if (!actor) {
          // The actor left the game — do not hang in the phase, advance the turn
          addLog(state, SYSTEM, { ru: 'Автор действия вышел. Действие отменено.', en: 'The player acting has left. The action is cancelled.' });
          nextTurn(state);
          return;
      }

      switch(action.type) {
          case 'tax':
              actor.coins += 3;
              addLog(state, actor.name, { ru: 'Получил налог (+3)', en: 'Collected tax (+3)' });
              nextTurn(state);
              break;
          case 'foreign_aid':
              actor.coins += 2;
              addLog(state, actor.name, { ru: 'Получил помощь (+2)', en: 'Collected foreign aid (+2)' });
              nextTurn(state);
              break;
          case 'steal':
              if (target) {
                  const amount = Math.min(2, target.coins);
                  target.coins -= amount;
                  actor.coins += amount;
                  addLog(state, actor.name, { ru: `Украл ${amount} у ${target.name}`, en: `Stole ${amount} from ${target.name}` });
              }
              nextTurn(state);
              break;
          case 'assassinate':
              if (target) {
                  state.phase = 'losing_influence';
                  state.pendingPlayerId = target.id;
                  delete action.nextPhase;
                  addLog(state, SYSTEM, { ru: `Покушение удалось! ${target.name} теряет карту`, en: `The assassination succeeds! ${target.name} loses a card` });
                  state.turnDeadline = now() + TURN_MS;
              } else {
                  nextTurn(state);
              }
              break;
          case 'exchange': {
              // Guard against an exhausted deck (should not happen, but never hang)
              if (state.deck.length < 2) {
                  addLog(state, SYSTEM, { ru: 'В колоде не хватает карт для обмена.', en: 'Not enough cards in the deck to exchange.' });
                  nextTurn(state);
                  break;
              }
              const drawn = [state.deck.pop()!, state.deck.pop()!];
              const currentHand = actor.cards.filter(c => !c.revealed).map(c => c.role);
              state.exchangeBuffer = [...currentHand, ...drawn];
              state.phase = 'resolving_exchange';
              state.pendingPlayerId = actor.id;
              state.turnDeadline = now() + TURN_MS;
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
        ...current, status: 'playing', players: newPlayers, deck: shuffled,
        // A random player opens rather than always the host.
        turnIndex: randomIndex(newPlayers.length),
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
      addLog(newState, SYSTEM, { ru: 'Игра началась! Всем удачи.', en: 'The game has started. Good luck!' });
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
         const leaver = newState.players.find((p: Player) => p.id === userId);
         if (!leaver || newState.players.length === 1) return null;

         if (newState.status === 'playing') {
             addLog(newState, SYSTEM, { ru: `${leaver.name} покинул матч`, en: `${leaver.name} left the match` });
             dropPlayer(newState, userId);
         } else {
             newState.players = newState.players.filter((p: Player) => p.id !== userId);
             passHost(newState, leaver);
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