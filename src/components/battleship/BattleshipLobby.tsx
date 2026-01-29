'use client';

import React, { useState } from 'react';
import { LogOut, Book, HelpCircle, Anchor, Users, Copy, Check, Crown } from 'lucide-react';
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
  const isHost = roomMeta?.isHost;

  const t = {
    ru: {
      title: 'Морской Бой',
      waiting: 'Ожидание соперника...',
      start: 'В Бой!',
      leave: 'Выйти',
      players: 'Флот',
      code: 'Код доступа',
      copy: 'Скопировано',
      minPlayers: 'Ждем 2-го игрока'
    },
    en: {
      title: 'Battleship',
      waiting: 'Waiting for opponent...',
      start: 'Battle!',
      leave: 'Leave',
      players: 'Fleet',
      code: 'Access Code',
      copy: 'Copied',
      minPlayers: 'Waiting for P2'
    }
  }[lang];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

      {/* HEADER */}
      <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
        <button onClick={leaveGame} className="p-2 bg-white border border-[#E6E1DC] rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm">
            <LogOut className="w-5 h-5 text-gray-500 hover:text-red-600" />
        </button>
        <div className="text-center">
            <h1 className="font-black text-xl flex items-center gap-2 uppercase tracking-tight text-[#1A1F26]">
               <Anchor className="w-6 h-6 text-[#9e1316]" /> {t.title}
            </h1>
            <div className="text-[10px] font-bold text-[#9e1316] uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full mt-1 inline-block">
                {t.waiting}
            </div>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 z-10 flex flex-col items-center justify-center gap-8">

        {/* ROOM CODE */}
        <div className="relative group cursor-pointer" onClick={() => { navigator.clipboard.writeText(roomMeta?.code || ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
            <div className="bg-white border-2 border-[#1A1F26] px-10 py-6 rounded-[2rem] shadow-[4px_4px_0px_0px_rgba(26,31,38,1)] active:translate-y-1 active:shadow-none transition-all">
                <div className="text-center">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{t.code}</div>
                    <div className="text-5xl font-black text-[#1A1F26] tracking-widest">{roomMeta?.code}</div>
                </div>
            </div>
            {copied && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1A1F26] text-white text-[10px] font-bold uppercase px-3 py-1 rounded-full animate-in fade-in slide-in-from-bottom-2">
                    {t.copy}
                </div>
            )}
        </div>

        {/* PLAYERS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            {players.map(p => (
              <div key={p.userId} className="bg-white p-6 rounded-[24px] border border-[#E6E1DC] flex flex-col items-center gap-4 relative shadow-sm animate-in zoom-in-95">
                {p.isHost && <div className="absolute top-4 right-4 text-[#9e1316]"><Crown className="w-5 h-5" /></div>}
                <div className="w-20 h-20 rounded-full bg-[#F5F5F0] border-4 border-white shadow-lg overflow-hidden">
                    <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.userId}`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="text-center">
                    <div className="font-black text-[#1A1F26] text-lg uppercase tracking-tight">Admiral</div>
                    <div className="text-xs font-bold text-[#8A9099] uppercase tracking-wider">{p.userId === userId ? '(Вы)' : ''}</div>
                </div>
                <div className="w-full h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#9e1316] w-full animate-pulse" />
                </div>
              </div>
            ))}

            {players.length < 2 && (
                <div className="bg-[#F8FAFC] border-2 border-dashed border-[#E6E1DC] p-6 rounded-[24px] flex flex-col items-center justify-center gap-4 opacity-60">
                    <div className="w-20 h-20 rounded-full bg-[#E6E1DC]/30 flex items-center justify-center">
                        <Users className="w-8 h-8 text-[#8A9099]" />
                    </div>
                    <div className="font-bold text-[#8A9099] uppercase tracking-wider text-xs">Ожидание...</div>
                </div>
            )}
        </div>

        {/* START BUTTON */}
        {isHost && (
            <button
                onClick={startGame}
                disabled={players.length < 2}
                className="w-full max-w-sm py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-[0.2em] hover:bg-[#9e1316] disabled:opacity-50 disabled:hover:bg-[#1A1F26] transition-all shadow-lg active:scale-95 mt-4"
            >
                {players.length < 2 ? t.minPlayers : t.start}
            </button>
        )}

        {!isHost && (
             <div className="mt-4 text-xs font-bold text-[#8A9099] uppercase tracking-widest animate-pulse">
                 {t.waiting}
             </div>
        )}

      </main>
    </div>
  );
}