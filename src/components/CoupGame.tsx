'use client';

import React, { useState, useEffect } from 'react';
import {
  Coins, Crown, Shield,
  LogOut, Book, HelpCircle,
  Swords, Skull, RefreshCw, AlertTriangle, ThumbsUp, AlertOctagon, CheckCircle, Timer
} from 'lucide-react';
import { DICTIONARY } from '@/constants/coup';
import { Role, Lang, GameState, Player } from '@/types/coup';
import { GameCard, ActionBtn, RulesModal, GuideModal, LogPanel } from './CoupComponents';

interface CoupGameProps {
  gameState: GameState;
  userId: string | undefined;
  performAction: (actionType: string, targetId?: string) => Promise<void>;
  challenge: () => Promise<void>;
  block: () => Promise<void>;
  pass: () => Promise<void>;
  resolveLoss: (cardIndex: number) => Promise<void>;
  resolveExchange: (selectedIndices: number[]) => Promise<void>;
  leaveGame: () => Promise<void>;
  skipTurn?: () => Promise<void>;
  lang: Lang;
}

export default function CoupGame({
  gameState, userId, performAction, challenge, block, pass, resolveLoss, resolveExchange, leaveGame, skipTurn, lang
}: CoupGameProps) {
  const [targetMode, setTargetMode] = useState<'coup' | 'steal' | 'assassinate' | null>(null);
  const [activeModal, setActiveModal] = useState<'rules' | 'guide' | null>(null);
  const [selectedExchangeIndices, setSelectedExchangeIndices] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [hasPassed, setHasPassed] = useState(false); // Local UI state for pass

  const players = gameState.players || [];
  const me = players.find(p => p.id === userId);
  const currentPlayer = players[gameState.turnIndex];
  const isMyTurn = currentPlayer?.id === userId;
  const isHost = players.find(p => p.id === userId)?.isHost;

  const t = DICTIONARY[lang].ui;
  const actionsT = DICTIONARY[lang].actions;

  const phase = gameState.phase;
  const isActor = gameState.currentAction?.player === userId;
  const canBlock = (gameState.currentAction?.type === 'foreign_aid') || (gameState.currentAction?.target === userId);

  const isLosing = phase === 'losing_influence' && gameState.pendingPlayerId === userId;
  const isExchanging = phase === 'resolving_exchange' && gameState.pendingPlayerId === userId;

  const isForeignAid = gameState.currentAction?.type === 'foreign_aid';
  const isActionWithBlockAndChallenge = ['steal', 'assassinate'].includes(gameState.currentAction?.type || '');

  const isReactionPhase = phase === 'waiting_for_challenges' || phase === 'waiting_for_blocks' || phase === 'waiting_for_block_challenges';
  const isBlocker = gameState.currentAction?.blockedBy === userId;

  // Reset pass state when action changes
  useEffect(() => {
      setHasPassed(false);
  }, [gameState.currentAction, phase]);

  useEffect(() => {
      if (gameState.status !== 'playing') return;
      const interval = setInterval(() => {
          if (gameState.turnDeadline) {
              const remaining = Math.max(0, Math.ceil((gameState.turnDeadline - Date.now()) / 1000));
              setTimeLeft(remaining);
              if (remaining === 0 && skipTurn) {
                  const myResponsibility = (phase === 'choosing_action' && isMyTurn) || (isLosing) || (isExchanging);
                  if (myResponsibility) skipTurn();
              }
          }
      }, 500);
      return () => clearInterval(interval);
  }, [gameState.turnDeadline, gameState.status, phase, isMyTurn, isLosing, isExchanging, skipTurn]);

  const showChallengeBtn = !hasPassed && ((phase === 'waiting_for_challenges' && !isActor && !isForeignAid) || (phase === 'waiting_for_block_challenges' && !isBlocker) || (phase === 'waiting_for_blocks' && !isActor && !isForeignAid));
  const showBlockBtn = !hasPassed && !isActor && canBlock && !isBlocker && (isForeignAid || isActionWithBlockAndChallenge) && (phase === 'waiting_for_challenges' || phase === 'waiting_for_blocks');
  const showPassBtn = !hasPassed && ((phase === 'waiting_for_challenges' && !isActor) || (phase === 'waiting_for_blocks' && !isActor) || (phase === 'waiting_for_block_challenges' && !isBlocker));

  const handleAction = (action: string) => {
    if (['coup', 'steal', 'assassinate'].includes(action)) setTargetMode(action as any);
    else performAction(action);
  };

  const handleTarget = (targetId: string) => {
    const targetPlayer = players.find(p => p.id === targetId);
    if (!targetPlayer || targetPlayer.isDead) return;
    if (targetMode) { performAction(targetMode, targetId); setTargetMode(null); }
  };

  const handleExchangeToggle = (index: number) => {
      if (selectedExchangeIndices.includes(index)) {
          setSelectedExchangeIndices(prev => prev.filter(i => i !== index));
      } else {
          const lives = gameState?.players.find(p => p.id === userId)?.cards.filter(c => !c.revealed).length || 2;
          if (selectedExchangeIndices.length < lives) {
              setSelectedExchangeIndices(prev => [...prev, index]);
          }
      }
  };

  const handlePass = () => {
      setHasPassed(true);
      pass();
  };

  const shouldShowReactionPanel =
      isReactionPhase &&
      !me?.isDead &&
      !isLosing &&
      !isExchanging &&
      (!isActor || phase === 'waiting_for_block_challenges');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />
      {activeModal === 'rules' && <RulesModal onClose={() => setActiveModal(null)} lang={lang} />}
      {activeModal === 'guide' && <GuideModal onClose={() => setActiveModal(null)} lang={lang} />}

      <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
          <button onClick={leaveGame} className="p-2 text-gray-400 hover:text-[#9e1316]"><LogOut className="w-5 h-5" /></button>
          <div className="text-center">
             <h1 className="font-black text-xl">COUP</h1>
             <div className="text-[10px] font-bold text-[#9e1316] uppercase flex items-center justify-center gap-2">
                 {isLosing ? t.loseInfluence : (gameState.status === 'playing' ? `Turn: ${currentPlayer?.name}` : 'End')}
                 {gameState.status === 'playing' && (
                     <span className={`flex items-center gap-1 ${timeLeft < 15 ? 'text-red-600 animate-pulse' : 'text-gray-400'}`}>
                         <Timer className="w-3 h-3" /> {timeLeft}s
                     </span>
                 )}
             </div>
             {isHost && timeLeft === 0 && gameState.status === 'playing' && skipTurn && (
                 <button onClick={skipTurn} className="mt-1 text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200 uppercase font-bold hover:bg-red-200">
                     Force Skip
                 </button>
             )}
          </div>
          <div className="flex gap-2">
              <button onClick={() => setActiveModal('guide')} className="p-2 bg-white border rounded-xl shadow-sm"><Book className="w-5 h-5" /></button>
              <button onClick={() => setActiveModal('rules')} className="p-2 bg-white border rounded-xl shadow-sm"><HelpCircle className="w-5 h-5" /></button>
          </div>
      </header>

      <LogPanel logs={gameState.logs} lang={lang} />

      <main className="flex-1 relative z-10 p-4 pb-60 flex flex-col max-w-6xl mx-auto w-full h-full overflow-y-auto custom-scrollbar">
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {players.map(p => {
            if (p.id === userId) return null;
            const isCurr = gameState.turnIndex === players.findIndex(pl => pl.id === p.id);
            return (
              <div
                  key={p.id}
                  onClick={() => targetMode && !p.isDead && handleTarget(p.id)}
                  className={`
                      relative flex flex-col items-center p-3 bg-white border rounded-2xl transition-all
                      ${isCurr ? 'ring-4 ring-[#9e1316] scale-105 z-20' : 'opacity-90'}
                      ${targetMode && !p.isDead ? 'cursor-pointer animate-pulse ring-4 ring-blue-400 hover:scale-110' : ''}
                      ${p.isDead ? 'grayscale opacity-50 cursor-not-allowed' : ''}
                  `}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm mb-2"><img src={p.avatarUrl} className="w-full h-full object-cover" /></div>
                <div className="text-xs font-bold mb-1 truncate max-w-[80px]">{p.name}</div>
                <div className="flex gap-1 mb-2">{p.cards.map((c, i) => <div key={i} className={`w-3 h-5 rounded-sm border ${c.revealed ? 'bg-red-200' : 'bg-[#1A1F26]'}`} />)}</div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 rounded-full"><Coins className="w-3 h-3" /> {p.coins}</div>
              </div>
            );
          })}
        </div>

        {shouldShowReactionPanel && (
            <div className="fixed top-20 sm:top-auto sm:bottom-64 left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-xl border border-[#9e1316] p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 pointer-events-auto animate-in slide-in-from-top-10 sm:slide-in-from-bottom-10 fade-in">
                    <div className="text-xs font-bold uppercase text-[#1A1F26] text-center">
                        {isActor && phase === 'waiting_for_block_challenges'
                            ? "Ваше действие заблокировано!"
                            : (gameState.currentAction?.player === userId ? t.waitingForResponse : `${gameState.currentAction?.type.toUpperCase()}!`)}
                    </div>
                    <div className="flex gap-2 pointer-events-auto">
                        {showChallengeBtn && <button onClick={challenge} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-red-200 flex gap-2"><AlertOctagon className="w-4 h-4"/> {t.challenge}</button>}
                        {showBlockBtn && <button onClick={block} className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-purple-200 flex gap-2"><Shield className="w-4 h-4"/> {t.block}</button>}
                        {showPassBtn && <button onClick={handlePass} className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-200 flex gap-2"><ThumbsUp className="w-4 h-4"/> {t.pass}</button>}
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

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
                <div className="flex justify-center gap-3 sm:gap-4 relative shrink-0 mb-4 sm:mb-0 z-0">
                  {me.cards.map((card, i) => <GameCard key={i} role={card.role} revealed={card.revealed} isMe={true} lang={lang} disabled={me.isDead} isLosing={isLosing && !card.revealed} onClick={() => resolveLoss(i)} />)}
                </div>

                <div className="flex-1 w-full max-w-lg z-10 relative">
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
                     <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8">
                         {gameState.exchangeBuffer.map((role, i) => (
                             <div key={i} className={`relative transition-all duration-300 ${selectedExchangeIndices.includes(i) ? 'ring-4 ring-[#059669] rounded-2xl transform scale-105 z-10 shadow-xl' : 'opacity-80 hover:opacity-100'}`}>
                                <GameCard
                                   role={role}
                                   revealed={false}
                                   isMe={true}
                                   lang={lang}
                                   onClick={() => handleExchangeToggle(i)}
                                />
                                {selectedExchangeIndices.includes(i) && (
                                    <div className="absolute -top-2 -right-2 bg-[#059669] text-white rounded-full p-1 shadow-lg">
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                )}
                             </div>
                         ))}
                     </div>
                     <button
                        onClick={() => resolveExchange(selectedExchangeIndices)}
                        disabled={selectedExchangeIndices.length !== (me?.cards.filter(c => !c.revealed).length)}
                        className="w-full max-w-xs py-4 bg-[#059669] text-white rounded-xl font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#047857] transition-colors shadow-lg"
                     >
                        {t.confirm} ({selectedExchangeIndices.length}/{me?.cards.filter(c => !c.revealed).length})
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
                    onClick={leaveGame}
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