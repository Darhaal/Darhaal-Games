'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Users, Lock, Play, SortAsc, SortDesc, Filter, X, CheckSquare, Square } from 'lucide-react';

type Lang = 'ru' | 'en';

type Lobby = {
  id: string;
  name: string;
  code: string;
  game_state: {
      gameType: string;
      players: any[];
  };
  status: 'waiting' | 'playing' | 'finished';
  is_private: boolean;
};

type SortOption = 'players-desc' | 'players-asc' | 'name-asc' | 'name-desc';

export default function PlayPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('ru');
  const [search, setSearch] = useState('');
  const [privatePass, setPrivatePass] = useState('');
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('players-desc');
  const [filterCoup, setFilterCoup] = useState(true); // Default show Coup
  const [filterMafia, setFilterMafia] = useState(true); // Default show Mafia
  const [selectedPrivateLobby, setSelectedPrivateLobby] = useState<Lobby | null>(null);

  useEffect(() => {
    // Load lang from local storage
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);
  }, []);

  const t = {
    ru: {
      title: 'Найти игру',
      back: 'Назад',
      search: 'Поиск лобби...',
      join: 'Войти',
      playing: 'В игре',
      privateGame: 'Приватная игра',
      enterPass: 'Введите пароль для входа',
      pass: 'Пароль',
      cancel: 'Отмена',
      confirm: 'Войти',
      noGames: 'Игры не найдены',
      reset: 'Сбросить фильтры',
      sort: 'Сортировка'
    },
    en: {
      title: 'Find Game',
      back: 'Back',
      search: 'Search lobby...',
      join: 'Join',
      playing: 'Playing',
      privateGame: 'Private Game',
      enterPass: 'Enter password to join',
      pass: 'Password',
      cancel: 'Cancel',
      confirm: 'Join',
      noGames: 'No games found',
      reset: 'Reset',
      sort: 'Sort'
    }
  }[lang];

  useEffect(() => {
     fetchLobbies();

     const channel = supabase.channel('public_lobbies')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, fetchLobbies)
        .subscribe();

     return () => { supabase.removeChannel(channel) };
  }, []);

  const fetchLobbies = async () => {
     const { data, error } = await supabase
        .from('lobbies')
        .select('*')
        .neq('status', 'finished');

     if (data) {
         // Filter out and cleanup empty lobbies
         const validLobbies = data.filter(l => {
             if (!l.game_state?.players || l.game_state.players.length === 0) {
                 supabase.from('lobbies').delete().eq('id', l.id);
                 return false;
             }
             return true;
         });
         setLobbies(validLobbies);
     }
  };

  const filteredLobbies = lobbies
    .filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase());
      const gameType = l.game_state?.gameType || 'coup';
      const matchesType = (gameType === 'coup' && filterCoup) || (gameType === 'mafia' && filterMafia);

      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const pA = a.game_state?.players?.length || 0;
      const pB = b.game_state?.players?.length || 0;
      switch (sortBy) {
        case 'players-desc': return pB - pA;
        case 'players-asc': return pA - pB;
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

  const handleJoin = async (lobby: Lobby) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please login');

    if (lobby.is_private) {
      setSelectedPrivateLobby(lobby);
      return;
    }

    await joinLobbyDirectly(lobby.id, user.id);
  };

  const joinLobbyDirectly = async (lobbyId: string, userId: string) => {
      const { data: lobby } = await supabase.from('lobbies').select('game_state').eq('id', lobbyId).single();
      if (!lobby) return;

      const players = lobby.game_state.players || [];
      if (players.find((p: any) => p.id === userId)) {
          router.push(`/game/coup?id=${lobbyId}`);
          return;
      }

      if (players.length >= 6) {
          alert('Лобби заполнено');
          return;
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      const newPlayer = {
          id: userId,
          name: profile?.username || 'Player',
          avatarUrl: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
          isHost: false,
          isReady: false,
          coins: 2,
          cards: [],
          isDead: false
      };

      const newPlayers = [...players, newPlayer];
      await supabase.from('lobbies').update({
          game_state: { ...lobby.game_state, players: newPlayers }
      }).eq('id', lobbyId);

      router.push(`/game/coup?id=${lobbyId}`);
  };

  const confirmPrivateJoin = async () => {
    if (!selectedPrivateLobby || !privatePass) return;

    const { data } = await supabase.from('lobbies').select('id, password').eq('id', selectedPrivateLobby.id).single();

    if (data && data.password === privatePass) {
        const { data: { user } } = await supabase.auth.getUser();
        if(user) await joinLobbyDirectly(data.id, user.id);
    } else {
        alert('Неверный пароль');
    }
  };

  const getSortLabel = () => {
      switch (sortBy) {
        case 'players-desc': return 'Игроки (Max)';
        case 'players-asc': return 'Игроки (Min)';
        case 'name-asc': return 'Имя (А-Я)';
        case 'name-desc': return 'Имя (Я-А)';
      }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      {/* Language Switcher Removed as per request */}

      <header className="p-6 max-w-6xl mx-auto w-full flex items-center justify-between z-10 relative">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[#8A9099] hover:text-[#9e1316] transition-colors font-medium text-sm group">
          <div className="p-3 bg-white border border-[#E6E1DC] rounded-xl group-hover:border-[#9e1316]/50 transition-colors shadow-sm"><ArrowLeft className="w-5 h-5" /></div>
          <span className="text-xs font-bold uppercase tracking-widest hidden sm:block">{t.back}</span>
        </button>
        <h1 className="text-xl font-black font-space tracking-tight uppercase">{t.title}</h1>
        <div className="w-12"></div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 pt-4 pb-12 z-10 relative grid grid-cols-1 lg:grid-cols-3 gap-8">

        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-[#8A9099] group-focus-within:text-[#9e1316] transition-colors" />
              <input type="text" placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white border border-[#E6E1DC] rounded-xl py-3 pl-12 pr-4 text-[#1A1F26] font-bold text-sm focus:outline-none focus:border-[#9e1316] focus:shadow-lg focus:shadow-[#9e1316]/5 transition-all placeholder:text-[#8A9099]/50" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-3 text-[#8A9099] hover:text-[#1A1F26]"><X className="w-5 h-5" /></button>}
            </div>

            <div className="flex gap-2">
               <div className="relative group">
                  <button
                    className="h-full bg-white border border-[#E6E1DC] px-4 rounded-xl text-[#8A9099] hover:text-[#1A1F26] hover:border-[#1A1F26] transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wide min-w-[140px] justify-between"
                    onClick={() => {
                        const nextSort: Record<SortOption, SortOption> = {
                            'players-desc': 'players-asc',
                            'players-asc': 'name-asc',
                            'name-asc': 'name-desc',
                            'name-desc': 'players-desc'
                        };
                        setSortBy(nextSort[sortBy]);
                    }}
                  >
                    <span>{getSortLabel()}</span>
                    {sortBy.includes('desc') ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                  </button>
               </div>
            </div>
          </div>

          {/* Type Filters */}
          <div className="flex gap-4">
             <button onClick={() => setFilterCoup(!filterCoup)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${filterCoup ? 'bg-[#9e1316] text-white border-[#9e1316]' : 'bg-white text-[#8A9099] border-[#E6E1DC]'}`}>
                {filterCoup ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />} Coup
             </button>
             <button onClick={() => setFilterMafia(!filterMafia)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${filterMafia ? 'bg-[#1A1F26] text-white border-[#1A1F26]' : 'bg-white text-[#8A9099] border-[#E6E1DC]'}`}>
                {filterMafia ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />} Mafia
             </button>
          </div>

          <div className="space-y-4">
            {filteredLobbies.length > 0 ? (
              filteredLobbies.map((lobby) => (
                <div key={lobby.id} className="bg-white border border-[#E6E1DC] p-5 rounded-2xl flex items-center justify-between hover:border-[#9e1316] hover:shadow-lg hover:shadow-[#9e1316]/5 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${lobby.status === 'playing' ? 'bg-amber-500' : 'bg-[#9e1316]'}`} />
                  <div className="flex flex-col gap-1 pl-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg text-[#1A1F26] group-hover:text-[#9e1316] transition-colors">{lobby.name}</h3>
                      {lobby.is_private && <Lock className="w-3 h-3 text-[#8A9099]" />}
                      {lobby.status === 'playing' && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider">{t.playing}</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-[#8A9099] uppercase tracking-wide">
                      <span className="bg-[#F5F5F0] px-2 py-1 rounded-md">{lobby.game_state?.gameType || 'Coup'}</span>
                      <span className={`flex items-center gap-1 ${lobby.game_state?.players?.length >= 6 ? 'text-[#9e1316]' : ''}`}>
                        <Users className="w-3 h-3" /> {lobby.game_state?.players?.length || 0} / 6
                      </span>
                      <span className="font-mono bg-[#1A1F26] text-white px-2 py-0.5 rounded">{lobby.code}</span>
                    </div>
                  </div>
                  <button onClick={() => handleJoin(lobby)} className="bg-[#1A1F26] text-white px-5 py-3 rounded-xl hover:bg-[#9e1316] transition-colors shadow-lg shadow-[#1A1F26]/10 hover:shadow-[#9e1316]/20 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <span>{t.join}</span> <Play className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-dashed border-[#E6E1DC] rounded-[24px]">
                <Search className="w-12 h-12 text-[#E6E1DC] mb-4" />
                <p className="text-[#8A9099] font-bold text-sm uppercase tracking-widest">{t.noGames}</p>
                <button onClick={() => {setSearch(''); setFilterCoup(true); setFilterMafia(true);}} className="mt-2 text-[#9e1316] text-xs font-bold hover:underline">{t.reset}</button>
              </div>
            )}
          </div>
        </div>

        {selectedPrivateLobby && (
          <div className="lg:col-span-1">
            <div className="bg-white border border-[#E6E1DC] p-8 rounded-[32px] shadow-lg sticky top-6">
              <button onClick={() => setSelectedPrivateLobby(null)} className="absolute top-4 right-4 text-[#8A9099] hover:text-[#1A1F26]"><X className="w-5 h-5" /></button>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#1A1F26]\"><Lock className="w-8 h-8" /></div>
              </div>
              <h2 className="text-xl font-black text-center text-[#1A1F26] mb-2 uppercase tracking-tight">{selectedPrivateLobby.name}</h2>
              <p className="text-xs text-center text-[#8A9099] font-bold uppercase tracking-wider mb-6">{t.enterPass}</p>
              <div className="space-y-4">
                <input type="password" placeholder={t.pass} value={privatePass} onChange={(e) => setPrivatePass(e.target.value)} className="w-full bg-[#F5F5F0] border-none rounded-xl py-4 px-5 text-center text-[#1A1F26] font-bold text-lg focus:ring-2 focus:ring-[#9e1316]/20 transition-all placeholder:text-[#E6E1DC]" />
                <button onClick={confirmPrivateJoin} disabled={!privatePass} className="w-full bg-[#1A1F26] hover:bg-[#9e1316] text-white font-bold py-4 rounded-xl transition-all shadow-xl disabled:opacity-50 flex justify-center items-center gap-2 text-xs uppercase tracking-widest">
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