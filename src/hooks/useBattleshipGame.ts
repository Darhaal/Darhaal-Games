// hooks/useBattleshipGame.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BattleshipState, Ship, Coordinate, Orientation, FLEET_CONFIG } from '@/types/battleship';

const BOARD_SIZE = 10;
const TURN_DURATION_SEC = 60;

const getKey = (x: number, y: number) => `${x},${y}`;
const isValidCoord = (x: number, y: number) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

const getShipCoords = (ship: Ship): Coordinate[] => {
  const coords: Coordinate[] = [];
  for (let i = 0; i < ship.size; i++) {
    coords.push({
      x: ship.orientation === 'horizontal' ? ship.position.x + i : ship.position.x,
      y: ship.orientation === 'vertical' ? ship.position.y + i : ship.position.y,
    });
  }
  return coords;
};

// Check placement rules (boundaries, collision, buffer zone)
export const checkPlacement = (ships: Ship[], newShip: Ship, ignoreShipId?: string): boolean => {
  const newShipCoords = getShipCoords(newShip);
  for (const c of newShipCoords) {
    if (!isValidCoord(c.x, c.y)) return false;
  }

  const dangerZone = new Set<string>();
  const otherShips = ships.filter(s => s.id !== newShip.id && s.id !== ignoreShipId);

  otherShips.forEach(s => {
    getShipCoords(s).forEach(coord => {
      // 3x3 buffer around every ship segment
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          dangerZone.add(getKey(coord.x + dx, coord.y + dy));
        }
      }
    });
  });

  for (const c of newShipCoords) {
    if (dangerZone.has(getKey(c.x, c.y))) return false;
  }
  return true;
};

const shuffleFleet = (): Ship[] => {
  const ships: Ship[] = [];
  let attempts = 0;
  while (ships.length < 10 && attempts < 200) {
    ships.length = 0;
    let success = true;
    for (const config of FLEET_CONFIG) {
      for (let i = 0; i < config.count; i++) {
        let placed = false;
        let innerAttempts = 0;
        while (!placed && innerAttempts < 100) {
          const orientation: Orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';
          const x = Math.floor(Math.random() * BOARD_SIZE);
          const y = Math.floor(Math.random() * BOARD_SIZE);
          const newShip: Ship = {
            id: `${config.type}-${i}-${Math.random()}`,
            type: config.type,
            size: config.size,
            orientation,
            position: { x, y },
            hits: 0
          };
          if (checkPlacement(ships, newShip)) {
            ships.push(newShip);
            placed = true;
          }
          innerAttempts++;
        }
        if (!placed) { success = false; break; }
      }
      if (!success) break;
    }
    if (success) return ships;
    attempts++;
  }
  return [];
};

