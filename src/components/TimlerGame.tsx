'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarPlus, Check, ExternalLink, History, Loader2, Maximize2, Minus, Plus, X } from 'lucide-react';
import GameHeader from './GameHeader';
import GameRulesModal from './GameRulesModal';
import GameNotificationToast from './GameNotificationToast';
import GameLayout from './game/GameLayout';
import GameCard from './game/GameCard';
import TurnCard from './game/TurnCard';
import PlayersCard from './game/PlayersCard';
import ResultDialog from './game/ResultDialog';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_OVERLAY, DIALOG_PANEL, GAME_PAGE, LABEL } from './game/ui';
import Timeline, { formatDate } from './timler/Timeline';
import { requireGame } from '@/games/registry';
import { crowdColor } from '@/games/palette';
import { GAME_RULES } from '@/constants/rules';
import { defaultAvatar } from '@/constants/app';
import { DIFFICULTIES } from '@/data/difficulty';
import { useGameKeys } from '@/hooks/useGameKeys';
import { useEscape } from '@/hooks/useEscape';
import { TIMLER_BETWEEN_ROUNDS_SECONDS } from '@/hooks/useTimlerGame';
import { FIRST_YEAR, daysInMonth, hasDay, parseDate, type TimlerDate } from '@/lib/gameLogic/timler';
import { articleUrl, filePage, imageUrl, preload } from '@/lib/timler/pool';
import { pluralEn, pluralRu } from '@/lib/plural';
import { playSfx } from '@/lib/sound';
import type { TimlerEra, TimlerRoundResult, TimlerState } from '@/types/timler';

/**
 * Timler's screen — docs/timler-spec.md, sections 2–5. The photo is the
 * board; beside it the round, the answer, the score and the table. After a
 * round, the timeline of everyone's answers. Built from the shared game
 * parts (docs/design-system.md).
 */

const THIS_YEAR = new Date().getFullYear();

/** The years an era's photos come from — the range of the answer slider. */
const ERA_YEARS: Record<TimlerEra, [number, number]> = {
  all: [FIRST_YEAR, THIS_YEAR],
  before1900: [FIRST_YEAR, 1899],
  '1900-1945': [1900, 1945],
  '1946-2000': [1946, 2000],
  since2001: [2001, THIS_YEAR]
};

const MONTH_NAMES = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};

const T = {
  ru: {
    roundOf: (n: number, total: number) => `Раунд ${n} из ${total}`,
    roundClock: 'раунд',
    whenTaken: 'Когда снято фото?',
    answered: 'Ответ принят',
    roundOver: 'Раунд окончен',
    hintPick: 'Год — обязательно, день и месяц — если знаете',
    hintWait: 'Ждём остальных',
    startsIn: 'Начинаем через',
    loading: 'Загружаем фото…',
    loadError: 'Фото не загрузилось',
    yourAnswer: 'Ваш ответ',
    year: 'Год',
    addDate: '+ день и месяц',
    removeDate: 'только год',
    onlyYear: 'У этого фото известен только год',
    day: 'День',
    month: 'Месяц',
    submit: 'Ответить',
    yourScore: 'Ваш счёт',
    thinking: 'думает…',
    done: 'ответил ✓',
    noAnswer: 'нет ответа',
    exact: 'точно',
    sameDay: 'день в день',
    years: (n: number) => `${n} ${pluralRu(n, ['год', 'года', 'лет'])}`,
    days: (n: number) => `${n} ${pluralRu(n, ['день', 'дня', 'дней'])}`,
    readMore: 'Статья в Википедии',
    photoBy: 'Фото',
    next: 'Далее',
    total: 'Итоги',
    waitingGroup: 'Ждём остальных…',
    finishing: 'Подводим итоги…',
    nextRoundIn: (s: number) => `Следующий раунд через ${s} с`,
    youWin: 'Вы победили!',
    winnerLabel: 'Победитель',
    points: 'очков',
    fullScreen: 'Во весь экран',
    close: 'Закрыть'
  },
  en: {
    roundOf: (n: number, total: number) => `Round ${n} of ${total}`,
    roundClock: 'round',
    whenTaken: 'When was this taken?',
    answered: 'Answer in',
    roundOver: 'Round over',
    hintPick: 'The year is a must; the day and month if you know them',
    hintWait: 'Waiting for the others',
    startsIn: 'Starting in',
    loading: 'Loading the photo…',
    loadError: 'The photo did not load',
    yourAnswer: 'Your answer',
    year: 'Year',
    addDate: '+ day and month',
    removeDate: 'year only',
    onlyYear: 'Only the year is known for this photo',
    day: 'Day',
    month: 'Month',
    submit: 'Answer',
    yourScore: 'Your score',
    thinking: 'thinking…',
    done: 'answered ✓',
    noAnswer: 'no answer',
    exact: 'spot on',
    sameDay: 'the very day',
    years: (n: number) => `${n} ${pluralEn(n, 'year', 'years')}`,
    days: (n: number) => `${n} ${pluralEn(n, 'day', 'days')}`,
    readMore: 'Wikipedia article',
    photoBy: 'Photo',
    next: 'Next',
    total: 'Results',
    waitingGroup: 'Waiting for the others…',
    finishing: 'Totting up…',
    nextRoundIn: (s: number) => `Next round in ${s} s`,
    youWin: 'You win!',
    winnerLabel: 'Winner',
    points: 'points',
    fullScreen: 'Full screen',
    close: 'Close'
  }
};
type Texts = (typeof T)['ru'];

