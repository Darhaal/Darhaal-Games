import { useState, useEffect, useRef } from 'react';
import { BattleshipState, Ship } from '@/types/battleship';
import { updatePlayerStats } from '@/lib/playerStats';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { getKey, isValidCoord, getShipCoords, checkPlacement, shuffleFleet } from '@/lib/gameLogic/battleship';

/** A turn runs for a minute before it is passed on. */
const TURN_MS = 60 * 1000;

// Re-export for import backward compatibility
export { checkPlacement };

export function useBattleshipGame(
    lobbyId: string | null,
    user: { id: string; name: string; avatarUrl: string } | null
) {
  const [myShips, setMyShips] = useState<Ship[]>([]);
  const myShipsRef = useRef<Ship[]>([]);
  useEffect(() => { myShipsRef.current = myShips; }, [myShips]);

  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<BattleshipState>({
    lobbyId,
    userId: user?.id,
    channelPrefix: 'lobby-bs',
    getHostId: (state) => Object.values(state.players).find(pl => pl.isHost)?.id,
    // Sync local ships with the server state:
    // the server is authoritative in battle; during setup we only pick up on reconnect
    onIncoming: (incoming) => {
      const uid = user?.id;
      if (!uid || !incoming.players?.[uid]?.ships) return;
      const serverShips = incoming.players[uid].ships;

      if (incoming.phase === 'playing') {
        setMyShips(serverShips);
      } else if (incoming.phase === 'setup') {
        if (myShipsRef.current.length === 0 && serverShips.length > 0) {
          setMyShips(serverShips);
        }
      }
    }
  });

  // --- ACTIONS ---

  /**
   * Seat the player. Retryable on purpose: both sides open the invite link at
   * once often enough, and the old read-then-write form meant whoever lost
   * that race never appeared in the room.
   */
  const initGame = async () => {
    if (!user) return;

    await updateState((current) => {
      const players = Array.isArray(current.players) ? {} : current.players;
      const existing = players[user.id];

      // A record without a name is a half-written seat, so it is re-taken.
      if (existing && existing.name) return null;
      if (current.status === 'playing') return null;
      if (!existing && Object.keys(players).length >= 2) return null;

      const next: BattleshipState = JSON.parse(JSON.stringify({ ...current, players }));

      next.players[user.id] = {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        ships: existing?.ships || [],
        shots: existing?.shots || {},
        isReady: existing?.isReady || false,
        isHost: Object.keys(next.players).length === 0 || !!existing?.isHost,
        aliveShipsCount: existing?.aliveShipsCount || 0
      };

      return next;
    });
  };

  const startGame = async () => {
    if (!user?.id) return;
    await updateState((current) => {
      if (current.status !== 'waiting') return null;
      return { ...current, status: 'playing', phase: 'setup', logs: [] };
    });
  };

  const autoPlaceShips = () => setMyShips(shuffleFleet());
  const clearShips = () => setMyShips([]);

  const placeShipManual = (ship: Ship) => {
      const otherShips = myShips.filter(s => s.id !== ship.id);
      if (checkPlacement(otherShips, ship)) {
          setMyShips([...otherShips, ship]);
          return true;
      }
      return false;
  };

  const removeShip = (id: string) => setMyShips(myShips.filter(s => s.id !== id));

  /**
   * Retryable: both players finish placing independently and confirm whenever
   * they are done, so the two writes land together often. Losing one left a
   * player looking at a "waiting for opponent" screen that never moved, with
   * their fleet unsaved.
   */
  const submitShips = async () => {
    if (!user?.id) return;
    const ships = myShipsRef.current;

    await updateState((current) => {
      if (current.phase !== 'setup') return null;
      if (!current.players[user.id]) return null;
      if (current.players[user.id].isReady) return null; // already confirmed

      const newState: BattleshipState = JSON.parse(JSON.stringify(current));

      newState.players[user.id].ships = ships;
      newState.players[user.id].isReady = true;
      newState.players[user.id].aliveShipsCount = ships.length;

      const playersArr = Object.values(newState.players);
      if (playersArr.length === 2 && playersArr.every(p => p.isReady)) {
        newState.phase = 'playing';
        newState.status = 'playing';
        newState.turn = playersArr[0].id;
        newState.turnDeadline = Date.now() + TURN_MS;
        newState.startTime = Date.now();
      }

      return newState;
    });
  };

  const fireShot = async (x: number, y: number) => {
    if (!user?.id) return;

    // Re-checked inside the updater rather than against `gameState`: that is
    // React state, which can lag a turn behind the realtime update already
    // held in the sync ref.
    await updateState((current) => {
    if (current.turn !== user.id || current.phase !== 'playing') return null;
    const opponentId = Object.keys(current.players).find(id => id !== user.id);
    if (!opponentId) return null;

    const newState: BattleshipState = JSON.parse(JSON.stringify(current));
    const opponentBoard = newState.players[opponentId];
    const myBoard = newState.players[user.id];
    const key = getKey(x, y);

    if (myBoard.shots[key]) return null;

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
      getShipCoords(opponentBoard.ships[hitShipIdx]).forEach(c => {
        myBoard.shots[getKey(c.x, c.y)] = 'killed';
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = c.x + dx, ny = c.y + dy;
            if (isValidCoord(nx, ny) && !myBoard.shots[getKey(nx, ny)]) myBoard.shots[getKey(nx, ny)] = 'miss';
          }
        }
      });
    } else if (!hit) {
      newState.turn = opponentId;
      newState.turnDeadline = Date.now() + TURN_MS;
    } else {
        newState.turnDeadline = Date.now() + TURN_MS;
    }

    if (opponentBoard.aliveShipsCount === 0) {
      newState.phase = 'finished';
      newState.status = 'finished';
      newState.winner = user.id;
    }

    return newState;
    });
  };

  /**
   * Passes the turn on when the clock runs out.
   *
   * Callable by either player, not just the one on turn: it used to be guarded
   * on `current.turn === user.id`, so when that player closed their tab nobody
   * was left who could move the turn and the match sat there for good. The
   * deadline is the authority instead — a caller whose clock is early writes
   * nothing, and once the turn has moved the new deadline makes a second call
   * a no-op.
   */
  const handleTimeout = async () => {
    if (!user) return;

    await updateState((current) => {
      if (current.phase !== 'playing') return null;
      if (!current.turnDeadline || Date.now() < current.turnDeadline) return null;

      const opponentId = Object.keys(current.players).find(id => id !== current.turn);
      if (!opponentId) return null;

      return { ...current, turn: opponentId, turnDeadline: Date.now() + TURN_MS };
    });
  };

  const leaveGame = async () => {
     if (!lobbyId || !user) return;

     // A finished match is a record, not live state: leaving must not rewrite
     // the results the other players are still looking at. Just walk away —
     // the page navigates us out.
     const snapshot = gameStateRef.current;
     if (!snapshot || snapshot.status === 'finished') return;

     const others = Object.keys(snapshot.players || {}).filter((id) => id !== user.id);
     if (others.length === 0) {
         await deleteLobby();
         return;
     }

     await updateState((current) => {
         if (current.status === 'finished') return null;
         if (!current.players?.[user.id]) return null;

         const newState: BattleshipState = JSON.parse(JSON.stringify(current));
         const wasHost = newState.players[user.id]?.isHost;

         delete newState.players[user.id];

         const remaining = Object.keys(newState.players);
         if (remaining.length === 0) return null;

         if (wasHost) newState.players[remaining[0]].isHost = true;

         // Technical win for the remaining player only if the match already started
         // (phase === 'setup' is set before the start in the waiting lobby — leaving must not end the game)
         if (newState.status === 'playing') {
             newState.phase = 'finished';
             newState.status = 'finished';
             newState.winner = remaining[0];
         }

         return newState;
     });
  };

  // TRACK GAME END TO RECORD STATISTICS
  useEffect(() => {
      if (gameState?.status === 'finished' && user?.id && !lobbyDeleted) {
          const isWinner = gameState.winner === user.id;
          // Actual match duration; 600s fallback for legacy states
          const duration = gameState.startTime
              ? Math.max(1, Math.round((Date.now() - gameState.startTime) / 1000))
              : 600;

          updatePlayerStats(user.id, {
              gameType: 'battleship',
              result: isWinner ? 'win' : 'loss',
              durationSeconds: duration
          });
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the match finishes; adding gameState.players would re-record stats
  }, [gameState?.status, gameState?.winner, user?.id, lobbyDeleted]);

  return {
      gameState, roomMeta, myShips, loading, lobbyDeleted,
      initGame, startGame, autoPlaceShips, clearShips,
      placeShipManual, removeShip, submitShips, fireShot, leaveGame,
      handleTimeout
  };
}