import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BattleshipState, Ship, Coordinate, Orientation, FLEET_CONFIG } from '@/types/battleship';

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

const canPlaceShip = (ships: Ship[], newShip: Ship): boolean => {
  const newShipCoords = getShipCoords(newShip);

  // 1. Проверка границ
  for (const c of newShipCoords) {
    if (!isValidCoord(c.x, c.y)) return false;
  }

  // 2. Проверка пересечений и соседства
  const dangerZone = new Set<string>();
  ships.forEach(s => {
    getShipCoords(s).forEach(coord => {
      // Добавляем саму клетку и соседей
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
          if (canPlaceShip(ships, newShip)) {
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

export function useBattleshipGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<BattleshipState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [myShips, setMyShips] = useState<Ship[]>([]);
  const [loading, setLoading] = useState(true);

  const stateRef = useRef<{ lobbyId: string | null; userId: string | undefined; gameState: BattleshipState | null }>({
    lobbyId, userId, gameState: null
  });

  useEffect(() => {
    stateRef.current = { lobbyId, userId, gameState };
  }, [lobbyId, userId, gameState]);

  // --- Sync ---
  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data } = await supabase.from('lobbies').select('name, code, host_id, game_state').eq('id', lobbyId).single();
      if (data) {
        setRoomMeta({ name: data.name, code: data.code, isHost: data.host_id === userId });
        if (data.game_state) {
          setGameState(data.game_state);
          // Восстанавливаем корабли из стейта, если они там есть (при рефреше)
          if (userId && data.game_state.players && !Array.isArray(data.game_state.players)) {
             if (data.game_state.players[userId]?.ships) {
                setMyShips(data.game_state.players[userId].ships);
             }
          }
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [lobbyId, userId]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchLobbyState();
    const ch = supabase.channel(`lobby-bs:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => {
        const newState = payload.new.game_state as BattleshipState;
        if (newState) {
          setGameState(prev => {
            // Простая защита от старых пакетов
            if (prev && (newState.version || 0) < (prev.version || 0)) return prev;
            return newState;
          });
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lobbyId, fetchLobbyState]);

  const updateState = async (newState: BattleshipState) => {
    newState.version = (newState.version || 0) + 1;
    newState.lastActionTime = Date.now();
    setGameState(newState);
    if (stateRef.current.lobbyId) {
       await supabase.from('lobbies').update({ game_state: newState }).eq('id', stateRef.current.lobbyId);
    }
  };

  // --- Actions ---

  const initGame = async () => {
    if (!userId || !stateRef.current.gameState) return;
    const currentState = stateRef.current.gameState;

    // Fix: если стейт поврежден или это массив
    let playersObj = currentState.players;
    if (Array.isArray(playersObj)) playersObj = {};

    if (!playersObj[userId]) {
      const newState = JSON.parse(JSON.stringify(currentState)) as BattleshipState;
      if (Array.isArray(newState.players)) newState.players = {};

      const isFirst = Object.keys(newState.players).length === 0;
      newState.players[userId] = {
        userId, ships: [], shots: {}, isReady: false,
        isHost: isFirst,
        aliveShipsCount: 0
      };
      await updateState(newState);
    }
  };

  const startGame = async () => {
    if (!gameState || !userId) return;
    const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;
    newState.status = 'playing';
    newState.phase = 'setup';
    newState.logs.push({ text: 'Подготовка флота...', time: new Date().toLocaleTimeString() });
    await updateState(newState);
  };

  const autoPlaceShips = () => setMyShips(shuffleFleet());
  const clearShips = () => setMyShips([]);

  const placeShipManual = (ship: Ship) => {
      if (canPlaceShip(myShips, ship)) {
          setMyShips([...myShips, ship]);
          return true;
      }
      return false;
  };

  const removeShip = (id: string) => setMyShips(myShips.filter(s => s.id !== id));

  const submitShips = async () => {
    if (!userId || !gameState) return;
    const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;

    newState.players[userId].ships = myShips;
    newState.players[userId].isReady = true;
    newState.players[userId].aliveShipsCount = myShips.length;

    const playersArr = Object.values(newState.players);
    // Если оба готовы - начинаем бой
    if (playersArr.length === 2 && playersArr.every(p => p.isReady)) {
      newState.phase = 'playing';
      newState.turn = playersArr[0].userId; // Хост ходит первым (или просто первый в списке)
      newState.logs.push({ text: 'Бой начался!', time: new Date().toLocaleTimeString() });
    } else {
        newState.logs.push({ text: 'Ожидание соперника...', time: new Date().toLocaleTimeString() });
    }
    await updateState(newState);
  };

  const fireShot = async (x: number, y: number) => {
    if (!userId || !gameState || gameState.turn !== userId || gameState.phase !== 'playing') return;
    const opponentId = Object.keys(gameState.players).find(id => id !== userId);
    if (!opponentId) return;

    const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;
    const opponentBoard = newState.players[opponentId];
    const myBoard = newState.players[userId];
    const key = getKey(x, y);

    if (myBoard.shots[key]) return; // Уже стреляли сюда

    let hit = false, killed = false, hitShipIdx = -1;

    // Проверка попадания
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
      newState.logs.unshift({ text: `Корабль потоплен!`, time: new Date().toLocaleTimeString() });

      // Авто-промахи вокруг убитого корабля
      getShipCoords(opponentBoard.ships[hitShipIdx]).forEach(c => {
        myBoard.shots[getKey(c.x, c.y)] = 'killed'; // Обновляем статус клетки корабля
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = c.x + dx, ny = c.y + dy;
            if (isValidCoord(nx, ny) && !myBoard.shots[getKey(nx, ny)]) {
                myBoard.shots[getKey(nx, ny)] = 'miss';
            }
          }
        }
      });
    } else if (hit) {
        newState.logs.unshift({ text: `Попадание!`, time: new Date().toLocaleTimeString() });
    } else {
        newState.logs.unshift({ text: `Промах`, time: new Date().toLocaleTimeString() });
        newState.turn = opponentId; // Переход хода только при промахе
    }

    // Проверка победы
    if (opponentBoard.aliveShipsCount === 0) {
      newState.phase = 'finished';
      newState.winner = userId;
      newState.logs.unshift({ text: `ПОБЕДА АДМИРАЛА ${userId.slice(0,4)}!`, time: new Date().toLocaleTimeString() });
    }

    await updateState(newState);
  };

  const leaveGame = async () => {
    if (lobbyId) await supabase.from('lobbies').delete().eq('id', lobbyId);
  };

  return {
      gameState, roomMeta, myShips, loading,
      initGame, startGame, autoPlaceShips, clearShips,
      placeShipManual, removeShip, submitShips, fireShot, leaveGame
  };
}