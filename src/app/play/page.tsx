'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, Users, Lock, Play, X, Loader2 } from 'lucide-react';
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

  // Для приватных комнат
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

    // Если уже в игре — просто редирект
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] p-4 font-sans relative">
       <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      <div className="max-w-4xl mx-auto w-full relative z-10">
        <header className="flex items-center justify-between mb-8">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-gray-500 hover:text-[#9e1316]">
            <div className="p-2 bg-white border rounded-lg shadow-sm"><ArrowLeft className="w-5 h-5" /></div>
            <span className="font-bold uppercase text-xs tracking-widest hidden sm:block">Назад</span>
          </button>
          <h1 className="text-2xl font-black uppercase tracking-tight">Найти Игру</h1>
          <div className="w-10" />
        </header>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-12 pr-4 font-bold focus:outline-none focus:border-[#9e1316]"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#9e1316]" /></div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-400 font-bold uppercase">Игр не найдено</div>
            ) : (
              filtered.map(lobby => (
                <div key={lobby.id} className="bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between hover:shadow-lg transition-all group">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{lobby.name}</h3>
                      {lobby.is_private && <Lock className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase">
                      <span className="bg-gray-100 px-2 py-1 rounded">Coup</span>
                      <span className="flex items-center gap-1 text-[#9e1316]">
                        <Users className="w-3 h-3" /> {lobby.game_state.players.length} / 6
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => lobby.is_private ? setSelectedLobby(lobby) : handleJoin(lobby)}
                    className="bg-[#1A1F26] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-[#9e1316] transition-colors flex items-center gap-2"
                  >
                    Войти <Play className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {selectedLobby && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-3xl w-full max-w-sm relative shadow-2xl">
              <button onClick={() => setSelectedLobby(null)} className="absolute top-4 right-4"><X className="w-5 h-5" /></button>
              <h3 className="text-xl font-black mb-4 uppercase text-center">Приватная игра</h3>
              <input
                type="password"
                placeholder="Введите пароль"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-center font-bold"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
              <button
                onClick={() => handleJoin(selectedLobby, passwordInput)}
                className="w-full bg-[#1A1F26] text-white py-3 rounded-xl font-bold uppercase hover:bg-[#9e1316]"
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