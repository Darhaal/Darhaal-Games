import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';

export function useCoupGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref для доступа к актуальному стейту внутри cleanup функции (которая замыкается при маунте)
  const stateRef = useRef<{ lobbyId: string | null; userId: string | undefined; status: string }>({
    lobbyId, userId, status: 'waiting'
  });

  useEffect(() => {
    stateRef.current = { lobbyId, userId, status: gameState?.status || 'waiting' };
  }, [lobbyId, userId, gameState?.status]);

  // --- 1. Синхронизация с Supabase ---

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
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, userId, fetchLobbyState]);

  // --- 2. УМНЫЙ АВТО-ВЫХОД И ОЧИСТКА ---

  useEffect(() => {
    const handleUnload = async () => {
      const { lobbyId: lid, userId: uid, status } = stateRef.current;
      if (!lid || !uid) return;

      // 1. Получаем свежее состояние перед выходом
      const { data } = await supabase.from('lobbies').select('game_state').eq('id', lid).single();
      if (!data?.game_state) return;

      let newState = { ...data.game_state };
      let shouldDelete = false;

      if (status === 'waiting') {
        // Сценарий 1: Выход из Лобби
        // Просто удаляем игрока из списка
        newState.players = newState.players.filter((p: Player) => p.id !== uid);

        // Если игроков не осталось — удаляем комнату
        if (newState.players.length === 0) shouldDelete = true;
      } else if (status === 'playing') {
        // Сценарий 2: Выход из Активной Игры (Rage Quit / Disconnect)
        // Мы не можем удалить игрока из массива (собьются ходы), поэтому "убиваем" его
        newState.players = newState.players.map((p: Player) => {
            if (p.id === uid) {
                return {
                    ...p,
                    isDead: true,
                    coins: 0,
                    cards: p.cards.map(c => ({ ...c, revealed: true })) // Вскрываем карты
                };
            }
            return p;
        });

        // Проверяем, сколько живых осталось
        const alivePlayers = newState.players.filter((p: Player) => !p.isDead);

        if (alivePlayers.length === 0) {
            // Все вышли или умерли — удаляем мусорную комнату
            shouldDelete = true;
        } else if (alivePlayers.length === 1) {
            // Остался последний герой — присуждаем победу
            newState.status = 'finished';
            newState.winner = alivePlayers[0].name;
            // Добавляем лог о технической победе
            newState.logs.unshift({
                user: 'System',
                action: 'Opponent disconnected. Winner determined.',
                time: new Date().toLocaleTimeString()
            });
        }
      }

      // Применяем изменения
      if (shouldDelete) {
        await supabase.from('lobbies').delete().eq('id', lid);
      } else {
        await supabase.from('lobbies').update({ game_state: newState }).eq('id', lid);
      }
    };

    // Срабатывает при закрытии вкладки (ненадежно, но полезно)
    window.addEventListener('beforeunload', handleUnload);

    // Срабатывает при размонтировании компонента (переход Назад, клик по логотипу) - НАДЕЖНО
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);


  // --- 3. Игровые Действия ---

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
      case 'income':
        player.coins += 1;
        logAction = dict.income;
        break;
      case 'aid':
        player.coins += 2;
        logAction = dict.aid;
        break;
      case 'tax':
        player.coins += 3;
        logAction = dict.tax;
        break;
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

  return { gameState, roomMeta, loading, performAction, startGame };
}