export function useBattleshipGame(
    lobbyId: string | null,
    user: { id: string; name: string; avatarUrl: string } | null
) {
  const [gameState, setGameState] = useState<BattleshipState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [myShips, setMyShips] = useState<Ship[]>([]);
  const [loading, setLoading] = useState(true);

  const stateRef = useRef<{ lobbyId: string | null; user: typeof user; gameState: BattleshipState | null }>({
    lobbyId, user, gameState: null
  });

  useEffect(() => {
    stateRef.current = { lobbyId, user, gameState };
  }, [lobbyId, user, gameState]);

  // --- STATE SYNC & OPTIMISTIC LOCKING ---

  const updateState = async (newState: BattleshipState) => {
    if (!lobbyId) return;

    // Increment version
    newState.version = (newState.version || 0) + 1;
    newState.lastActionTime = Date.now();

    setGameState(newState);

    const { error } = await supabase
        .from('lobbies')
        .update({ game_state: newState })
        .eq('id', lobbyId);

    if (error) {
        console.error("State update failed:", error);
        fetchLobbyState(); // Revert on failure
    }
  };

  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data } = await supabase.from('lobbies').select('name, code, host_id, game_state').eq('id', lobbyId).single();
      if (data) {
        setRoomMeta({ name: data.name, code: data.code, isHost: data.host_id === user?.id });
        if (data.game_state) {
           setGameState(data.game_state);
           if (user?.id && data.game_state.players) {
              const p = data.game_state.players[user.id];
              if (p?.ships) setMyShips(p.ships);
           }
        }
      } else {
          setGameState(null);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [lobbyId, user?.id]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchLobbyState();

    const ch = supabase.channel(`lobby-bs:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => {
        const newState = payload.new.game_state as BattleshipState;
        if (newState) {
          setGameState(prev => {
            // Drop outdated packets (unless in lobby waiting mode)
            if (prev && newState.status !== 'waiting' && (newState.version || 0) < (prev.version || 0)) {
                return prev;
            }
            return newState;
          });

          if (user?.id && newState.players?.[user.id]?.ships) {
              setMyShips(newState.players[user.id].ships);
          }
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      () => setGameState(null))
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [lobbyId, fetchLobbyState, user?.id]);

  // --- LOGIC ---

  const initGame = async () => {
    if (!user || !stateRef.current.gameState) return;
    const currentState = stateRef.current.gameState;

    if (Array.isArray(currentState.players)) currentState.players = {};

    if (!currentState.players[user.id]) {
      const newState = JSON.parse(JSON.stringify(currentState)) as BattleshipState;
      const isFirst = Object.keys(newState.players).length === 0;

      newState.players[user.id] = {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        ships: [],
        shots: {},
        isReady: false,
        isHost: isFirst || newState.players[user.id]?.isHost,
        aliveShipsCount: 0
      };
      await updateState(newState);
    }
  };

  const startGame = async () => {
    if (!gameState || !user?.id) return;
    const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;
    newState.status = 'playing';
    newState.phase = 'setup';
    newState.logs = [];
    newState.turnDeadline = undefined;
    await updateState(newState);
  };

  const autoPlaceShips = () => setMyShips(shuffleFleet());
  const clearShips = () => setMyShips([]);
  const removeShip = (id: string) => setMyShips(myShips.filter(s => s.id !== id));

  const placeShipManual = (ship: Ship) => {
      const otherShips = myShips.filter(s => s.id !== ship.id);
      if (checkPlacement(otherShips, ship)) {
          setMyShips([...otherShips, ship]);
          return true;
      }
      return false;
  };

  const submitShips = async () => {
    if (!user?.id || !gameState) return;
    const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;

    newState.players[user.id].ships = myShips;
    newState.players[user.id].isReady = true;
    newState.players[user.id].aliveShipsCount = myShips.length;

    const playersArr = Object.values(newState.players);
    if (playersArr.length === 2 && playersArr.every(p => p.isReady)) {
      newState.phase = 'playing';
      newState.turn = playersArr[0].id;
      newState.turnDeadline = Date.now() + (TURN_DURATION_SEC * 1000); // Start timer
    }
    await updateState(newState);
  };

  const fireShot = async (x: number, y: number) => {
    const { gameState, user } = stateRef.current;
    if (!user?.id || !gameState || gameState.turn !== user.id || gameState.phase !== 'playing') return;

    // Check Timer (Grace period 2s)
    if (gameState.turnDeadline && Date.now() > gameState.turnDeadline + 2000) return;

    const opponentId = Object.keys(gameState.players).find(id => id !== user.id);
    if (!opponentId) return;

    const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;
    const opponentBoard = newState.players[opponentId];
    const myBoard = newState.players[user.id];
    const key = getKey(x, y);

    if (myBoard.shots[key]) return;

    let hit = false, killed = false, hitShipIdx = -1;
    for (let i = 0; i < opponentBoard.ships.length; i++) {
      const s = opponentBoard.ships[i];
      if (getShipCoords(s).some(c => c.x === x && c.y === y)) {
        hit = true; hitShipIdx = i; s.hits++;
        if (s.hits >= s.size) killed = true;
        break;
      }
    }

    myBoard.shots[key] = hit ? (killed ? 'killed' : 'hit') : 'miss';

    if (killed) {
      opponentBoard.aliveShipsCount--;
      // Auto-reveal surroundings
      getShipCoords(opponentBoard.ships[hitShipIdx]).forEach(c => {
        myBoard.shots[getKey(c.x, c.y)] = 'killed';
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = c.x + dx, ny = c.y + dy;
            if (isValidCoord(nx, ny) && !myBoard.shots[getKey(nx, ny)]) {
                myBoard.shots[getKey(nx, ny)] = 'miss';
            }
          }
        }
      });
    } else if (!hit) {
      newState.turn = opponentId;
      newState.turnDeadline = Date.now() + (TURN_DURATION_SEC * 1000); // Reset timer on miss
    }

    if (opponentBoard.aliveShipsCount === 0) {
      newState.phase = 'finished';
      newState.winner = user.id;
      newState.turnDeadline = undefined;
    }
    await updateState(newState);
  };

  const handleTimeout = async () => {
    const { gameState, user } = stateRef.current;
    if (!gameState || !user || gameState.phase !== 'playing') return;

    // Active player handles timeout (passes turn)
    if (gameState.turn === user.id) {
         const opponentId = Object.keys(gameState.players).find(id => id !== user.id);
         const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;
         if (opponentId) {
             newState.turn = opponentId;
             newState.turnDeadline = Date.now() + (TURN_DURATION_SEC * 1000);
             await updateState(newState);
         }
    }
  };

  const leaveGame = async () => {
     const { gameState, user, lobbyId } = stateRef.current;
     if (!lobbyId || !user || !gameState) return;

     const isHost = roomMeta?.isHost;

     if (isHost) {
         await supabase.from('lobbies').delete().eq('id', lobbyId);
         return;
     }

     const newState = JSON.parse(JSON.stringify(gameState));
     delete newState.players[user.id];

     if (Object.keys(newState.players).length === 0) {
         await supabase.from('lobbies').delete().eq('id', lobbyId);
     } else {
         if (newState.status === 'playing' || newState.phase === 'setup') {
             newState.phase = 'finished';
             newState.status = 'finished';
             newState.winner = Object.keys(newState.players)[0];
         }
         await updateState(newState);
     }
  };

  return {
      gameState, roomMeta, myShips, loading,
      initGame, startGame, autoPlaceShips, clearShips,
      placeShipManual, removeShip, submitShips, fireShot, leaveGame,
      handleTimeout
  };
}