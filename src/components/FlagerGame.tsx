'use client';

import Image from 'next/image';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Check, X, Flag, Search, Loader2,
  ArrowRight, Clock, Target
} from 'lucide-react';
import { FlagerState, FlagerPlayerState } from '@/types/flager';
import { COUNTRIES, COUNTRY_CODES, continentName } from '@/data/flager/countries';
import GameHeader from './GameHeader';
import { requireGame } from '@/games/registry';
import GameNotificationToast from './GameNotificationToast';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import { defaultAvatar } from '@/constants/app';
import { playSfx } from '@/lib/sound';
import { FLAGER_BETWEEN_ROUNDS_SECONDS } from '@/lib/gameLogic/flager';
import GameLayout from './game/GameLayout';
import GameCard from './game/GameCard';
import TurnCard from './game/TurnCard';
import PlayersCard from './game/PlayersCard';
import ResultDialog from './game/ResultDialog';
import { BUTTON_PRIMARY, DIALOG_OVERLAY, DIALOG_PANEL, GAME_PAGE, LABEL } from './game/ui';

const UI_TEXT = {
  ru: {
    title: 'FLAGGER',
    pro: 'by Darhaal',
    round: 'Раунд',
    of: 'из',
    time: 'Таймер',
    score: 'Очки',
    accuracy: 'Точность',
    status: 'Статус игроков',
    targetFound: 'Верно!',
    missionFailedShort: 'Ошибка',
    searching: 'Думает...',
    roundOver: 'Раунд завершен',
    results: 'Итоги раунда',
    correctAnswer: 'Это был флаг',
    yourResult: 'Ваш результат',
    success: 'Угадано',
    fail: 'Не угадано',
    accepted: 'Понятно',
    missionFailed: 'Попытки исчерпаны',
    timeUp: 'Время вышло',
    waitingOthers: 'Ждем остальных...',
    inputPlaceholder: 'Введите название страны...',
    notFound: 'Страна не найдена или уже была',
    nextRound: 'Далее',
    waitingGroup: 'Ожидание группы...',
    nextRoundIn: (s: number) => `Следующий раунд через ${s} с`,
    gameOver: 'Игра завершена',
    sessionResults: 'Итоговая таблица',
    player: 'Игрок',
    guessed: 'Флагов',
    returnMenu: 'В главное меню',
    you: '(Вы)',
    pixelMatch: 'PIXEL MATCH',
    noData: 'Введите любую страну',
    leaveGame: 'Выйти',
    close: 'Закрыть',
    roundClock: 'раунд',
    roundOf: (n: number, total: number) => `Раунд ${n} из ${total}`,
    yourScore: 'Ваш счёт',
    youWin: 'Победа',
    winnerLabel: 'Победитель',
    guessTitle: 'Угадайте флаг',
    guessHint: 'Вводите любые страны: совпавшие цвета проявятся на флаге'
  },
  en: {
    title: 'FLAGGER',
    pro: 'by Darhaal',
    round: 'Round',
    of: 'of',
    time: 'Timer',
    score: 'Score',
    accuracy: 'Accuracy',
    status: 'Player Status',
    targetFound: 'Correct!',
    missionFailedShort: 'Incorrect',
    searching: 'Thinking...',
    roundOver: 'Round Over',
    results: 'Round Results',
    correctAnswer: 'Correct Flag',
    yourResult: 'Your Result',
    success: 'Guessed',
    fail: 'Missed',
    accepted: 'Got it',
    missionFailed: 'Out of attempts',
    timeUp: 'Time Up',
    waitingOthers: 'Waiting for others...',
    inputPlaceholder: 'Enter country name...',
    notFound: 'Country not found or already guessed',
    nextRound: 'Next',
    waitingGroup: 'Waiting for group...',
    nextRoundIn: (s: number) => `Next round in ${s} s`,
    gameOver: 'Game Over',
    sessionResults: 'Final Scoreboard',
    player: 'Player',
    guessed: 'Flags',
    returnMenu: 'Main Menu',
    you: '(You)',
    pixelMatch: 'PIXEL MATCH',
    noData: 'Type any country',
    leaveGame: 'Leave',
    close: 'Close',
    roundClock: 'round',
    roundOf: (n: number, total: number) => `Round ${n} of ${total}`,
    yourScore: 'Your score',
    youWin: 'You win',
    winnerLabel: 'Winner',
    guessTitle: 'Guess the flag',
    guessHint: 'Type any country: matching colours show through'
  }
};

