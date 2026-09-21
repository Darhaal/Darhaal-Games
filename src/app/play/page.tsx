'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/hooks/useLang';
import { showToast } from '@/lib/toast';
import { COPYRIGHT } from '@/constants/app';
import SettingsButton from '@/components/SettingsButton';
import { useEscape } from '@/hooks/useEscape';
import {
  ArrowLeft, Search, Users, Lock, Play, X, Loader2,
  Crown, Filter, KeyRound, SortAsc, SortDesc, LayoutGrid
} from 'lucide-react';
import { GAMES, getGame, roomCapacity } from '@/games/registry';
import { GAME_ICONS } from '@/games/icons';

// Minimal player info inside game_state (shape differs per game)
interface LobbyPlayerInfo {
  id?: string;
  userId?: string;
  name?: string;
  isHost?: boolean;
}

interface LobbyRow {
  id: string;
  name: string;
  code: string;
  game_state: {
      gameType?: string;
      players: LobbyPlayerInfo[] | Record<string, LobbyPlayerInfo>;
      settings?: { maxPlayers?: number };
  };
  status: string;
  is_private: boolean;
  created_at: string;
}

// IMPORTANT: the password column is intentionally NOT selected — the check
// runs server-side via the join_lobby_check RPC (see supabase/migrations)

type SortOption = 'newest' | 'oldest' | 'players-desc' | 'players-asc';

const TRANSLATIONS = {
  ru: {
    title: 'Игровое Лобби',
    subtitle: 'Поиск активных сессий',
    codePlaceholder: 'Ввести код',
    join: 'Войти',
    searchPlaceholder: 'Поиск по названию...',
    sort: 'Сортировка',
    sortNew: 'Новые',
    sortOld: 'Старые',
    sortPlayers: 'Люди',
    modes: 'Категории',
    all: 'Все игры',
    loading: 'Загрузка списка...',
    empty: 'Список пуст',
    emptyDesc: 'Активных игр пока нет',
    full: 'Полная',
    started: 'Идет',
    back: 'Назад',
    private: 'Закрытая игра',
    enterPass: 'Пароль доступа',
    confirm: 'Войти',
    errorPass: 'Неверный пароль',
    errorAuth: 'Требуется авторизация',
    errorFull: 'Мест нет',
    errorNotFound: 'Игра не найдена',
    create: 'Новая игра',
    footer: COPYRIGHT,
  },
  en: {
    title: 'Game Lobby',
    subtitle: 'Find active sessions',
    codePlaceholder: 'Enter Code',
    join: 'Join',
    searchPlaceholder: 'Search by name...',
    sort: 'Sort By',
    sortNew: 'Newest',
    sortOld: 'Oldest',
    sortPlayers: 'Players',
    modes: 'Categories',
    all: 'All Games',
    loading: 'Loading list...',
    empty: 'List is empty',
    emptyDesc: 'No active games found',
    full: 'Full',
    started: 'Live',
    back: 'Back',
    private: 'Private Game',
    enterPass: 'Access Password',
    confirm: 'Enter',
    errorPass: 'Invalid password',
    errorAuth: 'Login required',
    errorFull: 'Room full',
    errorNotFound: 'Game not found',
    create: 'New Game',
    footer: COPYRIGHT,
  }
};

