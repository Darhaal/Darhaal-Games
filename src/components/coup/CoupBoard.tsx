'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2, ArrowLeft, Coins, Clock, Crown, X, Shield, History,
  Copy, CheckCircle, Users, Play, LogOut, Book, HelpCircle,
  Swords, Skull, RefreshCw, AlertTriangle, Ban
} from 'lucide-react';
import { useCoupGame } from '@/hooks/useCoupGame';
import { ROLE_CONFIG, DICTIONARY } from '@/constants/coup';
import { Role, Lang } from '@/types/coup';

// --- HELPERS FOR ROLE INFO ---
const ROLE_DETAILS: Record<Lang, Record<Role, { action: string; block: string }>> = {
  ru: {
    duke: { action: 'Налог (+3)', block: 'Помощь' },
    assassin: { action: 'Убийство (-3)', block: '-' },
    captain: { action: 'Кража (+2)', block: 'Кража' },
    ambassador: { action: 'Обмен', block: 'Кража' },
    contessa: { action: '-', block: 'Убийство' }
  },
  en: {
    duke: { action: 'Tax (+3)', block: 'Foreign Aid' },
    assassin: { action: 'Assassinate (-3)', block: '-' },
    captain: { action: 'Steal (+2)', block: 'Stealing' },
    ambassador: { action: 'Exchange', block: 'Stealing' },
    contessa: { action: '-', block: 'Assassination' }
  }
};

// --- TEXT CONTENT (RULES) ---
const RULES_CONTENT = {
  ru: (
    <div className="space-y-6 text-sm text-[#334155]">
      <section>
        <h3 className="font-black text-[#1A1F26] uppercase mb-2 flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-600" /> Цель игры</h3>
        <p className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-yellow-900 font-medium">
          Остаться последним игроком с хотя бы 1 влиянием.
        </p>
      </section>

      <section>
        <h3 className="font-black text-[#1A1F26] uppercase mb-2">💰 Базовые действия</h3>
        <ul className="space-y-2 text-xs font-medium">
          <li className="flex gap-2 items-start"><div className="w-1.5 h-1.5 mt-1.5 bg-emerald-500 rounded-full shrink-0"></div><div><strong>Income:</strong> +1 монета. Нельзя блокировать.</div></li>
          <li className="flex gap-2 items-start"><div className="w-1.5 h-1.5 mt-1.5 bg-emerald-500 rounded-full shrink-0"></div><div><strong>Foreign Aid:</strong> +2 монеты. Блокируется <span className="text-purple-700 font-bold">Герцогом</span>.</div></li>
          <li className="flex gap-2 items-start"><div className="w-1.5 h-1.5 mt-1.5 bg-red-500 rounded-full shrink-0"></div><div><strong>Coup:</strong> -7 монет. Выбери игрока → он теряет карту. Нельзя блокировать. (Обязательно при 10+ монетах).</div></li>
        </ul>
      </section>

      <section>
        <h3 className="font-black text-[#1A1F26] uppercase mb-2 text-red-600">❗ Блеф и Вызов</h3>
        <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-red-900 text-xs font-medium space-y-1">
          <p>Любое действие карты можно оспорить.</p>
          <ul className="list-disc pl-4">
            <li><strong>Игрок соврал:</strong> Он теряет 1 карту.</li>
            <li><strong>Игрок доказал:</strong> Оспоривший теряет 1 карту.</li>
          </ul>
        </div>
      </section>
    </div>
  ),
  en: (
    <div className="space-y-6 text-sm text-[#334155]">
      <section>
        <h3 className="font-black text-[#1A1F26] uppercase mb-2 flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-600" /> Objective</h3>
        <p className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-yellow-900 font-medium">
          To be the last player with at least 1 influence.
        </p>
      </section>
      <section>
        <h3 className="font-black text-[#1A1F26] uppercase mb-2">💰 Basic Actions</h3>
        <ul className="space-y-2 text-xs font-medium">
          <li><strong>Income:</strong> +1 coin. Cannot be blocked.</li>
          <li><strong>Foreign Aid:</strong> +2 coins. Blocked by <span className="text-purple-700 font-bold">Duke</span>.</li>
          <li><strong>Coup:</strong> -7 coins. Target loses a card. Unblockable. (Mandatory at 10+ coins).</li>
        </ul>
      </section>
    </div>
  )
};

