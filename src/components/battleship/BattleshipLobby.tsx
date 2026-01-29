'use client';

import React, { useState } from 'react';
import { LogOut, Book, HelpCircle, Anchor, Users, Copy, Check } from 'lucide-react';
import { BattleshipState, Lang } from '@/types/battleship';

interface BattleshipLobbyProps {
  gameState: BattleshipState;
  roomMeta: { name: string; code: string; isHost: boolean } | null;
  userId: string | undefined;
  startGame: () => Promise<void>;
  leaveGame: () => Promise<void>;
  lang: Lang;
}

export default function BattleshipLobby({ gameState, roomMeta, userId, startGame, leaveGame, lang }: BattleshipLobbyProps) {
  const [copied, setCopied] = useState(false);

  const players = Object.values(gameState.players || {});
  const me = userId ? gameState.players[userId] : null;
  const isHost = roomMeta?.isHost;

  const t = {
    ru: {
      title: 'Морской Бой',
      waiting: 'Ожидание противника...',
      ready: 'Флот готов к развертыванию',
      start: 'Начать битву',
      leave: 'Покинуть базу',
      players: 'Адмиралы',
      code: 'Код операции',
      copy: 'Скопировано',
      minPlayers: 'Нужно 2 игрока'
    },
    en: {
      title: 'Battleship',
      waiting: 'Waiting for opponent...',
      ready: 'Fleet ready for deployment',
      start: 'Start Battle',
      leave: 'Abandon Base',
      players: 'Admirals',
      code: 'Operation Code',
      copy: 'Copied',
      minPlayers: 'Need 2 players'
    }
  }[lang];

  const handleCopy = () => {
    if (roomMeta?.code) {
        navigator.clipboard.writeText(roomMeta.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

      {/* HEADER */}
      <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
        <button onClick={leaveGame} className="flex items-center gap-2 text-gray-400 hover:text-[#9e1316] transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="text-xs font-bold uppercase hidden sm:block">{t.leave}</span>
        </button>
        <div className="text-center">
            <h1 className="text-2xl font-black text-[#1A1F26] flex items-center gap-2 justify-center">
                <Anchor className="w-6 h-6 text-[#9e1316]" /> {roomMeta?.name || t.title}
            </h1>
            <div className="text-[10px] font-bold text-[#9e1316] uppercase tracking-widest">{t.waiting}</div>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 z-10 flex flex-col lg:flex-row gap-8 items-center justify-center">

        {/* PLAYER LIST */}
        <div className="w-full lg:w-2/3 bg-white border border-[#E6E1DC] rounded-[32px] p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#9e1316]" /> {t.players} {players.length}/2
              </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {players.map(p => (
              <div key={p.userId} className="relative bg-[#F5F5F0] p-6 rounded-2xl border border-[#E6E1DC] flex items-center gap-4 group transition-all hover:border-[#9e1316]/30">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-white shadow-md overflow-hidden">
                    <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.userId}`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="flex flex-col">
                    <div className="font-black text-[#1A1F26] uppercase tracking-tight">Admiral</div>
                    <div className="text-sm font-bold text-[#8A9099]">{p.userId === userId ? 'Вы' : 'Противник'}</div>
                </div>
                {p.isHost && <Anchor className="w-4 h-4 text-[#9e1316] absolute top-4 right-4" />}
              </div>
            ))}

            {players.length < 2 && (
                <div className="bg-white border-2 border-dashed border-[#E6E1DC] p-6 rounded-2xl flex items-center justify-center text-[#8A9099] font-bold text-xs uppercase tracking-widest animate-pulse">
                    Ожидание...
                </div>
            )}
          </div>
        </div>

        {/* SIDEBAR / CODE */}
        <div className="w-full lg:w-1/3 space-y-4">
            <div className="bg-white border border-[#E6E1DC] p-8 rounded-[32px] shadow-sm text-center">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">{t.code}</div>
                <div className="relative group cursor-pointer mb-8" onClick={handleCopy}>
                    <div className="text-5xl font-black text-[#1A1F26] group-hover:text-[#9e1316] transition-colors">
                        {roomMeta?.code}
                    </div>
                    <div className="absolute -right-2 -top-2 bg-[#9e1316] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </div>
                </div>

                {isHost ? (
                    <button
                        onClick={startGame}
                        disabled={players.length < 2}
                        className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-widest disabled:opacity-30 hover:bg-[#9e1316] transition-all shadow-lg active:scale-95"
                    >
                        {players.length < 2 ? t.minPlayers : t.start}
                    </button>
                ) : (
                    <div className="py-4 px-6 bg-[#F5F5F0] rounded-xl text-xs font-bold text-[#8A9099] uppercase tracking-widest animate-pulse">
                        {t.waiting}
                    </div>
                )}
            </div>

            <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest px-4">
                {lang === 'ru'
                    ? "Убедитесь, что ваш флот готов к сражению. Как только адмирал начнет игру, пути назад не будет."
                    : "Ensure your fleet is ready for battle. Once the admiral starts the game, there is no turning back."}
            </p>
        </div>
      </main>
    </div>
  );
}