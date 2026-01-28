'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2, Coins, Crown, X, Shield, History,
  LogOut, Book, HelpCircle,
  Swords, Skull, RefreshCw, AlertTriangle, ThumbsUp, AlertOctagon,
  Gavel
} from 'lucide-react';
import { useCoupGame } from '@/hooks/useCoupGame';
import { ROLE_CONFIG, DICTIONARY } from '@/constants/coup';
import { Role, Lang } from '@/types/coup';

// --- SUBCOMPONENTS ---

const Card = ({ role, revealed, onClick, selectable, isSelected, dead }: { role: Role, revealed: boolean, onClick?: () => void, selectable?: boolean, isSelected?: boolean, dead?: boolean }) => {
  if (!role) return null;
  const config = ROLE_CONFIG[role];
  const t = DICTIONARY['ru'].roles[role]; // Using RU for default in this view, can be dynamic

  return (
    <div
      onClick={selectable ? onClick : undefined}
      className={`
        relative w-24 h-36 sm:w-28 sm:h-44 rounded-xl transition-all duration-300 transform perspective-1000
        ${selectable ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl' : ''}
        ${isSelected ? 'ring-4 ring-yellow-400 -translate-y-4 shadow-2xl scale-105 z-20' : ''}
        ${dead ? 'opacity-50 grayscale rotate-6 translate-y-4' : ''}
      `}
    >
      <div className={`w-full h-full relative preserve-3d transition-transform duration-700 ${revealed ? 'rotate-y-0' : 'rotate-y-0'}`}>
        {/* Render Front Always if Revealed or Owner */}
        <div className={`
          absolute inset-0 rounded-xl border-4 bg-white flex flex-col items-center p-2 shadow-lg overflow-hidden
          ${revealed ? 'brightness-75' : 'bg-gradient-to-br from-white to-gray-50'}
        `} style={{ borderColor: config.color }}>
           {/* Background Icon */}
           <config.icon className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10" style={{ color: config.color }} />

           {/* Header */}
           <div className="w-full flex justify-between items-center mb-1">
             <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: config.color }}>{t.name}</span>
             <config.icon className="w-4 h-4" style={{ color: config.color }} />
           </div>

           {/* Central Art */}
           <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-auto mt-2 ${config.bg}`}>
              <config.icon className="w-10 h-10 sm:w-12 sm:h-12" style={{ color: config.color }} />
           </div>

           {/* Abilities */}
           {!revealed && (
             <div className="w-full text-[9px] sm:text-[10px] space-y-1 mt-2 font-medium text-gray-600 bg-white/80 p-1 rounded backdrop-blur-sm border border-gray-100">
                <div className="flex items-center gap-1">
                   <Swords className="w-3 h-3 text-emerald-600 shrink-0" />
                   <span className="leading-tight">{t.action}</span>
                </div>
                {t.block !== '-' && (
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-red-500 shrink-0" />
                    <span className="leading-tight text-red-600">Blocks {t.block}</span>
                  </div>
                )}
             </div>
           )}

           {/* Revealed Skull Overlay */}
           {revealed && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-lg">
                <Skull className="w-12 h-12 text-white drop-shadow-lg" />
             </div>
           )}
        </div>

        {/* Card Back (Only for non-owner, unrevealed - Handled by parent logic usually, but here we assume 'role' implies visibility) */}
      </div>
    </div>
  );
};

const CardBack = () => (
    <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl bg-[#1A1F26] border-2 border-[#333] flex items-center justify-center shadow-lg relative overflow-hidden">
        <div className="absolute inset-2 border border-white/10 rounded-lg" />
        <Crown className="w-8 h-8 text-white/20" />
    </div>
);

const ActionButton = ({ label, cost, onClick, disabled, color = 'bg-white', icon: Icon }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      relative overflow-hidden group flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border-b-4
      transition-all duration-100 active:border-b-0 active:translate-y-1 h-full
      ${disabled ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200' : `${color} hover:brightness-95 shadow-sm`}
    `}
  >
    <div className="flex flex-col items-center z-10">
       {Icon && <Icon className={`w-5 h-5 mb-1 ${disabled ? 'text-gray-400' : 'text-gray-800'}`} />}
       <span className={`text-[10px] sm:text-xs font-black uppercase leading-tight text-center ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>{label}</span>
       {cost && <span className="text-[9px] font-bold text-red-600 mt-0.5">{cost}</span>}
    </div>
  </button>
);

const Modal = ({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) => (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-3xl">
                <h3 className="font-black text-lg uppercase flex items-center gap-2 text-gray-800">{title}</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-4 custom-scrollbar">
                {children}
            </div>
        </div>
    </div>
);

// --- MAIN PAGE ---

export default function CoupBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [lang, setLang] = useState<Lang>('ru');
  const [showRules, setShowRules] = useState(false);
  const [targetMode, setTargetMode] = useState<string | null>(null);

  // Exchange State
  const [selectedExchangeCards, setSelectedExchangeCards] = useState<Role[]>([]);

  const { gameState, roomMeta, loading, performAction, startGame, leaveGame, pass, challenge, block, resolveLoss, resolveExchange } = useCoupGame(lobbyId, userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-red-600 w-8 h-8" /></div>;
  if (!gameState) return <div className="min-h-screen flex items-center justify-center">Lobby not found</div>;

  const me = gameState.players.find(p => p.id === userId);
  const myTurn = gameState.players[gameState.turnIndex]?.id === userId;
  const t = DICTIONARY[lang];

  const isActor = gameState.currentAction?.player === userId;
  const isTarget = gameState.currentAction?.target === userId;

  // Computed Phases
  const isLosingInfluence = gameState.phase === 'losing_influence' && gameState.pendingPlayerId === userId;
  const isExchanging = gameState.phase === 'resolving_exchange' && gameState.pendingPlayerId === userId;

  // --- HANDLERS ---
  const handleActionClick = (type: string) => {
    if (['coup', 'steal', 'assassinate'].includes(type)) {
       setTargetMode(type);
    } else {
       performAction(type);
    }
  };

  const handleTargetClick = (targetId: string) => {
    if (targetMode) {
        performAction(targetMode, targetId);
        setTargetMode(null);
    }
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
          if (selectedExchangeCards.length < (me?.cards.filter(c => !c.revealed).length || 2)) {
              setSelectedExchangeCards(prev => [...prev, role]);
          }
      }
  };

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#1A1F26] font-sans overflow-hidden flex flex-col relative">
      {/* HEADER */}
      <header className="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-20">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-red-200 shadow-lg">CP</div>
            <div className="hidden sm:block">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.ui.code}</div>
                <div className="font-mono font-black text-sm">{roomMeta?.code}</div>
            </div>
         </div>

         <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
             <button onClick={() => setShowRules(true)} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm"><Book className="w-4 h-4 text-gray-600"/></button>
             <button onClick={leaveGame} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm text-red-500"><LogOut className="w-4 h-4"/></button>
         </div>
      </header>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden relative">

          {/* LOGS SIDEBAR (Desktop) */}
          <div className="hidden lg:flex w-64 border-r border-gray-200 bg-white flex-col">
              <div className="p-4 font-bold text-xs uppercase text-gray-400 border-b">{t.ui.logs}</div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {gameState.logs.map((log, i) => (
                      <div key={i} className="text-xs p-2 rounded bg-gray-50 border border-gray-100">
                          <div className="flex justify-between mb-1">
                              <span className="font-bold">{log.user}</span>
                              <span className="text-gray-400">{log.time}</span>
                          </div>
                          <span className="text-gray-600">{log.action}</span>
                      </div>
                  ))}
              </div>
          </div>

          {/* GAME TABLE */}
          <div className="flex-1 relative flex flex-col bg-[#F0F2F5] overflow-y-auto">
             <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

             {/* PLAYERS GRID */}
             <div className="flex-1 p-4 sm:p-8 flex items-center justify-center">
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-8 w-full max-w-4xl">
                    {gameState.players.map(p => {
                        if (p.id === userId) return null;
                        const isTurn = gameState.turnIndex === gameState.players.findIndex(pl => pl.id === p.id);
                        return (
                            <div
                              key={p.id}
                              onClick={() => handleTargetClick(p.id)}
                              className={`
                                relative bg-white p-4 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center
                                ${isTurn ? 'border-red-500 shadow-xl scale-105 z-10' : 'border-transparent shadow-sm hover:shadow-md'}
                                ${targetMode ? 'cursor-pointer animate-pulse ring-4 ring-blue-400' : ''}
                                ${p.isDead ? 'opacity-50 grayscale' : ''}
                              `}
                            >
                                <div className="absolute -top-3 bg-white px-2 py-0.5 rounded-full border shadow-sm flex gap-1">
                                    {p.cards.map((c, i) => (
                                        <div key={i} className={`w-3 h-4 rounded-sm border ${c.revealed ? 'bg-red-400' : 'bg-gray-800'}`} />
                                    ))}
                                </div>

                                <img src={p.avatarUrl} className="w-14 h-14 rounded-full border-4 border-white shadow-md mb-2 object-cover" />
                                <div className="font-black text-sm text-center truncate w-full">{p.name}</div>
                                <div className="flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full mt-1">
                                    <Coins className="w-3 h-3 fill-yellow-500" /> {p.coins}
                                </div>
                            </div>
                        );
                    })}
                 </div>
             </div>

             {/* USER DASHBOARD (FIXED BOTTOM) */}
             <div className="bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[32px] p-4 sm:p-6 z-30 pb-8">
                 {me && (
                     <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6">

                         {/* MY INFO */}
                         <div className="flex flex-col items-center md:items-start shrink-0">
                             <div className="flex items-center gap-3 mb-2">
                                 <img src={me.avatarUrl} className="w-10 h-10 rounded-full border-2 border-gray-100" />
                                 <div className="text-left">
                                     <div className="font-black text-sm">{me.name}</div>
                                     <div className="text-xs text-gray-500 flex items-center gap-1">
                                        <Coins className="w-3 h-3 text-yellow-500" />
                                        <span className="font-bold text-yellow-600">{me.coins} Coins</span>
                                     </div>
                                 </div>
                             </div>
                         </div>

                         {/* MY CARDS */}
                         <div className="flex justify-center gap-2 sm:gap-4 relative">
                            {me.cards.map((c, i) => (
                                <Card
                                   key={i}
                                   role={c.role}
                                   revealed={c.revealed}
                                   dead={me.isDead}
                                   onClick={() => isLosingInfluence && !c.revealed ? resolveLoss(i) : undefined}
                                   selectable={isLosingInfluence && !c.revealed}
                                   isSelected={isLosingInfluence && !c.revealed}
                                />
                            ))}
                         </div>

                         {/* CONTROLS AREA */}
                         <div className="flex-1 w-full flex justify-center md:justify-end">

                             {me.isDead ? (
                                 <div className="bg-red-50 text-red-600 font-black px-6 py-3 rounded-xl uppercase tracking-widest border border-red-100">
                                     {t.ui.youDied}
                                 </div>
                             ) : (
                                 <>
                                    {/* Action Phase */}
                                    {myTurn && gameState.phase === 'choosing_action' && !targetMode && (
                                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 w-full max-w-2xl">
                                            <ActionButton label={t.actions.income} onClick={()=>handleActionClick('income')} color="bg-gray-50 border-gray-200" />
                                            <ActionButton label={t.actions.aid} onClick={()=>handleActionClick('foreign_aid')} color="bg-gray-50 border-gray-200" />
                                            <ActionButton label={t.actions.tax} icon={Crown} onClick={()=>handleActionClick('tax')} color="bg-purple-50 border-purple-200" />
                                            <ActionButton label={t.actions.steal} icon={Swords} onClick={()=>handleActionClick('steal')} color="bg-blue-50 border-blue-200" />
                                            <ActionButton label={t.actions.exchange} icon={RefreshCw} onClick={()=>handleActionClick('exchange')} color="bg-emerald-50 border-emerald-200" />
                                            <ActionButton label={t.actions.assassinate} icon={Skull} cost="-3" disabled={me.coins<3} onClick={()=>handleActionClick('assassinate')} color="bg-gray-900 border-black text-white" />
                                            <ActionButton label={t.actions.coup} icon={AlertTriangle} cost="-7" disabled={me.coins<7} onClick={()=>handleActionClick('coup')} color="bg-red-600 border-red-800 text-white" />
                                        </div>
                                    )}

                                    {/* Target Selection */}
                                    {targetMode && (
                                        <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
                                            <div className="text-sm font-bold uppercase text-blue-600 bg-blue-50 px-4 py-1 rounded-full animate-pulse">{t.ui.targetSelect} {targetMode}</div>
                                            <button onClick={()=>setTargetMode(null)} className="px-6 py-2 bg-gray-200 rounded-full font-bold text-xs hover:bg-gray-300 transition-colors">{t.ui.cancel}</button>
                                        </div>
                                    )}

                                    {/* Reaction Phase */}
                                    {gameState.phase.includes('waiting') && !myTurn && (
                                        <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-4">
                                            {/* CHALLENGE BUTTON */}
                                            {!isActor && !isLosingInfluence && (
                                                <button onClick={challenge} className="flex flex-col items-center p-3 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors border-b-4 border-red-200 active:border-b-0 active:translate-y-1">
                                                    <AlertOctagon className="w-5 h-5 mb-1"/>
                                                    <span className="text-[10px] font-black uppercase">{t.ui.challenge}</span>
                                                </button>
                                            )}

                                            {/* BLOCK BUTTON */}
                                            {gameState.phase === 'waiting_for_blocks' && (isTarget || gameState.currentAction?.type === 'foreign_aid') && (
                                                 <button onClick={block} className="flex flex-col items-center p-3 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 transition-colors border-b-4 border-purple-200 active:border-b-0 active:translate-y-1">
                                                    <Shield className="w-5 h-5 mb-1"/>
                                                    <span className="text-[10px] font-black uppercase">{t.ui.block}</span>
                                                 </button>
                                            )}

                                            {/* PASS BUTTON */}
                                            {!isActor && (
                                                <button onClick={pass} className="flex flex-col items-center p-3 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors border-b-4 border-emerald-200 active:border-b-0 active:translate-y-1">
                                                    <ThumbsUp className="w-5 h-5 mb-1"/>
                                                    <span className="text-[10px] font-black uppercase">{t.ui.pass}</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Wait Message */}
                                    {isActor && gameState.phase.includes('waiting') && (
                                        <div className="flex items-center gap-2 text-gray-400 bg-gray-50 px-4 py-2 rounded-xl">
                                            <Loader2 className="w-4 h-4 animate-spin"/>
                                            <span className="text-xs font-bold uppercase">{t.ui.waitingForResponse}</span>
                                        </div>
                                    )}

                                    {/* Lose Influence Message */}
                                    {isLosingInfluence && (
                                        <div className="absolute -top-16 left-0 right-0 flex justify-center pointer-events-none">
                                            <div className="bg-red-600 text-white px-6 py-2 rounded-full shadow-xl font-black uppercase animate-bounce text-sm">
                                                {t.ui.loseInfluence}
                                            </div>
                                        </div>
                                    )}
                                 </>
                             )}
                         </div>
                     </div>
                 )}
             </div>
          </div>

          {/* EXCHANGE MODAL */}
          {isExchanging && gameState.exchangeBuffer && (
             <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                 <div className="bg-white rounded-[32px] p-6 w-full max-w-2xl flex flex-col items-center shadow-2xl animate-in zoom-in-95">
                     <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><RefreshCw className="w-6 h-6 text-emerald-600"/> {t.ui.exchange}</h2>
                     <div className="flex flex-wrap justify-center gap-4 mb-8">
                         {gameState.exchangeBuffer.map((role, i) => (
                             <Card
                               key={i}
                               role={role}
                               revealed={false}
                               selectable={true}
                               isSelected={selectedExchangeCards.includes(role)}
                               onClick={() => handleExchangeToggle(role)}
                             />
                         ))}
                     </div>
                     <button
                        onClick={() => resolveExchange(selectedExchangeCards)}
                        disabled={selectedExchangeCards.length !== (me?.cards.filter(c => !c.revealed).length)}
                        className="w-full max-w-xs py-4 bg-emerald-600 text-white rounded-xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors shadow-lg"
                     >
                        {t.ui.confirm} ({selectedExchangeCards.length}/{me?.cards.filter(c => !c.revealed).length})
                     </button>
                 </div>
             </div>
          )}

          {/* LOBBY / WINNER SCREEN */}
          {(gameState.status === 'waiting' || gameState.status === 'finished') && (
              <div className="absolute inset-0 z-50 bg-[#F0F2F5] flex flex-col items-center justify-center p-4">
                   <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl text-center border-2 border-gray-100 relative overflow-hidden">
                       <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-purple-500 to-blue-500" />

                       {gameState.status === 'finished' ? (
                           <>
                              <Crown className="w-20 h-20 text-yellow-500 mx-auto mb-4 animate-bounce"/>
                              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">{t.ui.winner}</h2>
                              <div className="text-4xl font-black text-[#1A1F26] mb-8">{gameState.winner}</div>
                           </>
                       ) : (
                           <>
                              <h1 className="text-4xl font-black text-[#1A1F26] mb-2 tracking-tighter">COUP</h1>
                              <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">{t.ui.waiting}</div>
                              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t.ui.code}</div>
                                  <div className="text-3xl font-mono font-black">{roomMeta?.code}</div>
                              </div>
                              <div className="space-y-2 mb-8">
                                  {gameState.players.map(p => (
                                      <div key={p.id} className="flex items-center gap-3 p-2 bg-white border rounded-lg shadow-sm">
                                          <img src={p.avatarUrl} className="w-8 h-8 rounded-full"/>
                                          <span className="font-bold text-sm">{p.name}</span>
                                          {p.isHost && <Crown className="w-3 h-3 text-yellow-500 ml-auto"/>}
                                      </div>
                                  ))}
                              </div>
                           </>
                       )}

                       {me?.isHost ? (
                           <button onClick={startGame} className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase hover:bg-gray-800 transition-colors shadow-lg">
                               {gameState.status === 'finished' ? t.ui.playAgain : t.ui.startGame}
                           </button>
                       ) : (
                           <div className="flex gap-2 justify-center">
                               <Loader2 className="animate-spin text-gray-400"/>
                           </div>
                       )}

                       <div className="mt-4 flex justify-center gap-4">
                           <button onClick={() => setShowRules(true)} className="text-xs font-bold text-gray-400 hover:text-gray-600 underline">Rules</button>
                           <button onClick={leaveGame} className="text-xs font-bold text-red-400 hover:text-red-600 underline">Leave</button>
                       </div>
                   </div>
              </div>
          )}

          {/* RULES MODAL */}
          {showRules && (
              <Modal title={t.rules.title} onClose={() => setShowRules(false)}>
                  <div className="space-y-6 text-sm text-gray-600">
                      {t.rules.sections.map((sec, i) => (
                          <div key={i}>
                              <h4 className="font-bold text-[#1A1F26] mb-1">{sec.title}</h4>
                              <p className="bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed">{sec.content}</p>
                          </div>
                      ))}
                  </div>
              </Modal>
          )}
      </div>
    </div>
  );
}