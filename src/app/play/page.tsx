'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Search, Users, Lock, Play, X, Loader2,
  Crown, Filter, ScrollText, KeyRound, Unlock, SortAsc, SortDesc
} from 'lucide-react';
import { GameState, Player } from '@/types/coup';

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

function PlayContent() {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Фильтры ---
  const [search, setSearch] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [filterCoup, setFilterCoup] = useState(true);
  const [filterMafia, setFilterMafia] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // --- Приватные комнаты ---
  const [selectedLobby, setSelectedLobby] = useState<LobbyRow | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  const fetchLobbies = async () => {
    const { data } = await supabase
      .from('lobbies')
      .select('*')
      .neq('status', 'finished') // Не показываем завершенные
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
      alert('Неверный пароль');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Авторизуйтесь, чтобы играть');
      return;
    }

    // Если уже внутри
    if (lobby.game_state.players.some(p => p.id === user.id)) {
      router.push(`/game/coup?id=${lobby.id}`);
      return;
    }

    if (lobby.game_state.players.length >= 6) {
      alert('Комната заполнена');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    // Используем реальные данные профиля
    const newPlayer: Player = {
      id: user.id,
      name: profile?.username || user.email?.split('@')[0] || 'Player',
      avatarUrl: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
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
          alert('Лобби с таким кодом не найдено');
      }
  };

  // --- Логика фильтрации и сортировки ---
  const processedLobbies = lobbies
    .filter(l => {
        const term = search.toLowerCase();
        // Поиск по названию комнаты
        const matchesRoomName = l.name.toLowerCase().includes(term);
        // Поиск по нику игрока внутри комнаты
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] font-sans relative overflow-x-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      <div className="max-w-6xl mx-auto w-full relative z-10 px-4 py-6">

        {/* ХЕДЕР */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="group p-3 bg-white border border-[#E6E1DC] rounded-2xl hover:border-[#9e1316]/30 hover:shadow-lg hover:shadow-[#9e1316]/5 transition-all">
                <ArrowLeft className="w-5 h-5 text-[#8A9099] group-hover:text-[#9e1316]" />
            </button>
            <div>
                <h1 className="text-3xl font-black text-[#1A1F26] uppercase tracking-tight leading-none">Список Игр</h1>
                <p className="text-xs font-bold text-[#8A9099] uppercase tracking-wider mt-1">Присоединяйся и побеждай</p>
            </div>
          </div>

          {/* Ввод Кода */}
          <div className="flex bg-white p-2 rounded-2xl border border-[#E6E1DC] shadow-sm w-full md:w-auto">
             <div className="relative flex-1">
                <KeyRound className="absolute left-3 top-3 w-5 h-5 text-[#E6E1DC]" />
                <input
                    type="text"
                    placeholder="Код лобби"
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value.toUpperCase())}
                    className="w-full md:w-32 h-full pl-10 pr-4 font-mono font-bold text-[#1A1F26] placeholder:text-[#E6E1DC] focus:outline-none bg-transparent uppercase"
                    maxLength={6}
                />
             </div>
             <button
                onClick={handleCodeJoin}
                disabled={codeQuery.length < 6}
                className="bg-[#1A1F26] hover:bg-[#9e1316] text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
                Войти
             </button>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* САЙДБАР ФИЛЬТРОВ */}
            <aside className="w-full lg:w-72 space-y-6">

                {/* Поиск */}
                <div className="bg-white p-4 rounded-[24px] border border-[#E6E1DC] shadow-sm group focus-within:border-[#9e1316]/30 focus-within:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-[#8A9099]" />
                        <input
                            type="text"
                            placeholder="Название или ник..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full font-bold text-sm text-[#1A1F26] placeholder:text-[#E6E1DC] focus:outline-none"
                        />
                    </div>
                </div>

                {/* Сортировка */}
                <div className="bg-white p-6 rounded-[24px] border border-[#E6E1DC] shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-black text-[#8A9099] uppercase tracking-widest mb-4">
                        <Filter className="w-4 h-4" /> Сортировка
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setSortBy('newest')} className={`p-2 rounded-lg text-[10px] font-bold uppercase transition-all ${sortBy === 'newest' ? 'bg-[#1A1F26] text-white' : 'bg-[#F5F5F0] text-[#8A9099]'}`}>Новые</button>
                        <button onClick={() => setSortBy('oldest')} className={`p-2 rounded-lg text-[10px] font-bold uppercase transition-all ${sortBy === 'oldest' ? 'bg-[#1A1F26] text-white' : 'bg-[#F5F5F0] text-[#8A9099]'}`}>Старые</button>
                        <button onClick={() => setSortBy('players-desc')} className={`p-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${sortBy === 'players-desc' ? 'bg-[#1A1F26] text-white' : 'bg-[#F5F5F0] text-[#8A9099]'}`}>
                            Игроки <SortDesc className="w-3 h-3" />
                        </button>
                        <button onClick={() => setSortBy('players-asc')} className={`p-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${sortBy === 'players-asc' ? 'bg-[#1A1F26] text-white' : 'bg-[#F5F5F0] text-[#8A9099]'}`}>
                            Игроки <SortAsc className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Типы игр */}
                <div className="bg-white p-6 rounded-[24px] border border-[#E6E1DC] shadow-sm space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black text-[#8A9099] uppercase tracking-widest mb-2">
                        Режимы
                    </div>

                    <label className="flex items-center gap-4 cursor-pointer group">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${filterCoup ? 'bg-[#9e1316] border-[#9e1316]' : 'border-[#E6E1DC] bg-[#F5F5F0]'}`}>
                            {filterCoup && <X className="w-4 h-4 text-white rotate-0" />}
                        </div>
                        <span className={`font-bold text-sm transition-colors ${filterCoup ? 'text-[#1A1F26]' : 'text-[#8A9099]'}`}>Coup (Переворот)</span>
                        <input type="checkbox" className="hidden" checked={filterCoup} onChange={() => setFilterCoup(!filterCoup)} />
                    </label>

                    <label className="flex items-center gap-4 cursor-pointer group">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${filterMafia ? 'bg-[#1A1F26] border-[#1A1F26]' : 'border-[#E6E1DC] bg-[#F5F5F0]'}`}>
                            {filterMafia && <X className="w-4 h-4 text-white rotate-0" />}
                        </div>
                        <span className={`font-bold text-sm transition-colors ${filterMafia ? 'text-[#1A1F26]' : 'text-[#8A9099]'}`}>Mafia</span>
                        <input type="checkbox" className="hidden" checked={filterMafia} onChange={() => setFilterMafia(!filterMafia)} />
                    </label>
                </div>
            </aside>

            {/* СПИСОК ЛОББИ */}
            <div className="flex-1 w-full">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <Loader2 className="w-10 h-10 animate-spin text-[#9e1316] mb-4" />
                        <span className="text-xs font-bold uppercase tracking-widest text-[#8A9099]">Загрузка миров...</span>
                    </div>
                ) : processedLobbies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#E6E1DC] rounded-[32px] bg-white/50">
                        <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-[#E6E1DC]" />
                        </div>
                        <div className="text-[#1A1F26] font-black text-lg mb-1">Ничего не найдено</div>
                        <div className="text-[#8A9099] text-xs font-bold uppercase tracking-widest">Попробуйте изменить фильтры</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {processedLobbies.map(lobby => {
                            // Ищем хоста в массиве игроков
                            const hostPlayer = lobby.game_state.players.find(p => p.isHost) || lobby.game_state.players[0];
                            const isFull = lobby.game_state.players.length >= 6;
                            const gameType = lobby.game_state.gameType || 'coup';

                            return (
                                <div key={lobby.id} className="group bg-white border border-[#E6E1DC] p-5 rounded-[24px] flex flex-col sm:flex-row items-center gap-6 hover:shadow-xl hover:shadow-[#9e1316]/5 hover:border-[#9e1316]/30 transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#F5F5F0] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${gameType === 'coup' ? 'bg-[#9e1316]/10 text-[#9e1316]' : 'bg-[#1A1F26]/10 text-[#1A1F26]'}`}>
                                        {gameType === 'coup' ? <ScrollText className="w-8 h-8" /> : <Users className="w-8 h-8" />}
                                    </div>

                                    <div className="flex-1 text-center sm:text-left z-10">
                                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                            <h3 className="font-black text-lg text-[#1A1F26] group-hover:text-[#9e1316] transition-colors">{lobby.name}</h3>
                                            {lobby.is_private ? <Lock className="w-4 h-4 text-[#E6E1DC]" /> : <Unlock className="w-4 h-4 text-[#E6E1DC] opacity-50" />}
                                        </div>

                                        <div className="flex items-center justify-center sm:justify-start gap-4 text-xs font-bold text-[#8A9099] uppercase tracking-wide">
                                            {hostPlayer && (
                                                <div className="flex items-center gap-2 bg-[#F5F5F0] px-2 py-1 rounded-lg pr-3">
                                                    {hostPlayer.avatarUrl ? (
                                                        <img src={hostPlayer.avatarUrl} alt={hostPlayer.name} className="w-5 h-5 rounded-full object-cover border border-white shadow-sm" />
                                                    ) : (
                                                        <Crown className="w-4 h-4 text-[#E6E1DC] fill-current" />
                                                    )}
                                                    <span className="truncate max-w-[100px] text-xs font-bold text-[#1A1F26]">{hostPlayer.name}</span>
                                                </div>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                <span className={isFull ? 'text-[#9e1316]' : 'text-emerald-600'}>
                                                    {lobby.game_state.players.length}/6
                                                </span>
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => lobby.is_private ? setSelectedLobby(lobby) : handleJoin(lobby)}
                                        disabled={isFull}
                                        className={`
                                            z-10 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all
                                            ${isFull
                                                ? 'bg-[#F5F5F0] text-[#E6E1DC] cursor-not-allowed'
                                                : 'bg-[#1A1F26] text-white hover:bg-[#9e1316] shadow-lg shadow-[#1A1F26]/10 hover:shadow-[#9e1316]/20 active:scale-95'
                                            }
                                        `}
                                    >
                                        {isFull ? 'Full' : 'Войти'} <Play className="w-3 h-3 fill-current" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {/* Модальное окно пароля */}
        {selectedLobby && (
          <div className="fixed inset-0 bg-[#1A1F26]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-[32px] w-full max-w-sm relative shadow-2xl border border-[#E6E1DC] animate-in zoom-in-95">
              <button onClick={() => setSelectedLobby(null)} className="absolute top-6 right-6 text-[#8A9099] hover:text-[#1A1F26] transition-colors"><X className="w-6 h-6" /></button>

              <div className="w-16 h-16 bg-[#9e1316]/5 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#9e1316]">
                  <Lock className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-black mb-2 uppercase text-center text-[#1A1F26] tracking-tight">{selectedLobby.name}</h3>
              <p className="text-xs text-center text-[#8A9099] font-bold uppercase tracking-wider mb-8">Приватная комната</p>

              <div className="space-y-4">
                  <input
                    type="password"
                    placeholder="Введите пароль..."
                    className="w-full bg-[#F5F5F0] border border-transparent focus:bg-white focus:border-[#9e1316] rounded-xl py-4 px-5 text-center text-[#1A1F26] font-bold text-lg transition-all outline-none placeholder:text-[#E6E1DC] placeholder:font-medium"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                  />
                  <button
                    onClick={() => handleJoin(selectedLobby, passwordInput)}
                    className="w-full bg-[#1A1F26] text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg active:scale-95"
                  >
                    Подтвердить
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