'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Search, Users, Lock, Play, X, Loader2,
  Crown, Filter, ScrollText, KeyRound, Unlock, SortAsc, SortDesc,
  Ship, Bomb
} from 'lucide-react';

type Lang = 'ru' | 'en';

interface LobbyRow {
  id: string;
  name: string;
  code: string;
  // Используем any для game_state, так как структура зависит от игры
  game_state: any;
  status: string;
  is_private: boolean;
  password?: string;
  created_at: string;
}

type SortOption = 'newest' | 'oldest' | 'players-desc' | 'players-asc';

const TRANSLATIONS = {
  ru: {
    title: 'Список Игр',
    subtitle: 'Присоединяйся и побеждай',
    codePlaceholder: 'КОД',
    join: 'Войти',
    searchPlaceholder: 'Название или ник...',
    sort: 'Сортировка',
    sortNew: 'Новые',
    sortOld: 'Старые',
    sortPlayers: 'Игроки',
    modes: 'Режимы',
    coup: 'Coup',
    battleship: 'Морской Бой',
    mafia: 'Мафия',
    all: 'Все',
    private: 'Приватная комната',
    enterPass: 'Введите пароль',
    confirm: 'Войти',
    cancel: 'Отмена',
    empty: 'Лобби не найдено'
  },
  en: {
    title: 'Game Browser',
    subtitle: 'Join and conquer',
    codePlaceholder: 'CODE',
    join: 'Join',
    searchPlaceholder: 'Name or host...',
    sort: 'Sort By',
    sortNew: 'Newest',
    sortOld: 'Oldest',
    sortPlayers: 'Players',
    modes: 'Modes',
    coup: 'Coup',
    battleship: 'Battleship',
    mafia: 'Mafia',
    all: 'All',
    private: 'Private Room',
    enterPass: 'Enter Password',
    confirm: 'Enter',
    cancel: 'Cancel',
    empty: 'No lobbies found'
  }
};

