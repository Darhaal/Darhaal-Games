import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BattleshipState, PlayerBoard, Ship, Coordinate, Orientation, FLEET_CONFIG, CellStatus } from '@/types/battleship';

const BOARD_SIZE = 10;

// --- UTILS ---

const getKey = (x: number, y: number) => `${x},${y}`;

// Проверка: находится ли координата внутри поля
const isValidCoord = (x: number, y: number) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

// Получить все координаты, занятые кораблем
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

// Проверка валидности размещения (правило: корабли не касаются даже углами)
const canPlaceShip = (ships: Ship[], newShip: Ship): boolean => {
  const newShipCoords = getShipCoords(newShip);

  // 1. Проверка границ
  for (const c of newShipCoords) {
    if (!isValidCoord(c.x, c.y)) return false;
  }

  // 2. Проверка коллизий и соседства
  const occupied = new Set<string>();
  ships.forEach(s => {
    getShipCoords(s).forEach(c => {
      // Добавляем саму клетку и все клетки вокруг (3x3)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          occupied.add(getKey(s.position.x + (s.orientation === 'horizontal' ? dx : 0) + (s.orientation === 'horizontal' ? 0 : dx), 0)); // wait, logic fix below
        }
      }
    });
  });

  // Упрощенная и надежная логика проверки соседей
  // Создаем карту занятых зон (включая ореол) для существующих кораблей
  const dangerZone = new Set<string>();
  ships.forEach(s => {
    const sc = getShipCoords(s);
    sc.forEach(coord => {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                dangerZone.add(getKey(coord.x + dx, coord.y + dy));
            }
        }
    });
  });

  // Если хоть одна координата нового корабля попадает в dangerZone -> fail
  for (const c of newShipCoords) {
      if (dangerZone.has(getKey(c.x, c.y))) return false;
  }

  return true;
};

