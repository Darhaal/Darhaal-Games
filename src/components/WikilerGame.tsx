'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpenText, Check, Loader2, Send, X } from 'lucide-react';
import GameHeader from './GameHeader';
import GameRulesModal from './GameRulesModal';
import GameNotificationToast from './GameNotificationToast';
import GameLayout from './game/GameLayout';
import GameCard from './game/GameCard';
import TurnCard from './game/TurnCard';
import PlayersCard from './game/PlayersCard';
import ResultDialog from './game/ResultDialog';
import { BUTTON_PRIMARY, DIALOG_OVERLAY, DIALOG_PANEL, GAME_PAGE, LABEL } from './game/ui';
import { requireGame } from '@/games/registry';
import { GAME_RULES } from '@/constants/rules';
import { defaultAvatar } from '@/constants/app';
import { letterCount, readingVersion, type Token, type WikilerLang } from '@/lib/gameLogic/wikiler';
import { articleUrl, CC_BY_SA_URL, historyUrl } from '@/lib/wikiler/wikipedia';
import { useWikilerRound, type Feedback, type GuessEntry } from '@/hooks/useWikilerRound';
import { WIKILER_BETWEEN_ROUNDS_SECONDS } from '@/hooks/useWikilerGame';
import { DIFFICULTIES, TOPICS } from '@/data/wikiler/topics';
import ArticlePreview from './wikiler/ArticlePreview';
import { pluralEn, pluralRu } from '@/lib/plural';
import { playSfx } from '@/lib/sound';
import type { WikilerRoundResult, WikilerState } from '@/types/wikiler';
import { LANGUAGE_LINKS } from '@/lib/locale';

/**
 * Wikiler's screen — docs/wikiler-spec.md, section 7. The article is the
 * board; the cards beside it are the round, the score, the input and the
 * table. Built from the shared game parts (docs/design-system.md).
 */

