import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role } from '@/types/coup';

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

  const addLog = (state: GameState, user: string, action: string) => {
    state.logs.unshift({ user, action, time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit' }) });
    state.logs = state.logs.slice(0, 50);
  };

  const nextTurn = (state: GameState) => {
    const alivePlayers = state.players.filter(p => !p.isDead);
    if (alivePlayers.length === 1) {
      state.status = 'finished';
      state.winner = alivePlayers[0].name;
      state.phase = 'choosing_action';
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
      newState.pendingPlayerId = targetId;
    } else if (actionType === 'foreign_aid') {
      newState.phase = 'waiting_for_blocks';
    } else {
      newState.phase = 'waiting_for_challenges';
    }

    await updateState(newState);
  };

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

    const requiredRole = getRequiredRole(newState.currentAction.type, isBlockChallenge);
    const hasRole = accused.cards.some(c => !c.revealed && c.role === requiredRole);

    if (hasRole) {
      addLog(newState, accused.name, `Revealed ${requiredRole}!`);

      const cardIdx = accused.cards.findIndex(c => !c.revealed && c.role === requiredRole);
      const oldRole = accused.cards[cardIdx].role;
      newState.deck.push(oldRole);
      newState.deck.sort(() => Math.random() - 0.5);
      accused.cards[cardIdx].role = newState.deck.pop() as Role;

      newState.phase = 'losing_influence';
      newState.pendingPlayerId = challenger.id;
      newState.currentAction.nextPhase = isBlockChallenge ? 'blocked_end' : 'continue_action';

    } else {
      addLog(newState, accused.name, `Caught bluffing! (No ${requiredRole})`);

      newState.phase = 'losing_influence';
      newState.pendingPlayerId = accused.id;
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

  const resolveLoss = async (cardIndex: number) => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));

    if (newState.pendingPlayerId !== userId) return;

    const player = newState.players.find(p => p.id === userId);
    if (!player || player.cards[cardIndex].revealed) return;

    player.cards[cardIndex].revealed = true;
    addLog(newState, player.name, `Lost influence: ${player.cards[cardIndex].role}`);

    if (player.cards.every(c => c.revealed)) {
       player.isDead = true;
       player.coins = 0;
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

             if (next === 'action_cancelled' || next === 'blocked_end') {
                 nextTurn(newState);
             } else if (next === 'continue_action') {
                 if (['steal', 'assassinate'].includes(action.type) && !action.blockedBy) {
                     newState.phase = 'waiting_for_blocks';
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

  const resolveExchange = async (selectedRoles: Role[]) => {
      if (!gameState || !userId) return;
      const newState: GameState = JSON.parse(JSON.stringify(gameState));
      if (newState.phase !== 'resolving_exchange' || newState.pendingPlayerId !== userId) return;

      const player = newState.players.find(p => p.id === userId);
      if (!player || !newState.exchangeBuffer) return;

      let selectedIdx = 0;
      for (let i = 0; i < player.cards.length; i++) {
          if (!player.cards[i].revealed) {
              player.cards[i].role = selectedRoles[selectedIdx];
              selectedIdx++;
          }
      }

      const usedRoles = [...selectedRoles];
      const rolesToReturn: Role[] = [];
      const buffer = [...newState.exchangeBuffer];

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