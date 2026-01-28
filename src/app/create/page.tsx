'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Users, Lock, Unlock,
  ScrollText, ArrowRight, Eye, EyeOff, Loader2, Type, UserPlus
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

export default function CreatePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [lang, setLang] = useState<Lang>('ru');
  const [step, setStep] = useState<'selection' | 'settings'>('selection');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Settings
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // New Settings
  const [lobbyName, setLobbyName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);
  }, []);

  // Set defaults when game or user changes
  useEffect(() => {
    if (selectedGame) {
        setMaxPlayers(selectedGame.maxPlayers);
        // Default name if empty
        if (!lobbyName && user) {
            const userName = user.user_metadata?.username || user.email?.split('@')[0] || 'Host';
            const suffix = lang === 'ru' ? 'Лобби' : 'Lobby';
            setLobbyName(`${selectedGame.name} ${suffix} - ${userName}`);
        }
    }
  }, [selectedGame, user, lang]);

  const t = {
    ru: {
      select: 'Выберите игру',
      settings: 'Настройки комнаты',
      create: 'Создать',
      back: 'Назад',
      private: 'Приватная комната',
      password: 'Пароль',
      players: 'Игроков',
      comingSoon: 'Скоро',
      error: 'Ошибка при создании: ',
      lobbySuffix: 'Лобби',
      enterPass: 'Придумайте пароль',
      lobbyName: 'Название комнаты',
      playersCount: 'Количество игроков',
      enterName: 'Введите название',
    },
    en: {
      select: 'Select Game',
      settings: 'Room Settings',
      create: 'Create',
      back: 'Back',
      private: 'Private Room',
      password: 'Password',
      players: 'Players',
      comingSoon: 'Coming Soon',
      error: 'Error creating lobby: ',
      lobbySuffix: 'Lobby',
      enterPass: 'Set password',
      lobbyName: 'Room Name',
      playersCount: 'Max Players',
      enterName: 'Enter room name',
    }
  }[lang];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGame || !user) return;
    setLoading(true);

    try {
      const code = Math.floor(1000 + Math.random() * 9000).toString();

      const initialHost: Player = {
        id: user.id,
        name: user.user_metadata?.username || user.email?.split('@')[0] || 'Host',
        avatarUrl: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
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
        phase: 'choosing_action',
        currentAction: null,
        lastActionTime: Date.now(),
        version: 1,
      };

      // Сохраняем maxPlayers и gameType внутри game_state
      const gameStateWithSettings = {
          ...initialState,
          gameType: selectedGame.id,
          settings: {
              maxPlayers: maxPlayers
          }
      };

      const { data, error } = await supabase.from('lobbies').insert({
        code,
        name: lobbyName,
        host_id: user.id,
        is_private: isPrivate,
        password: isPrivate ? password : null,
        status: 'waiting',
        game_state: gameStateWithSettings,
      }).select().single();

      if (error) throw error;

      // ИСПРАВЛЕНИЕ: Динамический редирект на /{gameId}?id={lobbyId}
      // Для Coup это будет /coup?id=...
      router.push(`/${selectedGame.id}?id=${data.id}`);
    } catch (error: any) {
      alert(t.error + error.message);
      setLoading(false);
    }
  };

  const renderSelection = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl animate-in zoom-in-95 duration-300">
      {GAMES.map(game => (
        <button
          key={game.id}
          onClick={() => { if (!game.disabled) { setSelectedGame(game); setStep('settings'); } }}
          disabled={game.disabled}
          className={`
            relative group overflow-hidden bg-white border border-[#E6E1DC] rounded-[32px] p-6 text-left transition-all duration-300
            ${game.disabled
              ? 'opacity-60 cursor-not-allowed grayscale'
              : 'hover:border-[#9e1316] hover:shadow-xl hover:shadow-[#9e1316]/10 hover:-translate-y-1'
            }
          `}
        >
          <div className="flex justify-between items-start mb-4">
             <div className={`p-4 rounded-2xl ${game.disabled ? 'bg-gray-100' : 'bg-[#F5F5F0] group-hover:bg-[#9e1316]/5 transition-colors'}`}>
               {game.icon}
             </div>
             {game.disabled && <span className="text-[10px] font-bold uppercase bg-gray-100 px-2 py-1 rounded text-gray-400">{t.comingSoon}</span>}
          </div>
          <h3 className="text-2xl font-black text-[#1A1F26] mb-2">{game.name}</h3>
          <p className="text-sm text-[#8A9099] font-medium leading-relaxed mb-4">{game.desc[lang]}</p>

          <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F26] uppercase tracking-wider">
            <Users className="w-4 h-4 text-[#9e1316]" />
            {game.minPlayers}-{game.maxPlayers} {t.players}
          </div>
        </button>
      ))}
    </div>
  );

  const renderSettings = () => (
    <form onSubmit={handleCreate} className="w-full max-w-md bg-white border border-[#E6E1DC] rounded-[32px] p-8 shadow-xl animate-in slide-in-from-right-8 duration-300">
       <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 bg-[#F5F5F0] rounded-full flex items-center justify-center text-[#9e1316]">
             {selectedGame?.icon}
          </div>
       </div>

       <div className="space-y-6">
          {/* Lobby Name */}
          <div className="space-y-2">
               <label className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider ml-1 flex items-center gap-1"><Type className="w-3 h-3"/> {t.lobbyName}</label>
               <input
                   type="text"
                   value={lobbyName}
                   onChange={e => setLobbyName(e.target.value)}
                   placeholder={t.enterName}
                   className="w-full bg-[#F5F5F0] border border-transparent focus:bg-white focus:border-[#9e1316] rounded-xl py-3 px-4 font-bold text-[#1A1F26] outline-none transition-all placeholder:text-[#8A9099]/40"
                   required
               />
          </div>

          {/* Max Players Slider */}
          <div className="space-y-3">
               <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider ml-1 flex items-center gap-1"><UserPlus className="w-3 h-3"/> {t.playersCount}</label>
                    <span className="text-sm font-black text-[#1A1F26] bg-[#F5F5F0] px-2 py-0.5 rounded-lg">{maxPlayers}</span>
               </div>
               <input
                   type="range"
                   min={selectedGame?.minPlayers}
                   max={selectedGame?.maxPlayers}
                   step={1}
                   value={maxPlayers}
                   onChange={e => setMaxPlayers(Number(e.target.value))}
                   className="w-full h-2 bg-[#F5F5F0] rounded-full appearance-none cursor-pointer accent-[#9e1316]"
               />
               <div className="flex justify-between text-[10px] font-bold text-[#8A9099] px-1">
                   <span>{selectedGame?.minPlayers}</span>
                   <span>{selectedGame?.maxPlayers}</span>
               </div>
          </div>

          <div className="h-px bg-[#F5F5F0] w-full" />

          <div className="flex items-center justify-between p-4 bg-[#F5F5F0] rounded-2xl cursor-pointer hover:bg-[#E6E1DC]/50 transition-colors" onClick={() => setIsPrivate(!isPrivate)}>
             <div className="flex items-center gap-3">
               {isPrivate ? <Lock className="w-5 h-5 text-[#9e1316]" /> : <Unlock className="w-5 h-5 text-[#8A9099]" />}
               <span className="font-bold text-[#1A1F26] text-sm uppercase tracking-wide">{t.private}</span>
             </div>
             <div className={`w-12 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-[#9e1316]' : 'bg-[#E6E1DC]'}`}>
               <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isPrivate ? 'translate-x-6' : ''}`} />
             </div>
          </div>

          {isPrivate && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
               <label className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider ml-1">{t.password}</label>
               <div className="relative">
                 <input
                   type={showPassword ? "text" : "password"}
                   value={password}
                   onChange={e => setPassword(e.target.value)}
                   placeholder={t.enterPass}
                   className="w-full bg-[#F5F5F0] border border-transparent focus:bg-white focus:border-[#9e1316] rounded-xl py-3 pl-4 pr-10 font-bold text-[#1A1F26] outline-none transition-all placeholder:text-[#8A9099]/40"
                   required={isPrivate}
                 />
                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-[#8A9099] hover:text-[#1A1F26]">
                   {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                 </button>
               </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A1F26] text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <> {t.create} <ArrowRight className="w-4 h-4" /> </>}
          </button>
       </div>
    </form>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

      <header className="w-full max-w-6xl mx-auto p-6 flex justify-between items-center z-10 relative">
        <button onClick={() => { if (step === 'selection') router.push('/'); else setStep('selection'); }} className="flex items-center gap-2 text-[#8A9099] hover:text-[#9e1316] transition-colors group">
          <div className="p-3 bg-white border border-[#E6E1DC] rounded-xl group-hover:border-[#9e1316]/50 shadow-sm transition-all"><ArrowLeft className="w-5 h-5" /></div>
          <span className="text-xs font-bold uppercase tracking-widest hidden sm:block">{t.back}</span>
        </button>

        <div className="text-xl font-black text-[#1A1F26] uppercase tracking-tight flex flex-col items-center">
           {step === 'selection' ? t.select : t.settings}
           {step === 'settings' && selectedGame && (
             <span className="text-[10px] text-[#9e1316] tracking-widest mt-1">{selectedGame.name}</span>
           )}
        </div>

        <div className="w-12"></div>
      </header>

      <div className="flex-1 w-full flex flex-col items-center justify-center relative z-10 pb-10 px-4">
        {step === 'selection' && renderSelection()}
        {step === 'settings' && renderSettings()}
      </div>
    </div>
  );
}