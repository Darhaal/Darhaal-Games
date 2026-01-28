'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Users, Lock, Play, X, Loader2, Filter, SortAsc, SortDesc } from 'lucide-react';
import { GameState, Player } from '@/types/coup';

interface LobbyRow {
  id: string;
  name: string;
  code: string;
  game_state: GameState;
  status: string;
  is_private: boolean;
  password?: string;
}

function PlayContent() {
  const router = useRouter();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Приватные комнаты
  const [selectedLobby, setSelectedLobby] = useState<LobbyRow | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

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
      alert('Неверный пароль');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Сначала войдите в аккаунт');
      return;
    }

    const existingPlayer = lobby.game_state.players.find(p => p.id === user.id);
    if (existingPlayer) {
      router.push(`/game/coup?id=${lobby.id}`);
      return;
    }

    if (lobby.game_state.players.length >= 6) {
      alert('Лобби переполнено');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    const newPlayer: Player = {
      id: user.id,
      name: profile?.username || 'Guest',
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

    if (error) {
      alert('Ошибка входа: ' + error.message);
    } else {
      router.push(`/game/coup?id=${lobby.id}`);
    }
  };

  const filtered = lobbies.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] p-4 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      <div className="max-w-4xl mx-auto w-full relative z-10">
        <header className="flex items-center justify-between mb-8 pt-4">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-[#8A9099] hover:text-[#9e1316] transition-colors group">
            <div className="p-2 bg-white border border-[#E6E1DC] rounded-lg shadow-sm group-hover:border-[#9e1316]/50"><ArrowLeft className="w-5 h-5" /></div>
            <span className="font-bold uppercase text-xs tracking-widest hidden sm:block">Назад</span>
          </button>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[#1A1F26]">Найти Игру</h1>
          <div className="w-10" />
        </header>

        <div className="relative mb-8 group">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-[#8A9099] group-focus-within:text-[#9e1316] transition-colors" />
          <input
            type="text"
            placeholder="Поиск лобби..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E6E1DC] rounded-xl py-3 pl-12 pr-4 font-bold text-sm text-[#1A1F26] focus:outline-none focus:border-[#9e1316] focus:shadow-lg focus:shadow-[#9e1316]/5 transition-all"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin w-10 h-10 text-[#9e1316]" /></div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#E6E1DC] rounded-3xl bg-white/50">
                <Search className="w-12 h-12 text-[#E6E1DC] mb-4" />
                <div className="text-[#8A9099] font-bold uppercase tracking-widest">Игр не найдено</div>
              </div>
            ) : (
              filtered.map(lobby => (
                <div key={lobby.id} className="bg-white border border-[#E6E1DC] p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between hover:shadow-lg hover:border-[#9e1316]/30 transition-all group gap-4">
                  <div className="flex-1 w-full sm:w-auto">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg text-[#1A1F26] group-hover:text-[#9e1316] transition-colors">{lobby.name}</h3>
                      {lobby.is_private && <Lock className="w-4 h-4 text-[#8A9099]" />}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-[#8A9099] uppercase tracking-wide">
                      <span className="bg-[#F5F5F0] px-2 py-1 rounded">Coup</span>
                      <span className={`flex items-center gap-1 ${lobby.game_state.players.length >= 6 ? 'text-[#9e1316]' : 'text-emerald-600'}`}>
                        <Users className="w-3 h-3" /> {lobby.game_state.players.length} / 6
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => lobby.is_private ? setSelectedLobby(lobby) : handleJoin(lobby)}
                    className="w-full sm:w-auto bg-[#1A1F26] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#9e1316] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#1A1F26]/10"
                  >
                    Войти <Play className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {selectedLobby && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-[32px] w-full max-w-sm relative shadow-2xl border border-[#E6E1DC]">
              <button onClick={() => setSelectedLobby(null)} className="absolute top-4 right-4 text-[#8A9099] hover:text-[#1A1F26]"><X className="w-6 h-6" /></button>
              <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#1A1F26]"><Lock className="w-8 h-8" /></div>
              <h3 className="text-xl font-black mb-2 uppercase text-center text-[#1A1F26] tracking-tight">{selectedLobby.name}</h3>
              <p className="text-xs text-center text-[#8A9099] font-bold uppercase tracking-wider mb-6">Введите пароль для входа</p>

              <input
                type="password"
                placeholder="Пароль"
                className="w-full bg-[#F5F5F0] border-none rounded-xl py-4 px-5 text-center text-[#1A1F26] font-bold text-lg mb-4 focus:ring-2 focus:ring-[#9e1316]/20 transition-all placeholder:text-[#E6E1DC]"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
              <button
                onClick={() => handleJoin(selectedLobby, passwordInput)}
                className="w-full bg-[#1A1F26] text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg"
              >
                Войти
              </button>
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