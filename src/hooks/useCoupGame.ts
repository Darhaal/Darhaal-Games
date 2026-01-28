import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GameState, Player, Role } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';

export function useCoupGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  // --- 1. Синхронизация с Supabase ---

  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    const { data, error } = await supabase
      .from('lobbies')
      .select('game_state')
      .eq('id', lobbyId)
      .single();

    if (data?.game_state) {
      setGameState(data.game_state);
    }
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchLobbyState();

    const channel = supabase.channel(`lobby_coup:${lobbyId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          if (payload.new?.game_state) {
            setGameState(payload.new.game_state);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, fetchLobbyState]);

  // --- 2. Утилиты Логики ---

  const updateState = async (newState: GameState) => {
    setGameState(newState); // Оптимистичное обновление
    await supabase.from('lobbies').update({ game_state: newState }).eq('id', lobbyId);
  };

  const getNextTurn = (players: Player[], currentIdx: number) => {
    let next = (currentIdx + 1) % players.length;
    let loops = 0;
    // Пропускаем мертвых игроков
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

  // --- 3. Игровые Действия ---

  const startGame = async () => {
    if (!gameState) return;
    const roles: Role[] = ['duke', 'duke', 'duke', 'assassin', 'assassin', 'assassin', 'captain', 'captain', 'captain', 'ambassador', 'ambassador', 'ambassador', 'contessa', 'contessa', 'contessa'];
    const shuffled = roles.sort(() => Math.random() - 0.5);

    const newPlayers = gameState.players.map(p => ({
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

    await updateState(newState);
  };

  const performAction = async (actionType: string, targetId?: string) => {
    if (!gameState || !userId) return;

    // Глубокая копия стейта
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const playerIdx = newState.turnIndex;
    const player = newState.players[playerIdx];

    // Проверка очередности хода
    if (player.id !== userId) return;

    let logAction = '';
    const dict = DICTIONARY.ru.logs; // Используем RU для логов по умолчанию

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
        // Упрощенная логика обмена: перемешиваем колоду, даем новые карты (для скорости игры)
        if (newState.deck.length >= 2) {
             const currentHand = player.cards.filter(c => !c.revealed).map(c => c.role);
             // Возвращаем в колоду
             newState.deck.push(...currentHand);
             // Перемешиваем
             newState.deck.sort(() => Math.random() - 0.5);
             // Берем новые
             player.cards.forEach(c => {
                 if(!c.revealed) c.role = newState.deck.pop()!;
             });
             logAction = dict.exchange;
        }
        break;
    }

    // Проверка победителя
    const winner = checkWinner(newState.players);
    if (winner) {
      newState.winner = winner;
      newState.status = 'finished';
      logAction += ` | ${dict.win}`;
    } else {
      newState.turnIndex = getNextTurn(newState.players, newState.turnIndex);
    }

    // Добавляем лог
    newState.logs.unshift({
      user: player.name,
      action: logAction,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    });
    // Ограничиваем историю
    newState.logs = newState.logs.slice(0, 50);

    await updateState(newState);
  };

  return { gameState, loading, performAction, startGame };
}