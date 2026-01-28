'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Users, Lock, Unlock,
  ScrollText, ArrowRight, Eye, EyeOff, Loader2
} from 'lucide-react';
import { GameState, Player } from '@/types/coup';

type Lang = 'ru' | 'en';

type Game = {
  id: string;
  name: string;
  desc: Record<Lang, string>;
  minPlayers: number;
  maxPlayers: number;
  icon: React.ReactNode;
  disabled?: boolean;
};

const GAMES: Game[] = [
  {
    id: 'coup',
    name: 'Coup',
    desc: {
      ru: 'Интриги, блеф и влияние. Уничтожь врагов.',
      en: 'Intrigue, bluff, and influence. Destroy your enemies.'
    },
    minPlayers: 2,
    maxPlayers: 6,
    icon: <ScrollText className="w-8 h-8" />,
  },
  {
    id: 'mafia',
    name: 'Mafia',
    desc: {
      ru: 'Классическая мафия. Город засыпает.',
      en: 'Classic mafia. The city falls asleep.'
    },
    minPlayers: 4,
    maxPlayers: 12,
    icon: <Users className="w-8 h-8" />,
    disabled: true,
  },
];

function CreateLobbyContent() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('ru');
  const [step, setStep] = useState<'selection' | 'settings'>('selection');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Настройки комнаты
  const [roomName, setRoomName] = useState('New Room');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);
  }, []);

  const t = {
    ru: {
      back: 'Назад',
      select: 'Выбор игры',
      settings: 'Настройки',
      name: 'Название',
      max: 'Макс. игроков',
      public: 'Открытая',
      private: 'Приватная',
      pass: 'Пароль',
      create: 'Создать комнату',
    },
    en: {
      back: 'Back',
      select: 'Select Game',
      settings: 'Settings',
      name: 'Room Name',
      max: 'Max Players',
      public: 'Public',
      private: 'Private',
      pass: 'Password',
      create: 'Create Room',
    }
  }[lang];

  const createLobby = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        alert(lang === 'ru' ? 'Нужно войти в систему!' : 'Login required!');
        setLoading(false);
        return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    // ИСПРАВЛЕНО: Более надежное определение имени
    const hostName = profile?.username || user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Host';
    const hostAvatar = user.user_metadata?.avatar_url || profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const initialHost: Player = {
        id: user.id,
        name: hostName,
        avatarUrl: hostAvatar,
        coins: 2,
        cards: [],
        isDead: false,
        isHost: true,
        isReady: true
    };

    const initialState: GameState = {
        players: [initialHost],
        deck: [],
        turnIndex: 0,
        logs: [],
        status: 'waiting',
        lastActionTime: Date.now()
    };

    const { data, error } = await supabase.from('lobbies').insert({
        name: roomName,
        host_id: user.id,
        status: 'waiting',
        code: code,
        is_private: isPrivate,
        password: isPrivate ? password : null,
        game_state: initialState
    }).select().single();

    if (error) {
        alert('Error: ' + error.message);
        setLoading(false);
    } else {
        router.push(`/game/coup?id=${data.id}`);
    }
  };

  const renderSelection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      {GAMES.map((game) => (
        <button
          key={game.id}
          disabled={game.disabled}
          onClick={() => {
            setSelectedGame(game);
            setMaxPlayers(game.maxPlayers);
            setStep('settings');
          }}
          className={`
            group relative flex flex-col p-8 h-80 text-left
            bg-white border border-[#E6E1DC] rounded-[32px] shadow-sm
            transition-all duration-300
            ${game.disabled
              ? 'opacity-60 cursor-not-allowed grayscale'
              : 'hover:border-[#9e1316] hover:-translate-y-2 hover:shadow-2xl hover:shadow-[#9e1316]/10'
            }
          `}
        >
          <div className={`mb-6 p-5 w-fit rounded-2xl border transition-all duration-300 ${game.disabled ? 'bg-[#F5F5F0] border-[#E6E1DC]' : 'bg-[#F5F5F0] border-[#E6E1DC] group-hover:bg-[#9e1316] group-hover:text-white group-hover:border-[#9e1316]'}`}>
            {game.icon}
          </div>

          <div className="mt-auto relative z-10">
            <h3 className={`text-2xl font-black mb-2 uppercase tracking-tight ${game.disabled ? 'text-[#8A9099]' : 'text-[#1A1F26] group-hover:text-[#9e1316]'}`}>
              {game.name}
            </h3>
            <p className="text-sm text-[#8A9099] font-medium mb-4 line-clamp-2">
              {game.disabled ? 'Coming Soon' : game.desc[lang]}
            </p>

            <div className="flex items-center gap-2 text-xs font-bold text-[#8A9099] uppercase tracking-wider">
              <Users className="w-4 h-4" />
              {game.minPlayers}-{game.maxPlayers} Players
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  const renderSettings = () => (
    <div className="w-full max-w-lg bg-white border border-[#E6E1DC] p-10 rounded-[32px] shadow-2xl shadow-[#9e1316]/5 relative animate-in zoom-in-95 duration-300">
      <div className="mb-8 flex items-center gap-4 border-b border-[#E6E1DC] pb-6">
        <div className="p-4 bg-[#9e1316]/10 rounded-2xl text-[#9e1316]">
          {selectedGame?.icon}
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#1A1F26] uppercase tracking-tight">{selectedGame?.name}</h2>
          <p className="text-xs font-bold text-[#8A9099] uppercase tracking-wider">{t.settings}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider ml-1">{t.name}</label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="w-full bg-[#F5F5F0] border border-transparent rounded-xl py-3 px-4 text-[#1A1F26] font-bold text-sm focus:outline-none focus:bg-white focus:border-[#9e1316] focus:ring-4 focus:ring-[#9e1316]/5 transition-all"
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider ml-1">{t.max}</label>
            <span className="text-sm font-black text-[#9e1316] bg-[#9e1316]/10 px-3 py-1 rounded-lg">{maxPlayers}</span>
          </div>
          <input
            type="range"
            min={selectedGame?.minPlayers}
            max={selectedGame?.maxPlayers}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-full h-2 bg-[#F5F5F0] rounded-full appearance-none cursor-pointer accent-[#9e1316]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => { setIsPrivate(false); setPassword(''); }} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${!isPrivate ? 'border-[#9e1316] bg-[#9e1316]/5 text-[#9e1316]' : 'border-[#E6E1DC] text-[#8A9099] hover:border-[#8A9099]'}`}>
            <Unlock className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.public}</span>
          </button>
          <button onClick={() => setIsPrivate(true)} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${isPrivate ? 'border-[#9e1316] bg-[#9e1316]/5 text-[#9e1316]' : 'border-[#E6E1DC] text-[#8A9099] hover:border-[#8A9099]'}`}>
            <Lock className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.private}</span>
          </button>
        </div>

        {isPrivate && (
          <div className="space-y-2 animate-in slide-in-from-top-2 fade-in">
            <label className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider ml-1">{t.pass}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#F5F5F0] border border-transparent rounded-xl py-3 px-4 pr-10 text-[#1A1F26] font-bold text-sm focus:outline-none focus:bg-white focus:border-[#9e1316] focus:ring-4 focus:ring-[#9e1316]/5 transition-all"
                required={isPrivate}
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-[#8A9099] hover:text-[#1A1F26]">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        <button
            onClick={createLobby}
            disabled={loading}
            className="w-full bg-[#1A1F26] hover:bg-[#9e1316] text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-[#1A1F26]/20 hover:shadow-[#9e1316]/30 active:scale-[0.98] flex justify-center items-center gap-2 text-xs uppercase tracking-widest mt-4"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t.create} <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-4 font-sans text-[#1A1F26] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      <header className="w-full max-w-7xl p-6 flex items-center justify-between z-10 relative mb-8">
        <button onClick={() => { if (step === 'selection') router.push('/'); else setStep('selection'); }} className="flex items-center gap-2 text-[#8A9099] hover:text-[#9e1316] transition-colors group">
          <div className="p-3 bg-white border border-[#E6E1DC] rounded-xl group-hover:border-[#9e1316]/50 shadow-sm transition-all"><ArrowLeft className="w-5 h-5" /></div><span className="text-xs font-bold uppercase tracking-widest hidden sm:block">{t.back}</span>
        </button>
        <div className="flex flex-col items-center">
           <h1 className="text-xl font-black tracking-tight text-[#1A1F26] uppercase">{step === 'selection' ? t.select : t.settings}</h1>
        </div>
        <div className="w-12"></div>
      </header>
      <div className="flex-1 w-full flex flex-col items-center justify-center relative z-10 pb-10">
        {step === 'selection' && renderSelection()}
        {step === 'settings' && renderSettings()}
      </div>
    </div>
  );
}

export default function CreateLobby() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" /></div>}>
      <CreateLobbyContent />
    </Suspense>
  );
}