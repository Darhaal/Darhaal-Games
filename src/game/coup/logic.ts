import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Crown, Skull, Swords, RefreshCw, Shield } from 'lucide-react';

// --- ТИПЫ ДАННЫХ ---

export type Role = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';

export interface Card {
  role: Role;
  revealed: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatarUrl: string;
  coins: number;
  cards: Card[];
  isDead: boolean;
  isHost: boolean;
}

export interface GameLog {
  user: string;
  action: string;
  time: string;
}

export interface GameState {
  players: Player[];
  deck: Role[];
  turnIndex: number;
  logs: GameLog[];
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
  lastActionTime: number;
}

// --- КОНСТАНТЫ ---

export const ROLE_CONFIG: Record<Role, { color: string; icon: any }> = {
  duke: { color: '#6D28D9', icon: Crown },
  assassin: { color: '#991B1B', icon: Skull },
  captain: { color: '#1D4ED8', icon: Swords },
  ambassador: { color: '#047857', icon: RefreshCw },
  contessa: { color: '#374151', icon: Shield }
};

export const DICTIONARY = {
  ru: {
    roles: {
      duke: { name: 'Герцог', desc: 'Налог (+3). Блок помощи.' },
      assassin: { name: 'Ассасин', desc: 'Убийство (-3 монет).' },
      captain: { name: 'Капитан', desc: 'Кража (+2). Блок кражи.' },
      ambassador: { name: 'Посол', desc: 'Обмен карт. Блок кражи.' },
      contessa: { name: 'Графиня', desc: 'Блокирует убийство.' },
    },
    actions: {
      income: 'Доход', aid: 'Помощь', tax: 'Налог', steal: 'Кража',
      assassinate: 'Убийство', exchange: 'Обмен', coup: 'Переворот'
    },
    logs: {
      start: 'Игра началась',
      income: 'взял Доход (+1)',
      aid: 'взял Помощь (+2)',
      tax: 'взял Налог (+3)',
      steal: (target: string) => `украл у ${target}`,
      assassinate: (target: string) => `убил карту ${target}`,
      coup: (target: string) => `совершил Переворот на ${target}`,
      exchange: 'обменял карты',
      win: 'ПОБЕДИЛ!'
    }
  }
};

// --- ХУК ЛОГИКИ (ENGINE) ---

export function useCoupLogic(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Инициализация и получение данных
  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    const { data } = await supabase.from('lobbies').select('game_state').eq('id', lobbyId).single();
    if (data?.game_state) {
      setGameState(data.game_state);
    }
    setLoading(false);
  }, [lobbyId]);

  // 2. Подписка на Realtime (Мультиплеер)
  useEffect(() => {
    if (!lobbyId) return;
    fetchLobbyState();

    const channel = supabase.channel(`lobby_coup:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => {
        if (payload.new?.game_state) {
          setGameState(payload.new.game_state);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, fetchLobbyState]);

  // 3. Утилиты игры
  const getNextTurn = (players: Player[], currentIdx: number) => {
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
    return player;
  };

  // 4. Главная функция действия (Action Committer)
  const performAction = async (actionType: string, targetId?: string) => {
    if (!gameState || !userId) return;

    // Глубокая копия стейта
    const newState: GameState = JSON.parse(JSON.stringify(gameState));
    const playerIdx = newState.turnIndex;
    const player = newState.players[playerIdx];

    // Валидация хода
    if (player.id !== userId) return;

    let logAction = '';

    // Логика действий
    switch (actionType) {
      case 'income':
        player.coins += 1;
        logAction = DICTIONARY.ru.logs.income;
        break;
      case 'aid':
        player.coins += 2;
        logAction = DICTIONARY.ru.logs.aid;
        break;
      case 'tax':
        player.coins += 3;
        logAction = DICTIONARY.ru.logs.tax;
        break;
      case 'steal':
        if (targetId) {
          const target = newState.players.find(p => p.id === targetId);
          if (target) {
            const stolen = Math.min(2, target.coins);
            target.coins -= stolen;
            player.coins += stolen;
            logAction = DICTIONARY.ru.logs.steal(target.name);
          }
        }
        break;
      case 'assassinate':
        if (targetId && player.coins >= 3) {
          player.coins -= 3;
          const target = newState.players.find(p => p.id === targetId);
          if (target) {
            killPlayerCard(target);
            logAction = DICTIONARY.ru.logs.assassinate(target.name);
          }
        }
        break;
      case 'coup':
        if (targetId && player.coins >= 7) {
          player.coins -= 7;
          const target = newState.players.find(p => p.id === targetId);
          if (target) {
            killPlayerCard(target);
            logAction = DICTIONARY.ru.logs.coup(target.name);
          }
        }
        break;
      case 'exchange':
        // Упрощенная логика обмена для MVP: просто перемешиваем колоду и выдаем новые (в полной версии нужен выбор)
        // Здесь мы покажем, как это делается правильно: берем 2 из колоды, выбираем.
        // Для примера просто пометим лог. Реализация UI обмена требует модального окна в page.tsx
        logAction = DICTIONARY.ru.logs.exchange;
        break;
    }

    // Финализация хода
    const winner = checkWinner(newState.players);
    if (winner) {
      newState.winner = winner;
      newState.status = 'finished';
      logAction += ` | ${DICTIONARY.ru.logs.win}`;
    } else {
      newState.turnIndex = getNextTurn(newState.players, newState.turnIndex);
    }

    newState.logs.unshift({
      user: player.name,
      action: logAction,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    });
    newState.logs = newState.logs.slice(0, 50);

    // Оптимистичное обновление
    setGameState(newState);
    // Отправка на сервер
    await supabase.from('lobbies').update({ game_state: newState }).eq('id', lobbyId);
  };

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
      logs: [{ user: 'Система', action: DICTIONARY.ru.logs.start, time: '' }],
      winner: undefined
    };

    setGameState(newState);
    await supabase.from('lobbies').update({ game_state: newState }).eq('id', lobbyId);
  };

  return { gameState, loading, performAction, startGame };
}