// --- NEW COMPONENT: Beautiful Game Card ---
const GameCard = ({ role, revealed, isMe, onClick, selected, lang, small = false, disabled = false }: { role: Role, revealed: boolean, isMe: boolean, onClick?: () => void, selected?: boolean, lang: Lang, small?: boolean, disabled?: boolean }) => {
  if (!role || !ROLE_CONFIG[role]) return null;
  const config = ROLE_CONFIG[role];
  const info = DICTIONARY[lang].roles[role];
  const details = ROLE_DETAILS[lang][role];

  // Base dimensions
  const dims = small ? 'w-24 h-36' : 'w-28 h-44 sm:w-32 sm:h-48';

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`
        relative ${dims} perspective-1000 group transition-all duration-300
        ${selected ? '-translate-y-4 z-30' : 'hover:-translate-y-2 z-10'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className={`
        relative w-full h-full duration-500 preserve-3d transition-transform shadow-xl rounded-2xl
        ${(isMe || revealed) ? 'rotate-y-0' : ''}
      `}>

        {/* FACE SIDE (Role) */}
        <div className={`
          absolute inset-0 backface-hidden rounded-2xl border-[3px] overflow-hidden bg-white flex flex-col p-2.5
          ${revealed ? 'grayscale brightness-90' : ''}
        `}
        style={{ borderColor: config.color }}
        >
           {/* Background Pattern */}
           <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-black via-transparent to-transparent" />

           {/* Header */}
           <div className="w-full flex justify-between items-start z-10 mb-1">
              <span className="font-black text-[10px] uppercase tracking-wider" style={{ color: config.color }}>{info.name}</span>
              <config.icon className="w-4 h-4 opacity-50" style={{ color: config.color }} />
           </div>

           {/* Central Art (Icon) */}
           <div className="flex-1 flex flex-col items-center justify-center z-10 gap-2">
              <div className="p-3 rounded-full bg-white border-2 shadow-sm relative" style={{ borderColor: config.color }}>
                 <div className="absolute inset-0 rounded-full opacity-10" style={{ backgroundColor: config.color }} />
                 <config.icon className={`${small ? 'w-8 h-8' : 'w-10 h-10'}`} style={{ color: config.color }} />
              </div>
           </div>

           {/* Footer / Stats on Card */}
           <div className="z-10 w-full space-y-1 mt-auto">
             <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100">
               <div className="w-4 h-4 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                 <Swords className="w-2.5 h-2.5 text-emerald-700" />
               </div>
               <span className="text-[9px] font-bold text-gray-600 leading-none truncate">{details.action}</span>
             </div>
             {details.block !== '-' && (
               <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100">
                 <div className="w-4 h-4 rounded-md bg-red-100 flex items-center justify-center shrink-0">
                   <Shield className="w-2.5 h-2.5 text-red-700" />
                 </div>
                 <span className="text-[9px] font-bold text-gray-600 leading-none truncate">{details.block}</span>
               </div>
             )}
           </div>

           {/* Dead Overlay */}
           {revealed && (
             <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-50 backdrop-blur-[1px]">
               <Skull className="w-10 h-10 text-white drop-shadow-lg mb-1" />
               <span className="text-white font-black uppercase text-[10px] tracking-widest border-2 border-white px-2 py-0.5 rounded">Dead</span>
             </div>
           )}
        </div>

        {/* BACK SIDE (Cover) */}
        {!revealed && !isMe && (
          <div className="absolute inset-0 backface-hidden rounded-2xl bg-[#1A1F26] border-4 border-[#333] flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
             <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
             <div className="absolute inset-4 border border-[#E6E1DC]/20 rounded-xl" />
             <div className="w-16 h-16 rounded-full border-2 border-[#E6E1DC]/20 flex items-center justify-center bg-[#E6E1DC]/5 backdrop-blur-sm">
                <Crown className="w-8 h-8 text-[#E6E1DC] drop-shadow-md" />
             </div>
             <div className="mt-3 text-[9px] font-black text-[#E6E1DC] tracking-[0.3em] uppercase">COUP</div>
          </div>
        )}
      </div>

      {/* Selection Glow */}
      {selected && (
        <div className="absolute -inset-3 rounded-[20px] bg-[#9e1316]/20 blur-xl -z-10 animate-pulse pointer-events-none" />
      )}
    </div>
  );
};

// --- ACTION BUTTON ---
const ActionBtn = ({ label, onClick, disabled, color = 'bg-white', icon: Icon }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex flex-col items-center justify-center gap-1.5 p-2 sm:p-3 rounded-xl border-b-[3px] transition-all active:translate-y-0.5 active:border-b-0 h-full relative overflow-hidden
      ${disabled
        ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400'
        : `${color} hover:brightness-95 text-[#1A1F26] shadow-sm`
      }
    `}
  >
    {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />}
    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-none text-center">{label}</span>
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
  const [isLeaving, setIsLeaving] = useState(false);

  // Modals
  const [activeModal, setActiveModal] = useState<'rules' | 'guide' | null>(null);

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

  const handleLeave = async () => {
      if (isLeaving) return;
      setIsLeaving(true);
      try {
        await leaveGame();
      } catch (e) {
        console.error("Leave failed", e);
      } finally {
        router.push('/play');
      }
  };

  if (loading || isLeaving) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316]" /></div>;
  if (!gameState) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
              <div className="text-xl font-bold text-gray-400">Лобби не найдено</div>
              <button onClick={() => router.push('/play')} className="px-6 py-2 bg-[#1A1F26] text-white rounded-xl font-bold uppercase text-xs">Выйти</button>
          </div>
      );
  }

  const players = gameState.players || [];
  const me = players.find(p => p.id === userId);
  const isMyTurn = players[gameState.turnIndex]?.id === userId;
  const t = DICTIONARY[lang].ui;
  const actionsT = DICTIONARY[lang].actions;

  // --- MODALS RENDER ---
  const renderModals = () => {
    if (!activeModal) return null;
    const closeModal = () => setActiveModal(null);

    return (
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 border border-white/20">
          {/* Header */}
          <div className="p-6 border-b border-[#E6E1DC] flex justify-between items-center bg-white sticky top-0 z-10">
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-[#1A1F26]">
              {activeModal === 'rules' ? <HelpCircle className="w-8 h-8 text-[#9e1316]" /> : <Book className="w-8 h-8 text-[#9e1316]" />}
              {activeModal === 'rules' ? (lang === 'ru' ? 'Правила' : 'Rules') : (lang === 'ru' ? 'Справочник' : 'Guide')}
            </h2>
            <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6 text-[#8A9099]" /></button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#F8FAFC]">
            {activeModal === 'rules' ? RULES_CONTENT[lang] : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(['duke', 'assassin', 'captain', 'ambassador', 'contessa'] as Role[]).map(role => {
                  const info = ROLE_DETAILS[lang][role];
                  const config = ROLE_CONFIG[role];
                  return (
                    <div key={role} className="flex flex-col items-center bg-white rounded-3xl p-4 border border-[#E6E1DC] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: config.color }} />
                      <div className="scale-90 origin-top -mb-2">
                        <GameCard role={role} revealed={false} isMe={true} lang={lang} small={true} />
                      </div>
                      <div className="mt-4 w-full space-y-2">
                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                           <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                             <Swords className="w-3 h-3 text-emerald-700" />
                           </div>
                           <div className="flex-1">
                             <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Action</div>
                             <div className="text-[10px] font-bold text-[#1A1F26] leading-tight">{info.action}</div>
                           </div>
                        </div>
                        {info.block !== '-' && (
                          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                             <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                               <Ban className="w-3 h-3 text-red-700" />
                             </div>
                             <div className="flex-1">
                               <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Block</div>
                               <div className="text-[10px] font-bold text-[#1A1F26] leading-tight">{info.block}</div>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- LOBBY HEADER ---
  const renderHeader = (title: string, sub: string) => (
    <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
        <button onClick={handleLeave} className="flex items-center gap-2 text-[#8A9099] hover:text-[#9e1316] transition-colors group">
            <div className="p-2 bg-white border border-[#E6E1DC] rounded-xl shadow-sm group-hover:border-[#9e1316]/50 transition-all"><LogOut className="w-5 h-5" /></div>
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:block">{t.leave}</span>
        </button>

        <div className="text-center">
            <h1 className="text-2xl font-black text-[#1A1F26] tracking-tight">{title}</h1>
            <div className="text-[10px] font-bold text-[#9e1316] uppercase tracking-[0.2em]">{sub}</div>
        </div>

        <div className="flex gap-2">
            <button onClick={() => setActiveModal('guide')} className="p-2 bg-white border border-[#E6E1DC] rounded-xl shadow-sm hover:text-[#9e1316] hover:border-[#9e1316]/50 transition-all">
                <Book className="w-5 h-5" />
            </button>
            <button onClick={() => setActiveModal('rules')} className="p-2 bg-white border border-[#E6E1DC] rounded-xl shadow-sm hover:text-[#9e1316] hover:border-[#9e1316]/50 transition-all">
                <HelpCircle className="w-5 h-5" />
            </button>
        </div>
    </header>
  );

  // === 1. LOBBY VIEW ===
  if (gameState.status === 'waiting') {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>
            {renderModals()}
            {renderHeader(roomMeta?.name || 'Lobby', `Coup • ${t.waiting}`)}

            <main className="flex-1 w-full max-w-5xl mx-auto p-4 z-10 flex flex-col lg:flex-row gap-8 items-start justify-center mt-8">
                {/* Players List */}
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
                                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{lang === 'ru' ? 'В лобби' : 'Ready'}</div>
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

                {/* Right Panel */}
                <div className="w-full lg:w-1/3 space-y-6">
                    <div className="bg-white border border-[#E6E1DC] p-6 rounded-[32px] shadow-sm">
                        <div className="text-xs font-bold text-[#8A9099] uppercase tracking-wider mb-2 text-center">{lang === 'ru' ? 'Код' : 'Code'}</div>
                        <button onClick={handleCopyCode} className="w-full bg-[#1A1F26] hover:bg-[#9e1316] transition-colors p-6 rounded-2xl group relative overflow-hidden">
                            <div className="text-4xl font-black text-white font-mono tracking-widest text-center relative z-10">{roomMeta?.code}</div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                {copied ? <CheckCircle className="text-white w-8 h-8" /> : <Copy className="text-white w-8 h-8" />}
                            </div>
                        </button>
                    </div>

                    {me?.isHost ? (
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
                            <div className="font-bold text-[#1A1F26] uppercase">{lang === 'ru' ? 'Ожидание...' : 'Waiting...'}</div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
  }

  // === 2. GAME VIEW ===

  const handleAction = (action: string) => {
    if (['coup', 'steal', 'assassinate'].includes(action)) {
      setTargetMode(action as any);
    } else {
      performAction(action);
    }
  };

  const handleTarget = (targetId: string) => {
    if (targetMode) {
      performAction(targetMode, targetId);
      setTargetMode(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />
      {renderModals()}
      {renderHeader('COUP', gameState.status === 'playing' ? `${lang === 'ru' ? 'Ход' : 'Turn'}: ${players[gameState.turnIndex]?.name || '...'}` : 'End')}

      {/* Main Game Area with more bottom padding for the fixed control panel */}
      <main className="flex-1 relative z-10 p-4 pb-48 flex flex-col max-w-6xl mx-auto w-full h-full overflow-y-auto custom-scrollbar">

        {/* Opponents Grid */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {players.map(player => {
            if (player.id === userId) return null;
            const isTargetable = !!targetMode && !player.isDead;
            const isCurrent = gameState.status === 'playing' && players[gameState.turnIndex]?.id === player.id;

            return (
              <div
                key={player.id}
                onClick={() => isTargetable && handleTarget(player.id)}
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

        {/* Logs Overlay - Moved to top left to avoid obscuring center content */}
        {gameState.status === 'playing' && (
           <div className="absolute top-2 left-2 sm:left-auto sm:right-2 sm:top-2 bg-white/90 backdrop-blur px-4 py-2 rounded-full border border-[#E6E1DC] shadow-sm text-[10px] font-bold text-gray-500 flex items-center gap-2 z-0 max-w-[200px] truncate">
              <History className="w-3 h-3 shrink-0" />
              {gameState.logs?.[0] ? (
                 <span className="flex gap-1 truncate">
                   <span className="text-[#1A1F26]">{gameState.logs[0].user}</span>
                   <span>{gameState.logs[0].action}</span>
                 </span>
               ) : 'Game Started'}
           </div>
        )}

        {/* Player Zone (Fixed Bottom) */}
        {me && (
          <div className="fixed bottom-0 left-0 right-0 p-2 sm:p-4 z-50 pointer-events-none">
            <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-xl border border-[#E6E1DC] rounded-[32px] p-4 sm:p-6 shadow-2xl relative pointer-events-auto">
              {isMyTurn && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#9e1316] text-white px-4 py-1.5 rounded-full text-xs font-black uppercase flex items-center gap-2 shadow-lg animate-bounce z-20">
                  <Clock className="w-3 h-3" /> {t.yourTurn}
                </div>
              )}

              <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                {/* Hand */}
                <div className="flex justify-center gap-3 sm:gap-4 relative shrink-0">
                  {(me.cards || []).map((card, i) => (
                    <GameCard
                        key={i}
                        role={card.role}
                        revealed={card.revealed}
                        isMe={true}
                        lang={lang}
                        disabled={me.isDead}
                    />
                  ))}
                  {me.isDead && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl z-10 font-black text-red-600 uppercase tracking-widest border-2 border-red-100">
                      Eliminated
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex-1 w-full max-w-lg">
                  <div className="flex items-center gap-3 mb-4 justify-center md:justify-start bg-[#F8FAFC] p-2 px-4 rounded-xl border border-[#E6E1DC] w-fit mx-auto md:mx-0">
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
                          <ActionBtn label={actionsT.income} onClick={() => handleAction('income')} disabled={!isMyTurn} color="bg-gray-50 border-gray-200" />
                          <ActionBtn label={actionsT.aid} onClick={() => handleAction('aid')} disabled={!isMyTurn} color="bg-gray-50 border-gray-200" />
                          <ActionBtn label={actionsT.tax} onClick={() => handleAction('tax')} disabled={!isMyTurn} color="bg-purple-50 border-purple-200" icon={Crown} />

                          <ActionBtn label={actionsT.steal} onClick={() => handleAction('steal')} disabled={!isMyTurn} color="bg-blue-50 border-blue-200" icon={Swords} />
                          <ActionBtn label={actionsT.exchange} onClick={() => handleAction('exchange')} disabled={!isMyTurn} color="bg-green-50 border-green-200" icon={RefreshCw} />
                          <ActionBtn label={actionsT.assassinate} onClick={() => handleAction('assassinate')} disabled={!isMyTurn || me.coins < 3} color="bg-gray-800 border-black text-white" icon={Skull} />

                          <button
                            onClick={() => handleAction('coup')}
                            disabled={!isMyTurn || me.coins < 7}
                            className={`
                               col-span-3 sm:col-span-2 p-3 bg-[#9e1316] text-white font-bold uppercase rounded-xl border-b-4 border-[#7a0f11] shadow-lg hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[1px] active:border-b-0 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 flex items-center justify-center gap-2
                               ${me.coins >= 10 ? 'animate-pulse ring-2 ring-offset-2 ring-[#9e1316]' : ''}
                            `}
                          >
                            <AlertTriangle className="w-4 h-4" /> {actionsT.coup} (-7)
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

      {/* Winner Overlay */}
      {gameState.winner && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[32px] text-center animate-in zoom-in duration-300 border-4 border-[#9e1316] shadow-2xl max-w-sm w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            <div className="relative z-10">
                <Crown className="w-24 h-24 text-yellow-500 mx-auto mb-6 animate-bounce drop-shadow-md" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">{t.winner}</h2>
                <p className="text-3xl font-black text-[#1A1F26] mb-8">{gameState.winner}</p>
                <button
                    onClick={handleLeave}
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