'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Search, Users, Lock, Play, X, Loader2,
  Crown, Filter, ScrollText, KeyRound, Unlock, SortAsc, SortDesc
} from 'lucide-react';
import { GameState, Player } from '@/types/coup';

type Lang = 'ru' | 'en';

interface LobbyRow {
  id: string;
  name: string;
  code: string;
  game_state: {
      gameType?: string;
      players: Player[];
  } & GameState;
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
    coup: 'Coup (Переворот)',
    mafia: 'Mafia',
    loading: 'Загрузка миров...',
    empty: 'Ничего не найдено',
    emptyDesc: 'Попробуйте изменить фильтры',
    full: 'Full',
    back: 'Вернуться',
    private: 'Приватная комната',
    enterPass: 'Введите пароль...',
    confirm: 'Подтвердить',
    errorPass: 'Неверный пароль',
    errorAuth: 'Авторизуйтесь, чтобы играть',
    errorFull: 'Комната заполнена',
    errorNotFound: 'Лобби с таким кодом не найдено'
  },
  en: {
    title: 'Game List',
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
    mafia: 'Mafia',
    loading: 'Loading worlds...',
    empty: 'No games found',
    emptyDesc: 'Try changing filters',
    full: 'Full',
    back: 'Return',
    private: 'Private Room',
    enterPass: 'Enter password...',
    confirm: 'Confirm',
    errorPass: 'Invalid password',
    errorAuth: 'Login required to play',
    errorFull: 'Room is full',
    errorNotFound: 'Lobby not found'
  }
};