interface FlagerGameProps {
  gameState: FlagerState;
  userId: string;
  makeGuess: (code: string) => void;
  handleTimeout: () => void;
  forceRoundEnd?: () => void;
  forceNextRound?: () => void;
  readyNextRound: () => void;
  leaveGame: () => void;
  lang: 'ru' | 'en';
}


const FlagRevealCanvas = ({ targetCode, guesses, isRoundDone, t }: { targetCode: string, guesses: string[], isRoundDone: boolean, t: { noData: string; pixelMatch: string } }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const WIDTH = 640;
  const HEIGHT = 426;

  useEffect(() => {
    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const targetPath = COUNTRIES[targetCode.toLowerCase()]?.flagPath;
    if (!targetPath) return;

    const targetImg = new window.Image();
    targetImg.crossOrigin = "Anonymous";
    targetImg.src = targetPath;

    targetImg.onload = () => {
        if (!isMounted) return;

        setIsLoading(false);
        ctx.fillStyle = '#1A1F26';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        if (isRoundDone) {
             ctx.drawImage(targetImg, 0, 0, WIDTH, HEIGHT);
             return;
        }

        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = WIDTH;
        targetCanvas.height = HEIGHT;
        const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
        if(!targetCtx) return;

        targetCtx.drawImage(targetImg, 0, 0, WIDTH, HEIGHT);
        const targetData = targetCtx.getImageData(0, 0, WIDTH, HEIGHT);
        const mask = new Uint8Array(WIDTH * HEIGHT).fill(0);

        if (guesses.length === 0) {
            ctx.fillStyle = '#111';
            ctx.fillRect(0,0,WIDTH,HEIGHT);
            ctx.font = '30px monospace';
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.fillText(t.noData, WIDTH/2, HEIGHT/2);
            return;
        }

        let processedCount = 0;
        guesses.forEach(guessCode => {
            const guessPath = COUNTRIES[guessCode.toLowerCase()]?.flagPath;
            if (!guessPath) { processedCount++; return; }

            const guessImg = new window.Image();
            guessImg.crossOrigin = "Anonymous";
            guessImg.src = guessPath;

            guessImg.onload = () => {
                if (!isMounted) return;

                const guessCanvas = document.createElement('canvas');
                guessCanvas.width = WIDTH;
                guessCanvas.height = HEIGHT;
                const guessCtx = guessCanvas.getContext('2d', { willReadFrequently: true });
                if(!guessCtx) return;

                guessCtx.drawImage(guessImg, 0, 0, WIDTH, HEIGHT);
                const guessData = guessCtx.getImageData(0, 0, WIDTH, HEIGHT);

                for (let i = 0; i < targetData.data.length; i += 4) {
                    const idx = i / 4;
                    if (mask[idx] === 1) continue;
                    if (targetData.data[i+3] < 10) continue;

                    const rDist = Math.abs(targetData.data[i] - guessData.data[i]);
                    const gDist = Math.abs(targetData.data[i+1] - guessData.data[i+1]);
                    const bDist = Math.abs(targetData.data[i+2] - guessData.data[i+2]);

                    if (rDist < 45 && gDist < 45 && bDist < 45) mask[idx] = 1;
                }

                processedCount++;
                if (processedCount === guesses.length) {
                    const finalImageData = ctx.createImageData(WIDTH, HEIGHT);
                    for (let i = 0; i < mask.length; i++) {
                        const ptr = i * 4;
                        if (mask[i]) {
                            finalImageData.data[ptr] = targetData.data[ptr];
                            finalImageData.data[ptr+1] = targetData.data[ptr+1];
                            finalImageData.data[ptr+2] = targetData.data[ptr+2];
                            finalImageData.data[ptr+3] = 255;
                        } else {
                            const noise = Math.random() * 20;
                            finalImageData.data[ptr] = 20 + noise;
                            finalImageData.data[ptr+1] = 25 + noise;
                            finalImageData.data[ptr+2] = 30 + noise;
                            finalImageData.data[ptr+3] = 255;
                        }
                    }
                    ctx.putImageData(finalImageData, 0, 0);
                }
            };
        });
    };

    return () => { isMounted = false; };
  }, [targetCode, guesses, isRoundDone, t]);

  return (
    <div className="relative w-full aspect-[3/2] bg-[#1A1F26] overflow-hidden border border-[#1A1F26] shadow-sm group">
       {isLoading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#9e1316] animate-spin" /></div>}
       <canvas ref={canvasRef} width={640} height={426} className="w-full h-full object-contain z-10 relative transition-all duration-500" />

       <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20" />
       <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] z-30 pointer-events-none" />

       {!isRoundDone && (
         <div className="absolute top-3 right-3 bg-black/60 text-[#9e1316] text-2xs font-mono px-2 py-1 rounded backdrop-blur-sm z-40 border border-[#9e1316]/40 animate-pulse">
            {t.pixelMatch}
         </div>
       )}
    </div>
  );
};

