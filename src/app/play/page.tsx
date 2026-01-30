'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Search, Users, Lock, Play, X, Loader2,
  Crown, Filter, KeyRound, Unlock, SortAsc, SortDesc,
  Ship, Bomb, Fingerprint, ShieldAlert, Skull, ScrollText
} from 'lucide-react';

type Lang = 'ru' | 'en';

interface LobbyRow {
  id: string;
  name: string;
  code: string;
  game_state: {
      gameType?: string;
      players: any;
      settings?: { maxPlayers?: number };
  };
  status: string;
  is_private: boolean;
  password?: string;
  created_at: string;
}

type SortOption = 'newest' | 'oldest' | 'players-desc' | 'players-asc';

const TRANSLATIONS = {
  ru: {
    title: 'Игровой Зал',
    subtitle: 'Присоединяйся и побеждай',
    codePlaceholder: 'КОД',
    join: 'Войти',
    searchPlaceholder: 'Название или ник...',
    sort: 'Сортировка',
    sortNew: 'Новые',
    sortOld: 'Старые',
    sortPlayers: 'Игроки',
    modes: 'Режимы',
    coup: 'Coup (Переворот)',
    battleship: 'Морской Бой',
    mafia: 'Мафия',
    all: 'Все',
    loading: 'Загрузка миров...',
    empty: 'Ничего не найдено',
    emptyDesc: 'Попробуйте изменить фильтры',
    full: 'Мест нет',
    started: 'Игра идет',
    back: 'Вернуться',
    private: 'Приватная комната',
    enterPass: 'Введите пароль...',
    confirm: 'Подтвердить',
    errorPass: 'Неверный пароль',
    errorAuth: 'Авторизуйтесь, чтобы играть',
    errorFull: 'Комната заполнена',
    errorNotFound: 'Лобби с таким кодом не найдено',
    create: 'Создать',
    blocked: 'Скоро'
  },
  en: {
    title: 'Game Hall',
    subtitle: 'Join and conquer',
    codePlaceholder: 'CODE',
    join: 'Join',
    searchPlaceholder: 'Name or host...',
    sort: 'Sort By',
    sortNew: 'Newest',
    sortOld: 'Oldest',
    sortPlayers: 'Players',
    modes: 'Game Modes',
    coup: 'Coup',
    battleship: 'Battleship',
    mafia: 'Mafia',
    all: 'All',
    loading: 'Loading worlds...',
    empty: 'No games found',
    emptyDesc: 'Try changing filters',
    full: 'Full',
    started: 'Started',
    back: 'Return',
    private: 'Private Room',
    enterPass: 'Enter password...',
    confirm: 'Confirm',
    errorPass: 'Invalid password',
    errorAuth: 'Login required to play',
    errorFull: 'Room is full',
    errorNotFound: 'Lobby not found',
    create: 'Create',
    blocked: 'Coming Soon'
  }
};

