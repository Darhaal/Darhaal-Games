'use client';

import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { SpyfallState } from '@/types/spyfall';
import { VOTE_DURATION_SECONDS } from '@/hooks/useSpyfallGame';
import { SPYFALL_PACKS, getAllLocations } from '@/data/spyfall/locations';
import LocationArt from '@/components/spyfall/LocationArt';
import {
  Clock, Eye, EyeOff, User, Map,
  Play, Crown, Target, Fingerprint,
  CheckCircle2, XCircle, Siren, ThumbsUp, ThumbsDown, Star
} from 'lucide-react';
import GameHeader from './GameHeader';
import { requireGame } from '@/games/registry';
import GameNotificationToast from './GameNotificationToast';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import { playSfx } from '@/lib/sound';
import { useEscape } from '@/hooks/useEscape';
import GameLayout from './game/GameLayout';
import GameCard from './game/GameCard';
import TurnCard from './game/TurnCard';
import PlayersCard from './game/PlayersCard';
import ResultDialog from './game/ResultDialog';
import {
  BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, DIALOG_OVERLAY, DIALOG_PANEL, GAME_PAGE, LABEL
} from './game/ui';

interface SpyfallGameProps {
  gameState: SpyfallState;
  userId: string;
  startGame: () => void;
  endGame: (winner: 'spy' | 'locals', reason: string) => void;
  leaveGame: () => void;
  startNomination: (targetId: string) => void;
  resolveVoteTimeout: () => void;
  vote: (agree: boolean) => void;
  lang: 'ru' | 'en';
}

const UI_TEXT = {
  ru: {
    waiting: 'Ожидание игроков...',
    minPlayers: 'Нужно 3+ игрока',
    start: 'Начать миссию',
    roleTitle: 'ВАША РОЛЬ',
    youAreSpy: 'ВЫ ШПИОН',
    spyTask: 'Не выдайте себя. Ваша задача — угадать текущую локацию.',
    youAreLocal: 'МИРНЫЙ ЖИТЕЛЬ',
    localTask: 'Вычислите шпиона среди игроков.',
    locations: 'Локации',
    timeLeft: 'Таймер',
    reveal: 'Показать',
    hide: 'Скрыть',
    spyWins: 'Победа шпиона',
    localsWin: 'Победа мирных',
    round: 'Раунд',
    roundClock: 'раунд',
    spyShort: 'Вы шпион',
    localShort: 'Вы мирный житель',
    spyHint: 'Слушайте вопросы и угадайте локацию, пока вас не вычислили',
    localHint: 'Задавайте вопросы и найдите шпиона. Обвинить можно в списке игроков',
    secret: 'Совершенно секретно',
    playAgain: 'Новый раунд',
    leave: 'Покинуть',
    players: 'Игроки',
    accuse: 'Обвинить',
    guessLoc: 'Назвать локацию',
    guessTitle: 'Где мы находимся?',
    confirmAccuse: 'Начать голосование?',
    confirmDesc: 'Требуется единогласное решение всех игроков, кроме обвиняемого.',
    voteTitle: 'ГОЛОСОВАНИЕ',
    voteDesc: 'подозревается в шпионаже',
    voteYes: 'Шпион!',
    voteNo: 'Мирный',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    waitingVote: 'Ожидание голосов...',
    rulesTitle: 'Правила игры',
    branding: 'Darhaal',
    pro: 'Spyfall',
    reasons: {
        time: 'Время истекло (Шпион победил)',
        guessed_loc: 'Шпион верно назвал локацию',
        spy_failed_guess: 'Шпион ошибся с локацией',
        spy_caught: 'Шпион был раскрыт на голосовании',
        innocent_killed: 'Мирные ошиблись и казнили своего',
        spy_left: 'Шпион сбежал с места'
    },
    unknown: 'Неизвестно',
    spy: 'Шпион',
    loc: 'Локация',
    score: 'Очки'
  },
  en: {
    waiting: 'Waiting for players...',
    minPlayers: 'Need 3+ players',
    start: 'Start Mission',
    roleTitle: 'YOUR ROLE',
    youAreSpy: 'YOU ARE THE SPY',
    spyTask: 'Blend in. Figure out the current location.',
    youAreLocal: 'LOCAL CITIZEN',
    localTask: 'Find the spy among the players.',
    locations: 'Locations',
    timeLeft: 'Timer',
    reveal: 'Reveal',
    hide: 'Hide',
    spyWins: 'The spy wins',
    localsWin: 'The locals win',
    round: 'Round',
    roundClock: 'round',
    spyShort: 'You are the spy',
    localShort: 'You are a local',
    spyHint: 'Listen to the questions and guess the location before you are found out',
    localHint: 'Ask questions and find the spy. Accuse from the player list',
    secret: 'Top secret',
    playAgain: 'New Round',
    leave: 'Leave',
    players: 'Players',
    accuse: 'Accuse',
    guessLoc: 'Guess Location',
    guessTitle: 'Where are we?',
    confirmAccuse: 'Start voting?',
    confirmDesc: 'Unanimous decision required from all other players.',
    voteTitle: 'VOTING',
    voteDesc: 'is suspected of being the spy',
    voteYes: 'Spy!',
    voteNo: 'Innocent',
    cancel: 'Cancel',
    confirm: 'Confirm',
    waitingVote: 'Waiting for votes...',
    rulesTitle: 'Game Rules',
    branding: 'Darhaal',
    pro: 'Spyfall',
    reasons: {
        time: 'Time is up (Spy wins)',
        guessed_loc: 'Spy correctly identified location',
        spy_failed_guess: 'Spy guessed wrong',
        spy_caught: 'Spy caught by vote',
        innocent_killed: 'Innocent player executed',
        spy_left: 'Spy disconnected'
    },
    unknown: 'Unknown',
    spy: 'Spy',
    loc: 'Location',
    score: 'Score'
  }
};

