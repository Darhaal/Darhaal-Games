// hooks/useCoupGame.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';

const TURN_DURATION_SEC = 60;

// Fisher-Yates Shuffle
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

  // --- 1. Sync & Locking ---

  const updateState = async (newState: GameState) => {
    if (!lobbyId) return;

    // Optimistic Locking: Increment version
    newState.version = (newState.version || 0) + 1;
    newState.lastActionTime = Date.now();

    // Optimistic UI Update
    setGameState(newState);

    const { error } = await supabase
        .from('lobbies')
        .update({ game_state: newState })
        .eq('id', lobbyId);

    if (error) {
        console.error("Coup state update failed:", error);
        fetchLobbyState();
    }
  };

  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data } = await supabase.from('lobbies').select('name, code, host_id, game_state').eq('id', lobbyId).single();
      if (data) {
        setRoomMeta({ name: data.name, code: data.code, isHost: data.host_id === userId });
        if (data.game_state) setGameState(data.game_state);
      } else {
        setGameState(null);
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
                const newState = payload.new.game_state;
                // Accept update if:
                // 1. We are in waiting room (players joining)
                // 2. The incoming version is newer than ours
                if (newState.status === 'waiting' || !prev || (newState.version || 0) > (prev.version || 0)) {
                    return newState;
                }
                return prev;
            });
          }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      () => setGameState(null))
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [lobbyId, fetchLobbyState]);

  // --- 2. Logic Helpers ---

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

    // Set timer for next player
    state.turnDeadline = Date.now() + (TURN_DURATION_SEC * 1000);
  };

  // --- 3. Actions ---

  const performAction = async (actionType: string, targetId?: string) => {
    const { gameState } = stateRef.current;
    if (!gameState || !userId) return;

    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const player = newState.players.find(p => p.id === userId);
    if (!player) return;

    // Validation
    if (actionType === 'coup') {
      if (player.coins < 7) return;
      player.coins -= 7;
    } else if (actionType === 'assassinate') {
      if (player.coins < 3) return;
      player.coins -= 3;
    }

    const targetName = targetId ? newState.players.find(p => p.id === targetId)?.name : '';
    const action = { type: actionType, player: userId, target: targetId };
    newState.currentAction = action;

    // Logs & Phase Transition
    switch (actionType) {
        case 'income':
            addLog(newState, player.name, 'Взял Доход (+1)');
            player.coins++;
            nextTurn(newState);
            break;
        case 'foreign_aid':
            addLog(newState, player.name, 'Хочет взять Помощь (+2)');
            newState.phase = 'waiting_for_blocks';
            newState.turnDeadline = Date.now() + (30 * 1000); // Shorter time for reactions
            break;
        case 'tax':
            addLog(newState, player.name, 'Объявил Налог (+3) (Герцог)');
            newState.phase = 'waiting_for_challenges';
            newState.turnDeadline = Date.now() + (30 * 1000);
            break;
        case 'steal':
            addLog(newState, player.name, `Хочет украсть у ${targetName} (Капитан)`);
            newState.phase = 'waiting_for_challenges';
            newState.turnDeadline = Date.now() + (30 * 1000);
            break;
        case 'exchange':
            addLog(newState, player.name, 'Хочет сменить карты (Посол)');
            newState.phase = 'waiting_for_challenges';
            newState.turnDeadline = Date.now() + (30 * 1000);
            break;
        case 'assassinate':
            addLog(newState, player.name, `Платит убийце за ${targetName} (-3)`);
            newState.phase = 'waiting_for_challenges';
            newState.turnDeadline = Date.now() + (30 * 1000);
            break;
        case 'coup':
            addLog(newState, player.name, `УСТРАИВАЕТ ПЕРЕВОРОТ против ${targetName}!`);
            newState.phase = 'losing_influence';
            newState.pendingPlayerId = targetId;
            newState.turnDeadline = Date.now() + (TURN_DURATION_SEC * 1000);
            break;
    }

    await updateState(newState);
  };

  const pass = async () => {
    const { gameState } = stateRef.current;
    if (!gameState) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));

    // Logic to count passes could be added here for strict rules,
    // but typically for online play, we just auto-resolve if everyone passes.
    // For MVP, we assume if YOU pass, and you were the only blocker possible, it proceeds.
    // Simplifying: The 'Pass' button is usually just local UI hiding, unless we track votes.
    // BETTER MVP LOGIC: Timer handles "no one objected".
    // Active interaction: If logic requires explicit pass, we'd need a 'votes' array.
    // Current Simpler Logic:
    // If it's a reaction phase, and I am the target/victim, my 'pass' might allow action.

    // To keep it robust without voting array:
    // The Pass button effectively does nothing but hide the UI for that user locally (handled in UI component),
    // OR if I am the specific target (e.g. Steal), my pass allows the action immediately.

    if (newState.currentAction?.target === userId) {
        // If I am the target and I pass, the action succeeds immediately (skip waiting for others)
        applyActionEffect(newState);
    }

    // We update state only if we actually changed something (like skipping wait).
    // If we just clicked pass as a bystander, we do nothing to DB.
    if (newState.currentAction?.target === userId) {
        await updateState(newState);
    }
  };

  const challenge = async () => {
    const { gameState, userId } = stateRef.current;
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const challenger = newState.players.find(p => p.id === userId);
    if (!challenger || !newState.currentAction) return;

    const isBlockChallenge = newState.phase === 'waiting_for_block_challenges';
    const accusedId = isBlockChallenge ? newState.currentAction.blockedBy : newState.currentAction.player;

    if (challenger.id === accusedId) return;

    const accused = newState.players.find(p => p.id === accusedId);
    if (!accused) return;

    addLog(newState, challenger.name, `НЕ ВЕРИТ игроку ${accused.name}!`);

    const requiredRoles = getRequiredRoles(newState.currentAction.type, isBlockChallenge);
    const hasRole = accused.cards.some(c => !c.revealed && requiredRoles.includes(c.role));

    if (hasRole) {
      // Accused proves innocence
      const cardIdx = accused.cards.findIndex(c => !c.revealed && requiredRoles.includes(c.role));
      const oldRole = accused.cards[cardIdx].role;
      addLog(newState, accused.name, `Показал карту: ${getRoleName(oldRole)}!`);

      // Swap card
      newState.deck.push(oldRole);
      newState.deck = shuffleDeck(newState.deck);
      accused.cards[cardIdx].role = newState.deck.pop() as Role;

      // Challenger loses influence
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = challenger.id;
      newState.turnDeadline = Date.now() + (TURN_DURATION_SEC * 1000);

      // Action continues (if it wasn't a block challenge that failed)
      // If Block was challenged and Block was true -> Action is blocked.
      // If Action was challenged and Action was true -> Action proceeds.
      newState.currentAction.nextPhase = isBlockChallenge ? 'blocked_end' : 'continue_action';

    } else {
      // Accused lied
      addLog(newState, accused.name, `БЛЕФОВАЛ! (Нет карты)`);
      newState.phase = 'losing_influence';
      newState.pendingPlayerId = accused.id;
      newState.turnDeadline = Date.now() + (TURN_DURATION_SEC * 1000);

      // If Block was challenged and Block was lie -> Block fails, Action proceeds.
      // If Action was challenged and Action was lie -> Action fails.
      newState.currentAction.nextPhase = isBlockChallenge ? 'continue_action' : 'action_cancelled';
    }

    await updateState(newState);
  };

  const block = async () => {
    const { gameState, userId } = stateRef.current;
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    if (!newState.currentAction) return;

    // Prevent double block
    if (newState.currentAction.blockedBy) return;

    newState.currentAction.blockedBy = userId;
    newState.phase = 'waiting_for_block_challenges';
    newState.turnDeadline = Date.now() + (30 * 1000); // Time to challenge the block

    const blockerName = newState.players.find(p => p.id === userId)?.name || '?';
    addLog(newState, blockerName, `БЛОКИРУЕТ действие`);

    await updateState(newState);
  };

  const resolveLoss = async (cardIndex: number) => {
    const { gameState, userId } = stateRef.current;
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));

    if (newState.pendingPlayerId !== userId) return;

    const player = newState.players.find(p => p.id === userId);
    if (!player || player.cards[cardIndex].revealed) return;

    player.cards[cardIndex].revealed = true;
    const lostRole = getRoleName(player.cards[cardIndex].role);
    addLog(newState, player.name, `СБРОСИЛ КАРТУ: ${lostRole}`);

    // Check death
    if (player.cards.every(c => c.revealed)) {
       player.isDead = true;
       player.coins = 0;
       addLog(newState, player.name, 'Выбывает из игры ☠️');
    }

    // Handle what happens next based on 'nextPhase' flag stored during challenge
    const action = newState.currentAction;
    if (!action) {
       nextTurn(newState);
    } else {
        if (action.type === 'coup') {
            nextTurn(newState);
        }
        else if (action.type === 'assassinate' && newState.phase === 'losing_influence' && !action.nextPhase) {
            // Victim lost card from assassination payment. Now turn ends.
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
                 if (['steal', 'assassinate'].includes(action.type) && !action.blockedBy) {
                     // If we successfully challenged a block, or survived a challenge on stealing
                     // For steal/assassinate, we might still need to wait for blocks if we just survived a challenge on the action itself.
                     // But if 'nextPhase' was set, it implies we resolved the immediate dispute.
                     // Simplified: If action confirmed true, apply it.
                     applyActionEffect(newState);
                 } else {
                     applyActionEffect(newState);
                 }
             }
        } else {
          nextTurn(newState);
        }
    }

    await updateState(newState);
  };

  const resolveExchange = async (selectedIndices: number[]) => {
      const { gameState, userId } = stateRef.current;
      if (!gameState || !userId) return;
      const newState: GameState = JSON.parse(JSON.stringify(gameState));

      const player = newState.players.find(p => p.id === userId);
      if (!player || !newState.exchangeBuffer) return;

      const buffer = newState.exchangeBuffer;
      let selectionPtr = 0;

      // Update player hand
      for (let i = 0; i < player.cards.length; i++) {
          if (!player.cards[i].revealed) {
              if (selectionPtr < selectedIndices.length) {
                  const bufferIndex = selectedIndices[selectionPtr];
                  player.cards[i].role = buffer[bufferIndex];
                  selectionPtr++;
              }
          }
      }

      // Return rest to deck
      const remainingRoles = buffer.filter((_, idx) => !selectedIndices.includes(idx));
      newState.deck.push(...remainingRoles);
      newState.deck = shuffleDeck(newState.deck);

      newState.exchangeBuffer = undefined;
      addLog(newState, player.name, 'Обменял карты');
      nextTurn(newState);

      await updateState(newState);
  };

  // Helper to execute action results
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
                  // Clear nextPhase so resolving loss doesn't loop
                  delete action.nextPhase;
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
              // Timer for exchange
              state.turnDeadline = Date.now() + (TURN_DURATION_SEC * 1000);
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

  const startGame = async () => {
    const { gameState } = stateRef.current;
    if (!gameState) return;
    const roles: Role[] = ['duke', 'duke', 'duke', 'assassin', 'assassin', 'assassin', 'captain', 'captain', 'captain', 'ambassador', 'ambassador', 'ambassador', 'contessa', 'contessa', 'contessa'];
    const shuffled = shuffleDeck(roles);

    const newPlayers = gameState.players.map(p => ({
      ...p, coins: 2, isDead: false,
      cards: [{ role: shuffled.pop()!, revealed: false }, { role: shuffled.pop()!, revealed: false }]
    }));

    const newState: GameState = {
      ...gameState, status: 'playing', players: newPlayers, deck: shuffled, turnIndex: 0,
      phase: 'choosing_action', currentAction: null, logs: [], winner: undefined,
      lastActionTime: Date.now(), version: 1,
      turnDeadline: Date.now() + (TURN_DURATION_SEC * 1000)
    };
    addLog(newState, 'Система', 'Игра началась! Всем удачи.');
    await updateState(newState);
  };

  const leaveGame = async () => {
     const { gameState, userId, lobbyId } = stateRef.current;
     if (!lobbyId || !userId || !gameState) return;

     // 3. Lobby Consistency
     const newState = JSON.parse(JSON.stringify(gameState));
     newState.players = newState.players.filter((p: Player) => p.id !== userId);

     if (newState.players.length === 0) {
         await supabase.from('lobbies').delete().eq('id', lobbyId);
     } else {
         if (roomMeta?.isHost) {
            newState.players[0].isHost = true;
            addLog(newState, 'Система', `Хост вышел. Новый хост: ${newState.players[0].name}`);
         }
         addLog(newState, 'Система', 'Игрок покинул матч');
         await updateState(newState);
     }
  };

  // Timeout Handling (Simple Auto-Pass/Skip)
  const skipTurn = async () => {
      const { gameState } = stateRef.current;
      if (!gameState) return;
      const newState: GameState = JSON.parse(JSON.stringify(gameState));
      addLog(newState, 'Система', 'Время вышло! Пропуск хода.');
      nextTurn(newState);
      await updateState(newState);
  };

  return { gameState, roomMeta, loading, performAction, startGame, leaveGame, pass, challenge, block, resolveLoss, resolveExchange, skipTurn };
}