const T = {
  ru: {
    roundOf: (n: number, m: number) => `Раунд ${n} из ${m}`,
    roundClock: 'раунд',
    whatArticle: 'Что это за статья?',
    solved: 'Угадано!',
    notSolved: 'Не угадано',
    waitOthers: 'Ждём остальных…',
    loading: 'Загружаем статью…',
    loadError: 'Не удалось загрузить статью',
    loadErrorNote: 'Википедия не ответила. Раунд закончится по времени.',
    startsIn: 'Раунд начнётся через',
    yourScore: 'Ваш счёт',
    attempts: (n: number) => `${n} ${pluralRu(n, ['попытка', 'попытки', 'попыток'])}`,
    attemptsOf: (n: number, max: number) => `${n} из ${max} попыток`,
    unlimitedHint: 'Попытки без ограничений',
    leftHint: (n: number) => `Осталось ${n} ${pluralRu(n, ['попытка', 'попытки', 'попыток'])}`,
    guessLabel: 'Угадать',
    word: 'Слово',
    article: 'Статья',
    wordPlaceholder: 'Напишите слово…',
    titlePlaceholder: 'Название статьи…',
    send: 'Отправить',
    switchHint: 'Tab — переключить',
    guesses: 'Ваши попытки',
    noGuesses: 'Пока пусто — начните с любого слова',
    feedbackWord: (text: string, n: number, cost: number) =>
      n === 0 ? `«${text}» — нет в статье (−${cost})` : `«${text}» — ${n} ${pluralRu(n, ['раз', 'раза', 'раз'])}${cost ? ` (−${cost})` : ''}`,
    repeat: 'Это слово уже открыто',
    empty: 'Напишите слово',
    several: 'По одному слову — название пишите во вкладке «Статья»',
    open: 'Это слово и так видно',
    titleWrong: (text: string) => `«${text}» — не та статья (−50)`,
    wait: 'Подождите…',
    checking: 'Проверяем…',
    letters: (n: number) => `${n} ${pluralRu(n, ['буква', 'буквы', 'букв'])}`,
    fromWikipedia: 'Статья из Википедии',
    authors: 'авторы',
    roundOver: 'Раунд завершён',
    itWas: 'Это была статья',
    alsoIn: 'На других языках',
    openInWikipedia: 'Открыть в Википедии',
    yourResult: 'Ваш результат',
    next: 'Далее',
    waitingGroup: 'Ждём остальных…',
    nextRoundIn: (s: number) => `Следующий раунд через ${s} с`,
    finishing: 'Считаем итоги…',
    youWin: 'Победа',
    winnerLabel: 'Победитель',
    total: 'Итог',
    guessed: 'угадал',
    missed: 'не угадал'
  },
  en: {
    roundOf: (n: number, m: number) => `Round ${n} of ${m}`,
    roundClock: 'round',
    whatArticle: 'Which article is it?',
    solved: 'Solved!',
    notSolved: 'Not solved',
    waitOthers: 'Waiting for the others…',
    loading: 'Loading the article…',
    loadError: 'Could not load the article',
    loadErrorNote: 'Wikipedia did not answer. The round will end on time.',
    startsIn: 'The round starts in',
    yourScore: 'Your score',
    attempts: (n: number) => `${n} ${pluralEn(n, 'attempt', 'attempts')}`,
    attemptsOf: (n: number, max: number) => `${n} of ${max} attempts`,
    unlimitedHint: 'Unlimited attempts',
    leftHint: (n: number) => `${n} ${pluralEn(n, 'attempt', 'attempts')} left`,
    guessLabel: 'Guess',
    word: 'Word',
    article: 'Article',
    wordPlaceholder: 'Type a word…',
    titlePlaceholder: 'Article title…',
    send: 'Send',
    switchHint: 'Tab to switch',
    guesses: 'Your attempts',
    noGuesses: 'Nothing yet — start with any word',
    feedbackWord: (text: string, n: number, cost: number) =>
      n === 0 ? `“${text}” — not in the article (−${cost})` : `“${text}” — ${n} ${pluralEn(n, 'time', 'times')}${cost ? ` (−${cost})` : ''}`,
    repeat: 'That word is already open',
    empty: 'Type a word',
    several: 'One word at a time — type the title in the Article tab',
    open: 'That word is shown anyway',
    titleWrong: (text: string) => `“${text}” — not this article (−50)`,
    wait: 'Wait a moment…',
    checking: 'Checking…',
    letters: (n: number) => `${n} ${pluralEn(n, 'letter', 'letters')}`,
    fromWikipedia: 'Article from Wikipedia',
    authors: 'authors',
    roundOver: 'Round over',
    itWas: 'The article was',
    alsoIn: 'In other languages',
    openInWikipedia: 'Open on Wikipedia',
    yourResult: 'Your result',
    next: 'Next',
    waitingGroup: 'Waiting for the others…',
    nextRoundIn: (s: number) => `Next round in ${s} s`,
    finishing: 'Adding up…',
    youWin: 'You win',
    winnerLabel: 'Winner',
    total: 'Total',
    guessed: 'solved',
    missed: 'missed'
  },
  uk: {
    roundOf: (n: number, m: number) => `Раунд ${n} з ${m}`,
    roundClock: 'раунд',
    whatArticle: 'Що це за стаття?',
    solved: 'Вгадано!',
    notSolved: 'Не вгадано',
    waitOthers: 'Чекаємо на решту…',
    loading: 'Завантажуємо статтю…',
    loadError: 'Не вдалося завантажити статтю',
    loadErrorNote: 'Вікіпедія не відповіла. Раунд закінчиться за часом.',
    startsIn: 'Раунд почнеться через',
    yourScore: 'Ваш рахунок',
    attempts: (n: number) => `${n} ${pluralRu(n, ['спроба', 'спроби', 'спроб'])}`,
    attemptsOf: (n: number, max: number) => `${n} з ${max} спроб`,
    unlimitedHint: 'Спроби без обмежень',
    leftHint: (n: number) => `Залишилося ${n} ${pluralRu(n, ['спроба', 'спроби', 'спроб'])}`,
    guessLabel: 'Вгадати',
    word: 'Слово',
    article: 'Стаття',
    wordPlaceholder: 'Напишіть слово…',
    titlePlaceholder: 'Назва статті…',
    send: 'Надіслати',
    switchHint: 'Tab — перемкнути',
    guesses: 'Ваші спроби',
    noGuesses: 'Поки порожньо — почніть із будь-якого слова',
    feedbackWord: (text: string, n: number, cost: number) =>
      n === 0 ? `«${text}» — немає в статті (−${cost})` : `«${text}» — ${n} ${pluralRu(n, ['раз', 'рази', 'разів'])}${cost ? ` (−${cost})` : ''}`,
    repeat: 'Це слово вже відкрите',
    empty: 'Напишіть слово',
    several: 'По одному слову — назву пишіть у вкладці «Стаття»',
    open: 'Це слово й так видно',
    titleWrong: (text: string) => `«${text}» — не та стаття (−50)`,
    wait: 'Зачекайте…',
    checking: 'Перевіряємо…',
    letters: (n: number) => `${n} ${pluralRu(n, ['літера', 'літери', 'літер'])}`,
    fromWikipedia: 'Стаття з Вікіпедії',
    authors: 'автори',
    roundOver: 'Раунд завершено',
    itWas: 'Це була стаття',
    alsoIn: 'Іншими мовами',
    openInWikipedia: 'Відкрити у Вікіпедії',
    yourResult: 'Ваш результат',
    next: 'Далі',
    waitingGroup: 'Чекаємо на решту…',
    nextRoundIn: (s: number) => `Наступний раунд через ${s} с`,
    finishing: 'Рахуємо підсумки…',
    youWin: 'Перемога',
    winnerLabel: 'Переможець',
    total: 'Підсумок',
    guessed: 'вгадав',
    missed: 'не вгадав'
  }
};