export default function SpyfallGame({ gameState, userId, startGame, endGame, leaveGame, startNomination, vote, resolveVoteTimeout, lang }: SpyfallGameProps) {
  const t = UI_TEXT[lang];
  const me = gameState.players.find(p => p.id === userId);
  const isHost = me?.isHost;

  const [showRole, setShowRole] = useState(true);
  const [timeLeft, setTimeLeft] = useState(gameState.settings.roundDuration);
  const [crossedOut, setCrossedOut] = useState<string[]>([]);
  const [voteTimeLeft, setVoteTimeLeft] = useState(VOTE_DURATION_SECONDS);
  const [showRules, setShowRules] = useState(false);
  // The result can be put aside to look at the table, and brought back.
  const [resultHidden, setResultHidden] = useState(false);

  const [showGuessModal, setShowGuessModal] = useState(false);
  const [accuseTarget, setAccuseTarget] = useState<string | null>(null);

  // Escape closes dismissible overlays (voting is mandatory and stays)
  useEscape(showGuessModal, () => setShowGuessModal(false));
  useEscape(!!accuseTarget, () => setAccuseTarget(null));

  const getLocationData = (id: string) => {
      const allLocs = getAllLocations();
      return allLocs.find(l => l.id === id);
  };

  const getActiveLocations = () => {
      if (gameState.locationList && gameState.locationList.length > 0) {
          const allLocs = getAllLocations();
          return allLocs.filter(l => gameState.locationList.includes(l.id));
      }
      return SPYFALL_PACKS[0].locations;
  };

  const activeLocations = getActiveLocations();

  useEffect(() => {
    // The round timer only runs while playing — it freezes during voting
    // (on return from voting, startTime is shifted by the pause duration, see vote())
    if (gameState.status !== 'playing') return;
    const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
        const remaining = Math.max(0, gameState.settings.roundDuration - elapsed);
        setTimeLeft(remaining);
        if (remaining === 0) {
            // One primary writer — the host; everyone else backs up after 5s
            const overdueMs = Date.now() - (gameState.startTime + gameState.settings.roundDuration * 1000);
            if (isHost || overdueMs > 5000) {
                endGame('spy', 'time');
                clearInterval(interval);
            }
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.status, gameState.startTime, gameState.settings.roundDuration, endGame, isHost]);

  // A vote that nobody finishes used to freeze the room: the round clock is
  // stopped while voting, the in-game screen has no auto-kick, and conviction
  // needs a ballot from every other player. The host drives this, with everyone
  // else backing up five seconds later in case the host is the one who left.
  useEffect(() => {
    if (gameState.status !== 'voting' || !gameState.nomination) return;
    const deadline = gameState.nomination.startTime + VOTE_DURATION_SECONDS * 1000;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setVoteTimeLeft(remaining);
      if (remaining === 0 && (isHost || Date.now() - deadline > 5000)) {
        resolveVoteTimeout();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.status, gameState.nomination, isHost, resolveVoteTimeout]);

  // Round outcome sound: my side won or lost
  useEffect(() => {
      if (gameState.status === 'finished' && gameState.winner && me) {
          const iWon = (gameState.winner === 'spy' && me.isSpy) || (gameState.winner === 'locals' && !me.isSpy);
          playSfx(iWon ? 'win' : 'lose');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- play the sting once per outcome; adding `me` would replay it whenever the player object is rebuilt
  }, [gameState.status, gameState.winner]);

  const toggleCross = (id: string) => {
      if (crossedOut.includes(id)) setCrossedOut(prev => prev.filter(c => c !== id));
      else setCrossedOut(prev => [...prev, id]);
  };

  const getRoleName = (jsonRole: string | null) => {
      if (!jsonRole) return '';
      try {
          const roleObj = JSON.parse(jsonRole);
          return roleObj[lang] || roleObj['en'];
      } catch { return jsonRole; }
  };

  const handleSpyGuess = (locationId: string) => {
      if (locationId === gameState.currentLocationId) {
          endGame('spy', 'guessed_loc');
      } else {
          endGame('locals', 'spy_failed_guess');
      }
      setShowGuessModal(false);
  };

  const handleConfirmAccuse = () => {
      if (accuseTarget) {
          startNomination(accuseTarget);
          setAccuseTarget(null);
      }
  };

  // --- WAITING LOBBY ---
  if (gameState.status === 'waiting') {
      return (
          <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none" />

              <div className="text-center mb-12 relative z-10">
                  <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-[#E6E1DC] shadow-sm mb-4">
                      <Fingerprint className="w-4 h-4 text-[#9e1316]" />
                      <span className="text-2xs font-black text-[#1A1F26] uppercase tracking-[0.2em]">{t.branding}</span>
                  </div>
                  <h1 className="text-6xl md:text-8xl font-black text-[#1A1F26] tracking-tighter leading-none mb-4">{t.pro}</h1>
                  <p className="text-[#8A9099] font-bold text-xs uppercase tracking-[0.3em]">{t.waiting}</p>
              </div>

              <div className="flex flex-wrap justify-center gap-6 max-w-4xl mb-16 relative z-10">
                  {gameState.players.map(p => (
                      <div key={p.id} className="flex flex-col items-center group animate-in zoom-in duration-300">
                          <div className="w-20 h-20 rounded-[24px] bg-white border-4 border-white shadow-lg overflow-hidden relative group-hover:scale-105 transition-transform duration-300">
                              <Image src={p.avatarUrl} alt="" width={80} height={80} className="w-full h-full object-cover" />
                              {p.isHost && (
                                  <div className="absolute top-0 right-0 bg-[#FBBF24] p-1.5 rounded-bl-xl shadow-sm">
                                      <Crown className="w-3 h-3 text-white" />
                                  </div>
                              )}
                          </div>
                          <div className="mt-3 flex flex-col items-center">
                              <span className="text-xs font-black text-[#1A1F26] bg-white px-3 py-1.5 rounded-full border border-[#E6E1DC] shadow-sm tracking-wide">{p.name}</span>
                              <span className="text-3xs font-bold text-[#9e1316] mt-1 flex items-center gap-1"><Star className="w-3 h-3 fill-current"/> {p.score || 0}</span>
                          </div>
                      </div>
                  ))}
                  {Array.from({ length: Math.max(0, 3 - gameState.players.length) }).map((_, i) => (
                      <div key={i} className="w-20 h-20 rounded-[24px] border-2 border-dashed border-[#E6E1DC] flex items-center justify-center bg-transparent opacity-50">
                          <User className="w-8 h-8 text-[#E6E1DC]" />
                      </div>
                  ))}
              </div>

              <div className="flex gap-4 relative z-10 w-full max-w-md">
                  <button onClick={leaveGame} className="flex-1 py-4 bg-white border border-[#E6E1DC] rounded-2xl font-bold uppercase text-xs hover:bg-[#F8FAFC] hover:text-[#9e1316] transition-colors">
                      {t.leave}
                  </button>
                  {isHost ? (
                      <button
                          onClick={startGame}
                          disabled={gameState.players.length < 3}
                          className="flex-[2] py-4 bg-[#1A1F26] text-white rounded-2xl font-black uppercase text-xs hover:bg-[#9e1316] transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                          <Play className="w-4 h-4" /> {t.start}
                      </button>
                  ) : (
                      <div className="flex-[2] py-4 bg-[#E6E1DC]/30 border border-[#E6E1DC] text-[#8A9099] rounded-2xl font-bold uppercase text-xs flex items-center justify-center gap-2">
                          <Clock className="w-4 h-4 animate-spin" /> {t.waiting}
                      </div>
                  )}
              </div>
          </div>
      );
  }

  const isFinished = gameState.status === 'finished';
  const spyPlayer = gameState.players.find(p => p.isSpy);
  const actualLocation = getLocationData(gameState.currentLocationId || '');
  const isSpyWin = gameState.winner === 'spy';
  const iWon = !!me && ((isSpyWin && me.isSpy) || (!isSpyWin && !me.isSpy));
  const winReason = t.reasons[gameState.winReason as keyof typeof t.reasons] || gameState.winReason;
  const winners = gameState.players.filter(p => isSpyWin ? p.isSpy : !p.isSpy);
  const alreadyNominated = !!me?.hasNominated;

  return (
    <div className={GAME_PAGE}>
        {/* These were written into game_state and never rendered — a player
            leaving mid-round happened silently. */}
        <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

        <GameRulesModal
          isOpen={showRules}
          onClose={() => setShowRules(false)}
          rules={GAME_RULES[lang as 'ru' | 'en'].spyfall}
        />

        <GameHeader
            title={requireGame('spyfall').name[lang]}
            icon={Fingerprint}
            timeLeft={timeLeft}
            showTime={gameState.status === 'playing'}
            timeCaption={t.roundClock}
            onLeave={leaveGame}
            onShowRules={() => setShowRules(true)}
            lang={lang}
        />

        <GameLayout
            boardWidth={760}
            board={
                <div className="space-y-6">
                    {/* ROLE — the one secret each player holds */}
                    <div className="relative pb-6">
                        <div className={`${CARD} p-6 md:p-8 text-center`}>
                            <div className={`${LABEL} mb-4 inline-flex items-center gap-2`}>
                                <Fingerprint className="w-3.5 h-3.5" /> {t.roleTitle}
                            </div>

                            <div className="relative min-h-[112px] flex items-center justify-center">
                                <div className={`transition-all duration-500 ${showRole ? 'blur-0 opacity-100' : 'blur-md opacity-0 pointer-events-none'}`}>
                                    {me?.isSpy ? (
                                        <>
                                            <h2 className="text-3xl md:text-4xl font-black text-[#9e1316] tracking-tight mb-3">{t.youAreSpy}</h2>
                                            <p className="text-sm font-medium text-[#1A1F26] bg-red-50 py-2 px-4 rounded-xl inline-block border border-red-100">{t.spyTask}</p>
                                        </>
                                    ) : (
                                        <>
                                            <h2 className="text-3xl md:text-4xl font-black text-[#1A1F26] tracking-tight leading-tight">{getLocationData(gameState.currentLocationId || '')?.name[lang]}</h2>
                                            <div className="inline-block bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg text-sm font-bold mt-3 border border-emerald-100">
                                                {getRoleName(me?.role || '')}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {!showRole && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <div className="w-14 h-14 bg-[#1A1F26] rounded-2xl flex items-center justify-center mb-3">
                                            <Target className="w-7 h-7 text-white" />
                                        </div>
                                        <div className={LABEL}>{t.secret}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowRole(!showRole)}
                            className={`absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 ${BUTTON_PRIMARY} shadow-lg`}
                        >
                            {showRole ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {showRole ? t.hide : t.reveal}
                        </button>
                    </div>

                    {/* LOCATIONS — cross them out as you rule them in or out */}
                    <GameCard
                        label={<span className="inline-flex items-center gap-2"><Map className="w-3.5 h-3.5" /> {t.locations}</span>}
                        aside={me?.isSpy && gameState.status === 'playing' ? (
                            <button onClick={() => setShowGuessModal(true)} className={`flex items-center gap-2 px-3.5 py-2 ${BUTTON_PRIMARY} !bg-[#9e1316] hover:!bg-[#1A1F26]`}>
                                <Target className="w-3.5 h-3.5" /> {t.guessLoc}
                            </button>
                        ) : undefined}
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {activeLocations.map(loc => (
                                <button
                                    key={loc.id}
                                    onClick={() => toggleCross(loc.id)}
                                    className={`relative rounded-xl overflow-hidden aspect-[16/10] group transition-all duration-300 border border-[#E6E1DC] bg-[#1A1F26] ${
                                        crossedOut.includes(loc.id) ? 'opacity-40 grayscale scale-95' : 'hover:shadow-md hover:-translate-y-0.5'
                                    }`}
                                >
                                    <LocationArt locationId={loc.id} className="transition-transform duration-700 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/25 transition-colors" />
                                    <div className="absolute inset-0 flex items-center justify-center p-2">
                                        <span className="text-white text-center text-xs md:text-sm font-bold uppercase tracking-wide leading-tight drop-shadow-md">{loc.name[lang]}</span>
                                    </div>
                                    {crossedOut.includes(loc.id) && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-[80%] h-1 bg-[#9e1316] -rotate-[15deg] rounded-full" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </GameCard>
                </div>
            }
            side={
                <>
                    <TurnCard
                        lang={lang}
                        label={t.round}
                        title={me?.isSpy ? t.spyShort : t.localShort}
                        hint={me?.isSpy ? t.spyHint : t.localHint}
                        secondsLeft={gameState.status === 'playing' ? timeLeft : undefined}
                        turnSeconds={gameState.settings.roundDuration}
                        result={isFinished ? {
                            won: iWon,
                            title: isSpyWin ? t.spyWins : t.localsWin,
                            detail: winReason,
                            hidden: resultHidden,
                            onShow: () => setResultHidden(false)
                        } : undefined}
                    />

                    <PlayersCard
                        lang={lang}
                        rows={gameState.players.map(p => ({
                            id: p.id,
                            name: p.name,
                            avatarUrl: p.avatarUrl,
                            isHost: p.isHost,
                            isMe: p.id === userId,
                            won: isFinished && winners.some(w => w.id === p.id),
                            stat: (
                                <span className="flex items-center gap-1 tabular-nums">
                                    <Star className="w-3 h-3 fill-current text-[#9e1316]" /> {p.score || 0}
                                </span>
                            ),
                            aside: p.id !== userId && gameState.status === 'playing' && !alreadyNominated ? (
                                <button onClick={() => setAccuseTarget(p.id)} className={`px-2.5 py-1.5 ${BUTTON_SECONDARY} !text-2xs`}>
                                    {t.accuse}
                                </button>
                            ) : undefined
                        }))}
                    />
                </>
            }
        />

        {/* GUESS LOCATION */}
        {showGuessModal && (
            <div role="dialog" aria-modal="true" aria-label={t.guessTitle} className={DIALOG_OVERLAY} onClick={() => setShowGuessModal(false)}>
                <div className={`${DIALOG_PANEL} max-w-2xl !p-0 overflow-hidden flex flex-col max-h-[80vh]`} onClick={(e) => e.stopPropagation()}>
                    <div className="px-6 py-4 border-b border-[#F1F5F9] flex justify-between items-center">
                        <h3 className="font-black text-lg text-[#1A1F26] flex items-center gap-2"><Target className="w-5 h-5 text-[#9e1316]"/> {t.guessTitle}</h3>
                        <button onClick={() => setShowGuessModal(false)} className="p-2 hover:bg-[#F8FAFC] rounded-full transition-colors" aria-label={t.cancel}><XCircle className="w-5 h-5 text-[#8A9099]" /></button>
                    </div>
                    <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 custom-scrollbar bg-[#F8FAFC]">
                        {activeLocations.map(loc => (
                            <button
                                key={loc.id}
                                onClick={() => handleSpyGuess(loc.id)}
                                className="relative rounded-xl border border-[#E6E1DC] font-bold text-sm text-white hover:-translate-y-0.5 hover:shadow-md transition-all text-center overflow-hidden h-24 flex items-center justify-center group bg-[#1A1F26]"
                            >
                                <LocationArt locationId={loc.id} className="opacity-60 group-hover:opacity-40 transition-opacity" />
                                <span className="relative z-10 uppercase tracking-wide drop-shadow-md">{loc.name[lang]}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* ACCUSE — confirm before calling a vote */}
        {accuseTarget && (
            <div role="dialog" aria-modal="true" aria-label={t.confirmAccuse} className={DIALOG_OVERLAY} onClick={() => setAccuseTarget(null)}>
                <div className={`${DIALOG_PANEL} max-w-sm text-center`} onClick={(e) => e.stopPropagation()}>
                    <div className="w-14 h-14 bg-red-50 text-[#9e1316] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                        <Siren className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-black text-[#1A1F26] mb-1">{t.confirmAccuse}</h3>
                    <p className="text-sm font-medium text-[#8A9099] mb-6 leading-snug">{t.confirmDesc}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setAccuseTarget(null)} className={`flex-1 py-3 ${BUTTON_SECONDARY}`}>{t.cancel}</button>
                        <button onClick={handleConfirmAccuse} className={`flex-1 py-3 ${BUTTON_PRIMARY}`}>{t.confirm}</button>
                    </div>
                </div>
            </div>
        )}

        {/* VOTE — a required step, so it cannot be dismissed */}
        {gameState.status === 'voting' && gameState.nomination && (
            <div role="dialog" aria-modal="true" aria-label={t.voteTitle} className={DIALOG_OVERLAY}>
                <div className={`${DIALOG_PANEL} max-w-sm text-center`}>
                    <div className="w-14 h-14 bg-red-50 text-[#9e1316] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                        <Siren className="w-7 h-7 animate-pulse" />
                    </div>
                    <div className={`${LABEL} mb-1`}>{t.voteTitle}</div>
                    <div className="text-xs font-black tabular-nums text-[#9e1316] mb-3">{voteTimeLeft}s</div>
                    <p className="text-sm font-medium text-[#8A9099] mb-6 leading-relaxed">
                        <span className="text-[#1A1F26] font-bold">{gameState.players.find(p => p.id === gameState.nomination?.authorId)?.name}</span> {t.accuse.toLowerCase()}<br/>
                        <span className="text-[#9e1316] font-black text-lg block my-1">{gameState.players.find(p => p.id === gameState.nomination?.targetId)?.name}</span>
                        {t.voteDesc}
                    </p>

                    {userId === gameState.nomination.targetId ? (
                        <div className="py-4 bg-[#F8FAFC] rounded-xl border border-[#E6E1DC] text-[#8A9099] text-xs font-bold uppercase tracking-widest animate-pulse">
                            {t.waitingVote}
                        </div>
                    ) : gameState.nomination.votes[userId] !== undefined ? (
                        <div className="py-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4"/> {t.waitingVote}
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button onClick={() => vote(false)} className={`flex-1 py-3 flex flex-col items-center gap-1 ${BUTTON_SECONDARY}`}>
                                <ThumbsDown className="w-5 h-5" /> {t.voteNo}
                            </button>
                            <button onClick={() => vote(true)} className={`flex-1 py-3 flex flex-col items-center gap-1 ${BUTTON_PRIMARY} !bg-[#9e1316] hover:!bg-[#1A1F26]`}>
                                <ThumbsUp className="w-5 h-5" /> {t.voteYes}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        <ResultDialog
            lang={lang}
            open={isFinished && !resultHidden}
            onHide={() => setResultHidden(true)}
            won={iWon}
            title={isSpyWin ? t.spyWins : t.localsWin}
            note={winReason}
            winners={winners.map(w => ({ id: w.id, name: w.name, avatarUrl: w.avatarUrl }))}
            gameId="spyfall"
            parentState={gameState}
            onMenu={leaveGame}
        >
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E6E1DC] flex flex-col items-center gap-2">
                    <span className={LABEL}>{t.loc}</span>
                    <div className="w-full h-16 rounded-lg overflow-hidden relative bg-[#1A1F26]">
                        {actualLocation && <LocationArt locationId={actualLocation.id} />}
                    </div>
                    <span className="font-black text-sm text-[#1A1F26] text-center leading-tight">{actualLocation?.name[lang] ?? t.unknown}</span>
                </div>
                <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E6E1DC] flex flex-col items-center gap-2">
                    <span className={LABEL}>{t.spy}</span>
                    <Image src={spyPlayer?.avatarUrl || '/logo512.png'} alt="" width={64} height={64} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" />
                    <span className="font-black text-sm text-[#9e1316] text-center leading-tight">{spyPlayer?.name || t.unknown}</span>
                </div>
            </div>
        </ResultDialog>
    </div>
  );
}
