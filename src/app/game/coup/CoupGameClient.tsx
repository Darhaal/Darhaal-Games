'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, ScrollText, Coins, Loader2, Copy, Check,
  Clock, Skull, LogOut, RotateCcw
} from 'lucide-react';
import {
  DICTIONARY, Lang, GameState, Player, Card, getRoleIcon
} from './GameConstants';
import { GameInfoModal } from './GameInfoModal';

// --- Вспомогательный компонент Аватара ---
const PlayerAvatar = ({ url, name, size = 'md', border = false, borderColor = 'border-white' }: any) => {
  const sizeClasses: any = { md: 'w-12 h-12', lg: 'w-16 h-16', xl: 'w-20 h-20' };
  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-[#1A1F26] flex items-center justify-center border-4 ${border ? borderColor : 'border-transparent'}`}>
      <img src={url} alt={name} className="w-full h-full object-cover" />
    </div>
  );
};

// --- Компонент Карточки ---
const GameCard = ({ card, lang, onClick, selectable, selected }: any) => {
  const roleData = (DICTIONARY[lang].roles as any)[card.role];
  const Icon = getRoleIcon(card.role);

  return (
    <div
      onClick={onClick}
      className={`relative w-28 h-40 sm:w-32 sm:h-48 rounded-2xl transition-all duration-500 shadow-xl
      ${card.revealed ? 'grayscale opacity-60' : 'hover:-translate-y-2 cursor-pointer'}
      ${selected ? 'ring-4 ring-emerald-500 scale-105' : ''}`}
      style={{ backgroundColor: 'white', border: `2px solid ${card.revealed ? '#d1d5db' : roleData.color}` }}
    >
      <div className={`flex flex-col h-full overflow-hidden rounded-2xl ${card.revealed ? 'hidden' : 'flex'}`}>
        <div className="h-14 flex items-center justify-center" style={{ backgroundColor: roleData.color }}>
          <Icon className="text-white w-8 h-8" />
        </div>
        <div className="p-3 text-center flex-1 flex flex-col justify-between">
          <span className="font-black text-[11px] uppercase" style={{ color: roleData.color }}>{roleData.name}</span>
          <div className="bg-gray-50 py-1 rounded-lg text-[9px] font-black uppercase text-gray-400">{roleData.action}</div>
        </div>
      </div>
      {card.revealed && <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 rounded-2xl"><Skull className="text-gray-400 w-12 h-12" /></div>}
    </div>
  );
};

function CoupGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyId = searchParams.get('id');

  const [user, setUser] = useState<any>(null);
  const [lang, setLang] = useState<Lang>('ru');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // 1. Инициализация языка и пользователя
  useEffect(() => {
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  // 2. Realtime подписка
  useEffect(() => {
    if (!lobbyId) return;

    const channel = supabase.channel(`lobby:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => setGameState(payload.new.game_state))
      .subscribe();

    supabase.from('lobbies').select('game_state').eq('id', lobbyId).single()
      .then(({ data }) => data && setGameState(data.game_state));

    return () => { supabase.removeChannel(channel); };
  }, [lobbyId]);

  if (loading || !gameState) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#9E1316]" /></div>;

  const me = gameState.players.find(p => p.id === user?.id);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === user?.id && !gameState.winner;
  const t = DICTIONARY[lang];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col relative overflow-hidden">
      {/* Background Noise */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="p-4 border-b bg-white/80 backdrop-blur-md flex justify-between items-center z-50">
        <button onClick={() => router.push('/play')} className="p-2 text-gray-400 hover:text-[#9E1316]"><ArrowLeft /></button>
        <div className="flex flex-col items-center">
          <h1 className="font-black text-xl flex items-center gap-2"><ScrollText className="text-[#9E1316]" /> COUP</h1>
          {isMyTurn && <span className="text-[10px] font-black text-emerald-500 animate-pulse">{t.ui.yourTurn}</span>}
        </div>
        <button onClick={() => setShowRules(true)} className="p-2 text-gray-400 hover:text-[#9E1316]"><Info /></button>
      </header>

      {/* Game View */}
      <div className="flex-1 flex flex-col justify-between p-4 max-w-5xl mx-auto w-full z-10">

        {/* Opponents */}
        <div className="flex justify-center gap-6 flex-wrap py-4">
          {gameState.players.filter(p => p.id !== user?.id).map(p => (
            <div key={p.id} className={`flex flex-col items-center gap-2 transition-all ${p.isDead ? 'opacity-40 grayscale' : ''}`}>
              <PlayerAvatar url={p.avatarUrl} name={p.name} border={gameState.players[gameState.turnIndex].id === p.id} borderColor="border-[#9E1316]" />
              <div className="bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100 flex items-center gap-2">
                <span className="text-[10px] font-bold truncate max-w-[60px]">{p.name}</span>
                <span className="flex items-center text-yellow-600 font-bold text-[10px]"><Coins className="w-3 h-3 mr-0.5" />{p.coins}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Deck/Table Center */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-28 bg-[#1A1F26] rounded-2xl border-4 border-white shadow-2xl flex flex-col items-center justify-center text-white/10">
            <span className="font-black text-[10px] uppercase">{t.ui.deck}</span>
            <span className="text-lg font-black">{gameState.deck.length}</span>
          </div>
        </div>

        {/* Action Controls */}
        {me && !me.isDead && (
          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-4 perspective-1000">
              {me.cards.map((c, i) => <GameCard key={i} card={c} lang={lang} />)}
            </div>

            <div className={`grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 w-full p-4 bg-white/90 backdrop-blur rounded-3xl border border-gray-200 shadow-2xl transition-opacity ${!isMyTurn ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="col-span-full flex justify-between items-center mb-2 px-2">
                <div className="flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-1.5 rounded-full border border-yellow-100">
                  <Coins className="w-4 h-4" /> <span className="font-black text-lg">{me.coins}</span>
                </div>
                {isMyTurn && <div className="flex items-center gap-2 text-emerald-600 text-xs font-black uppercase"><Clock className="w-4 h-4" /> 30s</div>}
              </div>
              {/* Actions */}
              <button className="p-3 border rounded-2xl text-[10px] font-black uppercase hover