type Texts = (typeof T)['ru' | 'en' | 'uk'];

function describe(feedback: Feedback, t: Texts): { text: string; good: boolean } | null {
  switch (feedback.kind) {
    case 'word': return { text: t.feedbackWord(feedback.text, feedback.occurrences, feedback.cost), good: feedback.occurrences > 0 };
    case 'repeat': return { text: t.repeat, good: false };
    case 'invalid': return { text: t[feedback.reason], good: false };
    case 'title-wrong': return { text: t.titleWrong(feedback.text), good: false };
    case 'wait': return { text: t.wait, good: false };
    case 'solved': return null;
  }
}

/** A word's width in em, set in the given font weight. */
type Measure = (text: string, weight: number) => number;

/** From the letter count: close, but not what the word will take once it opens. */
const estimateWidth: Measure = (text) => Math.max(1, letterCount(text)) * 0.58 + 0.2;

/**
 * Word widths for the grey blocks. Once the page font has loaded, each block
 * is measured to the exact width its word takes, so opening a word swaps the
 * block for the word in place — nothing reflows and the paragraph does not
 * jump. Until then, and on the server, the estimate.
 */
function useWordWidths(): Measure {
  const [measure, setMeasure] = useState<Measure>(() => estimateWidth);
  useEffect(() => {
    let cancelled = false;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const family = getComputedStyle(document.body).fontFamily;
      const cache = new Map<string, number>();
      setMeasure(() => (text: string, weight: number) => {
        const key = `${weight}|${text}`;
        let width = cache.get(key);
        if (width === undefined) {
          ctx.font = `${weight} 100px ${family}`;
          width = ctx.measureText(text).width / 100;
          cache.set(key, width);
        }
        return width;
      });
    });
    return () => { cancelled = true; };
  }, []);
  return measure;
}