export default function FlagerGame({ gameState, userId, makeGuess, handleTimeout, forceRoundEnd, forceNextRound, readyNextRound, leaveGame, lang = 'en' }: FlagerGameProps) {
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [showRules, setShowRules] = useState(false);
  // The result can be put aside to look at the last flag, and brought back.
  const [resultHidden, setResultHidden] = useState(false);

  const t = UI_TEXT[lang];

  const me = gameState.players.find(p => p.id === userId);
  // Clamped: the result is shown over the board, which reads the last round.
  const currentFlagCode =
    gameState.targetChain[Math.min(gameState.currentRoundIndex, gameState.targetChain.length - 1)] ?? '';

  const isPlaying = gameState.status === 'playing';
  const isRoundEnd = gameState.status === 'round_end';
  const isFinished = gameState.status === 'finished';

  const isRoundDone = me?.hasFinishedRound;

  // Timer Logic
  const [elapsed, setElapsed] = useState(0);
  const roundDuration = gameState.settings?.roundDuration || 60;

  useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the per-round counter when the round changes; the alternative is remounting the whole board via key
      setElapsed(0);
  }, [gameState.currentRoundIndex]);

  useEffect(() => {
      if (!isPlaying || isRoundEnd || isFinished) return;

      const timer = setInterval(() => {
          const now = Date.now();
          const start = gameState.roundStartTime || now;
          const secondsPassed = Math.floor((now - start) / 1000);

          setElapsed(secondsPassed);

          if (secondsPassed >= roundDuration) {
              if (!isRoundDone) {
                 handleTimeout();
                 clearInterval(timer);
              } else if (secondsPassed >= roundDuration + 10 && forceRoundEnd) {
                 // Everyone times out their own round, so a player who closed
                 // their tab never finishes theirs and the round waits on them
                 // for good. Whoever is still here closes it out.
                 forceRoundEnd();
                 clearInterval(timer);
              }
          }
      }, 200);

      return () => clearInterval(timer);
  }, [isPlaying, isRoundEnd, isFinished, isRoundDone, gameState.roundStartTime, handleTimeout, forceRoundEnd, roundDuration]);

  // Between rounds: a minute to read the answer, then the next round starts
  // for everyone, so a player who closed their tab cannot hold it back.
  const [nextRoundIn, setNextRoundIn] = useState<number | null>(null);
  useEffect(() => {
      const endedAt = gameState.roundEndedAt;
      if (!isRoundEnd || !endedAt) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the between-rounds countdown when the dialog closes
          setNextRoundIn(null);
          return;
      }
      let fired = false;
      const tick = () => {
          const left = Math.max(0, Math.ceil(FLAGER_BETWEEN_ROUNDS_SECONDS - (Date.now() - endedAt) / 1000));
          setNextRoundIn(left);
          if (left === 0 && !fired && forceNextRound) {
              fired = true;
              forceNextRound();
          }
      };
      tick();
      const timer = setInterval(tick, 500);
      return () => clearInterval(timer);
  }, [isRoundEnd, gameState.roundEndedAt, forceNextRound]);

  const timeLeft = Math.max(0, roundDuration - Math.max(0, elapsed));
  const isCountingDown = elapsed < 0;
  const countdownValue = Math.abs(elapsed);

  const filteredCountries = useMemo(() => {
    if (!input) return [];
    const lowerInput = input.toLowerCase().trim();

    return COUNTRY_CODES.filter(code => {
      const c = COUNTRIES[code.toLowerCase()];
      if (!c) return false;

      const matchRu = c.name.ru.toLowerCase().includes(lowerInput);
      const matchEn = c.name.en.toLowerCase().includes(lowerInput);
      const matchAlias = c.aliases?.some(a => a.toLowerCase().includes(lowerInput));

      const notGuessed = !me?.guesses.includes(code.toLowerCase());

      return (matchRu || matchEn || matchAlias) && notGuessed;
    }).slice(0, 5);
  }, [input, me?.guesses]);

  const handleGuess = (code: string) => {
      const isCorrect = code.toLowerCase() === currentFlagCode.toLowerCase();
      playSfx(isCorrect ? 'success' : 'error');
      if (!isCorrect) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
      }
      makeGuess(code.toLowerCase());
      setInput('');
      setShowDropdown(false);
  };

  const calculateAccuracy = (p: FlagerPlayerState | undefined) => {
      if (!p) return 0; // Guard: a spectator/left player has no entry in players
      let totalGuesses = 0;
      let correctGuesses = 0;
      (p.history || []).forEach((h) => {
          totalGuesses += h.attempts || 0;
          if (h.isCorrect) correctGuesses++;
      });
      if (p.guesses && p.guesses.length > 0) {
          totalGuesses += p.guesses.length;
          const currentTarget = currentFlagCode?.toLowerCase();
          if (p.guesses.includes(currentTarget)) {
              correctGuesses++;
          }
      }
      if (totalGuesses === 0) return 0;
      return Math.round((correctGuesses / totalGuesses) * 100);
  };

  const handleEmergencyExit = () => {
    // leaveGame (handleLeave) awaits the DB write and navigates by itself
    leaveGame();
  };

  // Final sound — once when the game ends
  useEffect(() => {
      if (isFinished) playSfx('win');
  }, [isFinished]);

  const isAttemptsFailed = (me?.guesses?.length || 0) >= 10 && me?.guesses?.[(me?.guesses?.length || 0) - 1] !== currentFlagCode.toLowerCase();
  const isTimeFailed = elapsed >= roundDuration && !me?.roundScore;
  const isRoundFailed = isRoundDone && (isAttemptsFailed || isTimeFailed);

  const ranked = [...gameState.players].sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;
  const winners = ranked.filter(p => p.score === topScore && topScore > 0);
  const iWon = winners.some(w => w.id === userId);
  const roundNumber = Math.min(gameState.currentRoundIndex + 1, gameState.targetChain.length);
  const lastResult = me?.history[me.history.length - 1];

  return (
    <div className={GAME_PAGE}>
       <GameRulesModal
          isOpen={showRules}
          onClose={() => setShowRules(false)}
          rules={GAME_RULES[lang as 'ru' | 'en'].flager}
       />
       <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

       {/* COUNTDOWN before a round */}
       {isCountingDown && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
               <div key={countdownValue} className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-full shadow-2xl border border-[#E6E1DC] flex items-center justify-center animate-in zoom-in-50 fade-in duration-200">
                   <span className="text-5xl md:text-7xl font-black text-[#1A1F26] tabular-nums select-none">{countdownValue}</span>
               </div>
           </div>
       )}

       <GameHeader
            title={requireGame('flager').name[lang]}
            icon={Flag}
            timeLeft={timeLeft}
            showTime={isPlaying && !isFinished}
            timeCaption={t.roundClock}
            onLeave={handleEmergencyExit}
            onShowRules={() => setShowRules(true)}
            lang={lang}
       />

       <GameLayout
          boardWidth={720}
          board={
            <div className="flex flex-col gap-4">
              <div className="relative">
                 <FlagRevealCanvas
                    targetCode={currentFlagCode}
                    guesses={me?.guesses || []}
                    isRoundDone={!!isRoundDone || isFinished}
                    t={t}
                 />

                 {isRoundDone && !isRoundEnd && !isFinished && (
                     <div className="absolute inset-0 bg-[#1A1F26]/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-500">
                         <div className={`${DIALOG_PANEL} max-w-xs text-center !p-6`}>
                             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 border ${isRoundFailed ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                 {isRoundFailed ? (
                                     isTimeFailed ? <Clock className="w-7 h-7 text-red-600" /> : <X className="w-7 h-7 text-red-600" />
                                 ) : <Check className="w-7 h-7 text-emerald-600" />}
                             </div>
                             <h3 className="text-xl font-black text-[#1A1F26] mb-1">
                                 {isRoundFailed ? (isTimeFailed ? t.timeUp : t.missionFailed) : t.accepted}
                             </h3>
                             <p className="text-sm font-medium text-[#8A9099]">{t.waitingOthers}</p>
                         </div>
                     </div>
                 )}
              </div>

              {/* ANSWER */}
              {!isFinished && (
              <div className={`relative transition-all duration-300 ${isRoundDone || isCountingDown ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                   <div className={`relative transition-transform ${shake ? '-translate-x-2.5' : ''}`}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setShowDropdown(true); setHighlightIdx(0); }}
                            onKeyDown={(e) => {
                                if (filteredCountries.length === 0) return;
                                // Arrows navigate suggestions, Enter/Tab picks the highlighted one
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setHighlightIdx(i => (i + 1) % filteredCountries.length);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setHighlightIdx(i => (i - 1 + filteredCountries.length) % filteredCountries.length);
                                } else if (e.key === 'Enter' || e.key === 'Tab') {
                                    e.preventDefault();
                                    handleGuess(filteredCountries[Math.min(highlightIdx, filteredCountries.length - 1)]);
                                } else if (e.key === 'Escape') {
                                    setShowDropdown(false);
                                }
                            }}
                            placeholder={isCountingDown ? '…' : t.inputPlaceholder}
                            className={`w-full bg-white border rounded-xl py-4 pl-12 pr-16 font-bold text-lg text-[#1A1F26] placeholder:text-gray-400 placeholder:font-medium outline-none transition-colors shadow-sm ${
                                shake ? 'border-red-400 text-red-600' : 'border-[#E6E1DC] focus:border-[#1A1F26]'
                            }`}
                            disabled={isCountingDown}
                            autoFocus
                        />
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${shake ? 'text-red-500' : 'text-gray-400'}`} />
                        <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:block bg-[#F8FAFC] border border-[#E6E1DC] rounded-md px-2 py-0.5 text-2xs font-bold text-[#8A9099]">Tab</kbd>
                   </div>

                   {showDropdown && input.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-[#E6E1DC] rounded-2xl shadow-xl z-[60] overflow-hidden max-h-60 md:max-h-80 overflow-y-auto animate-in slide-in-from-bottom-2">
                          {filteredCountries.map((code, idx) => (
                              <button
                                  key={code}
                                  onClick={() => handleGuess(code)}
                                  onMouseEnter={() => setHighlightIdx(idx)}
                                  className={`w-full text-left px-5 py-3 font-bold text-sm flex items-center gap-4 border-b border-[#F1F5F9] last:border-0 transition-colors ${idx === highlightIdx ? 'bg-[#F8FAFC]' : 'hover:bg-[#F8FAFC]'}`}
                              >
                                  <Image src={COUNTRIES[code.toLowerCase()]?.flagPath || ""} alt="" width={40} height={28} className="w-9 h-6 object-cover rounded-sm border border-[#E6E1DC]" />
                                  <span className="text-[#1A1F26] truncate">{COUNTRIES[code.toLowerCase()]?.name[lang]}</span>
                                  <ArrowRight className={`w-4 h-4 ml-auto hidden sm:block ${idx === highlightIdx ? 'text-[#9e1316]' : 'text-gray-300'}`} />
                              </button>
                          ))}
                          {filteredCountries.length === 0 && (
                              <div className="p-5 text-center text-[#8A9099] text-xs font-bold">{t.notFound}</div>
                          )}
                      </div>
                   )}
              </div>
              )}

              {/* YOUR GUESSES this round */}
              {!isFinished && (me?.guesses.length ?? 0) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {me?.guesses.slice().reverse().map((code, i) => {
                      const isTarget = code === currentFlagCode.toLowerCase();
                      const cData = COUNTRIES[code];
                      return (
                          <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border animate-in fade-in slide-in-from-bottom-2 duration-300 ${isTarget ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-[#E6E1DC]'}`}>
                              <Image src={cData?.flagPath || ""} alt="" width={40} height={28} className="w-9 h-6 object-cover rounded-sm border border-[#E6E1DC]" />
                              <div className="flex flex-col min-w-0">
                                  <span className={`font-bold text-sm truncate ${isTarget ? 'text-emerald-800' : 'text-[#1A1F26]'}`}>{cData?.name[lang]}</span>
                                  <span className="text-2xs text-[#8A9099] font-bold uppercase">{continentName(cData?.continent, lang)}</span>
                              </div>
                          </div>
                      );
                  })}
              </div>
              )}
            </div>
          }
          side={
            <>
              <TurnCard
                lang={lang}
                label={t.roundOf(roundNumber, gameState.targetChain.length)}
                title={isRoundDone ? (isRoundFailed ? t.missionFailedShort : t.targetFound) : t.guessTitle}
                hint={isRoundDone ? t.waitingOthers : t.guessHint}
                secondsLeft={isPlaying && !isRoundEnd ? timeLeft : undefined}
                turnSeconds={roundDuration}
                result={isFinished ? {
                  won: iWon,
                  title: iWon ? t.youWin : t.winnerLabel,
                  detail: winners.map(w => `${w.name} — ${w.score}`).join(' · '),
                  hidden: resultHidden,
                  onShow: () => setResultHidden(false)
                } : undefined}
              />

              <GameCard label={t.yourScore}>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-black tabular-nums leading-none">{me?.score || 0}</div>
                  <div className="text-right">
                    <div className={LABEL}>{t.accuracy}</div>
                    <div className={`mt-1 text-base font-black flex items-center gap-1 justify-end tabular-nums ${calculateAccuracy(me) > 80 ? 'text-emerald-600' : 'text-[#1A1F26]'}`}>
                      <Target className="w-4 h-4" /> {calculateAccuracy(me)}%
                    </div>
                  </div>
                </div>
              </GameCard>

              <PlayersCard
                lang={lang}
                rows={gameState.players.map(p => {
                  const isDone = p.hasFinishedRound;
                  const hasFailed = isDone && p.roundScore === 0;
                  return {
                    id: p.id,
                    name: p.name,
                    avatarUrl: p.avatarUrl,
                    isHost: p.isHost,
                    isMe: p.id === userId,
                    won: isFinished && winners.some(w => w.id === p.id),
                    stat: isFinished ? undefined : (
                      <>
                        <span className={isDone ? (hasFailed ? 'text-red-500' : 'text-emerald-600') : ''}>
                          {isDone ? (hasFailed ? t.missionFailedShort : t.targetFound) : t.searching}
                        </span>
                        <span className="tabular-nums">{p.guesses?.length || 0}/10</span>
                      </>
                    ),
                    aside: (
                      <span className="flex flex-col items-end">
                        <span className="text-sm font-black text-[#1A1F26]">{p.score}</span>
                        {!isFinished && isDone && p.roundScore > 0 && <span className="text-emerald-600">+{p.roundScore}</span>}
                      </span>
                    )
                  };
                })}
              />
            </>
          }
       />

       {/* BETWEEN ROUNDS */}
       {isRoundEnd && (
            <div role="dialog" aria-modal="true" aria-label={t.roundOver} className={DIALOG_OVERLAY}>
                <div className={`${DIALOG_PANEL} max-w-lg`}>
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className={LABEL}>{t.roundOf(roundNumber, gameState.targetChain.length)}</div>
                            <h2 className="text-2xl font-black text-[#1A1F26] mt-1">{t.roundOver}</h2>
                        </div>
                    </div>

                    <div className="relative h-40 md:h-48 rounded-xl overflow-hidden mb-5 border border-[#E6E1DC]">
                        <Image src={COUNTRIES[currentFlagCode.toLowerCase()]?.flagPath || ""} alt="" fill sizes="(max-width: 768px) 100vw, 512px" className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                        <div className="absolute bottom-4 left-5">
                            <div className="text-white/70 text-2xs font-bold uppercase tracking-widest mb-1">{t.correctAnswer}</div>
                            <div className="text-2xl md:text-3xl font-black text-white">{COUNTRIES[currentFlagCode.toLowerCase()]?.name[lang]}</div>
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl border mb-5 flex items-center justify-between ${lastResult?.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                         <div>
                             <div className="font-bold text-[#1A1F26] text-sm">{t.yourResult}</div>
                             <div className={`text-xs font-bold ${lastResult?.isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
                                 {lastResult?.isCorrect ? t.success : t.fail}
                             </div>
                         </div>
                         <div className="font-black text-xl text-[#1A1F26] tabular-nums">+{lastResult?.points || 0}</div>
                    </div>

                    {!me?.isReadyForNextRound ? (
                        // Focused on arrival, so Enter carries on from the
                        // keyboard the answer was typed on.
                        <button autoFocus onClick={readyNextRound} className={`w-full py-3.5 flex items-center justify-center gap-2 ${BUTTON_PRIMARY}`}>
                            {t.nextRound} <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <div className="w-full py-3.5 bg-[#F8FAFC] border border-[#E6E1DC] text-[#8A9099] rounded-xl font-bold uppercase text-xs tracking-wide text-center flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> {t.waitingGroup}
                        </div>
                    )}

                    <div className="mt-4 flex justify-center gap-2">
                        {gameState.players.map(p => (
                            <div key={p.id} className={`w-2 h-2 rounded-full transition-colors ${p.isReadyForNextRound ? 'bg-emerald-500' : 'bg-[#E6E1DC]'}`} title={p.name} />
                        ))}
                    </div>
                    {nextRoundIn !== null && (
                        <p className="mt-3 text-center text-xs font-bold text-[#8A9099] tabular-nums">{t.nextRoundIn(nextRoundIn)}</p>
                    )}
                </div>
            </div>
       )}

       <ResultDialog
          lang={lang}
          open={isFinished && !resultHidden}
          onHide={() => setResultHidden(true)}
          won={iWon}
          title={iWon ? t.youWin : t.winnerLabel}
          winners={winners.map(w => ({ id: w.id, name: w.name, avatarUrl: w.avatarUrl || defaultAvatar(w.id) }))}
          gameId="flager"
          parentState={gameState}
          onMenu={handleEmergencyExit}
          wide
       >
          <div className="divide-y divide-[#F1F5F9] border-y border-[#F1F5F9]">
              {ranked.map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                      <span className="w-5 text-sm font-black text-[#8A9099] tabular-nums">{idx + 1}</span>
                      <Image src={p.avatarUrl || defaultAvatar(p.id)} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover bg-[#F8FAFC] shrink-0" />
                      <span className="text-sm font-bold truncate flex-1">
                          {p.name}
                          {p.id === userId && <span className="ml-1.5 text-3xs font-bold uppercase tracking-wider text-[#8A9099]">{t.you}</span>}
                      </span>
                      <span className="hidden sm:flex items-center gap-1 text-xs font-bold text-[#8A9099] tabular-nums">
                          <Target className="w-3 h-3" /> {calculateAccuracy(p)}%
                      </span>
                      <span className="text-xs font-bold text-[#8A9099] tabular-nums w-14 text-right">
                          {p.history.filter(h => h.isCorrect).length}/{gameState.targetChain.length}
                      </span>
                      <span className="text-base font-black tabular-nums w-14 text-right">{p.score}</span>
                  </div>
              ))}
          </div>
       </ResultDialog>
    </div>
  );
}