/** How far off a guess was, in words: "+3 года", "−2 days", "spot on". */
function describeError(guess: TimlerDate, answer: TimlerDate, t: Texts): string {
  if (hasDay(guess) && hasDay(answer)) {
    const days = Math.round((Date.UTC(guess.year, guess.month - 1, guess.day) - Date.UTC(answer.year, answer.month - 1, answer.day)) / 86_400_000);
    if (days === 0) return t.sameDay;
    if (Math.abs(days) < 365) return `${days > 0 ? '+' : '−'}${t.days(Math.abs(days))}`;
  }
  const years = guess.year - answer.year;
  if (years === 0) return t.exact;
  return `${years > 0 ? '+' : '−'}${t.years(Math.abs(years))}`;
}

/** The photo, with what it shows in the reader's language and the other one as a fallback. */
const pick = <V,>(both: { ru: V | null; en: V | null }, lang: 'ru' | 'en') => both[lang] ?? both[lang === 'ru' ? 'en' : 'ru'];

interface TimlerGameProps {
  gameState: TimlerState;
  userId: string;
  lang: 'ru' | 'en';
  answer: (guess: TimlerDate) => void;
  forceRoundEnd: () => void;
  readyNextRound: () => void;
  forceNextRound: () => void;
  leaveGame: () => void;
}

