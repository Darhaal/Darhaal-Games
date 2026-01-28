import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';

// Константы для прямого доступа (на случай если SDK не успевает)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amemndrojsaccfhtbsxc.supabase.com';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZW1uZHJvanNhY2NmaHRic3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjE2MDEsImV4cCI6MjA4NTA5NzYwMX0.G4RV8_5hF2eVdFA42QQSQGyTIWpjbQlosFnWxMBhp0g';

export function useCoupGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  // Храним состояние в ref для доступа в beforeunload/cleanup
  const stateRef = useRef<{
    lobbyId: string | null;
    userId: string | undefined;
    status: string;
    players: Player[]
  }>({
    lobbyId, userId, status: 'waiting', players: []
  });

  useEffect(() => {
    stateRef.current = {
        lobbyId,
        userId,
        status: gameState?.status || 'waiting',
        players: gameState?.players || []
    };
  }, [lobbyId, userId, gameState]);

  // --- 1. Синхронизация ---

  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data, error } = await supabase
        .from('lobbies')
        .select('name, code, host_id, game_state')
        .eq('id', lobbyId)
        .single();

      if (error) throw error;

      if (data) {
        setRoomMeta({
            name: data.name,
            code: data.code,
            isHost: data.host_id === userId
        });

        if (data.game_state) {
          const safeState = {
            ...data.game_state,
            players: data.game_state.players || []
          };
          setGameState(safeState);
        }
      }
    } catch (e) {
      console.error("Error fetching lobby:", e);
    } finally {
      setLoading(false);
    }
  }, [lobbyId, userId]);

  useEffect(() => {
    if (!lobbyId || !userId) return;
    fetchLobbyState();

    const channel = supabase.channel(`lobby_coup:${lobbyId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          if (payload.new) {
             if (payload.new.game_state) {
                const safeState = {
                    ...payload.new.game_state,
                    players: payload.new.game_state.players || []
                };
                setGameState(safeState);
             }
             if (roomMeta && payload.new.host_id !== undefined) {
                 setRoomMeta(prev => prev ? ({ ...prev, isHost: payload.new.host_id === userId }) : null);
             }
          } else {
             setGameState(null); // Лобби удалено
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, () => {
          setGameState(null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, userId, fetchLobbyState]);

  // --- 2. ЛОГИКА ВЫХОДА (LEAVE & CLEANUP) ---

  const prepareLeaveData = () => {
      const { userId: uid, status, players } = stateRef.current;
      if (!uid) return null;

      let newPlayers = [...players];
      let newStatus = status;
      let shouldDelete = false;

      if (status === 'playing') {
          // В игре: помечаем мертвым
          let playerDied = false;
          newPlayers = newPlayers.map(p => {
              if (p.id === uid && !p.isDead) {
                  playerDied = true;
                  return { ...p, isDead: true, coins: 0, cards: p.cards.map(c => ({ ...c, revealed: true })) };
              }
              return p;
          });

          const alive = newPlayers.filter(p => !p.isDead);

          if (alive.length === 0) {
              shouldDelete = true;
          } else if (alive.length === 1 && playerDied) {
              newStatus = 'finished';
              // Логика победы обрабатывается на клиенте
          }
      } else {
          // В лобби или в конце игры: удаляем
          newPlayers = newPlayers.filter(p => p.id !== uid);
          if (newPlayers.length === 0) shouldDelete = true;
      }

      return { newPlayers, newStatus, shouldDelete };
  };

  // Ручной выход (кнопка)
  const leaveGame = async () => {
      const { lobbyId: lid } = stateRef.current;
      if (!lid) return;

      // Сначала читаем свежие данные с сервера, чтобы избежать конфликтов
      const { data: current } = await supabase.from('lobbies').select('game_state').eq('id', lid).single();

      // Если лобби уже нет - просто уходим
      if (!current) return;

      // Обновляем реф свежими данными для prepareLeaveData
      stateRef.current.players = current.game_state.players || [];
      stateRef.current.status = current.game_state.status;

      const data = prepareLeaveData();
      if (!data) return;

      if (data.shouldDelete) {
          await supabase.from('lobbies').delete().eq('id', lid);
      } else {
          const mergedState = {
              ...current.game_state,
              players: data.newPlayers,
              status: data.newStatus
          };

          // Если есть победитель, пропишем его
          if (data.newStatus === 'finished' && !mergedState.winner) {
             const winner = data.newPlayers.find(p => !p.isDead);
             if (winner) mergedState.winner = winner.name;
          }

          await supabase.from('lobbies').update({ game_state: mergedState }).eq('id', lid);
      }
  };

  // Авто-выход (закрытие вкладки)
  useEffect(() => {
    const handleUnload = () => {
        const { lobbyId: lid } = stateRef.current;
        if (!lid) return;

        const leaveData = prepareLeaveData();
        if (!leaveData) return;

        const url = `${SUPABASE_URL}/rest/v1/lobbies?id=eq.${lid}`;

        if (leaveData.shouldDelete) {
            fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'apikey': SUPABASE_KEY
                },
                keepalive: true
            });
        } else {
            // Формируем payload. Берем текущий стейт из рефа как базу
            // Это "Best Effort"
            const finalState = {
                ...(gameState || {}),
                players: leaveData.newPlayers,
                status: leaveData.newStatus
            };

            fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'apikey': SUPABASE_KEY,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ game_state: finalState }),
                keepalive: true
            });
        }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
        window.removeEventListener('beforeunload', handleUnload);
    };
  }, [gameState]); // Зависимость от gameState важна для свежего замыкания


  // --- 3. Игровые Действия ---

  const performAction = async (actionType: string, targetId?: string) => {
    if (!gameState || !userId) return;
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    if (!newState.players || newState.players.length === 0) return;

    const playerIdx = newState.turnIndex;
    const player = newState.players[playerIdx];

    if (player.id !== userId) return;

    let logAction = '';
    const dict = DICTIONARY.ru.logs;

    switch (actionType) {
      case 'income': player.coins += 1; logAction = dict.income; break;
      case 'aid': player.coins += 2; logAction = dict.aid; break;
      case 'tax': player.coins += 3; logAction = dict.tax; break;
      case 'steal':
        if (targetId) {
          const target = newState.players.find(p => p.id === targetId);
          if (target) {
            const stolen = Math.min(2, target.coins);
            target.coins -= stolen;
            player.coins += stolen;
            logAction = dict.steal(target.name);
          }
        }
        break;
      case 'assassinate':
        if (targetId && player.coins >= 3) {
          player.coins -= 3;
          const target = newState.players.find(p => p.id === targetId);
          if (target) {
            killPlayerCard(target);
            logAction = dict.assassinate(target.name);
          }
        }
        break;
      case 'coup':
        if (targetId && player.coins >= 7) {
          player.coins -= 7;
          const target = newState.players.find(p => p.id === targetId);
          if (target) {
            killPlayerCard(target);
            logAction = dict.coup(target.name);
          }
        }
        break;
      case 'exchange':
        if (newState.deck.length >= 2) {
             const currentHand = player.cards.filter(c => !c.revealed).map(c => c.role);
             newState.deck.push(...currentHand);
             newState.deck.sort(() => Math.random() - 0.5);
             player.cards.forEach(c => {
                 if(!c.revealed) c.role = newState.deck.pop()!;
             });
             logAction = dict.exchange;
        }
        break;
    }

    const winner = checkWinner(newState.players);
    if (winner) {
      newState.winner = winner;
      newState.status = 'finished';
      logAction += ` | ${dict.win}`;
    } else {
      newState.turnIndex = getNextTurn(newState.players, newState.turnIndex);
    }

    newState.logs.unshift({
      user: player.name,
      action: logAction,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    });
    newState.logs = newState.logs.slice(0, 50);

    await updateState(newState);
  };

  const updateState = async (newState: GameState) => {
    setGameState(newState);
    await supabase.from('lobbies').update({ game_state: newState }).eq('id', lobbyId);
  };

  const getNextTurn = (players: Player[], currentIdx: number) => {
    if (!players || players.length === 0) return 0;
    let next = (currentIdx + 1) % players.length;
    let loops = 0;
    while (players[next].isDead && loops < players.length) {
      next = (next + 1) % players.length;
      loops++;
    }
    return next;
  };

  const checkWinner = (players: Player[]) => {
    const alive = players.filter(p => !p.isDead);
    return alive.length === 1 ? alive[0].name : undefined;
  };

  const killPlayerCard = (player: Player) => {
    const cardIdx = player.cards.findIndex(c => !c.revealed);
    if (cardIdx !== -1) {
      player.cards[cardIdx].revealed = true;
    }
    if (player.cards.every(c => c.revealed)) {
      player.isDead = true;
      player.coins = 0;
    }
  };

  const startGame = async () => {
    if (!gameState) return;
    const roles: Role[] = ['duke', 'duke', 'duke', 'assassin', 'assassin', 'assassin', 'captain', 'captain', 'captain', 'ambassador', 'ambassador', 'ambassador', 'contessa', 'contessa', 'contessa'];
    const shuffled = roles.sort(() => Math.random() - 0.5);

    const newPlayers = (gameState.players || []).map(p => ({
      ...p,
      coins: 2,
      isDead: false,
      cards: [
        { role: shuffled.pop()!, revealed: false },
        { role: shuffled.pop()!, revealed: false }
      ]
    }));

    const newState: GameState = {
      ...gameState,
      status: 'playing',
      players: newPlayers,
      deck: shuffled,
      turnIndex: 0,
      logs: [{ user: 'System', action: DICTIONARY.ru.logs.start, time: '' }],
      winner: undefined
    };

    await supabase.from('lobbies').update({ status: 'playing', game_state: newState }).eq('id', lobbyId);
    setGameState(newState);
  };

  return { gameState, roomMeta, loading, performAction, startGame, leaveGame };
}