function PlayContent() {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLang();

  const [search, setSearch] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [selectedLobby, setSelectedLobby] = useState<LobbyRow | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  // Escape closes the private-room password dialog
  useEscape(!!selectedLobby, () => setSelectedLobby(null));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchLobbies = async () => {
    const { data } = await supabase
      .from('lobbies')
      .select('id, name, code, game_state, status, is_private, created_at')
      .neq('status', 'finished')
      .order('created_at', { ascending: false });

    if (data) setLobbies(data as unknown as LobbyRow[]);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
    // Deferred call: the inner setState happens asynchronously (not in the effect body)
    queueMicrotask(() => { fetchLobbies(); });

    const ch = supabase.channel('public_lobbies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, fetchLobbies)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const t = TRANSLATIONS[lang];

  const getPlayers = (lobby: LobbyRow): LobbyPlayerInfo[] => {
      const p = lobby.game_state.players;
      if (Array.isArray(p)) return p;
      if (typeof p === 'object' && p !== null) return Object.values(p);
      return [];
  };

  /**
   * Seats in a room, through the shared helper rather than by hand.
   *
   * The list used to read `settings.maxPlayers` raw, so a row carrying a
   * value outside the game's own range displayed it as written — "2/99" for a
   * two-player game, and a room that could never read as full.
   */
  const capacityOf = (lobby: LobbyRow): number => {
      const game = getGame(lobby.game_state.gameType);
      return game ? roomCapacity(game, lobby.game_state.settings?.maxPlayers) : 6;
  };

  const getPlayerCount = (lobby: LobbyRow) => {
      const p = lobby.game_state.players;
      if (Array.isArray(p)) return p.length;
      if (typeof p === 'object' && p !== null) return Object.keys(p).length;
      return 0;
  };

  const handleJoin = async (lobby: LobbyRow, pass?: string) => {
    if (lobby.is_private) {
      // Server-side password check (the password never leaves the DB)
      const { data: passOk, error: rpcError } = await supabase.rpc('join_lobby_check', {
        p_lobby_id: lobby.id,
        p_password: pass || ''
      });

      if (rpcError) {
        // No fallback on purpose: the password column is not readable by
        // clients, so a failing RPC means the check cannot be performed at
        // all. Refuse rather than let anyone in.
        showToast(t.errorPass, 'error');
        return;
      } else if (!passOk) {
        showToast(t.errorPass, 'error');
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    const gameType = lobby.game_state.gameType;

    // A row whose gameType we do not recognise has no route to send anyone to.
    // Saying so beats navigating to /game/undefined, and beats the old
    // behaviour of defaulting to Coup and loading a Coup screen over a state
    // of some other shape.
    if (!getGame(gameType)) {
        showToast(t.errorNotFound, 'error');
        fetchLobbies();
        return;
    }

    // --- AUTH CHECK WITH REDIRECT TO GAME ---
    if (!user) {
        // Link straight to the game, not the lobby list
        const targetGameUrl = `/game/${gameType}?id=${lobby.id}`;
        router.push(`/?returnUrl=${encodeURIComponent(targetGameUrl)}`);
        return;
    }

    const { data: freshLobby, error: fetchError } = await supabase
        .from('lobbies')
        .select('game_state, status')
        .eq('id', lobby.id)
        .single();

    if (fetchError || !freshLobby) {
        showToast(t.errorNotFound, 'error');
        fetchLobbies();
        return;
    }

    if (freshLobby.status === 'finished') {
        showToast(lang === 'ru' ? 'Игра уже закончилась' : 'Game already finished', 'info');
        fetchLobbies();
        return;
    }

    const players = getPlayers({ ...lobby, game_state: freshLobby.game_state });

    if (players.some((p) => p.id === user.id || p.userId === user.id)) {
      router.push(`/game/${gameType}?id=${lobby.id}`);
      return;
    }

    // The room's own cap when it stored one, otherwise the game's declared
    // maximum. The old fallback hardcoded "2 for Battleship, 6 for anything
    // else", which quietly capped a 12-player Spyfall room at six.
    const maxPlayers =
      freshLobby.game_state.settings?.maxPlayers ?? getGame(gameType)?.players.max ?? 6;
    if (players.length >= maxPlayers) {
      showToast(t.errorFull, 'error');
      fetchLobbies();
      return;
    }

    if (freshLobby.status === 'playing') {
        showToast(t.started, 'info');
        return;
    }

    // Joining happens on the game page (initGame in every game)
    router.push(`/game/${gameType}?id=${lobby.id}`);
  };

  const handleCodeJoin = () => {
      const found = lobbies.find(l => l.code === codeQuery.toUpperCase());
      if (found) {
          if (found.is_private) setSelectedLobby(found);
          else handleJoin(found);
      } else {
          showToast(t.errorNotFound, 'error');
      }
  };

  const processedLobbies = lobbies
    .filter(l => {
        const term = search.toLowerCase();
        const players = getPlayers(l);
        const matchesRoomName = l.name.toLowerCase().includes(term);
        const matchesPlayerName = players.some((p) => (p.name || '').toLowerCase().includes(term));
        const matchesSearch = matchesRoomName || matchesPlayerName;

        const gameType = l.game_state.gameType;
        const matchesMode = filterMode === 'all' || gameType === filterMode;

        const isAlreadyIn = players.some((p) => p.id === currentUserId || p.userId === currentUserId);

        if ((l.status === 'playing' || l.status === 'finished') && !isAlreadyIn) return false;

        // A room with no seat left is not an offer. It used to sit in the list
        // wearing a disabled "Full" button, which reads as something you might
        // be able to do. Rooms you are already in stay, full or not.
        if (!isAlreadyIn && players.length >= capacityOf(l)) return false;

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
      ...GAMES.map(g => ({ id: g.id, label: g.name[lang] })),
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] font-sans relative overflow-x-hidden flex flex-col selection:bg-[#9e1316] selection:text-white">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none z-0" />
      <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-white via-white/80 to-transparent pointer-events-none z-0" />
      <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-[#9e1316]/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="sticky top-0 z-30 w-full bg-[#F8FAFC]/90 backdrop-blur-xl border-b border-[#E6E1DC] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <button onClick={() => router.push('/')} className="group p-2.5 md:p-3 bg-white border border-[#E6E1DC] rounded-xl hover:border-[#9e1316]/30 hover:shadow-sm transition-all">
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-[#8A9099] group-hover:text-[#9e1316]" />
            </button>
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-bold text-[#1A1F26] tracking-tight leading-none">{t.title}</h1>
                <p className="text-xs text-[#8A9099] font-medium hidden sm:block">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-[#E6E1DC] shadow-sm w-full md:w-auto transition-colors focus-within:border-[#9e1316]/50">
             <div className="relative flex-1">
                <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-[#9ca3af]" />
                <input
                    type="text"
                    placeholder={t.codePlaceholder}
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value.toUpperCase())}
                    className="w-full md:w-40 h-10 pl-9 pr-3 font-mono font-bold text-sm text-[#1A1F26] placeholder:text-gray-400 focus:outline-none bg-transparent tracking-wider"
                    maxLength={6}
                />
             </div>
             <button
                onClick={handleCodeJoin}
                disabled={codeQuery.length < 6}
                className="bg-[#1A1F26] hover:bg-[#9e1316] text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-8 flex items-center"
             >
                {t.join}
             </button>
          </div>

          <SettingsButton />
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full relative z-10 px-4 py-4 md:py-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8 items-start">
            <aside className="w-full lg:w-72 space-y-4 md:space-y-6 lg:sticky lg:top-28">
                <div className="bg-white p-3 rounded-2xl border border-[#E6E1DC] shadow-sm group focus-within:border-[#9e1316]/30 transition-all">
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-[#9ca3af] group-focus-within:text-[#1A1F26]" />
                        <input
                            type="text"
                            placeholder={t.searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full font-medium text-sm text-[#1A1F26] placeholder:text-gray-400 focus:outline-none bg-transparent"
                        />
                    </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#E6E1DC] shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#8A9099] uppercase tracking-wide mb-3">
                        <Filter className="w-4 h-4" /> {t.sort}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setSortBy('newest')} className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${sortBy === 'newest' ? 'bg-[#F1F5F9] text-[#1A1F26]' : 'text-gray-500 hover:bg-gray-50'}`}>{t.sortNew}</button>
                        <button onClick={() => setSortBy('oldest')} className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${sortBy === 'oldest' ? 'bg-[#F1F5F9] text-[#1A1F26]' : 'text-gray-500 hover:bg-gray-50'}`}>{t.sortOld}</button>
                        <button onClick={() => setSortBy('players-desc')} className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${sortBy === 'players-desc' ? 'bg-[#F1F5F9] text-[#1A1F26]' : 'text-gray-500 hover:bg-gray-50'}`}>
                            {t.sortPlayers} <SortDesc className="w-3 h-3" />
                        </button>
                        <button onClick={() => setSortBy('players-asc')} className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${sortBy === 'players-asc' ? 'bg-[#F1F5F9] text-[#1A1F26]' : 'text-gray-500 hover:bg-gray-50'}`}>
                            {t.sortPlayers} <SortAsc className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#E6E1DC] shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#8A9099] uppercase tracking-wide mb-3">
                        <LayoutGrid className="w-4 h-4" /> {t.modes}
                    </div>
                    <div className="flex flex-wrap lg:flex-col gap-1.5 -mx-1 lg:mx-0">
                        {MODES_LIST.map(mode => (
                            <label key={mode.id} className={`flex items-center gap-3 cursor-pointer group hover:bg-[#F8FAFC] px-3 py-2 rounded-lg transition-colors ${filterMode === mode.id ? 'bg-[#F1F5F9]' : ''}`}>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${filterMode === mode.id ? 'bg-[#1A1F26] border-[#1A1F26]' : 'border-gray-300 bg-white'}`}>
                                    {filterMode === mode.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                                <span className={`font-medium text-sm transition-colors ${filterMode === mode.id ? 'text-[#1A1F26]' : 'text-gray-600'}`}>
                                    {mode.label}
                                </span>
                                <input type="radio" name="mode" className="hidden" checked={filterMode === mode.id} onChange={() => setFilterMode(mode.id)} />
                            </label>
                        ))}
                    </div>
                </div>
            </aside>

            <div className="flex-1 w-full min-h-[50vh]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <Loader2 className="w-8 h-8 animate-spin text-[#9e1316] mb-3" />
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.loading}</span>
                    </div>
                ) : processedLobbies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#E6E1DC] rounded-3xl bg-white/50">
                        <div className="w-14 h-14 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-3">
                            <Search className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="text-[#1A1F26] font-bold text-base mb-1">{t.empty}</div>
                        <div className="text-gray-500 text-xs font-medium">{t.emptyDesc}</div>
                        <button onClick={() => router.push('/create')} className="mt-5 px-5 py-2.5 bg-[#1A1F26] text-white rounded-xl font-bold text-xs hover:bg-[#9e1316] transition-colors shadow-sm">
                            {t.create}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 pb-20">
                        {processedLobbies.map(lobby => {
                            const players = getPlayers(lobby);
                            const hostPlayer = players.find((p) => p.isHost) || players[0];
                            const game = getGame(lobby.game_state.gameType);
                            const maxPlayers = capacityOf(lobby);
                            const isFull = players.length >= maxPlayers;
                            const isPlaying = lobby.status === 'playing';
                            const GameIcon = game ? GAME_ICONS[game.id] : Users;
                            const isAlreadyIn = players.some((p) => p.id === currentUserId || p.userId === currentUserId);

                            return (
                                <div key={lobby.id} className={`group bg-white border border-[#E6E1DC] p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4 hover:shadow-lg hover:border-[#9e1316]/20 transition-all duration-300 relative overflow-hidden ${isAlreadyIn ? 'ring-1 ring-emerald-500/50 border-emerald-500/20' : ''}`}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#F5F5F0] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    {/* Unknown game type keeps the neutral chip rather than
                                        borrowing another game's colours — a row written by a
                                        newer deploy used to show up wearing Coup's icon. */}
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${game?.tint ?? 'bg-gray-50 text-gray-600'}`}>
                                        <GameIcon className="w-5 h-5" />
                                    </div>

                                    <div className="flex-1 text-center sm:text-left z-10 min-w-0 w-full">
                                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                            <h3 className="font-bold text-base text-[#1A1F26] truncate">{lobby.name}</h3>
                                            {lobby.is_private && <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                                        </div>

                                        <div className="flex items-center justify-center sm:justify-start gap-3 text-xs font-medium text-gray-500 flex-wrap">
                                            {hostPlayer && (
                                                <div className="flex items-center gap-1.5 bg-[#F8FAFC] px-2 py-1 rounded-md">
                                                    <Crown className="w-3 h-3 text-amber-500 fill-current shrink-0" />
                                                    <span className="truncate max-w-[100px] text-[#1A1F26]">{hostPlayer.name}</span>
                                                </div>
                                            )}
                                            <span className="flex items-center gap-1 shrink-0">
                                                <Users className="w-3.5 h-3.5" />
                                                <span className={isFull ? 'text-[#9e1316] font-bold' : 'text-emerald-600 font-bold'}>
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
                                                px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all w-full justify-center
                                                ${isAlreadyIn
                                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                    : (isFull || isPlaying)
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-[#1A1F26] text-white hover:bg-[#9e1316] shadow-sm active:scale-95'
                                                }
                                            `}
                                        >
                                            {isAlreadyIn ? t.back : (isFull ? t.full : (isPlaying ? t.started : t.join))}
                                            {!isFull && !isPlaying && <Play className="w-3 h-3 fill-current" />}
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
          <div className="fixed inset-0 bg-[#1A1F26]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={() => setSelectedLobby(null)}>
            <div className="bg-white p-6 rounded-[24px] w-full max-w-sm relative shadow-2xl border border-[#E6E1DC] animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedLobby(null)} className="absolute top-4 right-4 text-gray-400 hover:text-[#1A1F26] transition-colors"><X className="w-5 h-5" /></button>
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#1A1F26]">
                  <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-1 text-center text-[#1A1F26]">{selectedLobby.name}</h3>
              <p className="text-xs text-center text-gray-500 font-medium mb-6">{t.private}</p>
              <div className="space-y-3">
                  <input
                    type="password"
                    placeholder={t.enterPass}
                    className="w-full bg-[#F8FAFC] border border-gray-200 focus:bg-white focus:border-[#1A1F26] rounded-xl py-3 px-4 text-center text-[#1A1F26] font-bold text-base transition-all outline-none placeholder:text-gray-400"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleJoin(selectedLobby, passwordInput); }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleJoin(selectedLobby, passwordInput)}
                    className="w-full bg-[#1A1F26] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#9e1316] transition-colors shadow-md active:scale-95"
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