export default function TimlerGame({
  gameState, userId, lang, answer, forceRoundEnd, readyNextRound, forceNextRound, leaveGame
}: TimlerGameProps) {
  const t = T[lang];
  const { settings, round } = gameState;
  const me = gameState.players.find((p) => p.id === userId);
  const isPlaying = gameState.status === 'playing';
  const isRoundEnd = gameState.status === 'round_end';
  const isFinished = gameState.status === 'finished';
  const durationMs = settings.roundDuration * 1000;
  const photo = round?.photo ?? null;
  const photoDate = photo ? parseDate(photo.date) : null;
  const photoHasDay = !!photoDate && hasDay(photoDate);
  const roundKey = `${gameState.roundIndex}:${photo?.file ?? ''}`;
  const [minYear, maxYear] = ERA_YEARS[settings.era] ?? ERA_YEARS.all;

  const [showRules, setShowRules] = useState(false);
  const [resultHidden, setResultHidden] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [loaded, setLoaded] = useState<{ key: string; ok: boolean } | null>(null);
  const photoReady = loaded?.key === roundKey && loaded.ok;
  const photoFailed = loaded?.key === roundKey && !loaded.ok;
  useEscape(fullScreen, () => setFullScreen(false));

  // Whether the photo is in. Listened for on the element itself: a photo
  // the browser already has can finish before React hydrates, and React's
  // onLoad then never comes — so a finished one is noticed on the next frame.
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const done = () => setLoaded({ key: roundKey, ok: img.naturalWidth > 0 });
    const failed = () => setLoaded({ key: roundKey, ok: false });
    img.addEventListener('load', done);
    img.addEventListener('error', failed);
    const frame = requestAnimationFrame(() => { if (img.complete) done(); });
    return () => {
      cancelAnimationFrame(frame);
      img.removeEventListener('load', done);
      img.removeEventListener('error', failed);
    };
  }, [roundKey]);

  // The answer being composed, keyed by the round so a new round starts clean.
  const middle = Math.round((minYear + maxYear) / 2);
  const [form, setForm] = useState<{ key: string; year: string; withDate: boolean; day: number; month: number }>(
    { key: roundKey, year: String(middle), withDate: false, day: 1, month: 1 }
  );
  const draft = form.key === roundKey ? form : { key: roundKey, year: String(middle), withDate: false, day: 1, month: 1 };
  const setDraft = (patch: Partial<typeof draft>) => setForm({ ...draft, ...patch });
  const year = Number(draft.year);
  const yearValid = draft.year !== '' && Number.isInteger(year) && year >= FIRST_YEAR && year <= THIS_YEAR;
  const maxDay = yearValid ? daysInMonth(year, draft.month) : 31;
  const withDate = draft.withDate && photoHasDay;
  const day = Math.min(draft.day, maxDay);

  // The clock.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, [isPlaying]);
  const startsIn = round ? Math.ceil((round.startTime - clock) / 1000) : 0;
  const elapsedMs = round ? Math.max(0, clock - round.startTime) : 0;
  const secondsLeft = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));
  const canAnswer = isPlaying && !!me && !me.guess && startsIn <= 0 && elapsedMs < durationMs + 1000;

  // Out of time: anyone still here closes the round, once.
  const forced = useRef<string | null>(null);
  useEffect(() => {
    if (!isPlaying || !round) return;
    if (clock - round.startTime >= durationMs + 1500 && forced.current !== roundKey) {
      forced.current = roundKey;
      forceRoundEnd();
    }
  }, [clock, isPlaying, round, durationMs, roundKey, forceRoundEnd]);

  // The next photo starts loading while everyone looks at the results.
  useEffect(() => {
    if (gameState.next) preload(gameState.next);
  }, [gameState.next]);

  // A sound for the round's end: a cheer for the right year.
  const lastResult = me?.history[me.history.length - 1];
  const sounded = useRef<number>(-1);
  useEffect(() => {
    if (!isRoundEnd || !lastResult || sounded.current === gameState.roundIndex) return;
    sounded.current = gameState.roundIndex;
    const a = parseDate(lastResult.answer);
    playSfx(a && lastResult.guess?.year === a.year ? 'success' : 'click');
  }, [isRoundEnd, lastResult, gameState.roundIndex]);

  // Between rounds: a minute to look, then the next round starts for everyone.
  const [nextRoundIn, setNextRoundIn] = useState<number | null>(null);
  useEffect(() => {
    const endedAt = gameState.roundEndedAt;
    if (!isRoundEnd || !endedAt) return;
    let fired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil(TIMLER_BETWEEN_ROUNDS_SECONDS - (Date.now() - endedAt) / 1000));
      setNextRoundIn(left);
      if (left === 0 && !fired) {
        fired = true;
        forceNextRound();
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [isRoundEnd, gameState.roundEndedAt, forceNextRound]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canAnswer || !yearValid) return;
    answer(withDate ? { year, month: draft.month, day } : { year });
  };

  const nudge = (by: number) => {
    const from = yearValid ? year : middle;
    setDraft({ year: String(Math.min(THIS_YEAR, Math.max(FIRST_YEAR, from + by))) });
  };

  // ←/→ move the year, Enter answers (docs/games.md → Controls).
  useGameKeys(canAnswer, (e) => {
    if (e.key === 'ArrowLeft') { nudge(e.shiftKey ? -10 : -1); return true; }
    if (e.key === 'ArrowRight') { nudge(e.shiftKey ? 10 : 1); return true; }
    if (e.key === 'Enter') { submit(); return true; }
  });

  const ranked = useMemo(() => [...gameState.players].sort((a, b) => b.score - a.score), [gameState.players]);
  const top = ranked[0]?.score ?? 0;
  const winners = isFinished ? ranked.filter((p) => p.score === top) : [];
  const iWon = winners.some((w) => w.id === userId);
  const roundNumber = gameState.roundIndex + 1;
  const colorOf = (id: string) => crowdColor(Math.max(0, gameState.players.findIndex((p) => p.id === id)));

  // ------------------------------------------------------------- the board --

  const board = (
    <div className="bg-white rounded-2xl border border-[#E6E1DC] shadow-sm overflow-hidden">
      <div className="relative bg-[#F1F5F9] min-h-[45vh] flex items-center justify-center">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- a Commons thumbnail, scaled by Commons
          <img
            key={roundKey}
            ref={imgRef}
            src={imageUrl(photo.file)}
            alt=""
            className={`block w-full max-h-[70vh] object-contain transition-opacity duration-500 ${photoReady ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {!photoReady && !photoFailed && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-bold text-[#8A9099]">
            <Loader2 className="w-4 h-4 animate-spin text-[#9e1316]" /> {t.loading}
          </div>
        )}
        {photoFailed && (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#8A9099]">{t.loadError}</div>
        )}
        {isPlaying && startsIn > 0 && (
          <div className="absolute inset-0 z-10 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className={LABEL}>{t.startsIn}</div>
            <div className="text-6xl font-black text-[#1A1F26] tabular-nums mt-2">{startsIn}</div>
          </div>
        )}
        {photoReady && (
          <button
            type="button"
            onClick={() => setFullScreen(true)}
            aria-label={t.fullScreen}
            title={t.fullScreen}
            className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 border border-[#E6E1DC] text-[#8A9099] hover:text-[#9e1316] hover:border-[#9e1316]/30 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* After the round, what it was. During it nothing here — a caption gives the date away. */}
      {photo && !isPlaying && photoDate && <PhotoCaption photo={photo} date={photoDate} lang={lang} t={t} />}
    </div>
  );

  // ---------------------------------------------------------- the answer --

  const yearInput = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => nudge(-1)} disabled={!canAnswer} aria-label="−1" className={`p-2.5 ${BUTTON_SECONDARY}`}>
        <Minus className="w-4 h-4" />
      </button>
      <input
        value={draft.year}
        onChange={(e) => setDraft({ year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
        inputMode="numeric"
        aria-label={t.year}
        disabled={!canAnswer}
        className="min-w-0 flex-1 text-center bg-[#F8FAFC] border border-gray-200 focus:bg-white focus:border-[#1A1F26] rounded-xl py-2 px-3 font-black text-2xl text-[#1A1F26] tabular-nums outline-none transition-all disabled:opacity-50"
      />
      <button type="button" onClick={() => nudge(1)} disabled={!canAnswer} aria-label="+1" className={`p-2.5 ${BUTTON_SECONDARY}`}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );

  const dateFields = withDate && (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <select
        value={day}
        onChange={(e) => setDraft({ day: Number(e.target.value) })}
        aria-label={t.day}
        disabled={!canAnswer}
        className="bg-[#F8FAFC] border border-gray-200 focus:border-[#1A1F26] rounded-xl py-2 px-2 font-bold text-sm text-[#1A1F26] outline-none"
      >
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select
        value={draft.month}
        onChange={(e) => setDraft({ month: Number(e.target.value) })}
        aria-label={t.month}
        disabled={!canAnswer}
        className="bg-[#F8FAFC] border border-gray-200 focus:border-[#1A1F26] rounded-xl py-2 px-2 font-bold text-sm text-[#1A1F26] outline-none"
      >
        {MONTH_NAMES[lang].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
    </div>
  );

  const dateToggle = photoHasDay ? (
    <button
      type="button"
      onClick={() => setDraft({ withDate: !draft.withDate })}
      disabled={!canAnswer}
      className="inline-flex items-center gap-1.5 text-2xs font-black uppercase tracking-widest text-[#8A9099] hover:text-[#9e1316] disabled:opacity-50 transition-colors"
    >
      <CalendarPlus className="w-3.5 h-3.5" /> {withDate ? t.removeDate : t.addDate}
    </button>
  ) : (
    <span className="text-2xs font-bold text-[#B5B3AD]">{t.onlyYear}</span>
  );

  const answerForm = me?.guess ? (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-2xl font-black text-[#1A1F26] tabular-nums">{formatDate(me.guess, lang)}</div>
        <div className="text-xs font-bold text-[#8A9099]">{t.hintWait}</div>
      </div>
      <Check className="w-6 h-6 text-emerald-600" />
    </div>
  ) : (
    <form onSubmit={submit} className="space-y-3">
      {yearInput}
      <input
        type="range"
        min={minYear}
        max={maxYear}
        step={1}
        value={yearValid ? Math.min(maxYear, Math.max(minYear, year)) : middle}
        onChange={(e) => setDraft({ year: e.target.value })}
        disabled={!canAnswer}
        aria-label={t.year}
        className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#1A1F26] disabled:opacity-50"
      />
      <div className="flex justify-between text-2xs font-medium text-gray-400 tabular-nums -mt-1">
        <span>{minYear}</span><span>{maxYear}</span>
      </div>
      {dateToggle}
      {dateFields}
      <button type="submit" disabled={!canAnswer || !yearValid} className={`w-full py-3 ${BUTTON_PRIMARY}`}>
        {t.submit}
      </button>
    </form>
  );

  // ------------------------------------------------------------ the side --

  const statusTitle = !isPlaying ? t.roundOver : me?.guess ? t.answered : t.whenTaken;
  const side = (
    <>
      <TurnCard
        lang={lang}
        label={[
          t.roundOf(Math.min(roundNumber, settings.rounds), settings.rounds),
          ...(settings.difficulty !== 'any' ? [DIFFICULTIES[settings.difficulty].label[lang]] : [])
        ].join(' · ')}
        title={statusTitle}
        hint={isPlaying ? (me?.guess ? t.hintWait : t.hintPick) : undefined}
        secondsLeft={isPlaying && startsIn <= 0 ? secondsLeft : undefined}
        turnSeconds={settings.roundDuration}
      />

      {isPlaying && (
        <GameCard label={t.yourAnswer} className="hidden lg:block">
          {answerForm}
        </GameCard>
      )}

      <GameCard label={t.yourScore}>
        <div className="text-4xl font-black text-[#1A1F26] tabular-nums leading-none">{me?.score ?? 0}</div>
      </GameCard>

      <PlayersCard
        lang={lang}
        rows={gameState.players.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl || defaultAvatar(p.id),
          isHost: p.isHost,
          isMe: p.id === userId,
          won: isFinished && winners.some((w) => w.id === p.id),
          stat: isPlaying ? (
            // During a round, the others see that you answered — not what.
            <span className={p.guess ? 'text-emerald-600' : ''}>{p.guess ? t.done : t.thinking}</span>
          ) : undefined,
          aside: !isPlaying ? <span className="text-sm font-black text-[#1A1F26] tabular-nums">{p.score}</span> : undefined
        }))}
      />
    </>
  );

  // ------------------------------------------------------- round results --

  const roundRows = gameState.players
    .map((p) => ({ p, r: p.history[gameState.roundIndex] as TimlerRoundResult | undefined }))
    .filter((x): x is { p: typeof x.p; r: TimlerRoundResult } => !!x.r)
    .sort((a, b) => b.r.score - a.r.score);
  const bestAccuracy = Math.max(-Infinity, ...roundRows.flatMap(({ r }) => (r.guess ? [r.accuracy] : [])));

  return (
    <div className={GAME_PAGE}>
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />
      <GameHeader
        title={requireGame('timler').name[lang]}
        icon={History}
        timeLeft={secondsLeft}
        showTime={isPlaying && startsIn <= 0}
        timeCaption={t.roundClock}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
      />
      <GameRulesModal isOpen={showRules} onClose={() => setShowRules(false)} rules={GAME_RULES[lang].timler} />

      <GameLayout board={board} side={side} boardWidth={900} />
      {/* Room for the phone's answer bar, so the bottom of the page is not hidden under it. */}
      {isPlaying && <div className="lg:hidden h-56" aria-hidden />}

      {/* On a phone the answer stays under the thumb instead of below the photo. */}
      {isPlaying && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-[#E6E1DC] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(26,31,38,0.15)]">
          {answerForm}
        </div>
      )}

      {fullScreen && photo && (
        <div role="dialog" aria-modal="true" aria-label={t.fullScreen} className={`${DIALOG_OVERLAY} bg-[#1A1F26]/90`} onClick={() => setFullScreen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a Commons thumbnail, scaled by Commons */}
          <img src={imageUrl(photo.file, 2048)} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
          <button type="button" onClick={() => setFullScreen(false)} aria-label={t.close} className="absolute top-4 right-4 p-2 rounded-xl bg-white text-[#1A1F26] hover:text-[#9e1316]">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Between rounds */}
      {isRoundEnd && photo && photoDate && (
        <div role="dialog" aria-modal="true" aria-label={t.roundOver} className={DIALOG_OVERLAY}>
          <div className={`${DIALOG_PANEL} max-w-2xl max-h-[92vh] overflow-y-auto`}>
            <div className={LABEL}>{t.roundOf(roundNumber, settings.rounds)}</div>
            <h2 className="text-2xl font-black text-[#1A1F26] mt-1">{formatDate(photoDate, lang)}</h2>
            <p className="text-sm font-bold text-[#8A9099] mb-5">{pick(photo.title, lang)}</p>

            <Timeline
              answer={photoDate}
              lang={lang}
              guesses={roundRows.flatMap(({ p, r }) => (r.guess ? [{
                id: p.id,
                name: p.name,
                avatarUrl: p.avatarUrl || defaultAvatar(p.id),
                color: colorOf(p.id),
                date: r.guess,
                best: r.accuracy === bestAccuracy
              }] : []))}
            />

            <div className="divide-y divide-[#F1F5F9] border-y border-[#F1F5F9] my-5">
              {roundRows.map(({ p, r }) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.isReadyForNextRound ? 'bg-emerald-500' : 'bg-[#E6E1DC]'}`} />
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorOf(p.id) }} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#1A1F26] truncate">{p.name}</div>
                    <div className="text-2xs font-bold text-[#8A9099] tabular-nums">
                      {r.guess
                        ? <>{formatDate(r.guess, lang)} · {describeError(r.guess, photoDate, t)}</>
                        : t.noAnswer}
                    </div>
                  </div>
                  <div className="w-14 text-right text-sm font-black tabular-nums text-[#1A1F26]">+{r.score}</div>
                </div>
              ))}
            </div>

            {!me?.isReadyForNextRound ? (
              <button autoFocus onClick={readyNextRound} className={`w-full py-3.5 flex items-center justify-center gap-2 ${BUTTON_PRIMARY}`}>
                {roundNumber >= settings.rounds ? t.total : t.next} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-full py-3.5 bg-[#F8FAFC] border border-[#E6E1DC] text-[#8A9099] rounded-xl font-bold uppercase text-xs tracking-wide text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {roundNumber >= settings.rounds ? t.finishing : t.waitingGroup}
              </div>
            )}
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
        winners={winners.map((w) => ({ id: w.id, name: w.name, avatarUrl: w.avatarUrl || defaultAvatar(w.id) }))}
        gameId="timler"
        parentState={gameState}
        onMenu={leaveGame}
        wide
      >
        <div className="divide-y divide-[#F1F5F9] border-y border-[#F1F5F9]">
          {ranked.map((p, i) => {
            const exact = p.history.filter((h) => { const a = parseDate(h.answer); return a && h.guess?.year === a.year; }).length;
            return (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <span className="w-5 text-xs font-black text-[#8A9099] tabular-nums">{i + 1}</span>
                <span className="flex-1 text-sm font-bold text-[#1A1F26] truncate text-left">{p.name}</span>
                <span className="text-xs font-bold text-[#8A9099] tabular-nums" title={t.exact}>{exact}/{p.history.length}</span>
                <span className="w-14 text-right text-sm font-black tabular-nums">{p.score}</span>
              </div>
            );
          })}
        </div>
      </ResultDialog>
    </div>
  );
}

/** What the photo shows, when, a few lines about it, a link, and its author and licence. */
function PhotoCaption({ photo, date, lang, t }: {
  photo: NonNullable<TimlerState['round']>['photo'];
  date: TimlerDate;
  lang: 'ru' | 'en';
  t: Texts;
}) {
  const title = pick(photo.title, lang);
  const description = pick(photo.description, lang);
  const articleLang: 'ru' | 'en' | null = photo.article[lang] ? lang : photo.article[lang === 'ru' ? 'en' : 'ru'] ? (lang === 'ru' ? 'en' : 'ru') : null;
  return (
    <div className="px-5 md:px-7 py-4 border-t border-[#F1F5F9]">
      <div className="text-xl font-black text-[#1A1F26]">{formatDate(date, lang)}</div>
      {title && <div className="text-sm font-bold text-[#1A1F26] mt-0.5">{title}</div>}
      {description && <div className="text-sm text-gray-600 mt-1">{description}</div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-2xs font-bold text-[#8A9099]">
        {articleLang && (
          <a href={articleUrl(articleLang, photo.article[articleLang]!)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#9e1316]">
            <ExternalLink className="w-3 h-3" /> {t.readMore}
          </a>
        )}
        <a href={filePage(photo.file)} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#9e1316]">
          {t.photoBy}: {photo.author || 'Wikimedia Commons'}{photo.license ? ` · ${photo.license}` : ''}
        </a>
      </div>
    </div>
  );
}
