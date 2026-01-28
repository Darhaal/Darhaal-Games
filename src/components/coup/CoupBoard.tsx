'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ArrowLeft, Coins, Clock, Crown, X } from 'lucide-react';
import { useCoupGame } from '@/hooks/useCoupGame';
import { ROLE_CONFIG, DICTIONARY } from '@/constants/coup';
import { Role } from '@/types/coup';

// --- Sub-components for UI ---

const CardView = ({ role, revealed, isMe, onClick, selected }: { role: Role, revealed: boolean, isMe: boolean, onClick?: () => void, selected?: boolean }) => {
  const config = ROLE_CONFIG[role];
  const info = DICTIONARY.ru.roles[role]; // Hardcoded RU for consistency, can be dynamic

  return (
    <div
      onClick={onClick}
      className={`
        relative w-24 h-36 sm:w-28 sm:h-44 rounded-xl border-2 transition-all duration-300
        ${revealed ? 'bg-gray-200 grayscale opacity-60 border-gray-300' : 'bg-white border-[#E6E1DC] shadow-lg'}
        ${selected ? 'ring-4 ring-[#9e1316] -translate-y-2' : ''}
        ${!isMe && !revealed ? 'bg-[#1A1F26] border-white' : ''}
        cursor-pointer overflow-hidden
      `}
    >
      {(isMe || revealed) ? (
        <div className="flex flex-col items-center justify-between h-full p-3 text-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: config.color + '20' }}>
            <config.icon className="w-6 h-6" style={{ color: config.color }} />
          </div>
          <div className="font-black text-xs uppercase" style={{ color: config.color }}>{info.name}</div>
          <div className="text-[9px] leading-tight text-gray-500">{info.desc}</div>
          {revealed && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><X className="w-16 h-16 text-[#9e1316]" /></div>}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center relative">
           <div className="absolute inset-2 border-2 border-white/20 rounded-lg"></div>
           <Crown className="text-[#9e1316]/20 w-10 h-10" />
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ label, onClick, disabled, color = 'bg-white' }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      p-3 rounded-xl border-b-4 font-bold text-[10px] sm:text-xs uppercase transition-all active:translate-y-1 active:border-b-0
      ${disabled ? 'opacity-30 cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400' : `${color} border-gray-200 hover:brightness-95`}
    `}
  >
    {label}
  </button>
);

// --- MAIN BOARD ---

export default function CoupBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [targetMode, setTargetMode] = useState<'coup' | 'steal' | 'assassinate' | null>(null);

  const { gameState, loading, performAction, startGame } = useCoupGame(lobbyId, userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  if (loading || !gameState) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316]" /></div>;

  const me = gameState.players.find(p => p.id === userId);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === userId;
  const t = DICTIONARY.ru.ui;
  const actionsT = DICTIONARY.ru.actions;

  const handleActionClick = (action: string) => {
    if (['coup', 'steal', 'assassinate'].includes(action)) {
      setTargetMode(action as any);
    } else {
      performAction(action);
    }
  };

  const handleTargetSelect = (targetId: string) => {
    if (targetMode) {
      performAction(targetMode, targetId);
      setTargetMode(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

      {/* HEADER */}
      <header className="p-4 flex justify-between items-center z-10 bg-white/80 backdrop-blur border-b border-[#E6E1DC]">
        <button onClick={() => router.push('/play')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <h1 className="font-black text-xl tracking-tight">COUP</h1>
          <div className="text-[10px] font-bold text-[#9e1316] uppercase tracking-widest">
            {gameState.status === 'playing' ? `Ход: ${gameState.players[gameState.turnIndex].name}` : 'Лобби'}
          </div>
        </div>
        <div className="w-8" />
      </header>

      <main className="flex-1 relative z-10 p-4 flex flex-col max-w-5xl mx-auto w-full">

        {/* ОППОНЕНТЫ */}
        <div className="flex flex-wrap justify-center gap-4 mb-auto pt-4">
          {gameState.players.map(player => {
            if (player.id === userId) return null;
            const isTargetable = !!targetMode && !player.isDead;
            const isCurrent = gameState.players[gameState.turnIndex].id === player.id;

            return (
              <div
                key={player.id}
                onClick={() => isTargetable && handleTargetSelect(player.id)}
                className={`
                  relative flex flex-col items-center p-3 bg-white border rounded-2xl transition-all
                  ${isCurrent ? 'ring-2 ring-[#9e1316] scale-105 shadow-xl' : 'border-[#E6E1DC] opacity-80'}
                  ${isTargetable ? 'cursor-pointer animate-pulse ring-4 ring-blue-400 hover:scale-110' : ''}
                  ${player.isDead ? 'grayscale opacity-50' : ''}
                `}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm mb-2">
                  <img src={player.avatarUrl} className="w-full h-full object-cover" />
                </div>
                <div className="text-xs font-bold mb-1">{player.name}</div>
                <div className="flex gap-1 mb-2">
                  {player.cards.map((c, i) => (
                    <div key={i} className={`w-4 h-6 rounded ${c.revealed ? 'bg-red-200' : 'bg-[#1A1F26]'}`} />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 rounded-full border border-yellow-100">
                  <Coins className="w-3 h-3" /> {player.coins}
                </div>
              </div>
            );
          })}
        </div>

        {/* СТАТУС ИГРЫ */}
        <div className="my-4 text-center">
          {gameState.status === 'waiting' ? (
            <div className="bg-white p-6 rounded-2xl border border-[#E6E1DC] shadow-sm max-w-md mx-auto">
              <h2 className="text-xl font-black mb-4">Ожидание игроков ({gameState.players.length}/6)</h2>
              {me?.isHost ? (
                <button onClick={startGame} disabled={gameState.players.length < 2} className="w-full py-3 bg-[#1A1F26] text-white font-bold rounded-xl uppercase tracking-widest hover:bg-[#9e1316] transition-colors disabled:opacity-50">
                  {t.startGame}
                </button>
              ) : (
                <div className="text-sm text-gray-400 animate-pulse">Ожидаем хоста...</div>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-[#E6E1DC] shadow-sm text-xs font-bold text-gray-500">
               {gameState.logs[0] ? (
                 <>
                   <span className="text-[#1A1F26]">{gameState.logs[0].user}</span>
                   <span> {gameState.logs[0].action}</span>
                 </>
               ) : 'Игра началась'}
            </div>
          )}
        </div>

        {/* МОЯ ЗОНА */}
        {me && (
          <div className="bg-white/90 backdrop-blur-md border border-[#E6E1DC] rounded-3xl p-4 sm:p-6 shadow-2xl relative mt-4">
            {isMyTurn && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#9e1316] text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 shadow-lg animate-bounce"><Clock className="w-3 h-3" /> {t.yourTurn}</div>}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Карты */}
              <div className="flex justify-center gap-4">
                {me.cards.map((card, i) => (
                  <CardView key={i} role={card.role} revealed={card.revealed} isMe={true} />
                ))}
              </div>

              {/* Панель управления */}
              <div className="flex-1 w-full max-w-md">
                <div className="flex items-center gap-2 mb-4 justify-center sm:justify-start">
                  <div className="text-2xl font-black text-[#1A1F26]">{me.coins}</div>
                  <Coins className="w-6 h-6 text-yellow-500" />
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Монеты</div>
                </div>

                {!me.isDead && (
                  <>
                    {targetMode ? (
                      <div className="text-center p-4">
                        <div className="text-sm font-bold mb-2 uppercase animate-pulse text-[#9e1316]">{t.targetSelect} ({targetMode})</div>
                        <button onClick={() => setTargetMode(null)} className="px-6 py-2 bg-gray-100 rounded-full text-xs font-bold hover:bg-gray-200">{t.cancel}</button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <ActionButton label={actionsT.income} onClick={() => handleActionClick('income')} disabled={!isMyTurn} />
                        <ActionButton label={actionsT.aid} onClick={() => handleActionClick('aid')} disabled={!isMyTurn} />
                        <ActionButton label={actionsT.tax} onClick={() => handleActionClick('tax')} disabled={!isMyTurn} color="text-purple-700 bg-purple-50 border-purple-100" />
                        <ActionButton label={actionsT.steal} onClick={() => handleActionClick('steal')} disabled={!isMyTurn} color="text-blue-700 bg-blue-50 border-blue-100" />
                        <ActionButton label={actionsT.assassinate} onClick={() => handleActionClick('assassinate')} disabled={!isMyTurn || me.coins < 3} color="text-gray-700 bg-gray-100 border-gray-200" />
                        <ActionButton label={actionsT.exchange} onClick={() => handleActionClick('exchange')} disabled={!isMyTurn} color="text-green-700 bg-green-50 border-green-100" />
                        <button
                          onClick={() => handleActionClick('coup')}
                          disabled={!isMyTurn || me.coins < 7}
                          className="col-span-3 p-3 bg-[#9e1316] text-white font-bold uppercase rounded-xl shadow-lg hover:shadow-xl hover:bg-[#7a0f11] transition-all disabled:opacity-50 disabled:shadow-none"
                        >
                          {actionsT.coup}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {me.isDead && <div className="text-center font-black text-red-500 uppercase p-4 bg-red-50 rounded-xl border border-red-100">Вы выбыли из игры</div>}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ЭКРАН ПОБЕДЫ */}
      {gameState.winner && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-3xl text-center animate-in zoom-in border-4 border-[#9e1316]">
            <Crown className="w-20 h-20 text-yellow-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-3xl font-black uppercase mb-2">{t.winner}</h2>
            <p className="text-xl font-bold text-[#9e1316] mb-8">{gameState.winner}</p>
            <button onClick={() => router.push('/play')} className="px-8 py-3 bg-[#1A1F26] text-white rounded-xl font-bold uppercase hover:bg-[#9e1316] transition-colors">{t.leave}</button>
          </div>
        </div>
      )}
    </div>
  );
}