'use client';

import React, { useState } from 'react';
import { LogOut, Book, HelpCircle, Crown } from 'lucide-react';
import { DICTIONARY } from '@/constants/coup';
import { Lang, GameState } from '@/types/coup';
import { RulesModal, GuideModal } from './CoupComponents';

interface CoupLobbyProps {
  gameState: GameState;
  roomMeta: { name: string; code: string; isHost: boolean } | null;
  userId: string | undefined;
  startGame: () => Promise<void>;
  leaveGame: () => Promise<void>;
  lang: Lang;
}

export default function CoupLobby({ gameState, roomMeta, userId, startGame, leaveGame, lang }: CoupLobbyProps) {
  const [activeModal, setActiveModal] = useState<'rules' | 'guide' | null>(null);
  const [copied, setCopied] = useState(false);
  const t = DICTIONARY[lang].ui;
  const players = gameState.players || [];
  const me = players.find(p => p.id === userId);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />
      {activeModal === 'rules' && <RulesModal onClose={() => setActiveModal(null)} lang={lang} />}
      {activeModal === 'guide' && <GuideModal onClose={() => setActiveModal(null)} lang={lang} />}

      <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
        <button onClick={leaveGame} className="flex items-center gap-2 text-gray-400 hover:text-[#9e1316] transition-colors"><LogOut className="w-5 h-5" /><span className="text-xs font-bold uppercase hidden sm:block">{t.leave}</span></button>
        <div className="text-center"><h1 className="text-2xl font-black text-[#1A1F26]">{roomMeta?.name}</h1><div className="text-[10px] font-bold text-[#9e1316] uppercase">{t.waiting}</div></div>
        <div className="flex gap-2">
          <button onClick={() => setActiveModal('guide')} className="p-2 bg-white border border-[#E6E1DC] rounded-xl shadow-sm hover:border-[#9e1316] hover:text-[#9e1316] transition-colors"><Book className="w-5 h-5" /></button>
          <button onClick={() => setActiveModal('rules')} className="p-2 bg-white border border-[#E6E1DC] rounded-xl shadow-sm hover:border-[#9e1316] hover:text-[#9e1316] transition-colors"><HelpCircle className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 z-10 flex flex-col lg:flex-row gap-8 items-start justify-center mt-8">
        <div className="w-full lg:w-2/3 bg-white border border-[#E6E1DC] rounded-[32px] p-8 shadow-sm">
          <h2 className="text-xl font-black mb-6">{t.players} {players.length}/6</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {players.map(p => (
              <div key={p.id} className="bg-[#F5F5F0] p-4 rounded-2xl border border-[#E6E1DC] flex items-center gap-4">
                {p.isHost && <Crown className="w-4 h-4 text-[#9e1316] absolute top-2 right-2" />}
                <img src={p.avatarUrl} className="w-12 h-12 rounded-full border border-white shadow-sm object-cover" />
                <div className="font-bold text-[#1A1F26]">{p.name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-1/3 bg-white border border-[#E6E1DC] p-6 rounded-[32px] shadow-sm text-center space-y-6">
          <div className="text-xs font-bold text-gray-400 uppercase">{t.code}</div>
          <button onClick={() => { navigator.clipboard.writeText(roomMeta?.code || ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="text-4xl font-black text-[#1A1F26] hover:text-[#9e1316] transition-colors w-full">{roomMeta?.code}</button>
          {copied && <div className="text-xs text-emerald-600 font-bold">Copied!</div>}
          {me?.isHost ? (
            <button onClick={startGame} disabled={players.length < 2} className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase disabled:opacity-50">{t.startGame}</button>
          ) : <div className="text-xs font-bold text-gray-400 animate-pulse">{t.waiting}</div>}
        </div>
      </main>
    </div>
  );
}