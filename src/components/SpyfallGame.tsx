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
  CheckCircle2, XCircle, Siren, ThumbsUp, ThumbsDown, Shield, Star
} from 'lucide-react';
import GameHeader from './GameHeader';
import RematchButton from './RematchButton';
import GameNotificationToast from './GameNotificationToast';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import { playSfx } from '@/lib/sound';
import { useEscape } from '@/hooks/useEscape';

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
    spyWins: 'ПОБЕДА ШПИОНА',
    localsWin: 'ПОБЕДА МИРНЫХ',
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
    spyWins: 'SPY WINS',
    localsWin: 'LOCALS WIN',
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

  // Helper for image fallback
  if (gameState.status === 'finished') {
      const spyPlayer = gameState.players.find(p => p.isSpy);
      const actualLocation = getLocationData(gameState.currentLocationId || '');
      const winReason = t.reasons[gameState.winReason as keyof typeof t.reasons] || gameState.winReason;
      const isSpyWin = gameState.winner === 'spy';

      return (
          <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#F8FAFC] font-sans relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none" />

              <div className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl border border-[#E6E1DC] text-center max-w-lg w-full animate-in zoom-in-95 relative z-10 flex flex-col gap-8">
                  <div className="relative">
                      <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3 ${isSpyWin ? 'bg-[#1A1F26] text-[#9e1316]' : 'bg-emerald-100 text-emerald-600'}`}>
                          {isSpyWin ? <Fingerprint className="w-12 h-12" /> : <Shield className="w-12 h-12" />}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black uppercase text-[#1A1F26] mb-2 tracking-tighter leading-none">
                          {isSpyWin ? t.spyWins : t.localsWin}
                      </h2>
                      <div className="inline-block bg-[#F8FAFC] border border-[#E6E1DC] px-4 py-1.5 rounded-full text-xs font-bold text-[#8A9099] uppercase tracking-widest">
                          {winReason}
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E6E1DC] flex flex-col items-center gap-2 group">
                          <span className="text-2xs font-black text-[#8A9099] uppercase tracking-widest">{t.loc}</span>
                          <div className="w-full h-20 rounded-xl overflow-hidden relative">
                              {actualLocation ? (
                                  <LocationArt locationId={actualLocation.id} className="group-hover:scale-110 transition-transform duration-500" />
                              ) : (
                                  <div className="w-full h-full bg-gray-200 flex items-center justify-center"><Map className="w-6 h-6 text-gray-400" /></div>
                              )}
                          </div>
                          <span className="font-black text-[#1A1F26] leading-none mt-1">{actualLocation?.name[lang]}</span>
                      </div>
                      <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E6E1DC] flex flex-col items-center gap-2">
                          <span className="text-2xs font-black text-[#8A9099] uppercase tracking-widest">{t.spy}</span>
                          <div className="w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden">
                              <Image src={spyPlayer?.avatarUrl || "/logo512.png"} alt="" width={80} height={80} className="w-full h-full object-cover" />
                          </div>
                          <span className="font-black text-[#9e1316] leading-none mt-1">{spyPlayer?.name || t.unknown}</span>
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={leaveGame} className="flex-1 py-4 bg-white border border-[#E6E1DC] rounded-2xl font-bold uppercase text-xs hover:bg-[#F8FAFC] hover:border-gray-300 transition-all text-[#8A9099] hover:text-[#1A1F26]">
                          {t.leave}
                      </button>
                      {/* Anyone may start it, not just the host — the host is
                          often the first to walk away from a finished round. */}
                      <RematchButton
                        gameId="spyfall"
                        parentState={gameState}
                        lang={lang}
                        className="flex-[2] py-4 bg-[#1A1F26] text-white rounded-2xl font-black uppercase text-xs hover:bg-[#9e1316] transition-all shadow-xl hover:shadow-[#9e1316]/20"
                      />
                  </div>
              </div>
          </div>
      );
  }

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

  return (
    // Bottom padding is room for the chat button: on a phone the players'
    // "accuse" buttons are the last thing on the page.
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#1A1F26] relative overflow-hidden flex flex-col pb-24">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none fixed" />

        {/* These were written into game_state and never rendered — a player
            leaving mid-round happened silently. */}
        <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

        <GameRulesModal
          isOpen={showRules}
          onClose={() => setShowRules(false)}
          rules={GAME_RULES[lang as 'ru' | 'en'].spyfall}
          themeColor="text-[#9e1316]"
        />

        <GameHeader
            title="Spyfall"
            icon={Fingerprint}
            timeLeft={timeLeft}
            showTime={true}
            onLeave={leaveGame}
            onShowRules={() => setShowRules(true)}
            lang={lang}
            accentColor="text-[#9e1316]"
        />

        <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 lg:gap-8 z-10">

            {/* ROLE CARD SECTION */}
            <div className="w-full">
                <div className="relative group perspective-1000 max-w-lg mx-auto">
                    <div className="bg-white rounded-[32px] p-6 md:p-10 shadow-xl border border-[#E6E1DC] relative overflow-hidden transition-all duration-500">
                        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay" />

                        <div className="relative z-10 text-center flex flex-col items-center min-h-[160px] justify-center">
                            <div className="text-2xs font-black text-[#8A9099] uppercase tracking-[0.3em] mb-4 flex items-center gap-2 border border-[#E6E1DC] px-3 py-1 rounded-full">
                                <Fingerprint className="w-3 h-3" /> {t.roleTitle}
                            </div>

                            <div className={`transition-all duration-500 transform ${showRole ? 'blur-0 opacity-100 translate-y-0' : 'blur-md opacity-0 translate-y-4 pointer-events-none'}`}>
                                {me?.isSpy ? (
                                    <>
                                        <h2 className="text-4xl md:text-5xl font-black text-[#9e1316] uppercase tracking-tighter mb-4 drop-shadow-sm">{t.youAreSpy}</h2>
                                        <p className="text-sm font-bold text-[#1A1F26] bg-red-50 py-2 px-6 rounded-2xl inline-block border border-red-100">{t.spyTask}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-1 rounded-full bg-emerald-500 mb-4 mx-auto" />
                                        <h2 className="text-3xl md:text-4xl font-black text-[#1A1F26] uppercase mb-2 tracking-tight leading-tight">{getLocationData(gameState.currentLocationId || '')?.name[lang]}</h2>
                                        <div className="inline-block bg-emerald-50 text-emerald-800 px-4 py-1 rounded-lg text-sm font-black uppercase tracking-wider mt-2 border border-emerald-100">
                                            {getRoleName(me?.role || '')}
                                        </div>
                                    </>
                                )}
                            </div>

                            {!showRole && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-500">
                                    <div className="w-20 h-20 bg-[#1A1F26] rounded-full flex items-center justify-center mb-4 shadow-lg">
                                        <Target className="w-10 h-10 text-white" />
                                    </div>
                                    <div className="text-sm font-black text-[#1A1F26] uppercase tracking-widest">Top Secret</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => setShowRole(!showRole)}
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-8 py-3 bg-[#1A1F26] text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-[#9e1316] transition-all shadow-xl active:scale-95 select-none"
                    >
                        {showRole ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {showRole ? t.hide : t.reveal}
                    </button>
                </div>
            </div>

            {/* CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">

                {/* LOCATIONS LIST */}
                <div className="lg:col-span-8 bg-white rounded-[32px] p-6 border border-[#E6E1DC] shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-[#8A9099] uppercase tracking-widest flex items-center gap-2">
                            <Map className="w-4 h-4 text-[#1A1F26]" /> {t.locations}
                        </h3>
                        {me?.isSpy && (
                            <button
                                onClick={() => setShowGuessModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#9e1316] text-white rounded-xl font-bold uppercase text-2xs tracking-widest hover:bg-[#7a0f11] transition-all shadow-md animate-pulse"
                            >
                                <Target className="w-3 h-3" /> {t.guessLoc}
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {activeLocations.map(loc => (
                            <button
                                key={loc.id}
                                onClick={() => toggleCross(loc.id)}
                                className={`
                                    relative rounded-xl overflow-hidden aspect-[16/10] group transition-all duration-300 border border-[#E6E1DC]
                                    ${crossedOut.includes(loc.id) ? 'opacity-40 grayscale scale-95' : 'hover:shadow-lg hover:scale-[1.02]'}
                                `}
                            >
                                <LocationArt locationId={loc.id} className="transition-transform duration-700 group-hover:scale-110" />

                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                                <div className="absolute inset-0 flex items-center justify-center p-2">
                                    <span className="text-white text-shadow text-center text-xs md:text-sm font-bold uppercase tracking-wide leading-tight drop-shadow-md relative z-10">{loc.name[lang]}</span>
                                </div>

                                {crossedOut.includes(loc.id) && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 backdrop-blur-[1px] bg-white/10">
                                        <div className="w-[80%] h-1 bg-[#9e1316] rotate-[-15deg] shadow-sm rounded-full" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* PLAYERS LIST */}
                <div className="lg:col-span-4 bg-white rounded-[32px] p-6 border border-[#E6E1DC] shadow-sm flex flex-col h-full">
                    <h3 className="text-xs font-black text-[#8A9099] uppercase tracking-widest mb-6 flex items-center gap-2">
                        <User className="w-4 h-4 text-[#1A1F26]" /> {t.players}
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[400px] lg:max-h-none">
                        {gameState.players.map(p => {
                            const isMe = p.id === userId;
                            const alreadyNominated = p.id !== userId && gameState.players.find(me => me.id === userId)?.hasNominated;

                            return (
                                <div key={p.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all group ${isMe ? 'bg-[#F8FAFC] border-[#E6E1DC]' : 'bg-white border-[#E6E1DC] hover:border-[#1A1F26] hover:shadow-md'}`}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="relative shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white shadow-sm overflow-hidden">
                                                <Image src={p.avatarUrl} alt="" width={80} height={80} className="w-full h-full object-cover" />
                                            </div>
                                            {p.isHost && <div className="absolute -top-1 -right-1 bg-[#FBBF24] p-0.5 rounded-full border border-white shadow-sm"><Crown className="w-2.5 h-2.5 text-white" /></div>}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className={`text-sm font-bold truncate ${isMe ? 'text-[#9e1316]' : 'text-[#1A1F26]'}`}>
                                                {p.name} {isMe && '(Вы)'}
                                            </span>
                                            <span className="text-3xs font-bold text-[#8A9099] flex items-center gap-1">
                                                <Star className="w-3 h-3 fill-current text-[#9e1316]"/> {p.score}
                                            </span>
                                        </div>
                                    </div>

                                    {/* VOTE BUTTON */}
                                    {!isMe && gameState.status === 'playing' && !alreadyNominated && (
                                        <button
                                            onClick={() => setAccuseTarget(p.id)}
                                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-3 py-1.5 bg-[#1A1F26] text-white rounded-lg text-2xs font-bold uppercase hover:bg-[#9e1316] transition-all shadow-md active:scale-95 shrink-0"
                                        >
                                            {t.accuse}
                                        </button>
                                    )}
                                    {alreadyNominated && !isMe && (
                                        <span className="text-2xs font-bold text-[#E6E1DC] uppercase tracking-wider shrink-0">-</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </main>

        {/* GUESS LOCATION MODAL */}
        {showGuessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md animate-in fade-in" onClick={() => setShowGuessModal(false)}>
                <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 border border-[#E6E1DC] flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="p-6 border-b border-[#F1F5F9] flex justify-between items-center bg-white sticky top-0 z-10">
                        <h3 className="font-black text-lg text-[#1A1F26] uppercase flex items-center gap-2"><Target className="w-5 h-5 text-[#9e1316]"/> {t.guessTitle}</h3>
                        <button onClick={() => setShowGuessModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircle className="w-6 h-6 text-gray-400" /></button>
                    </div>
                    <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 custom-scrollbar bg-[#F8FAFC]">
                        {activeLocations.map(loc => (
                            <button
                                key={loc.id}
                                onClick={() => handleSpyGuess(loc.id)}
                                className="relative p-4 rounded-xl border border-[#E6E1DC] font-bold text-sm text-white hover:scale-[1.02] transition-all text-center overflow-hidden h-24 flex items-center justify-center shadow-sm group bg-[#1A1F26]"
                            >
                                <LocationArt locationId={loc.id} className="opacity-60 group-hover:opacity-40 transition-opacity" />
                                <span className="relative z-10 text-shadow uppercase tracking-wide">{loc.name[lang]}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* ACCUSE CONFIRMATION MODAL */}
        {accuseTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md animate-in fade-in" onClick={() => setAccuseTarget(null)}>
                <div className="bg-white p-8 rounded-[32px] max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 border border-[#E6E1DC]" onClick={(e) => e.stopPropagation()}>
                    <div className="w-16 h-16 bg-red-50 text-[#9e1316] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
                        <Siren className="w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-black text-[#1A1F26] uppercase mb-2">{t.confirmAccuse}</h3>
                    <p className="text-xs font-bold text-[#8A9099] mb-8">{t.confirmDesc}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setAccuseTarget(null)} className="flex-1 py-3 bg-[#F8FAFC] text-[#1A1F26] border border-[#E6E1DC] rounded-xl font-bold uppercase text-xs hover:bg-[#E6E1DC] transition-colors">{t.cancel}</button>
                        <button onClick={handleConfirmAccuse} className="flex-1 py-3 bg-[#1A1F26] text-white rounded-xl font-bold uppercase text-xs hover:bg-[#9e1316] transition-colors shadow-lg">{t.confirm}</button>
                    </div>
                </div>
            </div>
        )}

        {/* VOTING MODAL (Small & Stylish) */}
        {gameState.status === 'voting' && gameState.nomination && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-md animate-in fade-in">
                <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl border border-[#E6E1DC] p-6 text-center animate-in zoom-in-95">
                    <div className="w-14 h-14 bg-red-50 text-[#9e1316] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                        <Siren className="w-7 h-7 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-black text-[#1A1F26] uppercase mb-1">{t.voteTitle}</h3>
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
                        <div className="py-4 bg-[#F0FDF4] rounded-xl border border-green-100 text-emerald-600 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4"/> {t.waitingVote}
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button onClick={() => vote(false)} className="flex-1 py-3 bg-[#F8FAFC] hover:bg-[#E6E1DC] text-[#1A1F26] rounded-xl font-bold uppercase text-xs transition-colors border border-[#E6E1DC] flex flex-col items-center gap-1">
                                <ThumbsDown className="w-5 h-5" /> {t.voteNo}
                            </button>
                            <button onClick={() => vote(true)} className="flex-1 py-3 bg-[#9e1316] hover:bg-[#7a0f11] text-white rounded-xl font-bold uppercase text-xs transition-colors shadow-lg shadow-[#9e1316]/20 flex flex-col items-center gap-1">
                                <ThumbsUp className="w-5 h-5" /> {t.voteYes}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}