function PlayContent() {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>('ru');

  const [search, setSearch] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [selectedLobby, setSelectedLobby] = useState<LobbyRow | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);
    fetchLobbies();

    const ch = supabase.channel('public_lobbies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, fetchLobbies)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const t = TRANSLATIONS[lang];

  const fetchLobbies = async () => {
    const { data } = await supabase
      .from('lobbies')
      .select('*')
      .neq('status', 'finished')
      .order('created_at', { ascending: false });

    if (data) setLobbies(data as unknown as LobbyRow[]);
    setLoading(false);
  };

  const getPlayers = (lobby: LobbyRow): any[] => {
      const p = lobby.game_state.players;
      if (Array.isArray(p)) return p;
      if (typeof p === 'object' && p !== null) return Object.values(p);
      return [];
  };

  const getPlayerCount = (lobby: LobbyRow) => {
      const p = lobby.game_state.players;
      if (Array.isArray(p)) return p.length;
      if (typeof p === 'object' && p !== null) return Object.keys(p).length;
      return 0;
  };

  const handleJoin = async (lobby: LobbyRow, pass?: string) => {
    if (lobby.is_private && lobby.password !== pass) {
      alert(t.errorPass);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert(t.errorAuth);
      return;
    }

    const { data: freshLobby, error: fetchError } = await supabase
        .from('lobbies')
        .select('game_state, status')
        .eq('id', lobby.id)
        .single();

    if (fetchError || !freshLobby) {
        alert(t.errorNotFound);
        fetchLobbies();
        return;
    }

    if (freshLobby.status === 'finished') {
        alert("Игра уже закончилась");
        fetchLobbies();
        return;
    }

    const gameType = lobby.game_state.gameType || 'coup';
    const players = getPlayers({ ...lobby, game_state: freshLobby.game_state });

    if (players.some((p: any) => p.id === user.id || p.userId === user.id)) {
      router.push(`/game/${gameType}?id=${lobby.id}`);
      return;
    }

    const maxPlayers = freshLobby.game_state.settings?.maxPlayers || (gameType === 'battleship' ? 2 : 6);
    if (players.length >= maxPlayers) {
      alert(t.errorFull);
      fetchLobbies();
      return;
    }

    if (freshLobby.status === 'playing') {
        alert(t.started);
        return;
    }

    if (gameType === 'coup') {
        const userName = user.user_metadata?.username || user.user_metadata?.full_name || 'Player';
        const userAvatar = user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

        const newPlayer = {
            id: user.id,
            name: userName,
            avatarUrl: userAvatar,
            coins: 2,
            cards: [],
            isDead: false,
            isHost: false,
            isReady: true
        };

        const currentPlayers = Array.isArray(freshLobby.game_state.players) ? freshLobby.game_state.players : [];
        const newPlayers = [...currentPlayers, newPlayer];
        const newState = { ...freshLobby.game_state, players: newPlayers };

        const { error } = await supabase
            .from('lobbies')
            .update({ game_state: newState })
            .eq('id', lobby.id);

        if (error) {
            console.error('Failed to join lobby:', error);
            return;
        }
    }

    router.push(`/game/${gameType}?id=${lobby.id}`);
  };

  const handleCodeJoin = () => {
      const found = lobbies.find(l => l.code === codeQuery.toUpperCase());
      if (found) {
          if (found.is_private) setSelectedLobby(found);
          else handleJoin(found);
      } else {
          alert(t.errorNotFound);
      }
  };

  const getGameIcon = (type: string) => {
      switch(type) {
          case 'battleship': return <Ship className="w-5 h-5" />;
          case 'mafia': return <Users className="w-5 h-5" />;
          case 'minesweeper': return <Bomb className="w-5 h-5" />;
          case 'bunker': return <ShieldAlert className="w-5 h-5" />;
          case 'spyfall': return <Fingerprint className="w-5 h-5" />;
          case 'secret_hitler': return <Skull className="w-5 h-5" />;
          default: return <ScrollText className="w-5 h-5" />;
      }
  };

  const processedLobbies = lobbies
    .filter(l => {
        const term = search.toLowerCase();
        const players = getPlayers(l);
        const matchesRoomName = l.name.toLowerCase().includes(term);
        const matchesPlayerName = players.some((p: any) => (p.name || '').toLowerCase().includes(term));
        const matchesSearch = matchesRoomName || matchesPlayerName;

        const gameType = l.game_state.gameType || 'coup';
        const matchesMode = filterMode === 'all' || gameType === filterMode;

        const isAlreadyIn = players.some((p: any) => p.id === currentUserId || p.userId === currentUserId);

        // Hide playing OR finished games unless participating
        if ((l.status === 'playing' || l.status === 'finished') && !isAlreadyIn) return false;

        return matchesSearch && matchesMode;
    })
    .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === 'players-desc') return getPlayerCount(b) - getPlayerCount(a);
        if (sortBy === 'players-asc') return getPlayerCount(a) - getPlayerCount(b);
        return 0;
    });

  const MODES_LIST = [
      { id: 'all', label: t.all },
      { id: 'coup', label: t.coup },
      { id: 'battleship', label: t.battleship },
      { id: 'mafia', label: t.mafia, disabled: true },
      { id: 'minesweeper', label: 'Minesweeper', disabled: true },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] font-sans relative overflow-x-hidden flex flex-col">
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none z-0"></div>

      <header className="sticky top-0 z-30 w-full bg-[#F8FAFC]/90 backdrop-blur-xl border-b border-[#E6E1DC] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="group p-3 bg-white border border-[#E6E1DC] rounded-2xl hover:border-[#9e1316]/30 hover:shadow-lg hover:shadow-[#9e1316]/5 transition-all">
                <ArrowLeft className="w-5 h-5 text-[#8A9099] group-hover:text-[#9e1316]" />
            </button>
            <div>
                <h1 className="text-2xl font-black text-[#1A1F26] uppercase tracking-tight leading-none">{t.title}</h1>
                <p className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider mt-1 hidden sm:block">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex bg-white p-1.5 rounded-xl border border-[#E6E1DC] shadow-sm w-full md:w-auto focus-within:border-[#9e1316] transition-colors">
             <div className="relative flex-1">
                <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-[#E6E1DC]" />
                <input
                    type="text"
                    placeholder={t.codePlaceholder}
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value.toUpperCase())}
                    className="w-full md:w-32 h-full pl-9 pr-3 font-mono font-bold text-sm text-[#1A1F26] placeholder:text-[#E6E1DC] focus:outline-none bg-transparent uppercase"
                    maxLength={6}
                />
             </div>
             <button
                onClick={handleCodeJoin}
                disabled={codeQuery.length < 6}
                className="bg-[#1A1F26] hover:bg-[#9e1316] text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {t.join}
             </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full relative z-10 px-4 py-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
            <aside className="w-full lg:w-72 space-y-6 lg:sticky lg:top-28">
                <div className="bg-white p-4 rounded-[24px] border border-[#E6E1DC] shadow-sm group focus-within:border-[#9e1316]/30 focus-within:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-[#8A9099] group-focus-within:text-[#9e1316]" />
                        <input
                            type="text"
                            placeholder={t.searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full font-bold text-sm text-[#1A1F26] placeholder:text-[#E6E1DC] focus:outline-none"
                        />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-[#E6E1DC] shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-black text-[#8A9099] uppercase tracking-widest mb-4">
                        <Filter className="w-4 h-4" /> {t.sort}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setSortBy('newest')} className={`p-2 rounded-lg text-[10px] font-bold uppercase transition-all ${sortBy === 'newest' ? 'bg-[#1A1F26] text-white' : 'bg-[#F5F5F0] text-[#8A9099]'}`}>{t.sortNew}</button>
                        <button onClick={() => setSortBy('oldest')} className={`p-2 rounded-lg text-[10px] font-bold uppercase transition-all ${sortBy === 'oldest' ? 'bg-[#1A1F26] text-white' : 'bg-[#F5F5F0] text-[#8A9099]'}`}>{t.sortOld}</button>
                        <button onClick={() => setSortBy('players-desc')} className={`p-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${sortBy === 'players-desc' ? 'bg-[#1A1F26] text-white' : 'bg-[#F5F5F0] text-[#8A9099]'}`}>
                            {t.sortPlayers} <SortDesc className="w-3 h-3" />
                        </button>
                        <button onClick={() => setSortBy('players-asc')} className={`p-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${sortBy === 'players-asc' ? 'bg-[#1A1F26] text-white' : 'bg-[#F5F5F0] text-[#8A9099]'}`}>
                            {t.sortPlayers} <SortAsc className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-[#E6E1DC] shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black text-[#8A9099] uppercase tracking-widest mb-2">
                        {t.modes}
                    </div>
                    {MODES_LIST.map(mode => (
                        <label key={mode.id} className={`flex items-center gap-4 cursor-pointer group hover:bg-[#F5F5F0] p-2 rounded-xl transition-colors -mx-2 ${mode.disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${filterMode === mode.id ? 'bg-[#1A1F26] border-[#1A1F26]' : 'border-[#E6E1DC] bg-white'}`}>
                                {filterMode === mode.id && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <span className={`font-bold text-sm transition-colors ${filterMode === mode.id ? 'text-[#1A1F26]' : 'text-[#8A9099]'}`}>
                                {mode.label}
                            </span>
                            {mode.disabled && <span className="ml-auto text-[8px] font-bold uppercase bg-gray-100 px-2 py-0.5 rounded text-gray-400 border border-gray-200">{t.blocked}</span>}
                            <input type="radio" name="mode" className="hidden" checked={filterMode === mode.id} onChange={() => setFilterMode(mode.id)} disabled={mode.disabled} />
                        </label>
                    ))}
                </div>
            </aside>

            <div className="flex-1 w-full min-h-[50vh]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <Loader2 className="w-10 h-10 animate-spin text-[#9e1316] mb-4" />
                        <span className="text-xs font-bold uppercase tracking-widest text-[#8A9099]">{t.loading}</span>
                    </div>
                ) : processedLobbies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#E6E1DC] rounded-[32px] bg-white/50">
                        <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-[#E6E1DC]" />
                        </div>
                        <div className="text-[#1A1F26] font-black text-lg mb-1">{t.empty}</div>
                        <div className="text-[#8A9099] text-xs font-bold uppercase tracking-widest">{t.emptyDesc}</div>
                        <button onClick={() => router.push('/create')} className="mt-6 px-6 py-3 bg-[#1A1F26] text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg">
                            {t.create}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 pb-20">
                        {processedLobbies.map(lobby => {
                            const players = getPlayers(lobby);
                            const hostPlayer = players.find((p:any) => p.isHost) || players[0];
                            const maxPlayers = lobby.game_state.settings?.maxPlayers || 6;
                            const isFull = players.length >= maxPlayers;
                            const isPlaying = lobby.status === 'playing';
                            const gameType = lobby.game_state.gameType || 'coup';
                            const isAlreadyIn = players.some((p: any) => p.id === currentUserId || p.userId === currentUserId);

                            return (
                                <div key={lobby.id} className={`group bg-white border border-[#E6E1DC] p-5 rounded-[24px] flex flex-col sm:flex-row items-center gap-6 hover:shadow-xl hover:shadow-[#9e1316]/5 hover:border-[#9e1316]/30 transition-all duration-300 relative overflow-hidden ${isAlreadyIn ? 'ring-2 ring-emerald-500/50 border-emerald-500/20' : ''}`}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#F5F5F0] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${gameType === 'coup' ? 'bg-[#9e1316]/10 text-[#9e1316]' : 'bg-[#1A1F26]/10 text-[#1A1F26]'}`}>
                                        {getGameIcon(gameType)}
                                    </div>

                                    <div className="flex-1 text-center sm:text-left z-10 min-w-0 w-full">
                                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                            <h3 className="font-black text-lg text-[#1A1F26] group-hover:text-[#9e1316] transition-colors truncate">{lobby.name}</h3>
                                            {lobby.is_private ? <Lock className="w-4 h-4 text-[#E6E1DC] shrink-0" /> : <Unlock className="w-4 h-4 text-[#E6E1DC] opacity-50 shrink-0" />}
                                        </div>

                                        <div className="flex items-center justify-center sm:justify-start gap-3 text-xs font-bold text-[#8A9099] uppercase tracking-wide flex-wrap">
                                            {hostPlayer && (
                                                <div className="flex items-center gap-2 bg-[#F5F5F0] px-2 py-1 rounded-lg pr-3 max-w-full">
                                                    <Crown className="w-3 h-3 text-[#E6E1DC] fill-current shrink-0" />
                                                    <span className="truncate max-w-[120px] text-xs font-bold text-[#1A1F26]">{hostPlayer.name}</span>
                                                </div>
                                            )}
                                            <span className="flex items-center gap-1 shrink-0">
                                                <Users className="w-3 h-3" />
                                                <span className={isFull ? 'text-[#9e1316]' : 'text-emerald-600'}>
                                                    {players.length}/{maxPlayers}
                                                </span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="z-10 shrink-0 w-full sm:w-auto">
                                        <button
                                            onClick={() => lobby.is_private ? setSelectedLobby(lobby) : handleJoin(lobby)}
                                            disabled={(isFull || isPlaying) && !isAlreadyIn}
                                            className={`
                                                px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all w-full justify-center
                                                ${isAlreadyIn
                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-900/10'
                                                    : (isFull || isPlaying)
                                                        ? 'bg-[#F5F5F0] text-[#E6E1DC] cursor-not-allowed'
                                                        : 'bg-[#1A1F26] text-white hover:bg-[#9e1316] shadow-lg shadow-[#1A1F26]/10 hover:shadow-[#9e1316]/20 active:scale-95'
                                                }
                                            `}
                                        >
                                            {isAlreadyIn ? t.back : (isFull ? t.full : (isPlaying ? t.started : t.join))} <Play className="w-3 h-3 fill-current" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* Private Room Modal */}
        {selectedLobby && (
          <div className="fixed inset-0 bg-[#1A1F26]/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-[32px] w-full max-w-sm relative shadow-2xl border border-[#E6E1DC] animate-in zoom-in-95">
              <button onClick={() => setSelectedLobby(null)} className="absolute top-6 right-6 text-[#8A9099] hover:text-[#1A1F26] transition-colors"><X className="w-6 h-6" /></button>
              <div className="w-16 h-16 bg-[#9e1316]/5 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#9e1316]">
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