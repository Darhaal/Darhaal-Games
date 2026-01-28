'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, ScrollText, X, Info,
  Shield, Swords, Skull, Coins,
  Crown, RefreshCw, Loader2, Copy, Check, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

// --- Types ---
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
};

const ROLES_CONFIG: Record<string, { name: string; color: string; icon: React.ReactNode; action: string; desc: string }> = {
  duke: { name: 'Герцог', color: '#9E1316', icon: <Crown className="w-5 h-5" />, action: 'Налог (+3)', desc: 'Блок Помощи' },
  assassin: { name: 'Ассасин', color: '#7B1012', icon: <Skull className="w-5 h-5" />, action: 'Убийство (-3)', desc: 'Устранение' },
  captain: { name: 'Капитан', color: '#8C1215', icon: <Swords className="w-5 h-5" />, action: 'Кража (+2)', desc: 'Блок Кражи' },
  ambassador: { name: 'Посол', color: '#B21A1E', icon: <RefreshCw className="w-5 h-5" />, action: 'Обмен', desc: 'Блок Кражи' },
  contessa: { name: 'Графиня', color: '#A31619', icon: <Shield className="w-5 h-5" />, action: '-', desc: 'Блок Убийства' },
};

// --- Helpers ---

// Алгоритм Фишера-Йейтса
const shuffleDeck = (array: string[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const addLog = (currentLogs: { user: string; action: string; time: string }[], user: string, action: string) => {
    const newLogs = [...currentLogs, { user, action, time: getTime() }];
    if (newLogs.length > 50) newLogs.shift();
    return newLogs;
};

// --- Components ---

// Memoized Card Component for performance
const GameCard = React.memo(({ card, onClick, selectable = false, selected = false }: { card: Card, onClick?: () => void, selectable?: boolean, selected?: boolean }) => {
    const roleInfo = ROLES_CONFIG[card.role] || ROLES_CONFIG.duke;

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
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Потеряна</span>
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
  const [timeLeft, setTimeLeft] = useState(30);

  // Локальные состояния для UI действий
  const [selectionMode, setSelectionMode] = useState<{ active: boolean; action: string | null }>({ active: false, action: null });
  const [exchangeMode, setExchangeMode] = useState<{ active: boolean; tempHand: Card[]; keptIndices: number[] }>({ active: false, tempHand: [], keptIndices: [] });

  const [gameState, setGameState] = useState<GameState>({
    players: [],
    deck: [],
    turnIndex: 0,
    logs: [],
    status: 'waiting'
  });

  const logRef = useRef<HTMLDivElement>(null);

  // 1. Инициализация
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, []);

  // 2. Загрузка и Подписка
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
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload: any) => {
          if (payload.new && payload.new.game_state) {
            setGameState(payload.new.game_state);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId, router, fetchLobbyState]);

  // 3. Вход в лобби (Оптимизированный)
  useEffect(() => {
    if (!user || loading) return;
    if (gameState.status !== 'waiting') return;

    const imInGame = gameState.players.some(p => p.id === user.id);
    if (!imInGame) {
      joinLobby();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, gameState.status]);

  // Автоскролл
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [gameState.logs.length]);

  const isMyTurn = user && gameState.players[gameState.turnIndex]?.id === user.id && !gameState.winner;

  // 4. Таймер хода
  useEffect(() => {
    // Сбрасываем таймер при смене хода или статуса
    setTimeLeft(30);
  }, [gameState.turnIndex, gameState.status]);

  useEffect(() => {
    if (!isMyTurn || gameState.status !== 'playing' || selectionMode.active || exchangeMode.active) return;

    const timer = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                clearInterval(timer);
                commitAction('income'); // Auto-action timeout
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, gameState.status, selectionMode.active, exchangeMode.active]);


  // --- Logic Helpers ---

  const copyLobbyCode = () => {
    if (!lobbyId) return;
    navigator.clipboard.writeText(lobbyId).then(() => {
        // Optional toast
    });
  };

  const updateGameState = async (newState: GameState) => {
    setGameState(newState);
    await supabase.from('lobbies').update({ game_state: newState }).eq('id', lobbyId);
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

  // --- Game Actions ---

  const joinLobby = async () => {
    if (!user) return;
    if (gameState.players.some(p => p.id === user.id)) return;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const name = profile?.username || user.email?.split('@')[0] || 'Player';
    const avatar = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

    const newPlayer: Player = {
      id: user.id,
      name,
      avatarUrl: avatar,
      coins: 2,
      cards: [],
      isDead: false,
      isHost: gameState.players.length === 0,
      isReady: false
    };

    const newPlayers = [...gameState.players, newPlayer];
    await updateGameState({ ...gameState, players: newPlayers });
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

    const newState: GameState = {
      ...gameState,
      status: 'playing',
      players: playersWithCards,
      deck: deck,
      turnIndex: 0,
      logs: addLog(gameState.logs, 'System', 'Игра началась!')
    };

    await updateGameState(newState);
  };

  // Инициация действия
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

      commitAction(actionType);
  };

  const handleTargetClick = (targetId: string) => {
      if (!selectionMode.active || !selectionMode.action) return;
      if (targetId === user?.id) return;

      commitAction(selectionMode.action, targetId);
      setSelectionMode({ active: false, action: null });
  };

  const handleExchangeStart = () => {
      const currentPlayerIdx = gameState.turnIndex;
      const myHand = gameState.players[currentPlayerIdx].cards.filter(c => !c.revealed);

      const currentDeck = [...gameState.deck];
      const drawn: Card[] = [];
      for(let i=0; i<2; i++) {
          const role = currentDeck.shift();
          if (role) drawn.push({ role, revealed: false });
      }

      const tempHand = [...myHand, ...drawn];
      setExchangeMode({ active: true, tempHand, keptIndices: [] });
  };

  const confirmExchange = async () => {
      const { tempHand, keptIndices } = exchangeMode;
      const currentPlayerIdx = gameState.turnIndex;
      // Корректная проверка: сколько карт было живых, столько и нужно оставить
      const requiredCount = gameState.players[currentPlayerIdx].cards.filter(c => !c.revealed).length;

      if (keptIndices.length !== requiredCount) {
          // alert is blocking, use simple logic return or UI hint
          return;
      }

      const keptCards = keptIndices.map(i => tempHand[i]);
      const returnedToDeck = tempHand.filter((_, i) => !keptIndices.includes(i)).map(c => c.role);

      let newDeck = [...gameState.deck];
      newDeck.splice(0, 2); // Remove the 2 we "drew"
      newDeck.push(...returnedToDeck);
      newDeck = shuffleDeck(newDeck);

      const newPlayers = [...gameState.players];
      const oldRevealed = newPlayers[currentPlayerIdx].cards.filter(c => c.revealed);
      newPlayers[currentPlayerIdx].cards = [...oldRevealed, ...keptCards];

      setExchangeMode({ active: false, tempHand: [], keptIndices: [] });

      await updateGameState({
          ...gameState,
          players: newPlayers,
          deck: newDeck,
          turnIndex: findNextAliveIndex(gameState.turnIndex, newPlayers),
          logs: addLog(gameState.logs, newPlayers[currentPlayerIdx].name, 'Обмен карт')
      });
  };

  const commitAction = async (type: string, targetId?: string) => {
    if (!isMyTurn) return;

    const currentPlayer = gameState.players[gameState.turnIndex];
    let newCoins = currentPlayer.coins;
    let logText = '';
    let newPlayers = [...gameState.players];
    let targetIndex = -1;

    if (targetId) {
        targetIndex = newPlayers.findIndex(p => p.id === targetId);
    }

    switch (type) {
      case 'income':
        newCoins += 1;
        logText = 'Доход (+1)';
        break;

      case 'aid':
        newCoins += 2;
        logText = 'Помощь (+2)';
        break;

      case 'tax':
        newCoins += 3;
        logText = 'Налог (+3)';
        break;

      case 'coup':
         if (newCoins < 7) return;
         newCoins -= 7;
         if (targetIndex !== -1 && !newPlayers[targetIndex].isDead) {
             loseCard(targetIndex, newPlayers);
             logText = `ПЕРЕВОРОТ на ${newPlayers[targetIndex].name}`;
         } else return;
         break;

      case 'steal':
         if (targetIndex !== -1 && !newPlayers[targetIndex].isDead) {
             const stolen = Math.min(2, newPlayers[targetIndex].coins);
             newPlayers[targetIndex].coins -= stolen;
             newCoins += stolen;
             logText = `Кража (+${stolen}) у ${newPlayers[targetIndex].name}`;
         } else return;
         break;

      case 'assassinate':
         if (newCoins < 3) return;
         newCoins -= 3;
         if (targetIndex !== -1 && !newPlayers[targetIndex].isDead) {
             loseCard(targetIndex, newPlayers);
             logText = `Убийство (-3) на ${newPlayers[targetIndex].name}`;
         } else return;
         break;
    }

    newPlayers[gameState.turnIndex] = { ...currentPlayer, coins: newCoins };

    const winnerName = checkWinner(newPlayers);
    let newStatus = gameState.status;
    let nextTurn = true;

    if (winnerName) {
        newStatus = 'finished';
        logText += ` | ПОБЕДА: ${winnerName}`;
        nextTurn = false;
    }

    let nextIndex = gameState.turnIndex;
    if (nextTurn && newStatus === 'playing') {
        nextIndex = findNextAliveIndex(gameState.turnIndex, newPlayers);
        if (nextIndex === -1) nextIndex = gameState.turnIndex;
    }

    await updateGameState({
        players: newPlayers,
        deck: gameState.deck,
        turnIndex: nextIndex,
        winner: winnerName || undefined,
        status: newStatus,
        logs: addLog(gameState.logs, currentPlayer.name, logText)
    });
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

  const me = gameState.players.find(p => p.id === user?.id);
  const opponents = gameState.players.filter(p => p.id !== user?.id);
  const isHost = me?.isHost;

  if (loading) return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" /></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] font-sans relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      {/* Header */}
      <header className="p-4 border-b border-[#E6E1DC] bg-white/80 backdrop-blur-md flex justify-between items-center z-20">
        <button onClick={() => router.push('/')} className="p-2 text-[#8A9099] hover:text-[#9e1316]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
             <h1 className="font-black text-xl uppercase flex items-center gap-2"><ScrollText className="w-6 h-6 text-[#9e1316]" /> COUP</h1>
             {gameState.status === 'waiting' && <span className="text-[10px] font-bold text-[#9e1316] uppercase tracking-widest">Ожидание игроков...</span>}
             {gameState.winner && <span className="text-xs font-black text-[#9e1316] uppercase tracking-widest bg-yellow-100 px-2 rounded">Winner: {gameState.winner}</span>}
             {selectionMode.active && <span className="text-xs font-bold text-white bg-[#9e1316] px-3 py-1 rounded-full animate-pulse mt-1">ВЫБЕРИТЕ ЦЕЛЬ</span>}

             {isMyTurn && !selectionMode.active && !exchangeMode.active && (
                 <div className="flex flex-col items-center mt-1">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ВАШ ХОД
                    </span>
                    <div className="w-24 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div
                           className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
                           style={{ width: `${(timeLeft / 30) * 100}%` }}
                        />
                    </div>
                 </div>
             )}
        </div>
        <button onClick={() => setShowInfo(true)} className="p-2 text-[#8A9099] hover:text-[#9e1316]"><Info className="w-5 h-5" /></button>
      </header>

      {/* LOBBY AREA */}
      {gameState.status === 'waiting' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 z-10">
           <div className="bg-white p-8 rounded-[32px] border border-[#E6E1DC] shadow-xl max-w-2xl w-full">
              <h2 className="text-2xl font-black mb-6 text-center">Игроки в лобби ({gameState.players.length})</h2>
              <div className="space-y-3 mb-8">
                  {gameState.players.map(p => (
                      <div key={p.id} className="flex items-center gap-4 p-3 bg-[#F5F5F0] rounded-xl border border-[#E6E1DC]">
                          <img src={p.avatarUrl} className="w-10 h-10 rounded-full border border-white shadow-sm" alt="avatar" />
                          <span className="font-bold flex-1">{p.name} {p.id === user?.id && '(Вы)'}</span>
                          {p.isHost && <Crown className="w-4 h-4 text-[#9e1316]" />}
                      </div>
                  ))}
                  {gameState.players.length === 0 && <p className="text-center text-[#8A9099]">Подключение...</p>}
              </div>
              <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-4 bg-[#1A1F26] rounded-xl text-white group cursor-pointer" onClick={copyLobbyCode}>
                      <span className="font-mono font-bold tracking-widest text-lg">CODE: {lobbyId?.slice(0, 4).toUpperCase() || '...'}</span>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] uppercase font-bold text-gray-400 group-hover:text-white transition-colors">Copy</span>
                         <Copy className="w-5 h-5 group-hover:text-[#9e1316] transition-colors" />
                      </div>
                  </div>
                  {isHost ? (
                      <button
                        onClick={startGame}
                        disabled={gameState.players.length < 2}
                        className="w-full py-4 bg-[#9e1316] text-white font-bold rounded-xl uppercase tracking-widest shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Начать игру
                      </button>
                  ) : (
                      <div className="text-center text-xs font-bold text-[#8A9099] uppercase tracking-widest mt-2 animate-pulse">Ожидание хоста...</div>
                  )}
              </div>
           </div>
        </div>
      )}

      {/* GAME AREA */}
      {(gameState.status === 'playing' || gameState.status === 'finished') && (
        <div className="flex-1 p-4 relative z-10 flex flex-col justify-between max-w-7xl mx-auto w-full h-[calc(100vh-80px)]">

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
                                <img src={p.avatarUrl} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 shadow-md transition-colors ${isTurn ? 'border-[#9e1316]' : isSelectable ? 'border-emerald-400 animate-pulse' : 'border-white'}`} alt={p.name} />
                                {isTurn && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#9e1316] text-white text-[9px] px-2 py-0.5 rounded-full font-bold">ХОДИТ</div>}
                                {p.isDead && <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center"><Skull className="text-white w-8 h-8"/></div>}
                                {isSelectable && <div className="absolute inset-0 rounded-full border-4 border-emerald-500/50 animate-ping"></div>}
                            </div>
                            <div className="flex flex-col items-center bg-white/80 px-2 sm:px-3 py-1 rounded-lg border border-[#E6E1DC]">
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
            <div className="flex justify-between items-center px-4 md:px-20 h-28 sm:h-32 mb-2">
                 <div className="hidden md:block w-64 h-full bg-white/70 backdrop-blur border border-[#E6E1DC] rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-[#F5F5F0] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8A9099]">Лог игры</div>
                    <div ref={logRef} className="h-full overflow-y-auto p-2 text-xs space-y-1 pb-8">
                        {gameState.logs.map((log, i) => (
                            <div key={i}><span className="font-bold">{log.user}:</span> {log.action}</div>
                        ))}
                    </div>
                 </div>
                 <div className="w-16 h-24 sm:w-20 sm:h-28 bg-[#1A1F26] rounded-xl border-4 border-white shadow-xl flex items-center justify-center text-white/20 font-black relative mx-auto md:mx-0">
                    <span className="relative z-10 text-xs sm:text-base">DECK</span>
                    <span className="absolute bottom-2 text-[10px] sm:text-xs opacity-50">{gameState.deck.length}</span>
                 </div>
                 <div className="hidden md:block w-64"></div>
            </div>

            {/* ME */}
            {me && (
                <div className="flex flex-col items-center gap-2 sm:gap-4 w-full max-w-3xl mx-auto pb-2">
                    {me.isDead ? (
                        <div className="text-2xl font-black text-red-500 bg-white px-6 py-2 rounded-xl shadow-lg uppercase">Вы выбыли</div>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 sm:gap-6 bg-white px-4 sm:px-6 py-2 rounded-2xl border border-[#E6E1DC] shadow-lg relative">
                                <div className="absolute -top-5 sm:-top-6 left-1/2 -translate-x-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-white overflow-hidden shadow-sm">
                                    <img src={me.avatarUrl} className="w-full h-full" alt="Me" />
                                </div>
                                <div className="flex items-center gap-2"><Coins className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" /><span className="text-xl sm:text-2xl font-black">{me.coins}</span></div>
                                <div className="h-6 sm:h-8 w-px bg-[#E6E1DC]"></div>
                                <div className="font-bold text-xs sm:text-sm text-[#1A1F26] mt-2">{me.name}</div>
                            </div>

                            {/* Карты */}
                            <div className="flex gap-4 justify-center -mt-2 z-10 perspective-1000">
                                {me.cards.map((card, idx) => (
                                    <GameCard key={idx} card={card} />
                                ))}
                            </div>

                            {/* Кнопки Действий */}
                            <div className={`
                                grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 w-full
                                bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-[#E6E1DC] shadow-2xl
                                transition-opacity ${(!isMyTurn || selectionMode.active) ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}
                            `}>
                                <ActionButton onClick={() => initiateAction('income')} label="Доход (+1)" disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('aid')} label="Помощь (+2)" disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('tax')} label="Налог (+3)" color="text-[#9E1316]" disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('steal')} label="Кража (+2)" color="text-[#2563EB]" disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('assassinate')} label="Убийство (-3)" color="text-[#1A1F26]" disabled={!isMyTurn || me.coins < 3} />
                                <ActionButton onClick={() => initiateAction('exchange')} label="Обмен" color="text-[#D97706]" disabled={!isMyTurn} />
                                <ActionButton onClick={() => initiateAction('coup')} label="Переворот (-7)" bg="bg-[#1A1F26] text-white hover:bg-[#9e1316]" disabled={!isMyTurn || me.coins < 7} icon={<Skull className="w-3 h-3" />} />
                            </div>

                            {/* Кнопка отмены выбора цели */}
                            {selectionMode.active && (
                                <button
                                  onClick={() => setSelectionMode({ active: false, action: null })}
                                  className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white border border-[#E6E1DC] text-[#1A1F26] px-6 py-2 rounded-full font-bold shadow-xl hover:bg-[#F5F5F0] transition-all z-20"
                                >
                                    Отмена
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
             <div className="bg-white p-8 rounded-3xl max-w-lg w-full relative">
                 <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4"><X /></button>
                 <h2 className="text-2xl font-black mb-4">Правила</h2>
                 <p className="text-sm text-gray-600 space-y-2">
                    <span className="block font-bold">Цель:</span> Остаться последним выжившим.
                    <span className="block font-bold">Действия:</span>
                    <span className="block">• Доход: +1 монета.</span>
                    <span className="block">• Помощь: +2 монеты (блочится Герцогом).</span>
                    <span className="block">• Налог: +3 монеты (только Герцог).</span>
                    <span className="block">• Убийство: -3 монеты, цель теряет карту (только Ассасин, блочится Графиней).</span>
                    <span className="block">• Кража: +2 монеты у другого (только Капитан, блочится Капитаном/Послом).</span>
                    <span className="block">• Обмен: сменить карты (только Посол).</span>
                    <span className="block">• Переворот: -7 монет, цель теряет карту (нельзя заблокировать).</span>
                 </p>
             </div>
        </div>
      )}

      {/* Exchange Modal */}
      {exchangeMode.active && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-[32px] max-w-3xl w-full border border-[#E6E1DC]">
                  <h2 className="text-2xl font-black mb-2 text-center uppercase">Обмен карт</h2>
                  {/* Подсказка сколько карт выбрать */}
                  <p className="text-center text-[#8A9099] font-bold mb-8">
                      Выберите <span className="text-[#9e1316] text-lg">{gameState.players[gameState.turnIndex].cards.filter(c => !c.revealed).length}</span> карты, которые хотите оставить
                  </p>

                  <div className="flex justify-center gap-4 mb-8 flex-wrap">
                      {exchangeMode.tempHand.map((card, idx) => (
                          <GameCard
                             key={idx}
                             card={card}
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
                      Подтвердить выбор ({exchangeMode.keptIndices.length} / {gameState.players[gameState.turnIndex].cards.filter(c => !c.revealed).length})
                  </button>
              </div>
          </div>
      )}

    </div>
  );
}