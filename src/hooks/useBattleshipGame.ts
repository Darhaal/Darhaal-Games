import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BattleshipState, Ship, Coordinate, Orientation, FLEET_CONFIG, PlayerBoard } from '@/types/battleship';

const BOARD_SIZE = 10;
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

// Экспортируем для использования в UI для подсветки
export const checkPlacement = (ships: Ship[], newShip: Ship, ignoreShipId?: string): boolean => {
  const newShipCoords = getShipCoords(newShip);
  for (const c of newShipCoords) {
    if (!isValidCoord(c.x, c.y)) return false;
  }

  const dangerZone = new Set<string>();
  const otherShips = ships.filter(s => s.id !== newShip.id && s.id !== ignoreShipId);

  otherShips.forEach(s => {
    getShipCoords(s).forEach(coord => {
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
  const [lobbyDeleted, setLobbyDeleted] = useState(false);

  const stateRef = useRef<{ lobbyId: string | null; user: typeof user; gameState: BattleshipState | null; myShips: Ship[] }>({
    lobbyId, user, gameState: null, myShips: []
  });

  useEffect(() => {
    stateRef.current = { lobbyId, user, gameState, myShips };
  }, [lobbyId, user, gameState, myShips]);

  // --- SYNC ---
  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data } = await supabase.from('lobbies').select('name, code, host_id, game_state').eq('id', lobbyId).single();
      if (data) {
        setRoomMeta({ name: data.name, code: data.code, isHost: data.host_id === user?.id });
        if (data.game_state) {
           setGameState(data.game_state);
           // Восстанавливаем корабли только если локально пусто (реконнект)
           if (user?.id && data.game_state.players) {
              const p = data.game_state.players[user.id];
              if (p?.ships && p.ships.length > 0 && stateRef.current.myShips.length === 0) {
                  setMyShips(p.ships);
              }
           }
        }
      } else {
          setGameState(null);
          setLobbyDeleted(true);
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
            if (newState.status === 'waiting') return newState;
            if (prev && (newState.version || 0) < (prev.version || 0)) return prev;
            return newState;
          });

          // ФИКС СБРОСА КОРАБЛЕЙ:
          // Если сервер присылает обновление (например, противник нажал "Готов"),
          // в этом обновлении массив ships вашего игрока может быть пустым (т.к. противник его не знает).
          // Мы обновляем setMyShips из сервера ТОЛЬКО если:
          // 1. Игра уже идет (playing) - значит это реконнект или синхронизация.
          // 2. Либо мы еще ничего не расставили (setup), а на сервере уже есть данные.
          // В остальных случаях (фаза setup, у нас есть корабли) мы ИГНОРИРУЕМ данные о кораблях с сервера,
          // чтобы не затереть нашу текущую расстановку.
          if (user?.id && newState.players?.[user.id]?.ships) {
              const serverShips = newState.players[user.id].ships;

              if (newState.phase === 'playing') {
                  setMyShips(serverShips);
              } else if (newState.phase === 'setup' && stateRef.current.myShips.length === 0 && serverShips.length > 0) {
                  setMyShips(serverShips);
              }
          }
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      () => {
          setGameState(null);
          setLobbyDeleted(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [lobbyId, fetchLobbyState, user?.id]);

  const updateState = async (newState: BattleshipState) => {
    newState.version = (newState.version || 0) + 1;
    newState.lastActionTime = Date.now();
    setGameState(newState);
    if (stateRef.current.lobbyId) {
       await supabase.from('lobbies').update({ game_state: newState }).eq('id', stateRef.current.lobbyId);
    }
  };

  // --- ACTIONS ---

  const initGame = async () => {
    if (!user || !stateRef.current.gameState) return;
    const currentState = stateRef.current.gameState;

    let playersObj = currentState.players;
    if (Array.isArray(playersObj)) playersObj = {};

    const existing = playersObj[user.id];
    // Если игрока нет в списке
    if (!existing || !existing.name) {
      // БЛОКИРОВКА ВХОДА В ИДУЩУЮ ИГРУ
      if (currentState.status === 'playing') {
          return; // Не добавляем игрока, если игра уже идет
      }

      const newState = JSON.parse(JSON.stringify(currentState)) as BattleshipState;
      if (Array.isArray(newState.players)) newState.players = {};

      const isFirst = Object.keys(newState.players).length === 0;

      newState.players[user.id] = {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        ships: existing?.ships || [],
        shots: existing?.shots || {},
        isReady: existing?.isReady || false,
        isHost: isFirst || existing?.isHost,
        aliveShipsCount: existing?.aliveShipsCount || 0
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
    await updateState(newState);
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

  const submitShips = async () => {
    if (!user?.id || !gameState) return;

    // Берем актуальный стейт, чтобы не перезаписать чужой isReady
    const currentGs = stateRef.current.gameState || gameState;
    const newState = JSON.parse(JSON.stringify(currentGs)) as BattleshipState;

    // Вписываем свои корабли в глобальный стейт
    newState.players[user.id].ships = myShips;
    newState.players[user.id].isReady = true;
    newState.players[user.id].aliveShipsCount = myShips.length;

    const playersArr = Object.values(newState.players);
    if (playersArr.length === 2 && playersArr.every(p => p.isReady)) {
      newState.phase = 'playing';
      newState.turn = playersArr[0].id;
      newState.turnDeadline = Date.now() + (60 * 1000);
    }

    await updateState(newState);
  };

  const fireShot = async (x: number, y: number) => {
    if (!user?.id || !gameState || gameState.turn !== user.id || gameState.phase !== 'playing') return;
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
      newState.turnDeadline = Date.now() + (60 * 1000);
    } else {
        newState.turnDeadline = Date.now() + (60 * 1000);
    }

    if (opponentBoard.aliveShipsCount === 0) {
      newState.phase = 'finished';
      newState.winner = user.id;
    }
    await updateState(newState);
  };

  const handleTimeout = async () => {
    const currentGs = stateRef.current.gameState;
    const currentUser = stateRef.current.user;
    if (!currentGs || !currentUser || currentGs.phase !== 'playing' || currentGs.turn !== currentUser.id) return;

    const opponentId = Object.keys(currentGs.players).find(id => id !== currentUser.id);
    const newState = JSON.parse(JSON.stringify(currentGs)) as BattleshipState;

    if (opponentId) {
        newState.turn = opponentId;
        newState.turnDeadline = Date.now() + (60 * 1000);
        await updateState(newState);
    }
  };

  const leaveGame = async () => {
     const currentGs = stateRef.current.gameState;
     if (!lobbyId || !user || !currentGs) return;

     const isHost = roomMeta?.isHost;
     if (isHost) {
         // Хост удаляет лобби целиком
         await supabase.from('lobbies').delete().eq('id', lobbyId);
     } else {
         const newState = JSON.parse(JSON.stringify(currentGs));
         delete newState.players[user.id];

         if (Object.keys(newState.players).length === 0) {
             await supabase.from('lobbies').delete().eq('id', lobbyId);
         } else {
             // Если игра шла, засчитываем победу оставшемуся
             if (newState.status === 'playing' || newState.phase === 'setup') {
                 newState.phase = 'finished';
                 newState.winner = Object.keys(newState.players)[0];
             }
             await updateState(newState);
         }
     }
  };

  return {
      gameState, roomMeta, myShips, loading, lobbyDeleted,
      initGame, startGame, autoPlaceShips, clearShips,
      placeShipManual, removeShip, submitShips, fireShot, leaveGame,
      handleTimeout
  };
}