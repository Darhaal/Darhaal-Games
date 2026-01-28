'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, LogOut, MessageSquare, AlertTriangle,
  ShieldAlert, Sword, Hand
} from 'lucide-react';
import { GameState, Player, Role, Lang } from '@/types/coup';
import { DICTIONARY } from '@/constants/coup';
import { GameCard, ActionBtn, LogPanel, RulesModal, GuideModal } from './CoupComponents';

interface CoupGameProps {
  gameState: GameState;
  userId: string | undefined;
  performAction: (action: string, target?: string) => Promise<void>;
  challenge: () => Promise<void>;
  block: () => Promise<void>;
  pass: () => Promise<void>;
  resolveLoss: (cardIndex: number) => Promise<void>;
  resolveExchange: (selectedIndices: number[]) => Promise<void>;
  leaveGame: () => Promise<void>;
  lang: Lang;
}

export default function CoupGame({
  gameState,
  userId,
  performAction,
  challenge,
  block,
  pass,
  resolveLoss,
  resolveExchange,
  leaveGame,
  lang
}: CoupGameProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [exchangeSelection, setExchangeSelection] = useState<number[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const t = DICTIONARY[lang];
  const me = gameState.players.find(p => p.id === userId);
  const myIndex = gameState.players.findIndex(p => p.id === userId);
  const isMyTurn = gameState.turnIndex === myIndex;

  // Определяем, кто сейчас должен действовать (если это не фаза выбора действия)
  const isPendingPlayer = gameState.pendingPlayerId === userId;

  const opponents = gameState.players.filter(p => p.id !== userId);
  const currentPlayer = gameState.players[gameState.turnIndex];

  // Сброс выделения при смене фазы
  useEffect(() => {
    setSelectedAction(null);
    setExchangeSelection([]);
  }, [gameState.phase, gameState.turnIndex]);

  // --- HANDLERS ---

  const handleActionClick = (action: string) => {
    // Действия требующие цели
    if (['coup', 'assassinate', 'steal'].includes(action)) {
      if (selectedAction === action) setSelectedAction(null);
      else setSelectedAction(action);
    } else {
      performAction(action);
    }
  };

  const handleTargetClick = (targetId: string) => {
    if (!selectedAction) return;
    performAction(selectedAction, targetId);
    setSelectedAction(null);
  };

  const handleCardClick = (index: number) => {
    // 1. Сброс карты при потере влияния
    if (gameState.phase === 'losing_influence' && isPendingPlayer) {
      resolveLoss(index);
    }
    // 2. Выбор карт при обмене (Посол)
    else if (gameState.phase === 'resolving_exchange' && isPendingPlayer) {
      if (exchangeSelection.includes(index)) {
        setExchangeSelection(prev => prev.filter(i => i !== index));
      } else {
        if (exchangeSelection.length < 2) {
          setExchangeSelection(prev => [...prev, index]);
        }
      }
    }
  };

  const submitExchange = () => {
    if (exchangeSelection.length === 2) {
      resolveExchange(exchangeSelection);
    }
  };

  // --- RENDER HELPERS ---

  const getPhaseMessage = () => {
    if (gameState.winner) return `${t.ui.winner}: ${gameState.winner}`;

    if (gameState.phase === 'losing_influence') {
      const victim = gameState.players.find(p => p.id === gameState.pendingPlayerId);
      return victim?.id === userId ? t.ui.loseInfluence : `${victim?.name} ${t.ui.waitingForResponse}`;
    }

    if (gameState.phase === 'resolving_exchange') {
       return isPendingPlayer ? t.ui.exchange : `${currentPlayer.name} ${t.ui.exchange}...`;
    }

    if (gameState.phase === 'waiting_for_challenges') {
       return `${currentPlayer.name}: ${gameState.currentAction?.type} -> ${t.ui.waitingForResponse}`;
    }

    if (gameState.phase === 'waiting_for_blocks') {
       return `${t.ui.waitingForResponse} (${t.ui.block}?)`;
    }

    if (isMyTurn && gameState.phase === 'choosing_action') {
        if (selectedAction) return t.ui.targetSelect;
        return t.ui.yourTurn;
    }

    return `${currentPlayer.name}...`;
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden text-[#1A1F26]">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

      {showRules && <RulesModal onClose={() => setShowRules(false)} lang={lang} />}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} lang={lang} />}

      <LogPanel logs={gameState.logs} lang={lang} />

      {/* HEADER */}
      <header className="w-full px-4 py-3 flex justify-between items-center z-10 bg-white/80 backdrop-blur-sm border-b border-[#E6E1DC]">
        <button onClick={leaveGame} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#9e1316] mb-0.5 animate-pulse">
                {getPhaseMessage()}
            </div>
            {gameState.currentAction && (
                <div className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                    {gameState.currentAction.type}
                </div>
            )}
        </div>
        <div className="flex gap-2">
           <button onClick={() => setShowGuide(true)} className="p-2 bg-white border border-[#E6E1DC] rounded-xl shadow-sm hover:text-[#9e1316]"><Users className="w-5 h-5" /></button>
        </div>
      </header>

      {/* MAIN BOARD */}
      <main className="flex-1 relative z-0 flex flex-col">

        {/* OPPONENTS AREA */}
        <div className="flex-1 p-4 flex flex-wrap content-start justify-center gap-4 overflow-y-auto custom-scrollbar">
          {opponents.map(p => (
            <div
              key={p.id}
              onClick={() => selectedAction && !p.isDead ? handleTargetClick(p.id) : undefined}
              className={`
                relative bg-white border-2 rounded-2xl p-3 w-[140px] flex flex-col items-center shadow-sm transition-all duration-200
                ${p.isDead ? 'opacity-50 grayscale' : ''}
                ${p.id === gameState.players[gameState.turnIndex].id ? 'border-[#9e1316] ring-2 ring-[#9e1316]/20' : 'border-[#E6E1DC]'}
                ${selectedAction && !p.isDead ? 'cursor-pointer hover:scale-105 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/20 animate-bounce-slow' : ''}
              `}
            >
               <div className="absolute -top-3 bg-white border border-[#E6E1DC] px-2 py-0.5 rounded-lg shadow-sm text-[10px] font-bold uppercase truncate max-w-[90%]">
                 {p.name}
               </div>

               <div className="flex justify-center -space-x-4 mb-2 mt-2">
                 {p.cards.map((c, i) => (
                    <div key={i} className="transform scale-75 origin-top">
                        <GameCard role={c.role} revealed={c.revealed} isMe={false} lang={lang} small />
                    </div>
                 ))}
               </div>

               <div className="w-full flex justify-between items-center text-xs font-bold bg-gray-50 rounded-lg px-2 py-1 mt-auto">
                  <span className="flex items-center gap-1 text-yellow-600"><div className="w-2 h-2 rounded-full bg-yellow-400" />{p.coins}</span>
                  <span className="text-gray-400">#{gameState.players.findIndex(pl => pl.id === p.id) + 1}</span>
               </div>

               {/* Target Overlay */}
               {selectedAction && !p.isDead && (
                   <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl flex items-center justify-center backdrop-blur-[1px]">
                       <Sword className="w-8 h-8 text-emerald-600 animate-pulse" />
                   </div>
               )}
            </div>
          ))}
        </div>

        {/* MY AREA & CONTROLS */}
        <div className="bg-white border-t border-[#E6E1DC] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-[32px] p-4 sm:p-6 z-20">

          {/* MY CARDS */}
          <div className="flex justify-center items-end gap-2 sm:gap-4 mb-6 -mt-12 sm:-mt-16">
             {gameState.phase === 'resolving_exchange' && isPendingPlayer && gameState.exchangeBuffer ? (
                 // Exchange View
                 <div className="flex flex-col items-center w-full">
                     <div className="bg-[#1A1F26] text-white px-4 py-1 rounded-full text-xs font-bold mb-2 shadow-lg animate-bounce">
                        {t.ui.exchange}: {exchangeSelection.length}/2
                     </div>
                     <div className="flex gap-2 overflow-x-auto p-2 w-full justify-center">
                        {gameState.exchangeBuffer.map((role, i) => (
                            <GameCard
                                key={i}
                                role={role}
                                revealed={false}
                                isMe={true}
                                lang={lang}
                                selected={exchangeSelection.includes(i)}
                                onClick={() => handleCardClick(i)}
                            />
                        ))}
                     </div>
                     <button
                        onClick={submitExchange}
                        disabled={exchangeSelection.length !== 2}
                        className="mt-4 bg-[#1A1F26] text-white px-8 py-2 rounded-xl font-bold uppercase disabled:opacity-50"
                     >
                        {t.ui.confirm}
                     </button>
                 </div>
             ) : (
                 // Normal View
                 me?.cards.map((c, i) => (
                    <GameCard
                        key={i}
                        role={c.role}
                        revealed={c.revealed}
                        isMe={true}
                        lang={lang}
                        isLosing={gameState.phase === 'losing_influence' && isPendingPlayer && !c.revealed}
                        onClick={() => handleCardClick(i)}
                        disabled={c.revealed}
                    />
                 ))
             )}
          </div>

          {/* MY STATS */}
          <div className="flex justify-between items-center mb-4 px-2">
             <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                    <img src={me?.avatarUrl} alt="Me" className="w-full h-full object-cover" />
                </div>
                <div>
                    <div className="font-black text-sm text-[#1A1F26]">{me?.name} (Вы)</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-sm" /> {me?.coins} Coins
                    </div>
                </div>
             </div>
             {selectedAction && (
                 <button onClick={() => setSelectedAction(null)} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">
                    {t.ui.cancel}
                 </button>
             )}
          </div>

          {/* CONTROLS GRID */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3 h-24 sm:h-32">
             {/* LOGIC:
                 1. My Turn & Choosing Action -> Show Action Buttons
                 2. Response needed (Challenge/Block) -> Show Response Buttons
                 3. Waiting -> Show Wait Message
                 4. Losing Influence -> Hint text
             */}

             {isMyTurn && gameState.phase === 'choosing_action' && !selectedAction ? (
                 <>
                    <ActionBtn label={t.actions.income} onClick={() => handleActionClick('income')} />
                    <ActionBtn label={t.actions.foreign_aid} onClick={() => handleActionClick('foreign_aid')} />
                    <ActionBtn label={t.actions.tax} onClick={() => handleActionClick('tax')} color="bg-purple-50 border-purple-100 text-purple-900" />
                    <ActionBtn label={t.actions.steal} onClick={() => handleActionClick('steal')} color="bg-blue-50 border-blue-100 text-blue-900" />
                    <ActionBtn label={t.actions.exchange} onClick={() => handleActionClick('exchange')} color="bg-emerald-50 border-emerald-100 text-emerald-900" />
                    <ActionBtn label={t.actions.assassinate} onClick={() => handleActionClick('assassinate')} disabled={(me?.coins || 0) < 3} color="bg-red-50 border-red-100 text-red-900" />
                    <ActionBtn label={t.actions.coup} onClick={() => handleActionClick('coup')} disabled={(me?.coins || 0) < 7} color="bg-[#1A1F26] text-white border-black" />
                 </>
             ) : (
                 // REACTION BUTTONS
                 <>
                    {/* Challenge Button logic */}
                    {gameState.phase === 'waiting_for_challenges' && gameState.currentAction?.player !== userId && (
                         <div className="col-span-2 h-full">
                            <ActionBtn
                                label={t.ui.challenge}
                                icon={AlertTriangle}
                                onClick={challenge}
                                color="bg-yellow-50 border-yellow-200 text-yellow-800"
                            />
                         </div>
                    )}

                    {/* Block Button logic */}
                    {gameState.phase === 'waiting_for_blocks' && (
                        (gameState.currentAction?.target === userId || gameState.currentAction?.type === 'foreign_aid') && (
                            <div className="col-span-2 h-full">
                                <ActionBtn
                                    label={t.ui.block}
                                    icon={ShieldAlert}
                                    onClick={block}
                                    color="bg-red-50 border-red-200 text-red-800"
                                />
                            </div>
                        )
                    )}

                    {/* Block Challenge Logic */}
                    {gameState.phase === 'waiting_for_block_challenges' && gameState.currentAction?.blockedBy !== userId && (
                         <div className="col-span-2 h-full">
                            <ActionBtn
                                label={`${t.ui.challenge} Block`}
                                icon={AlertTriangle}
                                onClick={challenge}
                                color="bg-yellow-50 border-yellow-200 text-yellow-800"
                            />
                         </div>
                    )}

                    {/* Pass Button (Always visible if can react) */}
                    {(
                        (gameState.phase === 'waiting_for_challenges' && gameState.currentAction?.player !== userId) ||
                        (gameState.phase === 'waiting_for_blocks' && (gameState.currentAction?.target === userId || gameState.currentAction?.type === 'foreign_aid')) ||
                        (gameState.phase === 'waiting_for_block_challenges' && gameState.currentAction?.blockedBy !== userId)
                    ) && (
                        <div className="col-span-2 h-full">
                             <ActionBtn label={t.ui.pass} icon={Hand} onClick={pass} color="bg-gray-100 border-gray-200 text-gray-600" />
                        </div>
                    )}

                    {/* Empty State / Waiting */}
                    {!isMyTurn &&
                     gameState.phase !== 'waiting_for_challenges' &&
                     gameState.phase !== 'waiting_for_blocks' &&
                     gameState.phase !== 'waiting_for_block_challenges' &&
                     !isPendingPlayer && (
                        <div className="col-span-4 flex items-center justify-center h-full text-gray-400 text-xs font-bold italic border-2 border-dashed border-gray-200 rounded-xl">
                            {t.ui.waitingForResponse}
                        </div>
                    )}

                    {/* Pending Player Prompt */}
                    {isPendingPlayer && gameState.phase === 'losing_influence' && (
                        <div className="col-span-4 flex items-center justify-center h-full bg-red-50 text-red-600 text-xs font-bold border border-red-100 rounded-xl animate-pulse">
                            {t.ui.loseInfluence} (Click a card)
                        </div>
                    )}
                 </>
             )}
          </div>
        </div>
      </main>
    </div>
  );
}