function PlayContent() {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>('ru');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  const [selectedLobby, setSelectedLobby] = useState<LobbyRow | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);
    fetchLobbies();

    const ch = supabase.channel('lobbies-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, fetchLobbies)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchLobbies = async () => {
    const { data } = await supabase
        .from('lobbies')
        .select('*')
        .order('created_at', { ascending: false });
    if (data) setLobbies(data);
    setLoading(false);
  };

  const handleJoin = async (lobby: LobbyRow, password?: string) => {
    if (lobby.is_private && lobby.password !== password) {
        alert('Wrong password');
        return;
    }
    // Определяем URL на основе gameType (который мы теперь сохраняем в game_state)
    const gameType = lobby.game_state?.gameType || 'coup'; // Fallback to coup for old lobbies
    router.push(`/game/${gameType}?id=${lobby.id}`);
  };

  // Хелпер для подсчета игроков (работает и для массивов Coup, и для объектов Battleship)
  const getPlayerCount = (lobby: LobbyRow) => {
      const players = lobby.game_state?.players;
      if (Array.isArray(players)) return players.length;
      if (players && typeof players === 'object') return Object.keys(players).length;
      return 0;
  };

  const filteredLobbies = lobbies
    .filter(l => {
       const gameType = l.game_state?.gameType || 'coup';
       const matchesMode = filterMode === 'all' || gameType === filterMode;
       const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.code.includes(searchQuery.toUpperCase());
       return matchesMode && matchesSearch && l.status === 'waiting';
    })
    .sort((a, b) => {
        if (sortOption === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortOption === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortOption === 'players-desc') return getPlayerCount(b) - getPlayerCount(a);
        if (sortOption === 'players-asc') return getPlayerCount(a) - getPlayerCount(b);
        return 0;
    });

  const getGameIcon = (type: string) => {
      switch(type) {
          case 'battleship': return <Ship className="w-4 h-4" />;
          case 'mafia': return <Users className="w-4 h-4" />;
          case 'minesweeper': return <Bomb className="w-4 h-4" />;
          default: return <ScrollText className="w-4 h-4" />;
      }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden text-[#1A1F26]">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto p-6 flex flex-col md:flex-row justify-between items-center z-10 relative gap-4">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-[#8A9099] hover:text-[#9e1316] transition-colors group self-start md:self-auto">
          <div className="p-3 bg-white border border-[#E6E1DC] rounded-xl group-hover:border-[#9e1316]/50 shadow-sm transition-all"><ArrowLeft className="w-5 h-5" /></div>
        </button>

        <div className="text-center">
           <h1 className="text-3xl font-black uppercase tracking-tight">{t.title}</h1>
           <p className="text-xs font-bold text-[#8A9099] uppercase tracking-widest">{t.subtitle}</p>
        </div>

        <div className="w-12 hidden md:block"></div>
      </header>

      {/* Filters & Content */}
      <div className="flex-1 w-full max-w-6xl mx-auto p-4 z-10 flex flex-col gap-6">

        {/* Controls */}
        <div className="bg-white p-4 rounded-[24px] border border-[#E6E1DC] shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">

            {/* Search */}
            <div className="relative w-full md:w-64 group">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-[#8A9099] group-focus-within:text-[#9e1316] transition-colors" />
                <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#F5F5F0] rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-[#1A1F26] placeholder:text-[#8A9099]/50 focus:bg-white focus:ring-2 focus:ring-[#9e1316]/10 outline-none transition-all"
                />
            </div>

            {/* Mode Filter */}
            <div className="flex gap-2 bg-[#F5F5F0] p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                {['all', 'coup', 'battleship'].map(mode => (
                    <button
                        key={mode}
                        onClick={() => setFilterMode(mode)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${filterMode === mode ? 'bg-white text-[#1A1F26] shadow-sm' : 'text-[#8A9099] hover:text-[#1A1F26]'}`}
                    >
                        {t[mode as keyof typeof t] || mode}
                    </button>
                ))}
            </div>

            {/* Sort */}
            <div className="flex gap-2">
                <button onClick={() => setSortOption(prev => prev === 'newest' ? 'oldest' : 'newest')} className="p-3 bg-[#F5F5F0] rounded-xl text-[#1A1F26] hover:bg-[#E6E1DC]">
                    {sortOption === 'newest' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                </button>
            </div>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? <div className="col-span-full flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#9e1316]" /></div> :
             filteredLobbies.length === 0 ? <div className="col-span-full text-center py-20 text-[#8A9099] font-bold uppercase">{t.empty}</div> :
             filteredLobbies.map(lobby => {
                 const currentPlayers = getPlayerCount(lobby);
                 const maxPlayers = lobby.game_state?.settings?.maxPlayers || 6;
                 const gameType = lobby.game_state?.gameType || 'coup';

                 return (
                    <div key={lobby.id} className="group bg-white border border-[#E6E1DC] p-6 rounded-[32px] hover:border-[#9e1316] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                        {lobby.is_private && <div className="absolute top-4 right-4 text-[#9e1316]"><Lock className="w-4 h-4" /></div>}

                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-[#F5F5F0] rounded-xl text-[#1A1F26] group-hover:bg-[#9e1316] group-hover:text-white transition-colors">
                                {getGameIcon(gameType)}
                            </div>
                            <div className="text-[10px] font-black bg-[#F5F5F0] px-2 py-1 rounded text-[#8A9099] uppercase tracking-widest group-hover:bg-[#9e1316]/10 group-hover:text-[#9e1316] transition-colors">
                                {lobby.code}
                            </div>
                        </div>

                        <h3 className="font-black text-lg text-[#1A1F26] mb-1 truncate pr-6">{lobby.name}</h3>
                        <div className="text-xs font-bold text-[#8A9099] uppercase tracking-wider mb-6 flex items-center gap-2">
                            {t[gameType as keyof typeof t]} • <span className="text-[#1A1F26]">{currentPlayers}/{maxPlayers}</span>
                        </div>

                        <button
                            onClick={() => lobby.is_private ? setSelectedLobby(lobby) : handleJoin(lobby)}
                            className="w-full py-3 bg-[#1A1F26] text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {lobby.is_private ? <KeyRound className="w-3 h-3" /> : <Play className="w-3 h-3" />} {t.join}
                        </button>
                    </div>
                 );
             })}
        </div>

        {/* Private Modal */}
        {selectedLobby && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white p-8 rounded-[32px] w-full max-w-sm relative shadow-2xl animate-in zoom-in-95">
              <button onClick={() => setSelectedLobby(null)} className="absolute top-4 right-4 p-2 hover:bg-[#F5F5F0] rounded-full transition-colors"><X className="w-5 h-5 text-[#8A9099]" /></button>

              <div className="w-16 h-16 bg-[#9e1316]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#9e1316]">
                  <Lock className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-black mb-2 uppercase text-center text-[#1A1F26] tracking-tight">{selectedLobby.name}</h3>
              <p className="text-xs text-center text-[#8A9099] font-bold uppercase tracking-wider mb-8">{t.private}</p>

              <div className="space-y-4">
                  <input
                    type="password"
                    placeholder={t.enterPass}
                    className="w-full bg-[#F5F5F0] border border-transparent focus:bg-white focus:border-[#9e1316] rounded-xl py-4 px-5 text-center text-[#1A1F26] font-bold text-lg transition-all outline-none placeholder:text-[#E6E1DC] placeholder:font-medium"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                  />
                  <button
                    onClick={() => handleJoin(selectedLobby, passwordInput)}
                    className="w-full bg-[#1A1F26] text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg active:scale-95"
                  >
                    {t.confirm}
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" /></div>}>
      <PlayContent />
    </Suspense>
  );
}