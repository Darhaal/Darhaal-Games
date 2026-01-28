import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, ScrollText, X, Info,
  Shield, Swords, Skull, Coins,
  Crown, RefreshCw, Loader2, Copy, Check, Clock, Globe,
  LogOut, RotateCcw, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// --- Configuration & Dictionary ---

const COLORS = {
  duke: '#9E1316',       // Spartan Crimson
  assassin: '#7B1012',   // Dark Red
  ambassador: '#B21A1E', // Bright Red
  captain: '#8C1215',    // Deep Red
  contessa: '#A31619'    // Elegant Red
};

const DICTIONARY = {
  ru: {
    roles: {
      duke: { name: 'Герцог', action: 'Налог', desc: 'Берет 3 монеты. Блокирует Помощь.' },
      assassin: { name: 'Ассасин', action: 'Убийство', desc: 'Платит 3 монеты. Убивает карту врага.' },
      captain: { name: 'Капитан', action: 'Кража', desc: 'Крадет 2 монеты у игрока. Блокирует Кражу.' },
      ambassador: { name: 'Посол', action: 'Обмен', desc: 'Меняет карты с колодой. Блокирует Кражу.' },
      contessa: { name: 'Графиня', action: 'Блок', desc: 'Блокирует Убийство.' },
    },
    actions: {
      income: 'Доход', aid: 'Помощь', tax: 'Налог', steal: 'Кража',
      assassinate: 'Убийство', exchange: 'Обмен', coup: 'Переворот',
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
      rules: 'Правила и Роли',
      exchangeTitle: 'Обмен карт',
      exchangeDesc: (count) => `Выберите ${count} карты, чтобы оставить`,
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
      duke: { name: 'Duke', action: 'Tax', desc: 'Take 3 coins. Blocks Foreign Aid.' },
      assassin: { name: 'Assassin', action: 'Assassinate', desc: 'Pay 3 coins. Eliminate enemy card.' },
      captain: { name: 'Captain', action: 'Steal', desc: 'Steal 2 coins. Blocks Stealing.' },
      ambassador: { name: 'Ambassador', action: 'Exchange', desc: 'Exchange cards. Blocks Stealing.' },
      contessa: { name: 'Contessa', action: 'Block', desc: 'Blocks Assassination.' },
    },
    actions: {
      income: 'Income', aid: 'Foreign Aid', tax: 'Tax', steal: 'Steal',
      assassinate: 'Assassinate', exchange: 'Exchange', coup: 'Coup',
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
      rules: 'Rules & Roles',
      exchangeTitle: 'Exchange Cards',
      exchangeDesc: (count) => `Select ${count} cards to keep`,
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

// --- Helpers ---

const getRoleIcon = (role) => {
  switch (role) {
    case 'duke': return <Crown className="w-full h-full" />;
    case 'assassin': return <Skull className="w-full h-full" />;
    case 'captain': return <Swords className="w-full h-full" />;
    case 'ambassador': return <RefreshCw className="w-full h-full" />;
    case 'contessa': return <Shield className="w-full h-full" />;
    default: return null;
  }
};

const shuffle = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// --- Sub-components ---

const PlayerAvatar = ({ url, name, size = 'md', border = false, borderColor = 'border-white', isDead = false }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  return (
    <div className={`relative ${sizes[size]} rounded-full overflow-hidden border-2 ${border ? borderColor : 'border-transparent'} ${isDead ? 'grayscale opacity-50' : ''}`}>
      <img src={url} alt={name} className="w-full h-full object-cover bg-gray-200" />
      {isDead && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <X className="text-white w-1/2 h-1/2" />
        </div>
      )}
    </div>
  );
};

const GameCard = ({ card, lang, onClick, selectable, selected }) => {
  const t = DICTIONARY[lang];
  const roleInfo = t.roles[card.role];
  const color = COLORS[card.role];

  return (
    <div
      onClick={onClick}
      className={`
        relative w-24 h-36 sm:w-32 sm:h-48 rounded-2xl shadow-xl transition-all duration-500 transform-gpu
        ${selectable ? 'cursor-pointer hover:-translate-y-2' : ''}
        ${selected ? 'ring-4 ring-emerald-500 scale-105' : ''}
        ${card.revealed ? 'grayscale opacity-60' : 'bg-white'}
      `}
      style={{ border: `2px solid ${card.revealed ? '#e5e7eb' : color}` }}
    >
      {/* Front */}
      <div className={`h-full flex flex-col ${card.revealed ? 'hidden' : 'flex'}`}>
        <div className="h-14 sm:h-16 flex items-center justify-center text-white" style={{ backgroundColor: color }}>
          <div className="w-8 h-8">{getRoleIcon(card.role)}</div>
        </div>
        <div className="flex-1 p-2 text-center flex flex-col justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-black uppercase mb-1" style={{ color }}>{roleInfo.name}</div>
            <div className="text-[8px] sm:text-[9px] text-gray-400 leading-tight">{roleInfo.desc}</div>
          </div>
          <div className="bg-gray-50 rounded-lg py-1 text-[8px] sm:text-[10px] font-black uppercase text-gray-500 border border-gray-100">
            {roleInfo.action}
          </div>
        </div>
      </div>

      {/* Back (Revealed) */}
      {card.revealed && (
        <div className="h-full flex flex-col items-center justify-center p-2 text-center bg-gray-100 rounded-2xl">
          <Skull className="w-8 h-8 text-gray-300 mb-2" />
          <div className="text-[10px] font-black text-gray-400 uppercase">{t.ui.lost}</div>
          <div className="text-xs font-bold text-gray-500">{roleInfo.name}</div>
        </div>
      )}
    </div>
  );
};

// --- Main Content ---

function CoupGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyId = searchParams.get('id');

  const [user, setUser] = useState(null);
  const [lang, setLang] = useState('ru');
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);

  // Game States
  const [gameState, setGameState] = useState({
    players: [],
    deck: [],
    turnIndex: 0,
    logs: [],
    status: 'waiting',
    winner: null,
    lastActionTime: Date.now()
  });

  const [selectionMode, setSelectionMode] = useState({ active: false, action: null });
  const [exchangeMode, setExchangeMode] = useState({ active: false, tempHand: [], keptIndices: [] });
  const logEndRef = useRef(null);

  // Initialize Language & Auth
  useEffect(() => {
    const savedLang = localStorage.getItem('dg_lang');
    if (savedLang) setLang(savedLang);

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  // Sync with DB
  const fetchState = useCallback(async () => {
    if (!lobbyId) return;
    const { data } = await supabase.from('lobbies').select('game_state').eq('id', lobbyId).single();
    if (data?.game_state) setGameState(data.game_state);
  }, [lobbyId]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchState();

    const channel = supabase.channel(`lobby:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, (payload) => {
        if (payload.new?.game_state) setGameState(payload.new.game_state);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [lobbyId, fetchState]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.logs]);

  const updateDB = async (newState) => {
    setGameState(newState);
    await supabase.from('lobbies').update({ game_state: newState }).eq('id', lobbyId);
  };

  const isMyTurn = user && gameState.players[gameState.turnIndex]?.id === user.id && gameState.status === 'playing';
  const t = DICTIONARY[lang];

  // --- Actions ---

  const addLog = (user, action) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return [...gameState.logs.slice(-19), { user, action, time }];
  };

  const nextTurn = (players) => {
    let nextIdx = (gameState.turnIndex + 1) % players.length;
    while (players[nextIdx].isDead) {
      nextIdx = (nextIdx + 1) % players.length;
    }
    return nextIdx;
  };

  const checkWinner = (players) => {
    const alive = players.filter(p => !p.isDead);
    return alive.length === 1 ? alive[0].name : null;
  };

  const handleAction = async (actionType, targetId = null) => {
    if (!isMyTurn) return;

    let newPlayers = JSON.parse(JSON.stringify(gameState.players));
    let me = newPlayers[gameState.turnIndex];
    let logMsg = '';
    let updatedDeck = [...gameState.deck];

    switch (actionType) {
      case 'income':
        me.coins += 1;
        logMsg = t.actions.income;
        break;
      case 'aid':
        me.coins += 2;
        logMsg = t.actions.aid;
        break;
      case 'tax':
        me.coins += 3;
        logMsg = t.actions.tax;
        break;
      case 'steal':
        const targetSteal = newPlayers.find(p => p.id === targetId);
        const amount = Math.min(2, targetSteal.coins);
        targetSteal.coins -= amount;
        me.coins += amount;
        logMsg = `${t.actions.steal} @${targetSteal.name}`;
        break;
      case 'assassinate':
        me.coins -= 3;
        const targetAss = newPlayers.find(p => p.id === targetId);
        loseCard(targetAss);
        logMsg = `${t.actions.assassinate} @${targetAss.name}`;
        break;
      case 'coup':
        me.coins -= 7;
        const targetCoup = newPlayers.find(p => p.id === targetId);
        loseCard(targetCoup);
        logMsg = `${t.actions.coup} @${targetCoup.name}`;
        break;
      case 'exchange':
        setExchangeMode({ active: true, tempHand: [], keptIndices: [] });
        return; // Handled separately
      default: break;
    }

    const winner = checkWinner(newPlayers);
    await updateDB({
      ...gameState,
      players: newPlayers,
      turnIndex: winner ? gameState.turnIndex : nextTurn(newPlayers),
      status: winner ? 'finished' : 'playing',
      winner,
      logs: addLog(me.name, logMsg)
    });

    setSelectionMode({ active: false, action: null });
  };

  const loseCard = (player) => {
    const card = player.cards.find(c => !c.revealed);
    if (card) card.revealed = true;
    if (player.cards.every(c => c.revealed)) {
      player.isDead = true;
      player.coins = 0;
    }
  };

  const startExchange = () => {
    const me = gameState.players[gameState.turnIndex];
    const myAliveCards = me.cards.filter(c => !c.revealed);
    const drawn = gameState.deck.slice(0, 2).map(role => ({ role, revealed: false }));
    setExchangeMode({
      active: true,
      tempHand: [...myAliveCards, ...drawn],
      keptIndices: []
    });
  };

  const confirmExchange = async () => {
    const meIdx = gameState.turnIndex;
    const required = gameState.players[meIdx].cards.filter(c => !c.revealed).length;
    if (exchangeMode.keptIndices.length !== required) return;

    let newPlayers = JSON.parse(JSON.stringify(gameState.players));
    let me = newPlayers[meIdx];
    const kept = exchangeMode.keptIndices.map(i => exchangeMode.tempHand[i]);
    const returned = exchangeMode.tempHand.filter((_, i) => !exchangeMode.keptIndices.includes(i)).map(c => c.role);

    // Update player cards
    const revealedOnes = me.cards.filter(c => c.revealed);
    me.cards = [...revealedOnes, ...kept];

    // Update deck
    const newDeck = shuffle([...gameState.deck.slice(2), ...returned]);

    await updateDB({
      ...gameState,
      players: newPlayers,
      deck: newDeck,
      turnIndex: nextTurn(newPlayers),
      logs: addLog(me.name, t.actions.exchange)
    });

    setExchangeMode({ active: false, tempHand: [], keptIndices: [] });
  };

  const startGame = async () => {
    const roles = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];
    let deck = [];
    roles.forEach(r => deck.push(r, r, r));
    deck = shuffle(deck);

    const players = gameState.players.map(p => {
      const cards = deck.splice(0, 2).map(role => ({ role, revealed: false }));
      return { ...p, cards, coins: 2, isDead: false };
    });

    await updateDB({
      ...gameState,
      status: 'playing',
      players,
      deck,
      turnIndex: 0,
      logs: addLog('System', 'Game Started'),
      winner: null
    });
  };

  // --- UI Components ---

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
      <Loader2 className="w-12 h-12 animate-spin text-[#9E1316]" />
    </div>
  );

  const me = gameState.players.find(p => p.id === user?.id);
  const isHost = me?.isHost;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col relative overflow-hidden font-sans">
      {/* Background Texture */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none"></div>

      {/* Header */}
      <header className="h-16 border-b border-[#E6E1DC] bg-white/80 backdrop-blur-md flex items-center justify-between px-6 z-40 shadow-sm">
        <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-[#9E1316]">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-[#9E1316]" /> COUP
          </h1>
          {gameState.status === 'playing' && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <Clock className="w-3 h-3" /> Turn: {gameState.players[gameState.turnIndex]?.name}
            </div>
          )}
        </div>
        <button onClick={() => setShowRules(true)} className="p-2 text-gray-400 hover:text-[#9E1316]">
          <Info className="w-6 h-6" />
        </button>
      </header>

      {/* Main Area */}
      <main className="flex-1 p-4 flex flex-col items-center justify-between z-10 max-w-7xl mx-auto w-full relative">

        {/* LOBBY VIEW */}
        {gameState.status === 'waiting' && (
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
            <div className="w-full bg-white p-8 rounded-[40px] border border-[#E6E1DC] shadow-2xl">
              <h2 className="text-2xl font-black text-center mb-8 uppercase tracking-tight">{t.ui.waiting}</h2>
              <div className="space-y-3 mb-8">
                {gameState.players.map(p => (
                  <div key={p.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <PlayerAvatar url={p.avatarUrl} name={p.name} />
                    <div className="flex-1 font-bold text-sm">{p.name} {p.id === user.id && '(You)'}</div>
                    {p.isHost && <Crown className="w-4 h-4 text-[#9E1316]" />}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(lobbyId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="w-full flex items-center justify-between p-4 bg-[#1A1F26] text-white rounded-2xl group active:scale-95 transition-all"
                >
                  <span className="font-mono font-bold uppercase tracking-widest">Code: {lobbyId?.slice(0, 4)}</span>
                  {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 opacity-40 group-hover:opacity-100" />}
                </button>
                {isHost ? (
                  <button
                    onClick={startGame}
                    disabled={gameState.players.length < 2}
                    className="w-full py-5 bg-[#9E1316] text-white font-black rounded-2xl shadow-xl shadow-[#9E1316]/20 hover:bg-[#7b1012] disabled:opacity-50 transition-all uppercase tracking-widest text-sm"
                  >
                    {t.ui.startGame}
                  </button>
                ) : (
                  <p className="text-center text-xs font-bold text-gray-400 animate-pulse uppercase tracking-wider">{t.ui.waitHost}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GAME PLAYING VIEW */}
        {(gameState.status === 'playing' || gameState.status === 'finished') && (
          <div className="w-full flex-1 flex flex-col justify-between py-2">

            {/* Opponents Area */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8">
              {gameState.players.filter(p => p.id !== user?.id).map(p => {
                const itsHisTurn = gameState.players[gameState.turnIndex]?.id === p.id;
                const selectable = selectionMode.active && !p.isDead;
                return (
                  <div
                    key={p.id}
                    onClick={() => selectable && handleAction(selectionMode.action, p.id)}
                    className={`flex flex-col items-center gap-2 transition-all duration-300 ${selectable ? 'cursor-pointer hover:scale-110' : ''}`}
                  >
                    <div className="relative">
                      <PlayerAvatar
                        url={p.avatarUrl} name={p.name} size="lg" isDead={p.isDead}
                        border={itsHisTurn || selectable}
                        borderColor={selectable ? 'border-emerald-400 animate-pulse' : 'border-[#9E1316]'}
                      />
                      {selectable && <div className="absolute inset-0 rounded-full ring-4 ring-emerald-500/20 animate-ping"></div>}
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-[#E6E1DC] flex flex-col items-center shadow-sm">
                      <span className="text-[10px] font-black uppercase truncate max-w-[80px]">{p.name}</span>
                      <div className="flex gap-2 text-[10px] font-bold text-gray-500">
                        <span className="flex items-center text-yellow-600"><Coins className="w-3 h-3 mr-1" />{p.coins}</span>
                        <span className="flex items-center text-gray-400"><Shield className="w-3 h-3 mr-1" />{p.cards.filter(c => !c.revealed).length}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table Center (Logs & Deck) */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-4 md:px-12 my-4">
              {/* Logs */}
              <div className="hidden md:block w-72 h-40 bg-white/50 backdrop-blur-sm border border-[#E6E1DC] rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-gray-50/50 px-4 py-2 border-b border-[#E6E1DC] text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {t.ui.log}
                </div>
                <div className="h-32 overflow-y-auto p-4 space-y-2 text-xs">
                  {gameState.logs.map((log, i) => (
                    <div key={i} className="flex gap-2 animate-in slide-in-from-left-2 duration-300">
                      <span className="font-black text-[#9E1316]">@{log.user}</span>
                      <span className="text-gray-500">{log.action}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>

              {/* Visual Deck */}
              <div className="relative group">
                <div className="w-20 h-28 sm:w-24 sm:h-36 bg-[#1A1F26] rounded-2xl border-4 border-white shadow-2xl flex flex-col items-center justify-center text-white/10 select-none">
                  <div className="text-xs font-black uppercase tracking-widest">{t.ui.deck}</div>
                  <div className="text-2xl font-black">{gameState.deck.length}</div>
                </div>
                <div className="absolute -inset-2 bg-[#9E1316]/5 rounded-3xl blur-xl group-hover:bg-[#9E1316]/10 transition-all pointer-events-none"></div>
              </div>

              <div className="hidden md:block w-72"></div>
            </div>

            {/* My Area */}
            {me && (
              <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-4">
                {me.isDead ? (
                  <div className="py-6 px-12 bg-white rounded-3xl border border-red-100 shadow-xl text-center">
                    <Skull className="w-12 h-12 text-red-500 mx-auto mb-2" />
                    <h2 className="text-2xl font-black text-gray-300 uppercase tracking-tight">{t.ui.eliminated}</h2>
                  </div>
                ) : (
                  <>
                    {/* Status Pill */}
                    <div className="flex items-center gap-6 bg-white px-8 py-3 rounded-full border border-[#E6E1DC] shadow-2xl relative z-20">
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                        <PlayerAvatar url={me.avatarUrl} name={me.name} size="lg" border={isMyTurn} borderColor="border-[#9E1316]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Coins className="w-6 h-6 text-yellow-500" />
                        <span className="text-2xl font-black tracking-tighter">{me.coins}</span>
                      </div>
                      <div className="h-8 w-px bg-gray-100"></div>
                      <div className="text-sm font-black uppercase tracking-widest text-gray-400">{me.name}</div>
                    </div>

                    {/* My Cards */}
                    <div className="flex gap-4 sm:gap-6 mt-2 perspective-1000">
                      {me.cards.map((card, i) => (
                        <div key={i} className="animate-in slide-in-from-bottom-8 duration-500" style={{ transitionDelay: `${i * 100}ms` }}>
                          <GameCard card={card} lang={lang} />
                        </div>
                      ))}
                    </div>

                    {/* Action Bar */}
                    <div className={`
                      grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 w-full p-3 bg-white/90 backdrop-blur-md rounded-3xl border border-[#E6E1DC] shadow-2xl transition-all duration-500
                      ${!isMyTurn || selectionMode.active ? 'opacity-40 pointer-events-none grayscale scale-95' : 'opacity-100 scale-100'}
                    `}>
                      <ActionBtn onClick={() => handleAction('income')} label={t.actions.income} />
                      <ActionBtn onClick={() => handleAction('aid')} label={t.actions.aid} />
                      <ActionBtn onClick={() => handleAction('tax')} label={t.actions.tax} color="text-[#9E1316]" />
                      <ActionBtn onClick={() => setSelectionMode({ active: true, action: 'steal' })} label={t.actions.steal} color="text-[#2563EB]" />
                      <ActionBtn onClick={() => setSelectionMode({ active: true, action: 'assassinate' })} label={t.actions.assassinate} disabled={me.coins < 3} />
                      <ActionBtn onClick={startExchange} label={t.actions.exchange} color="text-amber-600" />
                      <ActionBtn
                        onClick={() => setSelectionMode({ active: true, action: 'coup' })}
                        label={`${t.actions.coup} (-7)`}
                        disabled={me.coins < 7}
                        bg="bg-[#1A1F26] text-white hover:bg-[#9E1316]"
                      />
                    </div>

                    {/* Cancel Selection */}
                    {selectionMode.active && (
                      <button
                        onClick={() => setSelectionMode({ active: false, action: null })}
                        className="bg-white border border-[#E6E1DC] text-[#1A1F26] px-8 py-3 rounded-full font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-gray-50 active:scale-95 transition-all animate-in slide-in-from-bottom-4 duration-300"
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
      </main>

      {/* MODALS */}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
            <header className="p-8 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#9E1316] rounded-2xl text-white"><Info className="w-6 h-6" /></div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">{t.ui.rules}</h2>
              </div>
              <button onClick={() => setShowRules(false)} className="p-3 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-4">
              {Object.entries(t.roles).map(([role, info]) => (
                <div key={role} className="flex gap-6 p-6 border border-gray-100 rounded-3xl hover:bg-gray-50 transition-all group">
                  <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors" style={{ backgroundColor: COLORS[role] }}>
                    <div className="w-10 h-10 text-white">{getRoleIcon(role)}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: COLORS[role] }}>{info.name}</h3>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-gray-200 px-3 py-1 rounded-full text-gray-500">{info.action}</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed font-medium">{info.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Exchange Modal */}
      {exchangeMode.active && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1A1F26]/90 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="w-full max-w-4xl flex flex-col items-center">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">{t.ui.exchangeTitle}</h2>
            <p className="text-gray-400 font-bold mb-12 uppercase tracking-widest text-xs">
              {t.ui.exchangeDesc(gameState.players[gameState.turnIndex].cards.filter(c => !c.revealed).length)}
            </p>

            <div className="flex flex-wrap justify-center gap-6 mb-12">
              {exchangeMode.tempHand.map((card, idx) => {
                const isSelected = exchangeMode.keptIndices.includes(idx);
                return (
                  <GameCard
                    key={idx}
                    card={card}
                    lang={lang}
                    selectable={true}
                    selected={isSelected}
                    onClick={() => {
                      const req = gameState.players[gameState.turnIndex].cards.filter(c => !c.revealed).length;
                      if (isSelected) {
                        setExchangeMode(prev => ({ ...prev, keptIndices: prev.keptIndices.filter(i => i !== idx) }));
                      } else if (exchangeMode.keptIndices.length < req) {
                        setExchangeMode(prev => ({ ...prev, keptIndices: [...prev.keptIndices, idx] }));
                      }
                    }}
                  />
                );
              })}
            </div>

            <button
              onClick={confirmExchange}
              disabled={exchangeMode.keptIndices.length !== gameState.players[gameState.turnIndex].cards.filter(c => !c.revealed).length}
              className="px-12 py-5 bg-[#9E1316] text-white font-black rounded-2xl uppercase tracking-widest text-sm shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
            >
              {t.ui.confirm}
            </button>
          </div>
        </div>
      )}

      {/* Winner Screen */}
      {gameState.status === 'finished' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#1A1F26]/90 backdrop-blur-xl animate-in fade-in duration-1000">
          <div className="w-full max-w-md bg-white p-12 rounded-[50px] shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#9E1316] to-[#B21A1E]"></div>
            <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-yellow-400/20 animate-bounce">
              <Crown className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">{t.ui.winnerTitle}</h2>
            <div className="text-2xl font-black text-[#9E1316] mb-12 flex items-center justify-center gap-2">
              <ChevronRight className="w-6 h-6" /> {gameState.winner} <ChevronRight className="w-6 h-6 rotate-180" />
            </div>
            <div className="space-y-3">
              {isHost && (
                <button
                  onClick={startGame}
                  className="w-full py-5 bg-[#1A1F26] text-white font-black rounded-2xl uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#9E1316] transition-all"
                >
                  <RotateCcw className="w-5 h-5" /> {t.ui.playAgain}
                </button>
              )}
              <button
                onClick={() => router.push('/play')}
                className="w-full py-5 bg-gray-100 text-[#1A1F26] font-black rounded-2xl uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-200 transition-all"
              >
                <LogOut className="w-5 h-5" /> {t.ui.leave}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .perspective-1000 { perspective: 1000px; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .transform-style-3d { transform-style: preserve-3d; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E6E1DC; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9E1316; }
      `}</style>
    </div>
  );
}

const ActionBtn = ({ onClick, label, color = 'text-[#1A1F26]', bg = 'bg-gray-50/50 hover:bg-white', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center gap-1 transition-all
      ${bg} ${color}
      ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-black/5'}
    `}
  >
    <span className="text-[10px] font-black uppercase tracking-tight leading-none">{label}</span>
  </button>
);

export default function CoupGame() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-[#9E1316]" /></div>}>
      <CoupGameContent />
    </Suspense>
  );
}