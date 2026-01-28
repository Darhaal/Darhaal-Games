'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ArrowLeft, Coins, Clock, Crown, X, Shield, History, Copy, CheckCircle, Users, Play, LogOut } from 'lucide-react';
import { useCoupGame } from '@/hooks/useCoupGame';
import { ROLE_CONFIG, DICTIONARY } from '@/constants/coup';
import { Role, Lang } from '@/types/coup';

// --- Sub-components ---
const CardView = ({ role, revealed, isMe, onClick, selected, lang }: { role: Role, revealed: boolean, isMe: boolean, onClick?: () => void, selected?: boolean, lang: Lang }) => {
  if (!role || !ROLE_CONFIG[role]) return null;
  const config = ROLE_CONFIG[role];
  const info = DICTIONARY[lang].roles[role];

  return (
    <div
      onClick={onClick}
      className={`
        relative w-20 h-32 sm:w-28 sm:h-44 rounded-xl border-2 transition-all duration-300
        ${revealed ? 'bg-gray-200 grayscale opacity-60 border-gray-300' : 'bg-white border-[#E6E1DC] shadow-lg'}
        ${selected ? 'ring-4 ring-[#9e1316] -translate-y-2' : ''}
        ${!isMe && !revealed ? 'bg-[#1A1F26] border-white' : ''}
        cursor-pointer overflow-hidden group
      `}
    >
      {(isMe || revealed) ? (
        <div className="flex flex-col items-center justify-between h-full p-2 sm:p-3 text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1" style={{ backgroundColor: config.color + '20' }}>
            <config.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: config.color }} />
          </div>
          <div className="font-black text-[10px] sm:text-xs uppercase leading-tight" style={{ color: config.color }}>{info.name}</div>
          <div className="text-[8px] sm:text-[9px] leading-tight text-gray-500 hidden sm:block">{info.desc}</div>
          {revealed && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><X className="w-12 h-12 text-[#9e1316]" /></div>}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center relative bg-[#1A1F26]">
           <div className="absolute inset-2 border-2 border-white/10 rounded-lg"></div>
           <Shield className="text-white/20 w-8 h-8" />
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ label, onClick, disabled, color = 'bg-white', borderColor = 'border-gray-200' }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      p-2 sm:p-3 rounded-xl border-b-4 font-bold text-[10px] sm:text-xs uppercase transition-all active:translate-y-1 active:border-b-0
      ${disabled ? 'opacity-40 cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400' : `${color} ${borderColor} hover:brightness-95 text-[#1A1F26]`}
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
  const [copied, setCopied] = useState(false);
  const [lang, setLang] = useState<Lang>('ru');
  const [isLeaving, setIsLeaving] = useState(false); // Локальный стейт для UI загрузки при выходе

  // Достаем leaveGame из хука
  const { gameState, roomMeta, loading, performAction, startGame, leaveGame } = useCoupGame(lobbyId, userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang === 'en' || savedLang === 'ru') setLang(savedLang);
  }, []);

  const handleCopyCode = () => {
    if (roomMeta?.code) {
        navigator.clipboard.writeText(roomMeta.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  // Обработка выхода
  const handleLeave = async () => {
      if (isLeaving) return;

      // Блокируем кнопку
      setIsLeaving(true);

      try {
        // Вызываем функцию выхода из хука, которая чистит БД
        await leaveGame();
      } catch (e) {
        console.error("Leave failed", e);
      } finally {
        // В любом случае уходим на страницу поиска
        router.push('/play');
      }
  };

  // --- RENDERING ---

  if (loading || isLeaving) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316]" /></div>;
  if (!gameState) {
      // Если стейта нет, значит лобби удалено или ID неверен
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
              <div className="text-xl font-bold text-gray-400">Лобби не найдено или игра завершена</div>
              <button onClick={() => router.push('/play')} className="px-6 py-2 bg-[#1A1F26] text-white rounded-xl font-bold uppercase text-xs">Найти другую игру</button>
          </div>
      );
  }

  const players = gameState.players || [];
  const me = players.find(p => p.id === userId);
  const isMyTurn = players[gameState.turnIndex]?.id === userId;
  const t = DICTIONARY[lang].ui;
  const actionsT = DICTIONARY[lang].actions;

  // === 1. LOBBY VIEW (WAITING) ===
  if (gameState.status === 'waiting') {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

            <header className="w-full max-w-5xl mx-auto p-6 flex justify-between items-center z-10 relative">
                <button onClick={handleLeave} className="flex items-center gap-2 text-[#8A9099] hover:text-[#9e1316] transition-colors">
                    <div className="p-3 bg-white border border-[#E6E1DC] rounded-xl shadow-sm"><ArrowLeft className="w-5 h-5" /></div>
                    <span className="text-xs font-bold uppercase tracking-widest hidden sm:block">{t.leave}</span>
                </button>
                <div className="text-center">
                    <h1 className="text-3xl font-black text-[#1A1F26] tracking-tight">{roomMeta?.name || 'Lobby'}</h1>
                    <div className="text-xs font-bold text-[#9e1316] uppercase tracking-[0.2em]">Coup • {t.waiting}</div>
                </div>
                <div className="w-12"></div>
            </header>

            <main className="flex-1 w-full max-w-5xl mx-auto p-4 z-10 flex flex-col lg:flex-row gap-8 items-start justify-center mt-8">
                <div className="w-full lg:w-2/3 bg-white border border-[#E6E1DC] rounded-[32px] p-8 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black uppercase flex items-center gap-2">
                          {lang === 'ru' ? 'Игроки' : 'Players'} <span className="bg-[#F5F5F0] px-2 py-1 rounded-lg text-sm text-[#8A9099]">{players.length}/6</span>
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {players.map(p => (
                            <div key={p.id} className="bg-[#F5F5F0] p-4 rounded-2xl border border-[#E6E1DC] flex items-center gap-4 relative animate-in fade-in zoom-in duration-300">
                                {p.isHost && <div className="absolute top-2 right-2 text-[#9e1316]"><Crown className="w-4 h-4" /></div>}
                                <img src={p.avatarUrl} className="w-12 h-12 rounded-full border border-white shadow-sm object-cover" />
                                <div>
                                    <div className="font-bold text-[#1A1F26]">{p.name}</div>
                                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{lang === 'ru' ? 'В лобби' : 'In Lobby'}</div>
                                </div>
                            </div>
                        ))}
                        {Array.from({ length: 6 - players.length }).map((_, i) => (
                            <div key={`e-${i}`} className="border-2 border-dashed border-[#E6E1DC] rounded-2xl p-4 flex items-center gap-4 opacity-50">
                                <div className="w-12 h-12 bg-[#F5F5F0] rounded-full animate-pulse" />
                                <div className="text-xs font-bold text-[#8A9099] uppercase">{lang === 'ru' ? 'Пусто' : 'Empty'}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full lg:w-1/3 space-y-6">
                    <div className="bg-white border border-[#E6E1DC] p-6 rounded-[32px] shadow-sm">
                        <div className="text-xs font-bold text-[#8A9099] uppercase tracking-wider mb-2 text-center">{lang === 'ru' ? 'Код комнаты' : 'Room Code'}</div>
                        <button onClick={handleCopyCode} className="w-full bg-[#1A1F26] hover:bg-[#9e1316] transition-colors p-6 rounded-2xl group relative overflow-hidden">
                            <div className="text-4xl font-black text-white font-mono tracking-widest text-center relative z-10">{roomMeta?.code}</div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                {copied ? <CheckCircle className="text-white w-8 h-8" /> : <Copy className="text-white w-8 h-8" />}
                            </div>
                        </button>
                        <p className="text-[10px] text-center text-[#8A9099] font-bold mt-4">{lang === 'ru' ? 'Нажми, чтобы скопировать' : 'Click to copy'}</p>
                    </div>

                    {roomMeta?.isHost ? (
                        <button
                            onClick={startGame}
                            disabled={players.length < 2}
                            className="w-full py-6 bg-[#9e1316] hover:bg-[#7a0f11] text-white rounded-[24px] font-black uppercase tracking-widest text-lg shadow-xl shadow-[#9e1316]/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            <Play className="w-6 h-6 fill-current" /> {t.startGame}
                        </button>
                    ) : (
                        <div className="bg-[#F5F5F0] p-6 rounded-[24px] border border-[#E6E1DC] text-center">
                            <Loader2 className="w-8 h-8 text-[#9e1316] animate-spin mx-auto mb-3" />
                            <div className="font-bold text-[#1A1F26] uppercase">{lang === 'ru' ? 'Ожидание хоста...' : 'Waiting for host...'}</div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
  }

  // === 2. GAME VIEW (PLAYING) ===

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

      <header className="p-4 flex justify-between items-center z-10 bg-white/80 backdrop-blur border-b border-[#E6E1DC]">
        <button onClick={handleLeave} className="p-2 hover:bg-gray-100 rounded-full"><LogOut className="w-5 h-5 text-gray-500" /></button>
        <div className="text-center">
          <h1 className="font-black text-xl tracking-tight">COUP</h1>
          <div className="text-[10px] font-bold text-[#9e1316] uppercase tracking-widest">
            {gameState.status === 'playing' ? `${lang === 'ru' ? 'Ход' : 'Turn'}: ${players[gameState.turnIndex]?.name || '...'}` : (lang === 'ru' ? 'Конец' : 'End')}
          </div>
        </div>
        <div className="w-8" />
      </header>

      <main className="flex-1 relative z-10 p-4 flex flex-col max-w-5xl mx-auto w-full h-full">
        <div className="flex flex-wrap justify-center gap-4 mb-auto pt-4 pb-20">
          {players.map(player => {
            if (player.id === userId) return null;
            const isTargetable = !!targetMode && !player.isDead;
            const isCurrent = gameState.status === 'playing' && players[gameState.turnIndex]?.id === player.id;

            return (
              <div
                key={player.id}
                onClick={() => isTargetable && handleTargetSelect(player.id)}
                className={`
                  relative flex flex-col items-center p-3 bg-white border rounded-2xl transition-all duration-300
                  ${isCurrent ? 'ring-4 ring-[#9e1316] scale-105 shadow-xl z-20' : 'border-[#E6E1DC] opacity-90'}
                  ${isTargetable ? 'cursor-pointer animate-pulse ring-4 ring-blue-400 hover:scale-110 z-30' : ''}
                  ${player.isDead ? 'grayscale opacity-50' : ''}
                `}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm mb-2 relative">
                  <img src={player.avatarUrl} className="w-full h-full object-cover" />
                  {isCurrent && <div className="absolute inset-0 border-4 border-[#9e1316] rounded-full animate-pulse" />}
                </div>
                <div className="text-xs font-bold mb-1 max-w-[80px] truncate">{player.name}</div>
                <div className="flex gap-1 mb-2">
                  {(player.cards || []).map((c, i) => (
                    <div key={i} className={`w-3 h-5 rounded-sm border ${c.revealed ? 'bg-red-200 border-red-300' : 'bg-[#1A1F26] border-gray-600'}`} />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 rounded-full border border-yellow-100">
                  <Coins className="w-3 h-3" /> {player.coins}
                </div>
              </div>
            );
          })}
        </div>

        {gameState.status === 'playing' && (
           <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-[#E6E1DC] shadow-sm text-[10px] font-bold text-gray-500 flex items-center gap-2 z-0 max-w-[90%] truncate">
              <History className="w-3 h-3 shrink-0" />
              {gameState.logs?.[0] ? (
                 <span className="flex gap-1 truncate">
                   <span className="text-[#1A1F26]">{gameState.logs[0].user}</span>
                   <span>{gameState.logs[0].action}</span>
                 </span>
               ) : (lang === 'ru' ? 'Игра началась' : 'Game Started')}
           </div>
        )}

        {me && (
          <div className="fixed bottom-0 left-0 right-0 p-4 pb-8">
            <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur-md border border-[#E6E1DC] rounded-[32px] p-4 sm:p-6 shadow-2xl relative">
              {isMyTurn && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#9e1316] text-white px-4 py-1.5 rounded-full text-xs font-black uppercase flex items-center gap-2 shadow-lg animate-bounce z-20">
                  <Clock className="w-3 h-3" /> {t.yourTurn}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex justify-center gap-2 sm:gap-4 relative">
                  {(me.cards || []).map((card, i) => (
                    <CardView key={i} role={card.role} revealed={card.revealed} isMe={true} lang={lang} />
                  ))}
                  {me.isDead && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl z-10 font-black text-red-600 uppercase tracking-widest border-2 border-red-100">
                      Eliminated
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full max-w-md">
                  <div className="flex items-center gap-3 mb-4 justify-center sm:justify-start bg-[#F8FAFC] p-2 rounded-xl border border-[#E6E1DC] w-fit">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center"><Coins className="w-4 h-4 text-yellow-600" /></div>
                    <div className="text-2xl font-black text-[#1A1F26]">{me.coins}</div>
                  </div>

                  {!me.isDead && (
                    <>
                      {targetMode ? (
                        <div className="text-center p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                          <div className="text-sm font-bold mb-3 uppercase animate-pulse text-[#9e1316]">{t.targetSelect}: {targetMode}</div>
                          <button onClick={() => setTargetMode(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-full text-xs font-bold hover:bg-gray-100 shadow-sm">{t.cancel}</button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          <ActionButton label={actionsT.income} onClick={() => handleActionClick('income')} disabled={!isMyTurn} />
                          <ActionButton label={actionsT.aid} onClick={() => handleActionClick('aid')} disabled={!isMyTurn} />
                          <ActionButton label={actionsT.tax} onClick={() => handleActionClick('tax')} disabled={!isMyTurn} color="bg-purple-50" borderColor="border-purple-200" />
                          <ActionButton label={actionsT.steal} onClick={() => handleActionClick('steal')} disabled={!isMyTurn} color="bg-blue-50" borderColor="border-blue-200" />
                          <ActionButton label={actionsT.exchange} onClick={() => handleActionClick('exchange')} disabled={!isMyTurn} color="bg-green-50" borderColor="border-green-200" />
                          <ActionButton label={actionsT.assassinate} onClick={() => handleActionClick('assassinate')} disabled={!isMyTurn || me.coins < 3} color="bg-gray-800" borderColor="border-black" />
                          <button
                            onClick={() => handleActionClick('coup')}
                            disabled={!isMyTurn || me.coins < 7}
                            className={`
                               col-span-3 sm:col-span-2 p-3 bg-[#9e1316] text-white font-bold uppercase rounded-xl border-b-4 border-[#7a0f11] shadow-lg hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[1px] active:border-b-0 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0
                               ${me.coins >= 10 ? 'animate-pulse ring-2 ring-offset-2 ring-[#9e1316]' : ''}
                            `}
                          >
                            {actionsT.coup}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {gameState.winner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[32px] text-center animate-in zoom-in duration-300 border-4 border-[#9e1316] shadow-2xl max-w-sm w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            <div className="relative z-10">
                <Crown className="w-24 h-24 text-yellow-500 mx-auto mb-6 animate-bounce drop-shadow-md" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">{t.winner}</h2>
                <p className="text-3xl font-black text-[#1A1F26] mb-8">{gameState.winner}</p>
                <button
                    onClick={handleLeave} // Кнопка "Выйти" теперь чистит за собой
                    className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg"
                >
                    {t.leave}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}