// Автоматическая расстановка
const generateRandomFleet = (): Ship[] => {
    const ships: Ship[] = [];
    let attempts = 0;

    // Пытаемся расставить флот. Если заходим в тупик - сбрасываем и пробуем снова (макс 100 раз)
    while (ships.length < 10 && attempts < 100) {
        ships.length = 0; // Reset
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
    return []; // Fallback (should rarely happen)
};


// --- HOOK ---

export function useBattleshipGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<BattleshipState | null>(null);
  const [myShips, setMyShips] = useState<Ship[]>([]); // Локальное состояние для фазы расстановки
  const [loading, setLoading] = useState(true);

  // Refs for sync
  const stateRef = useRef<{ lobbyId: string | null; userId: string | undefined; gameState: BattleshipState | null }>({
    lobbyId, userId, gameState: null
  });

  useEffect(() => {
    stateRef.current = { lobbyId, userId, gameState };
  }, [lobbyId, userId, gameState]);

  // --- SYNC ---
  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data } = await supabase.from('lobbies').select('game_state').eq('id', lobbyId).single();
      if (data && data.game_state) {
          setGameState(data.game_state);
          // Если мы уже расставили корабли (вернулись в игру), подгружаем их в локальный стейт
          if (userId && data.game_state.players?.[userId]?.ships) {
              setMyShips(data.game_state.players[userId].ships);
          }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [lobbyId, userId]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchLobbyState();
    const ch = supabase.channel(`lobby-battleship:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => {
          const newState = payload.new.game_state as BattleshipState;
          if (newState) {
             setGameState(prev => {
                 // Simple version check
                 if (prev && (newState.version || 0) < (prev.version || 0)) return prev;
                 return newState;
             });
          }
      })
      .subscribe();
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

  // --- ACTIONS ---

  const initGame = async () => {
      if (!userId || !gameState) return;
      // Initialize basic structure if empty
      const newState = { ...gameState };
      if (!newState.players) newState.players = {};

      if (!newState.players[userId]) {
          newState.players[userId] = {
              userId,
              ships: [],
              shots: {},
              isReady: false,
              isHost: false, // Logic needed to determine host from lobby table ideally
              aliveShipsCount: 0
          };
          await updateState(newState);
      }
  };

  const autoPlaceShips = () => {
      const fleet = generateRandomFleet();
      setMyShips(fleet);
  };

  const clearShips = () => setMyShips([]);

  const placeShipManual = (ship: Ship) => {
      if (canPlaceShip(myShips, ship)) {
          setMyShips([...myShips, ship]);
          return true;
      }
      return false;
  };

  const removeShip = (id: string) => {
      setMyShips(myShips.filter(s => s.id !== id));
  };

  const submitShips = async () => {
      if (!userId || !gameState) return;
      const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;

      newState.players[userId].ships = myShips;
      newState.players[userId].isReady = true;
      newState.players[userId].aliveShipsCount = myShips.length;

      // Check if both ready
      const players = Object.values(newState.players);
      if (players.length === 2 && players.every(p => p.isReady)) {
          newState.phase = 'playing';
          newState.turn = players[0].userId; // First player starts
          newState.logs.push({ text: 'Battle started!', time: new Date().toLocaleTimeString() });
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
      if (myBoard.shots[key]) return; // Already shot here

      // Check Hit
      let hitShipIndex = -1;
      let hit = false;
      let killed = false;

      for (let i = 0; i < opponentBoard.ships.length; i++) {
          const ship = opponentBoard.ships[i];
          const coords = getShipCoords(ship);
          if (coords.some(c => c.x === x && c.y === y)) {
              hit = true;
              hitShipIndex = i;
              ship.hits++;
              if (ship.hits >= ship.size) killed = true;
              break;
          }
      }

      // Record Shot
      myBoard.shots[key] = hit ? (killed ? 'killed' : 'hit') : 'miss';

      // Logs
      if (killed) {
          newState.logs.unshift({ text: `Killed enemy ship!`, time: new Date().toLocaleTimeString() });
          opponentBoard.aliveShipsCount--;

          // Auto-fill misses around killed ship
          const killedShip = opponentBoard.ships[hitShipIndex];
          const coords = getShipCoords(killedShip);
          coords.forEach(c => {
               // Mark cell itself as killed
               myBoard.shots[getKey(c.x, c.y)] = 'killed';

               // Mark surroundings as miss
               for (let dx = -1; dx <= 1; dx++) {
                   for (let dy = -1; dy <= 1; dy++) {
                       const nx = c.x + dx;
                       const ny = c.y + dy;
                       const nKey = getKey(nx, ny);
                       if (isValidCoord(nx, ny) && !myBoard.shots[nKey]) {
                           myBoard.shots[nKey] = 'miss';
                       }
                   }
               }
          });

      } else if (hit) {
          newState.logs.unshift({ text: `Hit at ${String.fromCharCode(65+x)}${y+1}!`, time: new Date().toLocaleTimeString() });
      } else {
          newState.logs.unshift({ text: `Miss at ${String.fromCharCode(65+x)}${y+1}`, time: new Date().toLocaleTimeString() });
          // Switch turn only on miss
          newState.turn = opponentId;
      }

      // Check Win
      if (opponentBoard.aliveShipsCount === 0) {
          newState.phase = 'finished';
          newState.winner = userId;
          newState.logs.unshift({ text: `Victory for ${userId}!`, time: new Date().toLocaleTimeString() });
      }

      await updateState(newState);
  };

    const startGame = async () => {
        if (!gameState || !userId) return;
        const newState = JSON.parse(JSON.stringify(gameState)) as BattleshipState;

        // Переводим статус из ожидания в игру
        newState.status = 'playing';
        newState.phase = 'setup'; // Начинаем с расстановки
        newState.lastActionTime = Date.now();

        await updateState(newState);
    };
  const leaveGame = async () => {
      // Basic cleanup logic same as Coup
      if (lobbyId) await supabase.from('lobbies').delete().eq('id', lobbyId);
  };

  return {
      gameState,
      myShips,
      loading,
      initGame,
      autoPlaceShips,
      clearShips,
      placeShipManual,
      removeShip,
      submitShips,
      fireShot,
      leaveGame
  };
}