function PlayContent() {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>('ru');

  // --- Фильтры ---
  const [search, setSearch] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [filterCoup, setFilterCoup] = useState(true);
  const [filterMafia, setFilterMafia] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // --- Приватные комнаты ---
  const [selectedLobby, setSelectedLobby] = useState<LobbyRow | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  // Получаем ID пользователя для подсветки "своих" лобби
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);
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

  useEffect(() => {
    fetchLobbies();
    const channel = supabase.channel('public_lobbies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, fetchLobbies)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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

    // Если уже внутри — просто переходим
    if (lobby.game_state.players.some(p => p.id === user.id)) {
      router.push(`/game/coup?id=${lobby.id}`);
      return;
    }

    if (lobby.game_state.players.length >= 6) {
      alert(t.errorFull);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    const newPlayer: Player = {
      id: user.id,
      name: profile?.username || user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Player',
      avatarUrl: user.user_metadata?.avatar_url || profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
      coins: 2,
      cards: [],
      isDead: false,
      isHost: false,
      isReady: true
    };

    const newPlayers = [...lobby.game_state.players, newPlayer];
    const newState = { ...lobby.game_state, players: newPlayers };

    const { error } = await supabase
      .from('lobbies')
      .update({ game_state: newState })
      .eq('id', lobby.id);

    if (!error) {
      router.push(`/game/coup?id=${lobby.id}`);
    }
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

  // --- Логика фильтрации и сортировки ---
  const processedLobbies = lobbies
    .filter(l => {
        const term = search.toLowerCase();
        const matchesRoomName = l.name.toLowerCase().includes(term);
        const matchesPlayerName = l.game_state.players.some(p => p.name.toLowerCase().includes(term));
        const matchesSearch = matchesRoomName || matchesPlayerName;

        const isCoup = !l.game_state.gameType || l.game_state.gameType === 'coup';
        const isMafia = l.game_state.gameType === 'mafia';

        const matchesType = (isCoup && filterCoup) || (isMafia && filterMafia);
        return matchesSearch && matchesType;
    })
    .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === 'players-desc') return b.game_state.players.length - a.game_state.players.length;
        if (sortBy === 'players-asc') return a.game_state.players.length - b.game_state.players.length;
        return 0;
    });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] font-sans relative overflow-x-hidden flex flex-col">
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none z-0"></div>

      {/* Sticky Header */}
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

          {/* Ввод Кода */}
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

            {/* САЙДБАР ФИЛЬТРОВ */}
            <aside className="w-full lg:w-72 space-y-6 lg:sticky lg:top-28">

                {/* Поиск */}
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

                {/* Сортировка */}
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

                {/* Типы игр */}
                <div className="bg-white p-6 rounded-[24px] border border-[#E6E1DC] shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black text-[#8A9099] uppercase tracking-widest mb-2">
                        {t.modes}
                    </div>

                    <label className="flex items-center gap-4 cursor-pointer group hover:bg-[#F5F5F0] p-2 rounded-xl transition-colors -mx-2">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${filterCoup ? 'bg-[#9e1316] border-[#9e1316]' : 'border-[#E6E1DC] bg-white'}`}>
                            {filterCoup && <X className="w-4 h-4 text-white rotate-0" />}
                        </div>
                        <span className={`font-bold text-sm transition-colors ${filterCoup ? 'text-[#1A1F26]' : 'text-[#8A9099]'}`}>{t.coup}</span>
                        <input type="checkbox" className="hidden" checked={filterCoup} onChange={() => setFilterCoup(!filterCoup)} />
                    </label>

                    <label className="flex items-center gap-4 cursor-pointer group hover:bg-[#F5F5F0] p-2 rounded-xl transition-colors -mx-2">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${filterMafia ? 'bg-[#1A1F26] border-[#1A1F26]' : 'border-[#E6E1DC] bg-white'}`}>
                            {filterMafia && <X className="w-4 h-4 text-white rotate-0" />}
                        </div>
                        <span className={`font-bold text-sm transition-colors ${filterMafia ? 'text-[#1A1F26]' : 'text-[#8A9099]'}`}>{t.mafia}</span>
                        <input type="checkbox" className="hidden" checked={filterMafia} onChange={() => setFilterMafia(!filterMafia)} />
                    </label>
                </div>
            </aside>

            {/* СПИСОК ЛОББИ */}
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
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 pb-20">
                        {processedLobbies.map(lobby => {
                            // Ищем хоста
                            const hostPlayer = lobby.game_state.players.find(p => p.isHost) || lobby.game_state.players[0];
                            const isFull = lobby.game_state.players.length >= 6;
                            const gameType = lobby.game_state.gameType || 'coup';
                            const isAlreadyIn = lobby.game_state.players.some(p => p.id === currentUserId);

                            return (
                                <div key={lobby.id} className={`group bg-white border border-[#E6E1DC] p-5 rounded-[24px] flex flex-col sm:flex-row items-center gap-6 hover:shadow-xl hover:shadow-[#9e1316]/5 hover:border-[#9e1316]/30 transition-all duration-300 relative overflow-hidden ${isAlreadyIn ? 'ring-2 ring-emerald-500/50 border-emerald-500/20' : ''}`}>
                                    {/* Градиент при наведении */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#F5F5F0] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    {/* Иконка */}
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${gameType === 'coup' ? 'bg-[#9e1316]/10 text-[#9e1316]' : 'bg-[#1A1F26]/10 text-[#1A1F26]'}`}>
                                        {gameType === 'coup' ? <ScrollText className="w-8 h-8" /> : <Users className="w-8 h-8" />}
                                    </div>

                                    {/* Инфо */}
                                    <div className="flex-1 text-center sm:text-left z-10 min-w-0">
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
                                                    {lobby.game_state.players.length}/6
                                                </span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Кнопка */}
                                    <div className="z-10 shrink-0">
                                        <button
                                            onClick={() => lobby.is_private ? setSelectedLobby(lobby) : handleJoin(lobby)}
                                            disabled={isFull && !isAlreadyIn}
                                            className={`
                                                px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all w-full sm:w-auto justify-center
                                                ${isAlreadyIn
                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-900/10'
                                                    : isFull
                                                        ? 'bg-[#F5F5F0] text-[#E6E1DC] cursor-not-allowed'
                                                        : 'bg-[#1A1F26] text-white hover:bg-[#9e1316] shadow-lg shadow-[#1A1F26]/10 hover:shadow-[#9e1316]/20 active:scale-95'
                                                }
                                            `}
                                        >
                                            {isAlreadyIn ? t.back : (isFull ? t.full : t.join)} <Play className="w-3 h-3 fill-current" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* Модальное окно пароля */}
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