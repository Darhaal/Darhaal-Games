'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, ScrollText, X, Info,
  Shield, Swords, Skull, Coins,
  Crown, RefreshCw, Loader2, Copy, Check, Clock, Globe,
  LogOut, RotateCcw, User as UserIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// --- Types ---
type Lang = 'ru' | 'en';
type Card = { role: string; revealed: boolean };

type Player = {
  id: string;
  name: string;
  avatarUrl: string;
  coins: number;
  cards: Card[];
  isDead: boolean;
  isHost: boolean;
  isReady: boolean;
};

type GameState = {
  players: Player[];
  deck: string[];
  turnIndex: number;
  logs: { user: string; action: string; time: string }[];
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
  lastActionTime: number; // Для синхронизации таймера
};

// --- Dictionary & Config ---

const DICTIONARY = {
  ru: {
    roles: {
      duke: { name: 'Герцог', action: 'Налог (+3)', desc: 'Блок Помощи' },
      assassin: { name: 'Ассасин', action: 'Убийство (-3)', desc: 'Устранение' },
      captain: { name: 'Капитан', action: 'Кража (+2)', desc: 'Блок Кражи' },
      ambassador: { name: 'Посол', action: 'Обмен', desc: 'Блок Кражи' },
      contessa: { name: 'Графиня', action: '-', desc: 'Блок Убийства' },
    },
    actions: {
      income: 'Доход',
      aid: 'Помощь',
      tax: 'Налог',
      steal: 'Кража',
      assassinate: 'Убийство',
      exchange: 'Обмен',
      coup: 'Переворот',
    },
    logs: {
      start: 'Игра началась!',
      income: 'Доход (+1)',
      aid: 'Помощь (+2)',
      tax: 'Налог (+3)',
      steal: (amount: number, target: string) => `Кража (+${amount}) у ${target}`,
      assassinate: (target: string) => `Убийство (-3) на ${target}`,
      coup: (target: string) => `ПЕРЕВОРОТ на ${target}`,
      exchange: 'Обмен карт',
      winner: (name: string) => `ПОБЕДА: ${name}`,
      restart: 'Хост перезапустил игру',
    },
    ui: {
      waiting: 'Ожидание игроков...',
      copy: 'Скопировать код',
      copied: 'Скопировано!',
      startGame: 'Начать игру',
      waitHost: 'Ожидание хоста...',
      yourTurn: 'ВАШ ХОД',
      deck: 'КОЛОДА',
      log: 'Лог игры',
      rules: 'Правила',
      exchangeTitle: 'Обмен карт',
      exchangeDesc: (count: number) => `Выберите ${count} карты, чтобы оставить`,
      confirm: 'Подтвердить',
      cancel: 'Отмена',
      target: 'ВЫБЕРИТЕ ЦЕЛЬ',
      lost: 'Потеряна',
      eliminated: 'Вы выбыли',
      winnerTitle: 'Победитель!',
      playAgain: 'Играть снова',
      leave: 'Выйти',
    }
  },
  en: {
    roles: {
      duke: { name: 'Duke', action: 'Tax (+3)', desc: 'Block Aid' },
      assassin: { name: 'Assassin', action: 'Assassinate (-3)', desc: 'Eliminate' },
      captain: { name: 'Captain', action: 'Steal (+2)', desc: 'Block Steal' },
      ambassador: { name: 'Ambassador', action: 'Exchange', desc: 'Block Steal' },
      contessa: { name: 'Contessa', action: '-', desc: 'Block Assassination' },
    },
    actions: {
      income: 'Income',
      aid: 'Foreign Aid',
      tax: 'Tax',
      steal: 'Steal',
      assassinate: 'Assassinate',
      exchange: 'Exchange',
      coup: 'Coup',
    },
    logs: {
      start: 'Game started!',
      income: 'Income (+1)',
      aid: 'Foreign Aid (+2)',
      tax: 'Tax (+3)',
      steal: (amount: number, target: string) => `Steal (+${amount}) from ${target}`,
      assassinate: (target: string) => `Assassinate (-3) on ${target}`,
      coup: (target: string) => `COUP on ${target}`,
      exchange: 'Exchange cards',
      winner: (name: string) => `WINNER: ${name}`,
      restart: 'Host restarted the game',
    },
    ui: {
      waiting: 'Waiting for players...',
      copy: 'Copy Code',
      copied: 'Copied!',
      startGame: 'Start Game',
      waitHost: 'Waiting for host...',
      yourTurn: 'YOUR TURN',
      deck: 'DECK',
      log: 'Game Log',
      rules: 'Rules',
      exchangeTitle: 'Exchange Cards',
      exchangeDesc: (count: number) => `Select ${count} cards to keep`,
      confirm: 'Confirm',
      cancel: 'Cancel',
      target: 'SELECT TARGET',
      lost: 'Lost',
      eliminated: 'You are out',
      winnerTitle: 'Winner!',
      playAgain: 'Play Again',
      leave: 'Leave',
    }
  }
};