/** A hidden word: a grey block its own width, with its letter count — always, or on a tap. */
function Hidden({ text, width, peek, onPeek, label }: { text: string; width: number; peek: boolean; onPeek: () => void; label: string }) {
  const n = letterCount(text);
  return (
    <button
      type="button"
      onClick={onPeek}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center align-baseline bg-line hover:bg-[#D9D3CC] dark:hover:bg-[#363D46] rounded-[3px] h-[1.05em] translate-y-[0.12em] transition-colors"
      style={{ width: `${Math.max(0.5, width)}em` }}
    >
      {peek && <span className="text-[0.62em] font-black text-muted tabular-nums leading-none">{n}</span>}
    </button>
  );
}

function Tokens({ tokens, revealed, showAll, lastKey, peekId, onPeek, letters, measure, weight, idPrefix, t }: {
  tokens: Token[];
  /** Sizes the grey blocks; `weight` is the font weight they sit in. */
  measure: Measure;
  weight: number;
  /** Every hidden word shows its letter count, not just the tapped one (a lobby setting). */
  letters: boolean;
  revealed: ReadonlySet<string>;
  showAll: boolean;
  lastKey: string | null;
  peekId: string | null;
  onPeek: (id: string) => void;
  idPrefix: string;
  t: Texts;
}) {
  return (
    <>
      {tokens.map((token, i) => {
        if (token.kind === 'sep' || token.key === null) return <React.Fragment key={i}>{token.text}</React.Fragment>;
        if (revealed.has(token.key)) {
          // Fades in where its block was; the newest word's mark fades out
          // when the next one opens, rather than blinking off.
          return (
            <span
              key={i}
              data-key={token.key}
              className={`rounded-[3px] animate-word-in motion-reduce:animate-none transition-[background-color,box-shadow] duration-700 ease-out ${
                token.key === lastKey ? 'bg-accent/10 shadow-[0_0_0_2px_rgba(158,19,22,0.1)]' : 'bg-transparent shadow-[0_0_0_2px_rgba(158,19,22,0)]'
              }`}
            >
              {token.text}
            </span>
          );
        }
        if (showAll) return <span key={i} className="text-faded">{token.text}</span>;
        const id = `${idPrefix}-${i}`;
        return <Hidden key={i} text={token.text} width={measure(token.text, weight)} peek={letters || peekId === id} onPeek={() => onPeek(id)} label={t.letters(letterCount(token.text))} />;
      })}
    </>
  );
}

interface WikilerGameProps {
  gameState: WikilerState;
  userId: string;
  lobbyId: string;
  lang: 'ru' | 'en' | 'uk';
  reportProgress: (attempts: number, tabLeaves: number) => void;
  finishRound: (result: WikilerRoundResult, tabLeaves: number) => void;
  forceRoundEnd: () => void;
  readyNextRound: () => void;
  forceNextRound: () => void;
  leaveGame: () => void;
}

export default function WikilerGame({
  gameState, userId, lobbyId, lang, reportProgress, finishRound, forceRoundEnd,
  readyNextRound, forceNextRound, leaveGame
}: WikilerGameProps) {
  const t = T[lang];
  const { settings, round } = gameState;
  const me = gameState.players.find((p) => p.id === userId);
  const isPlaying = gameState.status === 'playing';
  const isRoundEnd = gameState.status === 'round_end';
  const isFinished = gameState.status === 'finished';
  const durationMs = settings.roundDuration * 1000;
  const limit = settings.mode === 'limited' ? settings.attempts : null;
  // The version this player reads: their language when the host found it there.
  const myLang = me?.lang;
  const reading = useMemo(
    () => (round ? readingVersion(round, settings, myLang) : null),
    [round, settings, myLang]
  );
  // The same article in the other languages at the table, for the results.
  const otherVersions = useMemo(() => {
    if (!round || !reading) return [];
    const all: Array<{ lang: WikilerLang; title: string }> = [
      { lang: settings.lang, title: round.title },
      ...Object.entries(round.versions ?? {}).map(([l, v]) => ({ lang: l as WikilerLang, title: v!.title }))
    ];
    return all.filter((v) => v.lang !== reading.lang);
  }, [round, reading, settings.lang]);

  const [showRules, setShowRules] = useState(false);
  const [resultHidden, setResultHidden] = useState(false);
  const [mode, setMode] = useState<'word' | 'title'>('word');
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const togglePeek = useCallback((id: string) => setPeekId((p) => (p === id ? null : id)), []);
  const measure = useWordWidths();

  // Leaving the tab mid-round is counted and shown in the results.
  const [tabLeaves, setTabLeaves] = useState(0);
  const tabLeavesRef = useRef(0);
  useEffect(() => { tabLeavesRef.current = tabLeaves; }, [tabLeaves]);

  const onFinish = useCallback((result: WikilerRoundResult) => {
    playSfx(result.solved ? 'success' : 'lose');
    finishRound(result, tabLeavesRef.current);
  }, [finishRound]);

  const r = useWikilerRound({
    lobbyId,
    round,
    version: reading,
    hidden: settings.hidden,
    durationMs,
    limit,
    alreadyDone: !!me?.done || !isPlaying,
    onFinish
  });

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

  // Out of time: this player's round ends; well past it, anyone closes it for
  // someone who vanished.
  const { timeUp } = r;
  const forced = useRef<string | null>(null);
  useEffect(() => {
    if (!isPlaying || !round || clock < round.startTime) return;
    if (clock - round.startTime >= durationMs && !me?.done) timeUp();
    if (clock - round.startTime >= durationMs + 10_000 && forced.current !== round.seed) {
      forced.current = round.seed;
      forceRoundEnd();
    }
  }, [clock, isPlaying, round, durationMs, me?.done, timeUp, forceRoundEnd]);

  useEffect(() => {
    if (!isPlaying || me?.done) return;
    const onHide = () => { if (document.visibilityState === 'hidden') setTabLeaves((n) => n + 1); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [isPlaying, me?.done]);

  // Attempts reach the table at most every three seconds — twenty players
  // typing fast would otherwise flood the room.
  const { attempts } = r;
  useEffect(() => {
    if (!isPlaying || me?.done) return;
    const timer = setTimeout(() => reportProgress(attempts, tabLeaves), 3000);
    return () => clearTimeout(timer);
  }, [attempts, tabLeaves, isPlaying, me?.done, reportProgress]);

  // Between rounds: a minute to read the answer, then the next round starts for everyone.
  const [nextRoundIn, setNextRoundIn] = useState<number | null>(null);
  useEffect(() => {
    const endedAt = gameState.roundEndedAt;
    if (!isRoundEnd || !endedAt) return;
    let fired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil(WIKILER_BETWEEN_ROUNDS_SECONDS - (Date.now() - endedAt) / 1000));
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

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (r.pending) return;
    const value = input;
    const result = mode === 'word' ? r.guessWord(value) : await r.guessTitle(value);
    setFeedback(result);
    if (result.kind === 'word' || result.kind === 'title-wrong' || result.kind === 'solved') setInput('');
    if (result.kind === 'title-wrong') playSfx('error');
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setMode((m) => (m === 'word' ? 'title' : 'word'));
    }
  };

  const scrollTo = (key: string) => {
    document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const lastKey = [...r.guesses].reverse().find((g) => g.key)?.key ?? null;
  const showAll = !!me?.done || !isPlaying;
  // Steps once a second with the clock, not four uneven steps a second.
  const liveScore = me?.done
    ? me.result?.score ?? 0
    : r.scoreNow(round ? round.startTime + Math.floor(elapsedMs / 1000) * 1000 : clock);
  const roundNumber = gameState.roundIndex + 1;
  const described = feedback ? describe(feedback, t) : null;
  const wiki = reading?.lang ?? settings.lang;
  const readTitle = reading?.title ?? round?.title ?? '';

  const ranked = useMemo(() => [...gameState.players].sort((a, b) => b.score - a.score), [gameState.players]);
  const top = ranked[0]?.score ?? 0;
  const winners = isFinished ? ranked.filter((p) => p.score === top) : [];
  const iWon = winners.some((w) => w.id === userId);

  const inputForm = (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid grid-cols-2 gap-1 p-1 bg-page rounded-xl border border-line" role="tablist">
        {(['word', 'title'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`py-1.5 rounded-lg text-2xs font-black uppercase tracking-widest transition-all ${
              mode === m ? 'bg-ink text-on-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {m === 'word' ? t.word : t.article}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKey}
          disabled={!r.canGuess}
          placeholder={mode === 'word' ? t.wordPlaceholder : t.titlePlaceholder}
          aria-label={mode === 'word' ? t.wordPlaceholder : t.titlePlaceholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-page border border-gray-200 focus:bg-surface focus:border-ink rounded-xl py-2.5 px-3 font-bold text-ink outline-none transition-all placeholder:text-gray-400 text-sm disabled:opacity-50"
        />
        <button type="submit" disabled={!r.canGuess || r.pending} aria-label={t.send} className={`px-3.5 ${BUTTON_PRIMARY} disabled:opacity-50`}>
          {r.pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <div className="min-h-4 text-2xs font-bold">
        {r.pending ? <span className="text-muted">{t.checking}</span>
          : described ? <span className={described.good ? 'text-emerald-600' : 'text-muted'}>{described.text}</span>
          : <span className="text-faded hidden lg:inline">{t.switchHint}</span>}
      </div>
    </form>
  );

  const board = (
    <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
      <div className="p-5 md:p-7">
        {/* Once the round is over for this player — above all after a miss — what the article was. */}
        {showAll && round && (
          <div className="mb-6">
            <ArticlePreview wikiLang={wiki} title={readTitle} label={t.itWas} openLabel={t.openInWikipedia} />
          </div>
        )}
        <h2 className="text-2xl md:text-3xl font-black text-ink leading-snug mb-5">
          {r.article ? (
            <Tokens tokens={r.article.titleTokens} revealed={r.revealed} showAll={showAll} lastKey={lastKey} peekId={peekId} onPeek={togglePeek} letters={settings.showLetters} measure={measure} weight={900} idPrefix="t" t={t} />
          ) : <span className="text-faded">· · ·</span>}
        </h2>

        {r.loadError ? (
          <div className="py-10 text-center">
            <div className="font-black text-ink">{t.loadError}</div>
            <div className="text-sm text-muted mt-1">{t.loadErrorNote}</div>
          </div>
        ) : !r.article ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm font-bold text-muted">
            <Loader2 className="w-4 h-4 animate-spin text-accent" /> {t.loading}
          </div>
        ) : (
          <div className="relative">
            {isPlaying && startsIn > 0 && (
              <div className="absolute inset-0 z-10 bg-surface/85 backdrop-blur-[2px] flex flex-col items-center justify-start pt-16">
                <div className={LABEL}>{t.startsIn}</div>
                <div className="text-6xl font-black text-ink tabular-nums mt-2">{startsIn}</div>
              </div>
            )}
            <div className="text-sm md:text-base leading-7 text-ink space-y-4 break-words">
              {r.article.blocks.map((block, i) =>
                block.heading ? (
                  <h3 key={i} className="text-lg font-black pt-2">
                    <Tokens tokens={block.tokens} revealed={r.revealed} showAll={showAll} lastKey={lastKey} peekId={peekId} onPeek={togglePeek} letters={settings.showLetters} measure={measure} weight={900} idPrefix={`b${i}`} t={t} />
                  </h3>
                ) : (
                  <p key={i}>
                    <Tokens tokens={block.tokens} revealed={r.revealed} showAll={showAll} lastKey={lastKey} peekId={peekId} onPeek={togglePeek} letters={settings.showLetters} measure={measure} weight={400} idPrefix={`b${i}`} t={t} />
                  </p>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* CC BY-SA credit. During a round it cannot name the article — that would give it away. */}
      <div className="px-5 md:px-7 py-3 border-t border-divider text-2xs font-medium text-muted">
        {showAll && round ? (
          <>
            <a href={articleUrl(wiki, readTitle)} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">{readTitle}</a>
            {' · '}{t.fromWikipedia}{' · '}
            <a href={CC_BY_SA_URL[lang]} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">CC BY-SA 4.0</a>
            {' · '}
            <a href={historyUrl(wiki, readTitle)} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">{t.authors}</a>
          </>
        ) : (
          <>
            {t.fromWikipedia} · <a href={CC_BY_SA_URL[lang]} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">CC BY-SA 4.0</a>
          </>
        )}
      </div>
    </div>
  );

  const statusTitle = !isPlaying ? t.roundOver
    : me?.done ? (me.result?.solved ? t.solved : t.notSolved)
    : t.whatArticle;
  const statusHint = me?.done && isPlaying ? t.waitOthers
    : limit !== null ? t.leftHint(Math.max(0, limit - attempts)) : t.unlimitedHint;

  const side = (
    <>
      <TurnCard
        lang={lang}
        label={[
          t.roundOf(Math.min(roundNumber, settings.rounds), settings.rounds),
          TOPICS[settings.topic].label[lang],
          ...(settings.difficulty && settings.difficulty !== 'any' ? [DIFFICULTIES[settings.difficulty].label[lang]] : [])
        ].join(' · ')}
        title={statusTitle}
        hint={statusHint}
        secondsLeft={isPlaying && startsIn <= 0 ? secondsLeft : undefined}
        turnSeconds={settings.roundDuration}
      />

      <GameCard label={t.yourScore}>
        <div className="flex items-end justify-between">
          <div className="text-4xl font-black text-ink tabular-nums leading-none">{isPlaying ? liveScore : me?.score ?? 0}</div>
          <div className="text-xs font-bold text-muted tabular-nums">
            {limit !== null ? t.attemptsOf(attempts, limit) : t.attempts(attempts)}
          </div>
        </div>
      </GameCard>

      <GameCard label={t.guessLabel} className="hidden lg:block">
        {inputForm}
      </GameCard>

      <GameCard label={t.guesses}>
        {r.guesses.length === 0 ? (
          <p className="text-xs font-medium text-muted">{t.noGuesses}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
            {[...r.guesses].reverse().map((g: GuessEntry, i) => (
              <button
                key={i}
                type="button"
                onClick={() => g.key && scrollTo(g.key)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-bold transition-colors ${
                  g.kind === 'title'
                    ? g.correct ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-600'
                    : g.occurrences ? 'bg-surface border-line text-ink hover:border-accent/30' : 'bg-page border-line text-faded'
                }`}
              >
                {g.kind === 'title' && (g.correct ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />)}
                {g.text}
                {g.kind === 'word' && <span className="tabular-nums text-muted">{g.occurrences}</span>}
              </button>
            ))}
          </div>
        )}
      </GameCard>

      <PlayersCard
        lang={lang}
        rows={gameState.players.map((p) => {
          const after = !isPlaying;
          return {
            id: p.id,
            name: p.name,
            avatarUrl: p.avatarUrl || defaultAvatar(p.id),
            isHost: p.isHost,
            isMe: p.id === userId,
            won: isFinished && winners.some((w) => w.id === p.id),
            stat: isFinished ? undefined : (
              <span className={p.done ? (p.result?.solved ? 'text-emerald-600' : 'text-faded') : ''}>
                {/* During a round, others see attempts and a tick — not scores. */}
                {p.done && isPlaying ? (p.result?.solved ? `✓ ${t.guessed}` : t.missed) : t.attempts(p.attempts)}
              </span>
            ),
            aside: after ? <span className="text-sm font-black text-ink tabular-nums">{p.score}</span> : undefined
          };
        })}
      />
    </>
  );

  const lastResult = me?.history[me.history.length - 1];
  const roundRanked = [...gameState.players].sort((a, b) =>
    (b.history[b.history.length - 1]?.score ?? 0) - (a.history[a.history.length - 1]?.score ?? 0));

  return (
    <div className={GAME_PAGE}>
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />
      <GameHeader
        title={requireGame('wikiler').name[lang]}
        icon={BookOpenText}
        timeLeft={secondsLeft}
        showTime={isPlaying && startsIn <= 0}
        timeCaption={t.roundClock}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
      />
      <GameRulesModal isOpen={showRules} onClose={() => setShowRules(false)} rules={GAME_RULES[lang].wikiler} />

      <GameLayout board={board} side={side} boardWidth={820} />
      {/* Room for the phone's input bar, so the last lines are not hidden under it. */}
      {isPlaying && !me?.done && <div className="lg:hidden h-28" aria-hidden />}

      {/* On a phone the input stays under the thumb instead of below the article. */}
      {isPlaying && !me?.done && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(26,31,38,0.15)]">
          {inputForm}
        </div>
      )}

      {/* Between rounds */}
      {isRoundEnd && round && (
        <div role="dialog" aria-modal="true" aria-label={t.roundOver} className={DIALOG_OVERLAY}>
          <div className={`${DIALOG_PANEL} max-w-lg max-h-[90vh] overflow-y-auto`}>
            <div className={LABEL}>{t.roundOf(roundNumber, settings.rounds)}</div>
            <h2 className="text-2xl font-black text-ink mt-1 mb-4">{t.roundOver}</h2>

            <div className="mb-4">
              <ArticlePreview wikiLang={wiki} title={readTitle} label={t.itWas} openLabel={t.openInWikipedia} compact />
              {otherVersions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
                  <span>{t.alsoIn}:</span>
                  {otherVersions.map((v) => (
                    <a key={v.lang} href={articleUrl(v.lang, v.title)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-page border border-line px-2 py-1 rounded-md hover:border-accent/30 hover:text-accent transition-colors">
                      <span className="text-2xs font-black uppercase">{LANGUAGE_LINKS.find((l) => l.locale === v.lang)?.short ?? v.lang}</span>
                      <span className="text-ink">{v.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className={`p-4 rounded-xl border mb-4 flex items-center justify-between ${lastResult?.solved ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <div>
                <div className="font-bold text-ink text-sm">{t.yourResult}</div>
                <div className={`text-xs font-bold ${lastResult?.solved ? 'text-emerald-700' : 'text-red-600'}`}>
                  {lastResult?.solved ? t.solved : t.notSolved} · {t.attempts(lastResult?.attempts ?? 0)}
                </div>
              </div>
              <div className="font-black text-xl text-ink tabular-nums">+{lastResult?.score ?? 0}</div>
            </div>

            <div className="divide-y divide-divider border-y border-divider mb-4">
              {roundRanked.map((p) => {
                const res = p.history[p.history.length - 1];
                return (
                  <div key={p.id} className="flex items-center gap-3 py-2">
                    <span className={`w-2 h-2 rounded-full ${p.isReadyForNextRound ? 'bg-emerald-500' : 'bg-line'}`} />
                    <span className="flex-1 text-sm font-bold text-ink truncate">{p.name}</span>
                    <span className="text-xs font-bold text-muted">{res?.solved ? '✓' : '—'}</span>
                    <span className="w-12 text-right text-sm font-black tabular-nums">+{res?.score ?? 0}</span>
                  </div>
                );
              })}
            </div>

            {!me?.isReadyForNextRound ? (
              <button autoFocus onClick={readyNextRound} className={`w-full py-3.5 flex items-center justify-center gap-2 ${BUTTON_PRIMARY}`}>
                {roundNumber >= settings.rounds ? t.total : t.next} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-full py-3.5 bg-page border border-line text-muted rounded-xl font-bold uppercase text-xs tracking-wide text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {roundNumber >= settings.rounds ? t.finishing : t.waitingGroup}
              </div>
            )}
            {nextRoundIn !== null && (
              <p className="mt-3 text-center text-xs font-bold text-muted tabular-nums">{t.nextRoundIn(nextRoundIn)}</p>
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
        gameId="wikiler"
        parentState={gameState}
        onMenu={leaveGame}
        wide
      >
        <div className="divide-y divide-divider border-y border-divider">
          {ranked.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <span className="w-5 text-xs font-black text-muted tabular-nums">{i + 1}</span>
              <span className="flex-1 text-sm font-bold text-ink truncate text-left">{p.name}</span>
              <span className="text-xs font-bold text-muted tabular-nums">{p.history.filter((h) => h.solved).length}/{p.history.length}</span>
              <span className="w-14 text-right text-sm font-black tabular-nums">{p.score}</span>
            </div>
          ))}
        </div>
      </ResultDialog>
    </div>
  );
}
