'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2, Coins, Crown, X, Shield, History,
  LogOut, Book, HelpCircle,
  Swords, Skull, RefreshCw, AlertTriangle, ThumbsUp, AlertOctagon
} from 'lucide-react';
import { useCoupGame } from '@/hooks/useCoupGame';
import { ROLE_CONFIG, DICTIONARY } from '@/constants/coup';
import { Role, Lang } from '@/types/coup';

// --- GAME CARD COMPONENT (3D Flip Style) ---
interface GameCardProps {
  role: Role;
  revealed: boolean;
  isMe: boolean;
  onClick?: () => void;
  selected?: boolean;
  lang: Lang;
  small?: boolean;
  disabled?: boolean;
  isLosing?: boolean;
}

const GameCard = ({ role, revealed, isMe, onClick, selected, lang, small = false, disabled = false, isLosing = false }: GameCardProps) => {
  if (!role || !ROLE_CONFIG[role] || !DICTIONARY[lang]?.roles[role]) return null;
  const config = ROLE_CONFIG[role];
  const info = DICTIONARY[lang].roles[role];

  const dims = small ? 'w-20 h-28' : 'w-24 h-36 sm:w-28 sm:h-44';

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`
        relative ${dims} perspective-1000 group transition-all duration-300 flex-shrink-0
        ${selected ? '-translate-y-4 z-30 scale-105' : 'hover:-translate-y-2 z-10'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        ${isLosing ? 'ring-4 ring-red-500 rounded-2xl animate-pulse' : ''}
      `}
    >
      <div className={`relative w-full h-full duration-500 preserve-3d transition-transform shadow-xl rounded-2xl ${(isMe || revealed) ? 'rotate-y-0' : ''}`}>

        {/* FACE */}
        <div className={`absolute inset-0 backface-hidden rounded-2xl border-[3px] overflow-hidden bg-white flex flex-col p-2 ${revealed ? 'grayscale brightness-90' : ''}`} style={{ borderColor: config.color }}>
           <div className="absolute inset-0 opacity-5 pointer-events-none bg-black" />

           <div className="w-full flex justify-between items-start z-10 mb-1">
              <span className="font-black text-[9px] sm:text-[10px] uppercase tracking-wider truncate" style={{ color: config.color }}>{info.name}</span>
              <config.icon className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" style={{ color: config.color }} />
           </div>

           <div className="flex-1 flex flex-col items-center justify-center z-10">
              <div className="p-2 sm:p-3 rounded-full bg-white border-2 shadow-sm relative" style={{ borderColor: config.color }}>
                 <div className="absolute inset-0 rounded-full opacity-10" style={{ backgroundColor: config.color }} />
                 <config.icon className={`${small ? 'w-6 h-6' : 'w-8 h-8 sm:w-10 sm:h-10'}`} style={{ color: config.color }} />
              </div>
           </div>

           {/* Stats */}
           {!small && (
             <div className="z-10 w-full space-y-1 mt-auto">
               <div className="flex items-center gap-1 bg-gray-50 rounded p-1 border border-gray-100">
                 <Swords className="w-2 h-2 text-emerald-600" /><span className="text-[8px] font-bold text-gray-600 truncate">{info.action}</span>
               </div>
               {info.block !== '-' && (
                 <div className="flex items-center gap-1 bg-gray-50 rounded p-1 border border-gray-100">
                   <Shield className="w-2 h-2 text-red-600" /><span className="text-[8px] font-bold text-gray-600 truncate">{info.block}</span>
                 </div>
               )}
             </div>
           )}

           {revealed && (
             <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50 backdrop-blur-[1px]">
               <Skull className="w-8 h-8 text-white drop-shadow-lg mb-1" />
             </div>
           )}
        </div>

        {/* BACK */}
        {!revealed && !isMe && (
          <div className="absolute inset-0 backface-hidden rounded-2xl bg-[#1A1F26] border-4 border-[#333] flex flex-col items-center justify-center shadow-inner">
             <div className="absolute inset-4 border border-[#E6E1DC]/20 rounded-xl" />
             <div className="w-12 h-12 rounded-full border-2 border-[#E6E1DC]/20 flex items-center justify-center bg-[#E6E1DC]/5">
                <Crown className="w-6 h-6 text-[#E6E1DC]" />
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- ACTION BUTTON ---
const ActionBtn = ({ label, onClick, disabled, color = 'bg-white', icon: Icon }: any) => (
  <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-b-[3px] transition-all active:translate-y-0.5 active:border-b-0 h-full relative overflow-hidden w-full ${disabled ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' : `${color} hover:brightness-95 text-[#1A1F26] shadow-sm`}`}>
    {Icon && <Icon className="w-4 h-4 mb-0.5" />}
    <span className="text-[9px] font-black uppercase leading-none text-center">{label}</span>
  </button>
);

// --- MODALS (Original Style) ---
const RulesModal = ({ onClose, lang }: { onClose: () => void, lang: Lang }) => {
  const content = DICTIONARY[lang].rules;
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-[32px] w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-black uppercase flex items-center gap-2"><HelpCircle className="w-6 h-6 text-[#9e1316]" /> {content.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-sm text-gray-600">
           <section>
             <h3 className="font-bold text-[#1A1F26] mb-1">{content.objective.title}</h3>
             <p className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-yellow-800">{content.objective.text}</p>
           </section>
           <section>
              <h3 className="font-bold text-[#1A1F26] mb-1">{content.general?.title}</h3>
              <p className="mb-2">{content.general?.text}</p>
           </section>
           <section>
             <h3 className="font-bold text-[#1A1F26] mb-2">{DICTIONARY[lang].ui.code} Actions</h3>
             <ul className="space-y-2">
               {content.actions.map((act, i) => (
                 <li key={i} className="flex gap-2 text-xs bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-[#1A1F26] shrink-0" />
                    <span><strong>{act.name}:</strong> {act.effect}</span>
                 </li>
               ))}
             </ul>
           </section>
           <section>
             <h3 className="font-bold text-[#1A1F26] mb-1">{content.challenge.title}</h3>
             <p className="bg-red-50 p-3 rounded-xl border border-red-100 text-red-800 text-xs">{content.challenge.text}</p>
           </section>
        </div>
      </div>
    </div>
  );
};

const GuideModal = ({ onClose, lang }: { onClose: () => void, lang: Lang }) => {
  const roles: Role[] = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-black uppercase flex items-center gap-2"><Book className="w-6 h-6 text-[#9e1316]" /> {lang === 'ru' ? 'Справочник' : 'Guide'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roles.map(role => {
              const info = DICTIONARY[lang].roles[role];
              const config = ROLE_CONFIG[role];
              return (
                <div key={role} className="bg-white p-4 rounded-2xl border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow">
                   <div className="shrink-0"><GameCard role={role} revealed={false} isMe={true} lang={lang} small={true} /></div>
                   <div className="flex-1 min-w-0">
                      <div className="font-black text-sm uppercase truncate" style={{ color: config.color }}>{info.name}</div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-1 mb-2 line-clamp-3">{info.desc}</p>
                      <div className="flex flex-wrap gap-1">
                         <span className="text-[9px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200 truncate max-w-full">{info.action}</span>
                         {info.block !== '-' && <span className="text-[9px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 truncate max-w-full">Block: {info.block}</span>}
                      </div>
                   </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- LOGS COMPONENT ---
const LogPanel = ({ logs, lang }: { logs: any[], lang: Lang }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="md:hidden fixed top-20 left-4 z-40 bg-white p-2 rounded-full shadow-lg border border-[#E6E1DC]">
        <History className="w-5 h-5 text-[#8A9099]" />
      </button>

      <div className={`fixed md:absolute top-24 left-4 z-30 w-72 max-h-64 bg-white/95 backdrop-blur-md rounded-2xl border border-[#E6E1DC] shadow-xl flex flex-col overflow-hidden transition-all duration-300 transform ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 md:translate-x-0 md:opacity-100'}`}>
         <div className="px-4 py-3 border-b border-[#E6E1DC] bg-gray-50/50 flex justify-between items-center">
           <div className="text-[10px] font-black uppercase text-[#8A9099] flex items-center gap-2 tracking-wider"><History className="w-3 h-3" /> {DICTIONARY[lang].ui.logs}</div>
           <button onClick={() => setIsOpen(false)} className="md:hidden"><X className="w-4 h-4 text-gray-400" /></button>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {logs.length === 0 && <div className="h-20 flex items-center justify-center text-xs text-gray-400 font-medium italic">{lang === 'ru' ? 'Игра началась' : 'Game Started'}</div>}
            {logs.map((log, i) => (
              <div key={i} className="text-xs px-3 py-2 rounded-xl hover:bg-gray-50 flex flex-col gap-1 border border-transparent hover:border-gray-100 transition-colors">
                 <div className="flex justify-between items-center">
                   <span className="font-bold text-[#1A1F26] truncate max-w-[120px]">{log.user}</span>
                   <span className="text-[9px] text-gray-400">{log.time}</span>
                 </div>
                 <span className="text-gray-600 leading-snug">{log.action}</span>
              </div>
            ))}
         </div>
      </div>
    </>
  );
};

// --- MAIN ---
export default function CoupBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [targetMode, setTargetMode] = useState<'coup' | 'steal' | 'assassinate' | null>(null);
  const [lang, setLang] = useState<Lang>('ru');
  const [isLeaving, setIsLeaving] = useState(false);
  const [activeModal, setActiveModal] = useState<'rules' | 'guide' | null>(null);
  const [copied, setCopied] = useState(false);

  // Exchange state
  const [selectedExchangeCards, setSelectedExchangeCards] = useState<Role[]>([]);

  const { gameState, roomMeta, loading, performAction, startGame, leaveGame, pass, challenge, block, resolveLoss, resolveExchange } = useCoupGame(lobbyId, userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang === 'en' || savedLang === 'ru') setLang(savedLang);
  }, []);

  const handleCopyCode = () => {
    if (roomMeta?.code) { navigator.clipboard.writeText(roomMeta.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const handleLeave = async () => {
      if (isLeaving) return;
      setIsLeaving(true);
      await leaveGame();
      router.push('/play');
  };

  const handleAction = (action: string) => {
    if (['coup', 'steal', 'assassinate'].includes(action)) setTargetMode(action as any);
    else performAction(action);
  };

  const handleTarget = (targetId: string) => {
    if (targetMode) { performAction(targetMode, targetId); setTargetMode(null); }
  };

  const handleExchangeToggle = (role: Role) => {
      if (selectedExchangeCards.includes(role)) {
          setSelectedExchangeCards(prev => {
              const idx = prev.indexOf(role);
              const newArr = [...prev];
              newArr.splice(idx, 1);
              return newArr;
          });
      } else {
          // Allow selection up to number of lives
          const lives = gameState?.players.find(p => p.id === userId)?.cards.filter(c => !c.revealed).length || 2;
          if (selectedExchangeCards.length < lives) {
              setSelectedExchangeCards(prev => [...prev, role]);
          }
      }
  };

  if (loading || isLeaving) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316]" /></div>;
  if (!gameState) return <div className="min-h-screen flex items-center justify-center">Lobby not found</div>;

  const players = gameState.players || [];
  const me = players.find(p => p.id === userId);
  const isMyTurn = players[gameState.turnIndex]?.id === userId;
  const t = DICTIONARY[lang].ui;
  const actionsT = DICTIONARY[lang].actions;

  // LOBBY
  if (gameState.status === 'waiting') {
      return (
          <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />
              {activeModal === 'rules' && <RulesModal onClose={()=>setActiveModal(null)} lang={lang} />}
              {activeModal === 'guide' && <GuideModal onClose={()=>setActiveModal(null)} lang={lang} />}

              <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
                  <button onClick={handleLeave} className="flex items-center gap-2 text-gray-400 hover:text-[#9e1316] transition-colors"><LogOut className="w-5 h-5"/><span className="text-xs font-bold uppercase hidden sm:block">{t.leave}</span></button>
                  <div className="text-center"><h1 className="text-2xl font-black text-[#1A1F26]">{roomMeta?.name}</h1><div className="text-[10px] font-bold text-[#9e1316] uppercase">{t.waiting}</div></div>
                  <div className="flex gap-2">
                      <button onClick={()=>setActiveModal('guide')} className="p-2 bg-white border border-[#E6E1DC] rounded-xl shadow-sm hover:border-[#9e1316] hover:text-[#9e1316] transition-colors"><Book className="w-5 h-5"/></button>
                      <button onClick={()=>setActiveModal('rules')} className="p-2 bg-white border border-[#E6E1DC] rounded-xl shadow-sm hover:border-[#9e1316] hover:text-[#9e1316] transition-colors"><HelpCircle className="w-5 h-5"/></button>
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
                      <button onClick={() => {navigator.clipboard.writeText(roomMeta?.code || ''); setCopied(true); setTimeout(()=>setCopied(false),2000)}} className="text-4xl font-black text-[#1A1F26] hover:text-[#9e1316] transition-colors w-full">{roomMeta?.code}</button>
                      {copied && <div className="text-xs text-emerald-600 font-bold">Copied!</div>}
                      {me?.isHost ? (
                          <button onClick={startGame} disabled={players.length < 2} className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase disabled:opacity-50">{t.startGame}</button>
                      ) : <div className="text-xs font-bold text-gray-400 animate-pulse">{t.waiting}</div>}
                  </div>
              </main>
          </div>
      );
  }

  // GAME
  const phase = gameState.phase;
  const isActor = gameState.currentAction?.player === userId;
  const canBlock = (gameState.currentAction?.target === userId) || (gameState.currentAction?.type === 'foreign_aid');
  const isLosing = phase === 'losing_influence' && gameState.pendingPlayerId === userId;
  const isExchanging = phase === 'resolving_exchange' && gameState.pendingPlayerId === userId;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />
      {activeModal === 'rules' && <RulesModal onClose={()=>setActiveModal(null)} lang={lang} />}
      {activeModal === 'guide' && <GuideModal onClose={()=>setActiveModal(null)} lang={lang} />}

      <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
          <button onClick={handleLeave}><LogOut className="w-5 h-5 text-gray-500" /></button>
          <div className="text-center">
             <h1 className="font-black text-xl">COUP</h1>
             <div className="text-[10px] font-bold text-[#9e1316] uppercase">{isLosing ? 'LOSE INFLUENCE!' : (gameState.status === 'playing' ? `Turn: ${players[gameState.turnIndex]?.name}` : 'End')}</div>
          </div>
          <div className="flex gap-2">
              <button onClick={()=>setActiveModal('guide')} className="p-2 bg-white border rounded-xl shadow-sm"><Book className="w-5 h-5"/></button>
              <button onClick={()=>setActiveModal('rules')} className="p-2 bg-white border rounded-xl shadow-sm"><HelpCircle className="w-5 h-5"/></button>
          </div>
      </header>

      <LogPanel logs={gameState.logs} lang={lang} />

      <main className="flex-1 relative z-10 p-4 pb-60 flex flex-col max-w-6xl mx-auto w-full h-full overflow-y-auto custom-scrollbar">
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {players.map(p => {
            if (p.id === userId) return null;
            const isCurr = gameState.turnIndex === players.findIndex(pl => pl.id === p.id);
            return (
              <div key={p.id} onClick={() => targetMode && handleTarget(p.id)} className={`relative flex flex-col items-center p-3 bg-white border rounded-2xl transition-all ${isCurr ? 'ring-4 ring-[#9e1316] scale-105 z-20' : 'opacity-90'} ${targetMode ? 'cursor-pointer animate-pulse ring-4 ring-blue-400' : ''} ${p.isDead ? 'grayscale opacity-50' : ''}`}>
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm mb-2"><img src={p.avatarUrl} className="w-full h-full object-cover" /></div>
                <div className="text-xs font-bold mb-1 truncate max-w-[80px]">{p.name}</div>
                <div className="flex gap-1 mb-2">{p.cards.map((c, i) => <div key={i} className={`w-3 h-5 rounded-sm border ${c.revealed ? 'bg-red-200' : 'bg-[#1A1F26]'}`} />)}</div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 rounded-full"><Coins className="w-3 h-3" /> {p.coins}</div>
              </div>
            );
          })}
        </div>

        {/* Reaction Bar */}
        {!isMyTurn && phase !== 'choosing_action' && phase !== 'losing_influence' && phase !== 'resolving_exchange' && !me?.isDead && (
            <div className="fixed bottom-60 sm:bottom-64 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-xl border border-[#9e1316] p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 pointer-events-auto animate-in slide-in-from-bottom-10 fade-in">
                    <div className="text-xs font-bold uppercase text-[#1A1F26] text-center">{gameState.currentAction?.player === userId ? t.waitingForResponse : `${gameState.currentAction?.type.toUpperCase()}!`}</div>
                    <div className="flex gap-2">
                        {!isActor && (phase.includes('challenges')) && <button onClick={challenge} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-red-200 flex gap-2"><AlertOctagon className="w-4 h-4"/> {t.challenge}</button>}
                        {canBlock && phase === 'waiting_for_blocks' && <button onClick={block} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-purple-200 flex gap-2"><Shield className="w-4 h-4"/> {t.block}</button>}
                        {!isActor && <button onClick={pass} className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-200 flex gap-2"><ThumbsUp className="w-4 h-4"/> {t.pass}</button>}
                    </div>
                </div>
            </div>
        )}

        {me && (
          <div className="fixed bottom-0 left-0 right-0 p-2 sm:p-4 z-50">
            <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-xl border border-[#E6E1DC] rounded-[32px] p-4 sm:p-6 shadow-2xl relative">
              {isMyTurn && !isLosing && !isExchanging && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#9e1316] text-white px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-lg animate-bounce z-20">{t.yourTurn}</div>}
              {isLosing && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase shadow-lg animate-pulse z-30">{t.loseInfluence}</div>}
              {isExchanging && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase shadow-lg z-30">{t.exchange}</div>}

              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex justify-center gap-3 sm:gap-4 relative shrink-0">
                  {me.cards.map((card, i) => <GameCard key={i} role={card.role} revealed={card.revealed} isMe={true} lang={lang} disabled={me.isDead} isLosing={isLosing && !card.revealed} onClick={() => resolveLoss(i)} />)}
                </div>

                <div className="flex-1 w-full max-w-lg">
                  <div className="flex items-center gap-3 mb-4 justify-center md:justify-start bg-[#F8FAFC] p-2 px-4 rounded-xl border border-[#E6E1DC] w-fit mx-auto md:mx-0"><Coins className="w-4 h-4 text-yellow-600" /><div className="text-2xl font-black text-[#1A1F26]">{me.coins}</div></div>

                  {!me.isDead && isMyTurn && phase === 'choosing_action' && (
                    <>
                      {targetMode ? (
                        <div className="text-center p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                          <div className="text-sm font-bold mb-3 uppercase animate-pulse text-[#9e1316]">{t.targetSelect}: {targetMode}</div>
                          <button onClick={() => setTargetMode(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-full text-xs font-bold hover:bg-gray-100 shadow-sm">{t.cancel}</button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          <ActionBtn label={actionsT.income} onClick={() => handleAction('income')} color="bg-gray-50 border-gray-200" />
                          <ActionBtn label={actionsT.aid} onClick={() => handleAction('foreign_aid')} color="bg-gray-50 border-gray-200" />
                          <ActionBtn label={actionsT.tax} onClick={() => handleAction('tax')} color="bg-purple-50 border-purple-200" icon={Crown} />
                          <ActionBtn label={actionsT.steal} onClick={() => handleAction('steal')} color="bg-blue-50 border-blue-200" icon={Swords} />
                          <ActionBtn label={actionsT.exchange} onClick={() => handleAction('exchange')} color="bg-green-50 border-green-200" icon={RefreshCw} />
                          <ActionBtn label={actionsT.assassinate} onClick={() => handleAction('assassinate')} disabled={me.coins < 3} color="bg-gray-800 border-black text-white" icon={Skull} />
                          <button onClick={() => handleAction('coup')} disabled={me.coins < 7} className="col-span-3 sm:col-span-2 p-3 bg-[#9e1316] text-white font-bold uppercase rounded-xl border-b-4 border-[#7a0f11] shadow-lg hover:shadow-xl active:translate-y-[1px] active:border-b-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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

        {/* EXCHANGE MODAL */}
        {isExchanging && gameState.exchangeBuffer && (
             <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                 <div className="bg-white rounded-[32px] p-6 w-full max-w-2xl flex flex-col items-center shadow-2xl animate-in zoom-in-95 border-4 border-[#059669]">
                     <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2 text-[#059669]"><RefreshCw className="w-6 h-6"/> {t.exchange}</h2>
                     <div className="flex flex-wrap justify-center gap-4 mb-8">
                         {gameState.exchangeBuffer.map((role, i) => (
                             <div key={i} className={`relative transition-all duration-300 ${selectedExchangeCards.includes(role) ? 'ring-4 ring-[#059669] rounded-2xl transform scale-105 z-10 shadow-xl' : 'opacity-80 hover:opacity-100'}`}>
                                <GameCard
                                   role={role}
                                   revealed={false}
                                   isMe={true}
                                   lang={lang}
                                   onClick={() => handleExchangeToggle(role)}
                                />
                                {selectedExchangeCards.includes(role) && (
                                    <div className="absolute -top-2 -right-2 bg-[#059669] text-white rounded-full p-1 shadow-lg">
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                )}
                             </div>
                         ))}
                     </div>
                     <button
                        onClick={() => resolveExchange(selectedExchangeCards)}
                        disabled={selectedExchangeCards.length !== (me?.cards.filter(c => !c.revealed).length)}
                        className="w-full max-w-xs py-4 bg-[#059669] text-white rounded-xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#047857] transition-colors shadow-lg"
                     >
                        {t.confirm} ({selectedExchangeCards.length}/{me?.cards.filter(c => !c.revealed).length})
                     </button>
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