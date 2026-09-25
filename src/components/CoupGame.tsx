'use client';

import Image from 'next/image';
import React, { useState, useEffect, useRef } from 'react';
import {
  Coins, Crown, Shield,
  Swords, Skull, RefreshCw, AlertTriangle, ThumbsUp, AlertOctagon, CheckCircle, ScrollText
} from 'lucide-react';
import { DICTIONARY } from '@/constants/coup';
import { Lang, GameState } from '@/types/coup';
import { GameCard as RoleCard, ActionBtn, GuideModal, logText, logUser } from './CoupComponents';
import GameHeader from './GameHeader';
import { requireGame } from '@/games/registry';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import { useEscape } from '@/hooks/useEscape';
import { defaultAvatar } from '@/constants/app';
import GameLayout from './game/GameLayout';
import GameCard from './game/GameCard';
import TurnCard from './game/TurnCard';
import ResultDialog from './game/ResultDialog';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_OVERLAY, DIALOG_PANEL, GAME_PAGE, LABEL } from './game/ui';
import { playSfx } from '@/lib/sound';

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
  // The result can be put aside to look at the table, and brought back.
  const [resultHidden, setResultHidden] = useState(false);

  // "Passed" is keyed to the specific phase/action: when the phase changes the key
  // changes too, so the flag resets automatically (no setState in an effect)
  const [passedForKey, setPassedForKey] = useState<string | null>(null);

  const players = gameState.players || [];
  const me = players.find(p => p.id === userId);
  const currentPlayer = players[gameState.turnIndex];
  const isMyTurn = currentPlayer?.id === userId;

  const t = DICTIONARY[lang].ui;
  const actionsT = DICTIONARY[lang].actions;
  /** The action's name in the reader's language, not its code ("STEAL!"). */
  const actionName = (type?: string) => {
    if (!type) return '';
    const key = (type === 'foreign_aid' ? 'aid' : type) as keyof typeof actionsT;
    return actionsT[key] ?? type;
  };

  const phase = gameState.phase;
  const isActor = gameState.currentAction?.player === userId;
  const canBlock = (gameState.currentAction?.type === 'foreign_aid') || (gameState.currentAction?.target === userId);

  const isLosing = phase === 'losing_influence' && gameState.pendingPlayerId === userId;
  const isExchanging = phase === 'resolving_exchange' && gameState.pendingPlayerId === userId;

  const isForeignAid = gameState.currentAction?.type === 'foreign_aid';
  const isActionWithBlockAndChallenge = ['steal', 'assassinate'].includes(gameState.currentAction?.type || '');

  const isReactionPhase = phase === 'waiting_for_challenges' || phase === 'waiting_for_blocks' || phase === 'waiting_for_block_challenges';
  const isBlocker = gameState.currentAction?.blockedBy === userId;

  // Escape cancels target selection (coup / steal / assassinate)
  useEscape(!!targetMode, () => setTargetMode(null));

  const phaseKey = `${gameState.phase}|${gameState.currentAction?.type}|${gameState.currentAction?.player}|${gameState.turnIndex}`;
  const hasPassedLocal = passedForKey === phaseKey;

  // Guard against one client firing the timeout multiple times
  const timeoutFiredRef = useRef(false);
  useEffect(() => {
      timeoutFiredRef.current = false;
  }, [gameState.turnDeadline, gameState.phase]);

  useEffect(() => {
      if (gameState.status !== 'playing') return;
      const interval = setInterval(() => {
          if (gameState.turnDeadline) {
              const remaining = Math.max(0, Math.ceil((gameState.turnDeadline - Date.now()) / 1000));
              setTimeLeft(remaining);

              if (remaining === 0 && skipTurn && !timeoutFiredRef.current) {
                  const overdue = Date.now() - gameState.turnDeadline;

                  // Phases with a single responsible player — that player
                  // resolves the timeout, and everyone else backs them up five
                  // seconds later. Without the backup the AFK kick could only
                  // be fired by the player who had gone AFK, so the table sat
                  // there until someone left.
                  if ((phase === 'choosing_action' && isMyTurn) || isLosing || isExchanging || overdue > 5000) {
                      timeoutFiredRef.current = true;
                      skipTurn();
                  }
                  else if (isReactionPhase) {
                      // One primary writer instead of a race between all clients:
                      // in reaction phases it is the actor; for block challenges — the blocker.
                      // Everyone else acts as a 5s-delayed backup (if the primary disconnected).
                      const overdueMs = Date.now() - gameState.turnDeadline;
                      const isPrimary = phase === 'waiting_for_block_challenges' ? isBlocker : isActor;
                      const isBackup = overdueMs > 5000 && !hasPassedLocal && !isActor && !isBlocker;

                      if (isPrimary || isBackup) {
                          timeoutFiredRef.current = true;
                          skipTurn();
                      }
                  }
              }
          }
      }, 500);
      return () => clearInterval(interval);
  }, [gameState.turnDeadline, gameState.status, phase, isMyTurn, isLosing, isExchanging, skipTurn, isReactionPhase, hasPassedLocal, isActor, isBlocker]);

  // "Your turn" and end-of-game sounds
  useEffect(() => {
      if (gameState.status === 'playing' && isMyTurn && phase === 'choosing_action') playSfx('notify');
  }, [isMyTurn, phase, gameState.status]);
  useEffect(() => {
      if (gameState.winner) playSfx(gameState.winnerId === userId ? 'win' : 'lose');
  }, [gameState.winner, gameState.winnerId, userId]);

  const showChallengeBtn = !hasPassedLocal && isReactionPhase && !isActor && !isBlocker && (
      phase === 'waiting_for_challenges' ||
      phase === 'waiting_for_block_challenges' ||
      (phase === 'waiting_for_blocks' && !isForeignAid)
  );

  const showBlockBtn = !hasPassedLocal && !isActor && !isBlocker && canBlock &&
      (isForeignAid || isActionWithBlockAndChallenge) &&
      (phase === 'waiting_for_challenges' || phase === 'waiting_for_blocks');

  const showPassBtn = !hasPassedLocal && isReactionPhase && !isActor && !isBlocker;

  const handleAction = (action: string) => {
    if (action === 'coup' || action === 'steal' || action === 'assassinate') setTargetMode(action);
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
      setPassedForKey(phaseKey);
      pass();
  };

  const shouldShowReactionPanel =
      isReactionPhase &&
      !me?.isDead &&
      !isLosing &&
      !isExchanging &&
      (!isActor || phase === 'waiting_for_block_challenges');

  const iWon = gameState.winnerId === userId;
  const winnerPlayer = players.find((p) => p.id === gameState.winnerId);
  const isFinished = !!gameState.winner;

  // What the Turn card says, phase by phase.
  const turnHint = isFinished
    ? undefined
    : isLosing ? t.loseHint
    : isExchanging ? t.exchangeHint
    : isReactionPhase
      ? `${actionName(gameState.currentAction?.type)} — ${t.waitingAnswers}`
      : isMyTurn ? t.turnHint : t.thinking;

  return (
    <div className={GAME_PAGE}>
      {activeModal === 'guide' && <GuideModal onClose={() => setActiveModal(null)} lang={lang} />}

      <GameRulesModal
        isOpen={activeModal === 'rules'}
        onClose={() => setActiveModal(null)}
        rules={GAME_RULES[lang].coup}
      />

      <GameHeader
        title={requireGame('coup').name[lang]}
        icon={ScrollText}
        timeLeft={timeLeft}
        showTime={gameState.status === 'playing'}
        onLeave={() => leaveGame()}
        onShowRules={() => setActiveModal('rules')}
        onShowGuide={() => setActiveModal('guide')}
        lang={lang}
      />

      <GameLayout
        boardWidth={720}
        board={
          <div className="space-y-4">
            {/* THE TABLE — everyone else, and the targets when an action asks for one */}
            <div className={`${LABEL} flex items-center justify-between`}>
              <span>{t.table}</span>
              {targetMode && <span className="text-[#9e1316] normal-case tracking-normal font-bold text-xs">{t.pickTarget}</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {players.map((p, index) => {
                if (p.id === userId) return null;
                const isCurr = !isFinished && gameState.turnIndex === index;
                const targetable = !!targetMode && !p.isDead;
                return (
                  <button
                    type="button"
                    key={p.id}
                    disabled={!targetable}
                    onClick={() => targetable && handleTarget(p.id)}
                    className={`relative text-left bg-white rounded-2xl border p-3 transition-all ${
                      targetable
                        ? 'border-[#9e1316]/40 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
                        : isCurr ? 'border-[#E6E1DC] shadow-sm bg-[#F8FAFC]' : 'border-[#E6E1DC] shadow-sm'
                    } ${p.isDead ? 'opacity-50' : ''}`}
                  >
                    {isCurr && <span aria-hidden className="absolute left-1 top-3 bottom-3 w-1 rounded-full bg-[#1A1F26]" />}
                    <div className="flex items-center gap-3 pl-1.5">
                      <Image
                        src={p.avatarUrl || defaultAvatar(p.id)}
                        alt=""
                        width={36}
                        height={36}
                        className={`w-9 h-9 rounded-full object-cover bg-[#F8FAFC] shrink-0 ${p.isDead ? 'grayscale' : ''}`}
                      />
                      <div className="min-w-0">
                        <div className={`text-sm font-bold truncate ${p.isDead ? 'line-through text-[#B5B3AD]' : ''}`}>{p.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Influence: a card back for each still hidden, red once shown. */}
                          <span className="flex gap-1">
                            {p.cards.map((c, i) => (
                              <span key={i} className={`w-2.5 h-3.5 rounded-[2px] ${c.revealed ? 'bg-red-200' : 'bg-[#1A1F26]'}`} />
                            ))}
                          </span>
                          <span className="flex items-center gap-1 text-2xs font-bold text-amber-600 tabular-nums">
                            <Coins className="w-3 h-3" /> {p.coins}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ANSWER — challenge, block or let it pass */}
            {shouldShowReactionPanel && (
              <GameCard label={t.responseLabel} className="animate-in fade-in slide-in-from-bottom-2">
                <div className="text-sm font-black text-[#1A1F26] mb-3">
                  {isActor && phase === 'waiting_for_block_challenges'
                    ? t.actionBlocked
                    : (gameState.currentAction?.player === userId ? t.waitingForResponse : actionName(gameState.currentAction?.type))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {showChallengeBtn && (
                    <button onClick={challenge} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 font-bold uppercase text-xs hover:bg-red-100 transition-colors">
                      <AlertOctagon className="w-4 h-4" /> {t.challenge}
                    </button>
                  )}
                  {showBlockBtn && (
                    <button onClick={block} className={`flex items-center gap-2 px-4 py-2.5 ${BUTTON_SECONDARY}`}>
                      <Shield className="w-4 h-4" /> {t.block}
                    </button>
                  )}
                  {showPassBtn && (
                    <button onClick={handlePass} className={`flex items-center gap-2 px-4 py-2.5 ${BUTTON_SECONDARY}`}>
                      <ThumbsUp className="w-4 h-4" /> {t.pass}
                    </button>
                  )}
                </div>
              </GameCard>
            )}
          </div>
        }
        side={
          <>
            <TurnCard
              lang={lang}
              who={currentPlayer ? { name: currentPlayer.name, isMe: isMyTurn, avatarUrl: currentPlayer.avatarUrl || defaultAvatar(currentPlayer.id) } : null}
              hint={turnHint}
              secondsLeft={gameState.status === 'playing' ? timeLeft : undefined}
              turnSeconds={isReactionPhase ? 30 : 60}
              result={isFinished ? {
                won: iWon,
                title: iWon ? t.youWin : t.winner,
                detail: gameState.winner ?? undefined,
                hidden: resultHidden,
                onShow: () => setResultHidden(false)
              } : undefined}
            />

            <GameCard label={t.logs}>
              <div className="max-h-72 overflow-y-auto custom-scrollbar -mx-1 px-1 space-y-2">
                {gameState.logs.length === 0 && (
                  <div className="text-xs text-[#8A9099] font-medium">{t.noLogs}</div>
                )}
                {gameState.logs.map((log, i) => (
                  <div key={i} className="text-xs leading-snug">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#1A1F26] truncate">{logUser(log.user, lang)}</span>
                      <span className="text-3xs text-[#B5B3AD] tabular-nums shrink-0">{log.time}</span>
                    </div>
                    <div className="text-[#8A9099]">{logText(log.action, lang)}</div>
                  </div>
                ))}
              </div>
            </GameCard>
          </>
        }
      />

      {/* Room under the hand, which stays pinned to the bottom edge. */}
      {me && <div aria-hidden className="h-[26rem] md:h-64" />}

      {/* YOUR HAND — pinned to the bottom, the one place Coup's actions live */}
      {me && !isFinished && (
        <div className="fixed bottom-0 left-0 right-0 p-2 sm:p-4 z-40">
          <div className="max-w-4xl mx-auto bg-white border border-[#E6E1DC] rounded-[24px] p-4 sm:p-5 shadow-2xl">
            {(isLosing || isExchanging) && (
              <div className={`mb-3 text-xs font-black uppercase tracking-widest text-center ${isLosing ? 'text-red-600' : 'text-emerald-700'}`}>
                {isLosing ? t.loseInfluence : t.exchange}
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="flex justify-center gap-3 sm:gap-4 shrink-0">
                {me.cards.map((card, i) => (
                  <RoleCard key={i} role={card.role} revealed={card.revealed} isMe={true} lang={lang} disabled={me.isDead} isLosing={isLosing && !card.revealed} onClick={() => resolveLoss(i)} />
                ))}
              </div>

              <div className="flex-1 w-full max-w-lg">
                <div className="flex items-center gap-2 mb-3 justify-center md:justify-start">
                  <span className={LABEL}>{t.coins}</span>
                  <span className="flex items-center gap-1.5 bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E6E1DC]">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span className="text-lg font-black tabular-nums">{me.coins}</span>
                  </span>
                </div>

                {!me.isDead && isMyTurn && phase === 'choosing_action' && (
                  targetMode ? (
                    <div className="text-center p-4 bg-[#F8FAFC] rounded-xl border border-dashed border-[#E6E1DC]">
                      <div className="text-sm font-bold mb-3 text-[#9e1316]">{actionName(targetMode)} — {t.pickTarget}</div>
                      <button onClick={() => setTargetMode(null)} className={`px-5 py-2 ${BUTTON_SECONDARY}`}>{t.cancel}</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      <ActionBtn label={actionsT.income} onClick={() => handleAction('income')} color="bg-gray-50 border-gray-200" />
                      <ActionBtn label={actionsT.aid} onClick={() => handleAction('foreign_aid')} color="bg-gray-50 border-gray-200" />
                      <ActionBtn label={actionsT.tax} onClick={() => handleAction('tax')} color="bg-purple-50 border-purple-200" icon={Crown} />
                      <ActionBtn label={actionsT.steal} onClick={() => handleAction('steal')} color="bg-blue-50 border-blue-200" icon={Swords} />
                      <ActionBtn label={actionsT.exchange} onClick={() => handleAction('exchange')} color="bg-green-50 border-green-200" icon={RefreshCw} />
                      <ActionBtn label={actionsT.assassinate} onClick={() => handleAction('assassinate')} disabled={me.coins < 3} color="bg-gray-800 border-black text-white" icon={Skull} />
                      <button onClick={() => handleAction('coup')} disabled={me.coins < 7} className={`col-span-3 sm:col-span-2 p-3 flex items-center justify-center gap-2 ${BUTTON_PRIMARY} !bg-[#9e1316] hover:!bg-[#1A1F26]`}>
                        <AlertTriangle className="w-4 h-4" /> {actionsT.coup}
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXCHANGE — keep as many as you have lives, the rest go back */}
      {isExchanging && gameState.exchangeBuffer && (
        <div role="dialog" aria-modal="true" aria-label={t.exchange} className={DIALOG_OVERLAY}>
          <div className={`${DIALOG_PANEL} max-w-2xl flex flex-col items-center`}>
            <div className={`${LABEL} mb-1`}>{t.exchange}</div>
            <p className="text-sm font-medium text-[#8A9099] mb-6 text-center">{t.exchangeHint}</p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8">
              {gameState.exchangeBuffer.map((role, i) => (
                <div key={i} className={`relative transition-all duration-300 ${selectedExchangeIndices.includes(i) ? 'ring-4 ring-[#1A1F26] rounded-2xl scale-105 z-10 shadow-xl' : 'opacity-80 hover:opacity-100'}`}>
                  <RoleCard role={role} revealed={false} isMe={true} lang={lang} onClick={() => handleExchangeToggle(i)} />
                  {selectedExchangeIndices.includes(i) && (
                    <div className="absolute -top-2 -right-2 bg-[#1A1F26] text-white rounded-full p-1 shadow-lg">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => resolveExchange(selectedExchangeIndices)}
              disabled={selectedExchangeIndices.length !== (me?.cards.filter(c => !c.revealed).length)}
              className={`w-full max-w-xs py-3.5 ${BUTTON_PRIMARY}`}
            >
              {t.confirm} ({selectedExchangeIndices.length}/{me?.cards.filter(c => !c.revealed).length})
            </button>
          </div>
        </div>
      )}

      <ResultDialog
        lang={lang}
        open={isFinished && !resultHidden}
        onHide={() => setResultHidden(true)}
        won={iWon}
        title={iWon ? t.youWin : t.winner}
        winners={winnerPlayer
          ? [{ id: winnerPlayer.id, name: winnerPlayer.name, avatarUrl: winnerPlayer.avatarUrl || defaultAvatar(winnerPlayer.id) }]
          : gameState.winner ? [{ id: 'winner', name: gameState.winner }] : []}
        gameId="coup"
        parentState={gameState}
        onMenu={leaveGame}
      />
    </div>
  );
}