const getRoleConfig = (role: string, lang: Lang) => {
  // @ts-ignore
  const config = DICTIONARY[lang].roles[role] || DICTIONARY[lang].roles.duke;
  const icons: Record<string, React.ReactNode> = {
    duke: <Crown className="w-5 h-5" />,
    assassin: <Skull className="w-5 h-5" />,
    captain: <Swords className="w-5 h-5" />,
    ambassador: <RefreshCw className="w-5 h-5" />,
    contessa: <Shield className="w-5 h-5" />
  };
  const colors: Record<string, string> = {
    duke: '#9E1316',
    assassin: '#7B1012',
    captain: '#8C1215',
    ambassador: '#B21A1E',
    contessa: '#A31619'
  };

  return { ...config, icon: icons[role] || icons.duke, color: colors[role] || colors.duke };
};

// --- Helpers ---

const shuffleDeck = (array: string[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const addLog = (currentLogs: any[], user: string, action: string, time: string) => {
    const newLogs = [...currentLogs, { user, action, time }];
    if (newLogs.length > 50) newLogs.shift();
    return newLogs;
};

// --- Components ---

const PlayerAvatar = React.memo(({ url, name, size = 'md', border = false, borderColor = 'border-white' }: { url: string, name: string, size?: 'sm' | 'md' | 'lg' | 'xl', border?: boolean, borderColor?: string }) => {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs sm:w-12 sm:h-12 sm:text-sm',
    lg: 'w-14 h-14 text-sm sm:w-16 sm:h-16',
    xl: 'w-20 h-20 text-xl'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center bg-[#1A1F26] text-white font-bold relative ${border ? `border-4 ${borderColor}` : ''}`}>
      {!error ? (
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span>{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
});
PlayerAvatar.displayName = 'PlayerAvatar';

const GameCard = React.memo(({ card, lang, onClick, selectable = false, selected = false }: { card: Card, lang: Lang, onClick?: () => void, selectable?: boolean, selected?: boolean }) => {
    const roleInfo = getRoleConfig(card.role, lang);
    const t = DICTIONARY[lang].ui;

    return (
        <div
          onClick={onClick}
          className={`
            relative w-28 h-40 sm:w-32 sm:h-48 rounded-xl shadow-lg transition-all duration-700 [transform-style:preserve-3d]
            ${selectable ? 'cursor-pointer hover:-translate-y-2' : ''}
            ${selected ? 'ring-4 ring-[#9e1316] scale-105' : ''}
            ${card.revealed ? 'opacity-60 grayscale border-gray-200 [transform:rotateY(180deg)]' : 'border-[#E6E1DC] bg-white'}
          `}
        >
            {/* Front Face */}
            <div className="absolute inset-0 flex flex-col rounded-xl overflow-hidden border border-[#E6E1DC] bg-white [backface-visibility:hidden]">
                <div className="h-12 sm:h-14 w-full flex items-center justify-center transition-colors" style={{ backgroundColor: roleInfo.color }}>
                    <div className="text-white drop-shadow-md scale-110 sm:scale-125">{roleInfo.icon}</div>
                </div>
                <div className="flex-1 p-2 text-center flex flex-col items-center justify-between">
                    <div>
                        <div className="font-black text-xs sm:text-sm uppercase mb-1" style={{ color: roleInfo.color }}>{roleInfo.name}</div>
                        <div className="text-[9px] sm:text-[10px] text-[#8A9099] leading-tight">{roleInfo.desc}</div>
                    </div>
                    <div className="bg-[#F8FAFC] w-full py-1 rounded text-[9px] sm:text-[10px] font-bold text-[#1A1F26] uppercase border border-[#F1F5F9]">{roleInfo.action}</div>
                </div>
                {selected && <div className="absolute inset-0 bg-[#9e1316]/10 flex items-center justify-center z-10"><Check className="w-10 h-10 text-[#9e1316]" /></div>}
            </div>

            {/* Back Face (Revealed) */}
            <div className="absolute inset-0 bg-gray-100 rounded-xl border border-gray-300 flex items-center justify-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    <div className="text-center p-2">
                        <Skull className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">{t.lost}</span>
                        <div className="text-xs font-black text-gray-600 mt-1">{roleInfo.name}</div>
                    </div>
            </div>
        </div>
    );
});
GameCard.displayName = 'GameCard';

const ActionButton = ({ onClick, label, color = 'text-[#1A1F26]', bg = 'bg-white', disabled = false, icon = null }: any) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`
            col-span-1 border border-[#E6E1DC] p-2 sm:p-3 rounded-xl
            text-[9px] sm:text-[10px] font-bold uppercase transition-all
            flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center
            ${bg} ${color}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:scale-105 hover:shadow-md active:scale-95'}
        `}
    >
        {icon} <span>{label}</span>
    </button>
);


// --- Main Component ---

export default function CoupGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyId = searchParams.get('id');

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [lang, setLang] = useState<Lang>('ru');
  const [copied, setCopied] = useState(false);

  // UI States
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectionMode, setSelectionMode] = useState<{ active: boolean; action: string | null }>({ active: false, action: null });
  const [exchangeMode, setExchangeMode] = useState<{ active: boolean; tempHand: Card[]; keptIndices: number[] }>({ active: false, tempHand: [], keptIndices: [] });

  const [gameState, setGameState] = useState<GameState>({
    players: [],
    deck: [],
    turnIndex: 0,
    logs: [],
    status: 'waiting',
    lastActionTime: Date.now()
  });

  const logRef = useRef<HTMLDivElement>(null);

  // 1. Init & Lang
  useEffect(() => {
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, []);

  // 2. Load & Subscribe
  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    const { data } = await supabase.from('lobbies').select('game_state').eq('id', lobbyId).single();
    if (data && data.game_state) {
      setGameState(data.game_state);
    }
  }, [lobbyId]);

  useEffect(() => {
    if (!lobbyId) {
      router.push('/play');
      return;
    }
    fetchLobbyState();

    const channel = supabase
      .channel(`lobby:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, (payload: any) => {
        if (payload.new && payload.new.game_state) {
          setGameState(payload.new.game_state);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, router, fetchLobbyState]);

  // 3. Auto-Join
  useEffect(() => {
    if (!user || loading || gameState.status !== 'waiting') return;
    const imInGame = gameState.players.some(p => p.id === user.id);
    if (!imInGame) joinLobby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, gameState.status]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [gameState.logs.length]);

  const isMyTurn = user && gameState.players[gameState.turnIndex]?.id === user.id && !gameState.winner;
  const t = DICTIONARY[lang];

  // 4. Timer Logic
  useEffect(() => {
    // Sync timer with server state if possible, or reset locally on turn change
    setTimeLeft(30);
  }, [gameState.turnIndex, gameState.status]);

  useEffect(() => {
    if (gameState.status !== 'playing') return;

    const timer = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                if (isMyTurn && !selectionMode.active && !exchangeMode.active) {
                     // Auto-action if my turn
                     handleIncome();
                }
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, gameState.status, gameState.turnIndex]);

  // --- Actions Logic Refactored ---

  const updateGameState = async (newState: GameState) => {
    setGameState(newState);
    await supabase.from('lobbies').update({ game_state: newState }).eq('id', lobbyId);
  };

  const copyLobbyCode = () => {
    if (!lobbyId) return;
    navigator.clipboard.writeText(lobbyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkWinner = (players: Player[]): string | null => {
    const alive = players.filter(p => !p.isDead);
    return alive.length === 1 ? alive[0].name : null;
  };

  const findNextAliveIndex = (current: number, players: Player[]) => {
      let next = (current + 1) % players.length;
      let loopCount = 0;
      while (players[next].isDead && next !== current) {
          next = (next + 1) % players.length;
          loopCount++;
          if (loopCount > players.length) return -1;
      }
      return next;
  };

  // --- Game Lifecycle ---

  const joinLobby = async () => {
    if (!user || gameState.players.some(p => p.id === user.id)) return;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const name = profile?.username || user.email?.split('@')[0] || 'Player';
    const avatar = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

    const newPlayer: Player = {
      id: user.id, name, avatarUrl: avatar,
      coins: 2, cards: [], isDead: false,
      isHost: gameState.players.length === 0, isReady: false
    };

    await updateGameState({ ...gameState, players: [...gameState.players, newPlayer] });
  };

  const startGame = async () => {
    const roles = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];
    let deck: string[] = [];
    roles.forEach(r => deck.push(r, r, r));
    deck = shuffleDeck(deck);

    const playersWithCards = gameState.players.map(p => {
      const pCards = deck.splice(0, 2).map(role => ({ role, revealed: false }));
      return { ...p, cards: pCards, coins: 2, isDead: false };
    });

    await updateGameState({
      ...gameState,
      status: 'playing',
      players: playersWithCards,
      deck: deck,
      turnIndex: 0,
      logs: addLog(gameState.logs, 'System', t.logs.start, getTime()),
      lastActionTime: Date.now()
    });
  };

  const restartGame = async () => {
    // Reset state but keep players
    const newPlayers = gameState.players.map(p => ({
        ...p, coins: 2, cards: [], isDead: false
    }));
    await updateGameState({
        ...gameState,
        players: newPlayers,
        status: 'waiting',
        logs: addLog(gameState.logs, 'System', t.logs.restart, getTime()),
        winner: undefined
    });
  };

  // --- Specific Action Handlers ---

  const finalizeTurn = async (newPlayers: Player[], logText: string, currentDeck?: string[]) => {
      const currentPlayer = gameState.players[gameState.turnIndex];
      const winnerName = checkWinner(newPlayers);
      let newStatus = gameState.status;
      let nextTurn = true;

      if (winnerName) {
          newStatus = 'finished';
          logText += ` | ${t.logs.winner(winnerName)}`;
          nextTurn = false;
      }

      let nextIndex = gameState.turnIndex;
      if (nextTurn && newStatus === 'playing') {
          nextIndex = findNextAliveIndex(gameState.turnIndex, newPlayers);
          if (nextIndex === -1) nextIndex = gameState.turnIndex;
      }

      await updateGameState({
          players: newPlayers,
          deck: currentDeck || gameState.deck,
          turnIndex: nextIndex,
          winner: winnerName || undefined,
          status: newStatus,
          logs: addLog(gameState.logs, currentPlayer.name, logText, getTime()),
          lastActionTime: Date.now()
      });
  };

  const handleIncome = async () => {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.turnIndex].coins += 1;
      await finalizeTurn(newPlayers, t.logs.income);
  };

  const handleAid = async () => {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.turnIndex].coins += 2;
      await finalizeTurn(newPlayers, t.logs.aid);
  };

  const handleTax = async () => {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.turnIndex].coins += 3;
      await finalizeTurn(newPlayers, t.logs.tax);
  };

  const handleSteal = async (targetIndex: number) => {
      const newPlayers = [...gameState.players];
      const target = newPlayers[targetIndex];
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      newPlayers[gameState.turnIndex].coins += stolen;
      await finalizeTurn(newPlayers, t.logs.steal(stolen, target.name));
  };

  const handleAssassinate = async (targetIndex: number) => {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.turnIndex].coins -= 3;
      loseCard(targetIndex, newPlayers);
      await finalizeTurn(newPlayers, t.logs.assassinate(newPlayers[targetIndex].name));
  };

  const handleCoup = async (targetIndex: number) => {
      const newPlayers = [...gameState.players];
      newPlayers[gameState.turnIndex].coins -= 7;
      loseCard(targetIndex, newPlayers);
      await finalizeTurn(newPlayers, t.logs.coup(newPlayers[targetIndex].name));
  };

  const loseCard = (playerIdx: number, playersArray: Player[]) => {
      const cardIdx = playersArray[playerIdx].cards.findIndex(c => !c.revealed);
      if (cardIdx !== -1) {
          playersArray[playerIdx].cards[cardIdx].revealed = true;
          if (playersArray[playerIdx].cards.every(c => c.revealed)) {
              playersArray[playerIdx].isDead = true;
              playersArray[playerIdx].coins = 0;
          }
      }
  };

  // --- Dispatcher ---

  const initiateAction = (actionType: string) => {
      const me = gameState.players[gameState.turnIndex];
      if (actionType === 'coup' && me.coins < 7) return;
      if (actionType === 'assassinate' && me.coins < 3) return;

      if (['coup', 'steal', 'assassinate'].includes(actionType)) {
          setSelectionMode({ active: true, action: actionType });
          return;
      }
      if (actionType === 'exchange') {
          handleExchangeStart();
          return;
      }

      if (actionType === 'income') handleIncome();
      else if (actionType === 'aid') handleAid();
      else if (actionType === 'tax') handleTax();
  };

  const handleTargetClick = (targetId: string) => {
      if (!selectionMode.active || !selectionMode.action) return;
      if (targetId === user?.id) return;

      const targetIndex = gameState.players.findIndex(p => p.id === targetId);
      if (targetIndex === -1 || gameState.players[targetIndex].isDead) return;

      if (selectionMode.action === 'coup') handleCoup(targetIndex);
      else if (selectionMode.action === 'steal') handleSteal(targetIndex);
      else if (selectionMode.action === 'assassinate') handleAssassinate(targetIndex);

      setSelectionMode({ active: false, action: null });
  };

  // --- Exchange Logic ---

  const handleExchangeStart = () => {
      const me = gameState.players[gameState.turnIndex];
      const myHand = me.cards.filter(c => !c.revealed);

      const currentDeck = [...gameState.deck];
      const drawn: Card[] = [];
      for(let i=0; i<2; i++) {
          const role = currentDeck.shift();
          if (role) drawn.push({ role, revealed: false });
      }

      setExchangeMode({ active: true, tempHand: [...myHand, ...drawn], keptIndices: [] });
  };

  const confirmExchange = async () => {
      const { tempHand, keptIndices } = exchangeMode;
      const currentPlayerIdx = gameState.turnIndex;
      const requiredCount = gameState.players[currentPlayerIdx].cards.filter(c => !c.revealed).length;

      if (keptIndices.length !== requiredCount) return;

      const keptCards = keptIndices.map(i => tempHand[i]);
      const returnedToDeck = tempHand.filter((_, i) => !keptIndices.includes(i)).map(c => c.role);

      let newDeck = [...gameState.deck];
      newDeck.splice(0, 2);
      newDeck.push(...returnedToDeck);
      newDeck = shuffleDeck(newDeck);

      const newPlayers = [...gameState.players];
      const oldRevealed = newPlayers[currentPlayerIdx].cards.filter(c => c.revealed);
      newPlayers[currentPlayerIdx].cards = [...oldRevealed, ...keptCards];

      setExchangeMode({ active: false, tempHand: [], keptIndices: [] });
      await finalizeTurn(newPlayers, t.logs.exchange, newDeck);
  };


  // --- Render ---

  if (loading) return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" /></div>;

  const me = gameState.players.find(p => p.id === user?.id);
  const opponents = gameState.players.filter(p => p.id !== user?.id);
  const isHost = me?.isHost;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] font-sans relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      {/* Header */}
      <header className="p-4 border-b border-[#E6E1DC] bg-white/80 backdrop-blur-md flex justify-between items-center z-20 shadow-sm">
        <button onClick={() => router.push('/')} className="p-2 text-[#8A9099] hover:text-[#9e1316]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
             <h1 className="font-black text-xl uppercase flex items-center gap-2 tracking-tight"><ScrollText className="w-6 h-6 text-[#9e1316]" /> COUP</h1>
             {gameState.status === 'waiting' && <span className="text-[10px] font-bold text-[#9e1316] uppercase tracking-widest">{t.ui.waiting}</span>}

             {selectionMode.active && <span className="text-xs font-bold text-white bg-[#9e1316] px-3 py-1 rounded-full animate-pulse mt-1">{t.ui.target}</span>}

             {isMyTurn && !selectionMode.active && !exchangeMode.active && gameState.status === 'playing' && (
                 <div className="flex flex-col items-center mt-1 w-32">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t.ui.yourTurn}
                    </span>
                    <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div
                           className={`h-full transition-all duration-1000 ease-linear ${timeLeft < 10 ? 'bg-red-500' : 'bg-emerald-500'}`}
                           style={{ width: `${(timeLeft / 30) * 100}%` }}
                        />
                    </div>
                 </div>
             )}
        </div>
        <div className="flex gap-2">
            <button onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')} className="p-2 text-[#8A9099] hover:text-[#1A1F26]">
                <Globe className="w-5 h-5" />
            </button>
            <button onClick={() => setShowInfo(true)} className="p-2 text-[#8A9099] hover:text-[#9e1316]"><Info className="w-5 h-5" /></button>
        </div>
      </header>

      {/* LOBBY AREA */}
      {gameState.status === 'waiting' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 animate-in fade-in zoom-in-95 duration-500">
           <div className="bg-white p-8 rounded-[32px] border border-[#E6E1DC] shadow-xl max-w-2xl w-full">
              <h2 className="text-2xl font-black mb-6 text-center">{t.ui.waiting} ({gameState.players.length})</h2>
              <div className="space-y-3 mb-8">
                  {gameState.players.map(p => (
                      <div key={p.id} className="flex items-center gap-4 p-3 bg-[#F5F5F0] rounded-xl border border-[#E6E1DC]">
                          <PlayerAvatar url={p.avatarUrl} name={p.name} />
                          <span className="font-bold flex-1 text-[#1A1F26]">{p.name} {p.id === user?.id && '(You)'}</span>
                          {p.isHost && <Crown className="w-4 h-4 text-[#9e1316]" />}
                      </div>
                  ))}
              </div>
              <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-4 bg-[#1A1F26] rounded-xl text-white group cursor-pointer active:scale-95 transition-transform" onClick={copyLobbyCode}>
                      <span className="font-mono font-bold tracking-widest text-lg">CODE: {lobbyId?.slice(0, 4).toUpperCase() || '...'}</span>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] uppercase font-bold text-gray-400 group-hover:text-white transition-colors">{copied ? t.ui.copied : t.ui.copy}</span>
                         {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 group-hover:text-[#9e1316] transition-colors" />}
                      </div>
                  </div>
                  {isHost ? (
                      <button
                        onClick={startGame}
                        disabled={gameState.players.length < 2}
                        className="w-full py-4 bg-[#9e1316] text-white font-bold rounded-xl uppercase tracking-widest shadow-lg hover:shadow-xl hover:bg-[#7a0f11] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t.ui.startGame}
                      </button>
                  ) : (
                      <div className="text-center text-xs font-bold text-[#8A9099] uppercase tracking-widest mt-2 animate-pulse">{t.ui.waitHost}</div>
                  )}
              </div>
           </div>
        </div>
      )}

      {/* GAME AREA */}
      {(gameState.status === 'playing' || gameState.status === 'finished') && (
        <div className="flex-1 p-2 sm:p-4 relative z-10 flex flex-col justify-between max-w-7xl mx-auto w-full h-[calc(100vh-70px)]">

            {/* OPPONENTS */}
            <div className="flex justify-center gap-4 sm:gap-6 flex-wrap py-2 sm:py-4">
                {opponents.map((p) => {
                    const isTurn = gameState.players[gameState.turnIndex]?.id === p.id && !gameState.winner;
                    const isSelectable = selectionMode.active && !p.isDead;
                    return (
                        <div
                           key={p.id}
                           onClick={() => isSelectable && handleTargetClick(p.id)}
                           className={`flex flex-col items-center gap-2 transition-all duration-300 relative
                             ${isTurn ? 'scale-110 z-10' : 'opacity-80'}
                             ${p.isDead ? 'grayscale opacity-60' : ''}
                             ${isSelectable ? 'cursor-pointer hover:scale-105' : ''}
                           `}
                        >
                            <div className="relative">
                                <PlayerAvatar
                                    url={p.avatarUrl} name={p.name} size="lg" border={isTurn || isSelectable}
                                    borderColor={isTurn ? 'border-[#9e1316]' : isSelectable ? 'border-emerald-400' : ''}
                                />
                                {isTurn && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#9e1316] text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm whitespace-nowrap">TURN</div>}
                                {p.isDead && <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center"><Skull className="text-white w-6 h-6"/></div>}
                                {isSelectable && <div className="absolute inset-0 rounded-full border-4 border-emerald-500/50 animate-ping"></div>}
                            </div>

                            <div className="flex flex-col items-center bg-white/90 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-lg border border-[#E6E1DC] shadow-sm">
                                <span className="text-[10px] sm:text-xs font-bold truncate max-w-[80px]">{p.name}</span>
                                <div className="flex gap-2 text-[10px] sm:text-xs">
                                    <span className="flex items-center text-yellow-600"><Coins className="w-3 h-3 mr-1" />{p.coins}</span>
                                    <span className="flex items-center"><Shield className="w-3 h-3 mr-1" />{p.cards.filter(c => !c.revealed).length}</span>
                                </div>
                            </div>

                            <div className="flex -space-x-2">
                                {p.cards.map((c, i) => (
                                    <div key={i} className={`w-5 h-7 sm:w-6 sm:h-8 rounded border shadow-sm ${c.revealed ? 'bg-gray-300' : 'bg-[#1A1F26]'}`}>
                                        {c.revealed && <X className="w-full h-full p-1 text-red-500" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* LOGS & DECK */}
            <div className="flex justify-between items-center px-2 md:px-20 h-28 sm:h-32 mb-2">
                 <div className="hidden md:block w-64 h-full bg-white/70 backdrop-blur border border-[#E6E1DC] rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-[#F5F5F0] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8A9099]">{t.ui.log}</div>
                    <div ref={logRef} className="h-full overflow-y-auto p-2 text-xs space-y-1 pb-8">
                        {gameState.logs.map((log, i) => (
                            <div key={i}><span className="font-bold text-[#1A1F26]">{log.user}:</span> <span className="text-[#555]">{log.action}</span></div>
                        ))}
                    </div>
                 </div>

                 {/* Таймер для всех (визуальный) */}
                 <div className="flex flex-col items-center justify-center mx-auto md:mx-0">
                     <div className="w-16 h-24 sm:w-20 sm:h-28 bg-[#1A1F26] rounded-xl border-4 border-white shadow-xl flex items-center justify-center text-white/20 font-black relative overflow-hidden">
                        <span className="relative z-10 text-xs sm:text-base">{t.ui.deck}</span>
                        <span className="absolute bottom-2 text-[10px] sm:text-xs opacity-50">{gameState.deck.length}</span>
                     </div>
                 </div>

                 <div className="hidden md:block w-64"></div>
            </div>

            {/* ME */}
            {me && (
                <div className="flex flex-col items-center gap-2 sm:gap-4 w-full max-w-3xl mx-auto pb-2">
                    {me.isDead ? (
                        <div className="text-2xl font-black text-red-500 bg-white px-6 py-2 rounded-xl shadow-lg uppercase border border-red-100">{t.ui.eliminated}</div>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 sm:gap-6 bg-white px-4 sm:px-6 py-2 rounded-2xl border border-[#E6E1DC] shadow-lg relative z-20">
                                <div className="absolute -top-5 sm:-top-6 left-1/2 -translate-x-1/2 rounded-full border-4 border-white shadow-sm">
                                    <PlayerAvatar url={me.avatarUrl} name={me.name} size="lg" />
                                </div>
                                <div className="flex items-center gap-2"><Coins className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" /><span className="text-xl sm:text-2xl font-black">{me.coins}</span></div>
                                <div className="h-6 sm:h-8 w-px bg-[#E6E1DC]"></div>
                                <div className="font-bold text-xs sm:text-sm text-[#1A1F26] mt-2">{me.name}</div>
                            </div>

                            {/* Карты */}
                            <div className="flex gap-4 justify-center -mt-2 z-10 perspective-1000">
                                {me.cards.map((card, idx) => (
                                    <GameCard key={idx} card={card} lang={lang} />
                                ))}
                            </div>

                            {/* Кнопки Действий */}
                            <div className={`
                                grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 w-full
                                bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-[#E6E1DC] shadow-2xl
                                transition-opacity duration-300 ${(!isMyTurn || selectionMode.active || exchangeMode.active) ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}
                            `}>
                                <ActionButton onClick={() => initiateAction('income')} label={t.actions.income} disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('aid')} label={t.actions.aid} disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('tax')} label={t.actions.tax} color="text-[#9E1316]" disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('steal')} label={t.actions.steal} color="text-[#2563EB]" disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('assassinate')} label={t.actions.assassinate} color="text-[#1A1F26]" disabled={!isMyTurn || me.coins < 3} />
                                <ActionButton onClick={() => initiateAction('exchange')} label={t.actions.exchange} color="text-[#D97706]" disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('coup')} label={`${t.actions.coup} (-7)`} bg="bg-[#1A1F26] text-white hover:bg-[#9e1316]" disabled={!isMyTurn || me.coins < 7} icon={<Skull className="w-3 h-3" />} />
                            </div>

                            {selectionMode.active && (
                                <button
                                  onClick={() => setSelectionMode({ active: false, action: null })}
                                  className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white border border-[#E6E1DC] text-[#1A1F26] px-6 py-2 rounded-full font-bold shadow-xl hover:bg-[#F5F5F0] transition-all z-20"
                                >
                                    {t.ui.cancel}
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white p-8 rounded-3xl max-w-lg w-full relative">
                 <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X /></button>
                 <h2 className="text-2xl font-black mb-4">{t.ui.rules}</h2>
                 <div className="space-y-3 text-sm text-gray-600">
                    {Object.entries(t.roles).map(([key, val]) => (
                        <div key={key} className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="font-bold uppercase text-[#1A1F26]">{(val as any).name}</span>
                            <span className="text-[#9e1316]">{(val as any).action}</span>
                            <span className="text-gray-400">{(val as any).desc}</span>
                        </div>
                    ))}
                 </div>
             </div>
        </div>
      )}

      {/* Exchange Modal */}
      {exchangeMode.active && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white p-8 rounded-[32px] max-w-3xl w-full border border-[#E6E1DC] shadow-2xl">
                  <h2 className="text-2xl font-black mb-2 text-center uppercase">{t.ui.exchangeTitle}</h2>
                  <p className="text-center text-[#8A9099] font-bold mb-8">
                     {t.ui.exchangeDesc(gameState.players[gameState.turnIndex].cards.filter(c => !c.revealed).length)}
                  </p>

                  <div className="flex justify-center gap-4 mb-8 flex-wrap">
                      {exchangeMode.tempHand.map((card, idx) => (
                          <GameCard
                             key={idx}
                             card={card}
                             lang={lang}
                             selectable={true}
                             selected={exchangeMode.keptIndices.includes(idx)}
                             onClick={() => {
                                const currentKept = exchangeMode.keptIndices;
                                const currentPlayerIdx = gameState.turnIndex;
                                const requiredCount = gameState.players[currentPlayerIdx].cards.filter(c => !c.revealed).length;

                                if (exchangeMode.keptIndices.includes(idx)) {
                                    setExchangeMode({ ...exchangeMode, keptIndices: currentKept.filter(i => i !== idx) });
                                } else {
                                    if (currentKept.length < requiredCount) {
                                        setExchangeMode({ ...exchangeMode, keptIndices: [...currentKept, idx] });
                                    }
                                }
                             }}
                          />
                      ))}
                  </div>

                  <button
                    onClick={confirmExchange}
                    disabled={exchangeMode.keptIndices.length !== gameState.players[gameState.turnIndex].cards.filter(c => !c.revealed).length}
                    className="w-full py-4 bg-[#1A1F26] text-white font-bold rounded-xl uppercase tracking-widest shadow-lg hover:shadow-xl hover:bg-[#9e1316] transition-colors disabled:opacity-50 disabled:hover:bg-[#1A1F26]"
                  >
                      {t.ui.confirm}
                  </button>
              </div>
          </div>
      )}

      {/* Winner Overlay */}
      {gameState.status === 'finished' && gameState.winner && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-500">
              <div className="bg-white p-10 rounded-[40px] border-2 border-[#9e1316] shadow-2xl text-center max-w-md w-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-[#9e1316]" />
                  <Crown className="w-16 h-16 text-[#9e1316] mx-auto mb-4 animate-bounce" />
                  <h2 className="text-3xl font-black uppercase text-[#1A1F26] mb-2">{t.ui.winnerTitle}</h2>
                  <p className="text-2xl font-bold text-[#9e1316] mb-8">{gameState.winner}</p>

                  <div className="space-y-3">
                      {isHost && (
                          <button onClick={restartGame} className="w-full py-4 bg-[#1A1F26] hover:bg-[#9e1316] text-white font-bold rounded-xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                             <RotateCcw className="w-4 h-4" /> {t.ui.playAgain}
                          </button>
                      )}
                      <button onClick={() => router.push('/play')} className="w-full py-4 bg-white border border-[#E6E1DC] hover:border-[#1A1F26] text-[#1A1F26] font-bold rounded-xl uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                          <LogOut className="w-4 h-4" /> {t.ui.leave}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}