'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ExternalLink, Loader2, Music, Pause, Play, SkipForward, Volume2, X } from 'lucide-react';
import GameHeader from './GameHeader';
import GameRulesModal from './GameRulesModal';
import GameNotificationToast from './GameNotificationToast';
import GameLayout from './game/GameLayout';
import GameCard from './game/GameCard';
import TurnCard from './game/TurnCard';
import PlayersCard from './game/PlayersCard';
import ResultDialog from './game/ResultDialog';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_OVERLAY, DIALOG_PANEL, GAME_PAGE, LABEL } from './game/ui';
import { requireGame } from '@/games/registry';
import { GAME_RULES } from '@/constants/rules';
import { defaultAvatar } from '@/constants/app';
import { DIFFICULTIES } from '@/data/difficulty';
import { CATEGORIES } from '@/data/songler/categories';
import { useGameKeys } from '@/hooks/useGameKeys';
import { SONGLER_BETWEEN_ROUNDS_SECONDS } from '@/hooks/useSonglerGame';
import { MAX_ATTEMPTS, SNIPPET_SECONDS, isDone, snippetSeconds } from '@/lib/gameLogic/songler';
import { coverUrl, deezerUrl, loadPool, suggest, type SonglerPool } from '@/lib/songler/pool';
import { preloadSong, useSnippetPlayer } from '@/lib/songler/audio';
import { playSfx } from '@/lib/sound';
import type { SonglerAttempt, SonglerRoundResult, SonglerSong, SonglerState } from '@/types/songler';

/**
 * Songler's screen — docs/songler-spec.md, sections 2–5. The player is the
 * board: the snippet, its growing bar, your tries and the answer field;
 * beside it the round, the score and the table. After a round, the song and
 * everyone's result. Built from the shared game parts (docs/design-system.md).
 */

const T = {
  ru: {
    roundOf: (n: number, total: number) => `Раунд ${n} из ${total}`,
    roundClock: 'раунд',
    whatSong: 'Что за песня?',
    solved: 'Угадано!',
    outOfTries: 'Попытки кончились',
    roundOver: 'Раунд окончен',
    hintPick: 'Слушайте и выбирайте песню из подсказок',
    hintWait: 'Ждём остальных',
    startsIn: 'Начинаем через',
    loading: 'Загружаем отрывок…',
    loadError: 'Отрывок не загрузился — попытки можно пропускать',
    play: 'Слушать',
    stop: 'Стоп',
    snippet: (s: string) => `Отрывок: ${s} с`,
    whole: 'Весь отрывок',
    placeholder: 'Название или исполнитель…',
    noMatches: 'Такой песни в игре нет',
    skip: (s: string) => `Пропустить · +${s} с`,
    giveUp: 'Сдаться',
    volume: 'Громкость',
    tries: 'Попытки',
    right: 'угадано',
    artist: 'исполнитель верный',
    wrong: 'мимо',
    skipped: 'пропуск',
    yourScore: 'Ваш счёт',
    triesOf: (n: number) => `попытка ${n} из ${MAX_ATTEMPTS}`,
    guessed: 'угадал ✓',
    missed: 'не угадал',
    solvedOn: (n: number) => `с ${n}-й попытки`,
    artistOnly: 'только исполнитель',
    noSolve: 'не угадал',
    onDeezer: 'Deezer',
    next: 'Далее',
    total: 'Итоги',
    waitingGroup: 'Ждём остальных…',
    finishing: 'Подводим итоги…',
    nextRoundIn: (s: number) => `Следующий раунд через ${s} с`,
    youWin: 'Вы победили!',
    winnerLabel: 'Победитель',
    named: 'угадано'
  },
  en: {
    roundOf: (n: number, total: number) => `Round ${n} of ${total}`,
    roundClock: 'round',
    whatSong: 'What song is this?',
    solved: 'Got it!',
    outOfTries: 'Out of tries',
    roundOver: 'Round over',
    hintPick: 'Listen, then pick the song from the suggestions',
    hintWait: 'Waiting for the others',
    startsIn: 'Starting in',
    loading: 'Loading the snippet…',
    loadError: 'The snippet did not load — you can still skip',
    play: 'Play',
    stop: 'Stop',
    snippet: (s: string) => `Snippet: ${s} s`,
    whole: 'The whole preview',
    placeholder: 'Title or artist…',
    noMatches: 'No such song in the game',
    skip: (s: string) => `Skip · +${s} s`,
    giveUp: 'Give up',
    volume: 'Volume',
    tries: 'Tries',
    right: 'right',
    artist: 'right artist',
    wrong: 'wrong',
    skipped: 'skipped',
    yourScore: 'Your score',
    triesOf: (n: number) => `try ${n} of ${MAX_ATTEMPTS}`,
    guessed: 'got it ✓',
    missed: 'missed',
    solvedOn: (n: number) => `on try ${n}`,
    artistOnly: 'artist only',
    noSolve: 'missed',
    onDeezer: 'Deezer',
    next: 'Next',
    total: 'Results',
    waitingGroup: 'Waiting for the others…',
    finishing: 'Totting up…',
    nextRoundIn: (s: number) => `Next round in ${s} s`,
    youWin: 'You win!',
    winnerLabel: 'Winner',
    named: 'named'
  },
  uk: {
    roundOf: (n: number, total: number) => `Раунд ${n} з ${total}`,
    roundClock: 'раунд',
    whatSong: 'Що за пісня?',
    solved: 'Вгадано!',
    outOfTries: 'Спроби скінчилися',
    roundOver: 'Раунд закінчено',
    hintPick: 'Слухайте й обирайте пісню з підказок',
    hintWait: 'Чекаємо на решту',
    startsIn: 'Починаємо через',
    loading: 'Завантажуємо уривок…',
    loadError: 'Уривок не завантажився — спроби можна пропускати',
    play: 'Слухати',
    stop: 'Стоп',
    snippet: (s: string) => `Уривок: ${s} с`,
    whole: 'Увесь уривок',
    placeholder: 'Назва або виконавець…',
    noMatches: 'Такої пісні в грі немає',
    skip: (s: string) => `Пропустити · +${s} с`,
    giveUp: 'Здатися',
    volume: 'Гучність',
    tries: 'Спроби',
    right: 'вгадано',
    artist: 'виконавець правильний',
    wrong: 'повз',
    skipped: 'пропуск',
    yourScore: 'Ваш рахунок',
    triesOf: (n: number) => `спроба ${n} з ${MAX_ATTEMPTS}`,
    guessed: 'вгадав ✓',
    missed: 'не вгадав',
    solvedOn: (n: number) => `з ${n}-ї спроби`,
    artistOnly: 'лише виконавець',
    noSolve: 'не вгадав',
    onDeezer: 'Deezer',
    next: 'Далі',
    total: 'Підсумки',
    waitingGroup: 'Чекаємо на решту…',
    finishing: 'Підбиваємо підсумки…',
    nextRoundIn: (s: number) => `Наступний раунд через ${s} с`,
    youWin: 'Ви перемогли!',
    winnerLabel: 'Переможець',
    named: 'вгадано'
  }
};
type Texts = (typeof T)['ru'];

/** Seconds as the reader writes them: 0,5 in Russian, 0.5 in English. */
// A decimal comma in Russian and Ukrainian
const secs = (s: number, lang: 'ru' | 'en' | 'uk') => (lang === 'en' ? String(s) : String(s).replace('.', ','));

interface SonglerGameProps {
  gameState: SonglerState;
  userId: string;
  lang: 'ru' | 'en' | 'uk';
  attempt: (guess: { id: number; title: string; artist: string } | null) => Promise<void>;
  forceRoundEnd: () => void;
  readyNextRound: () => void;
  forceNextRound: () => void;
  leaveGame: () => void;
}

export default function SonglerGame({
  gameState, userId, lang, attempt, forceRoundEnd, readyNextRound, forceNextRound, leaveGame
}: SonglerGameProps) {
  const t = T[lang];
  const { settings, round } = gameState;
  const me = gameState.players.find((p) => p.id === userId);
  const isPlaying = gameState.status === 'playing';
  const isRoundEnd = gameState.status === 'round_end';
  const isFinished = gameState.status === 'finished';
  const durationMs = settings.roundDuration * 1000;
  const song = round?.song ?? null;
  const roundKey = `${gameState.roundIndex}:${song?.id ?? ''}`;
  const myAttempts = useMemo(() => (isPlaying ? me?.attempts ?? [] : []), [isPlaying, me?.attempts]);
  const done = isDone(myAttempts);

  const [showRules, setShowRules] = useState(false);
  const [resultHidden, setResultHidden] = useState(false);

  // The audio. Everyone may hear the whole preview once the round is over,
  // or once they are done with it.
  const player = useSnippetPlayer(song?.id ?? null);
  const unlocked = snippetSeconds(myAttempts.length, done || !isPlaying, Math.round(player.duration));
  const scale = done || !isPlaying ? Math.max(15, player.duration) : 15;

  // The whole pool, for the suggestions.
  const [pool, setPool] = useState<SonglerPool | null>(null);
  useEffect(() => {
    let live = true;
    loadPool().then((p) => { if (live) setPool(p); });
    return () => { live = false; };
  }, []);

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
  const canGuess = isPlaying && !!me && !done && startsIn <= 0 && elapsedMs < durationMs + 1000;
  const canPlay = player.status === 'ready' && (isPlaying ? startsIn <= 0 : true);

  // Out of time: anyone still here closes the round, once.
  const forced = useRef<string | null>(null);
  useEffect(() => {
    if (!isPlaying || !round) return;
    if (clock - round.startTime >= durationMs + 1500 && forced.current !== roundKey) {
      forced.current = roundKey;
      forceRoundEnd();
    }
  }, [clock, isPlaying, round, durationMs, roundKey, forceRoundEnd]);

  // The next song starts loading while everyone looks at the results.
  useEffect(() => {
    if (gameState.next) preloadSong(gameState.next.id);
  }, [gameState.next]);

  // A round that ends stops the snippet.
  const { stop } = player;
  useEffect(() => { if (!isPlaying) stop(); }, [isPlaying, stop]);

  // Between rounds: a minute to look, then the next round starts for everyone.
  const [nextRoundIn, setNextRoundIn] = useState<number | null>(null);
  useEffect(() => {
    const endedAt = gameState.roundEndedAt;
    if (!isRoundEnd || !endedAt) return;
    let fired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil(SONGLER_BETWEEN_ROUNDS_SECONDS - (Date.now() - endedAt) / 1000));
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

  // The answer field, keyed by the round so a new round starts clean.
  const [field, setField] = useState({ key: roundKey, query: '', active: 0, open: false });
  const draft = field.key === roundKey ? field : { key: roundKey, query: '', active: 0, open: false };
  const setDraft = (patch: Partial<typeof draft>) => setField({ ...draft, ...patch });
  const tried = useMemo(() => new Set(myAttempts.flatMap((a) => (a.guess ? [a.guess.id] : []))), [myAttempts]);
  const options = useMemo(() => (pool && draft.query ? suggest(pool, draft.query, 8, tried) : []), [pool, draft.query, tried]);

  const togglePlay = () => {
    if (!canPlay) return;
    if (player.playing) player.stop();
    else player.play(unlocked);
  };

  /** A try. After a miss the longer snippet plays at once — the press is the gesture it needs. */
  const send = async (guess: SonglerSong | null) => {
    if (!canGuess || !song) return;
    setDraft({ query: '', active: 0, open: false });
    const right = !!guess && (guess.id === song.id);
    await attempt(guess ? { id: guess.id, title: guess.title, artist: guess.artist } : null);
    const tries = myAttempts.length + 1;
    if (right) {
      playSfx('success');
      return;
    }
    if (guess) playSfx('error');
    if (tries < MAX_ATTEMPTS && player.status === 'ready') player.play(SNIPPET_SECONDS[tries]);
  };

  const onFieldKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setDraft({ active: Math.min(options.length - 1, draft.active + 1), open: true }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setDraft({ active: Math.max(0, draft.active - 1), open: true }); }
    else if (e.key === 'Escape') setDraft({ open: false });
    else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = options[draft.active] ?? options[0];
      if (pick) send(pick);
    }
  };

  // Space plays, outside the answer field (docs/games.md → Controls).
  useGameKeys(canPlay, (e) => {
    if (e.key === ' ') { togglePlay(); return true; }
  });

  const ranked = useMemo(() => [...gameState.players].sort((a, b) => b.score - a.score), [gameState.players]);
  const top = ranked[0]?.score ?? 0;
  const winners = isFinished ? ranked.filter((p) => p.score === top) : [];
  const iWon = winners.some((w) => w.id === userId);
  const roundNumber = gameState.roundIndex + 1;

  // ------------------------------------------------------------- the board --

  const status = !isPlaying ? null
    : startsIn > 0 ? null
    : player.status === 'loading' ? t.loading
    : player.status === 'error' ? t.loadError
    : done ? t.whole
    : t.snippet(secs(unlocked, lang));

  const board = (
    <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
      <div className="relative p-5 md:p-7">
        {isPlaying && startsIn > 0 && (
          <div className="absolute inset-0 z-10 bg-surface/90 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className={LABEL}>{t.startsIn}</div>
            <div className="text-6xl font-black text-ink tabular-nums mt-2">{startsIn}</div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canPlay}
            aria-label={player.playing ? t.stop : t.play}
            className="w-16 h-16 shrink-0 rounded-full bg-ink text-on-ink flex items-center justify-center hover:bg-accent disabled:opacity-40 disabled:hover:bg-ink transition-colors shadow-md"
          >
            {player.status === 'loading' ? <Loader2 className="w-6 h-6 animate-spin" />
              : player.playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </button>
          <div className="flex-1 min-w-0">
            <SnippetBar unlocked={unlocked} scale={scale} elapsed={player.playing ? player.elapsed : 0} showSteps={isPlaying && !done} />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-muted tabular-nums truncate">{status}</span>
              <label className="flex items-center gap-1.5 text-muted shrink-0" title={t.volume}>
                <Volume2 className="w-3.5 h-3.5" />
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={player.volume}
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  aria-label={t.volume}
                  className="w-20 h-1 accent-ink cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {isPlaying && (
          <>
            <AttemptRows attempts={myAttempts} t={t} />
            {!done ? (
              <div className="mt-4 space-y-2">
                <div className="relative">
                  <input
                    value={draft.query}
                    onChange={(e) => setDraft({ query: e.target.value, active: 0, open: true })}
                    onFocus={() => setDraft({ open: true })}
                    onBlur={() => setTimeout(() => setField((f) => (f.key === roundKey ? { ...f, open: false } : f)), 150)}
                    onKeyDown={onFieldKey}
                    disabled={!canGuess}
                    placeholder={t.placeholder}
                    aria-label={t.placeholder}
                    autoComplete="off"
                    className="w-full bg-page border border-gray-200 focus:bg-surface focus:border-ink rounded-xl py-3 px-4 font-bold text-sm text-ink outline-none transition-all disabled:opacity-50"
                  />
                  {draft.open && draft.query && (
                    <ul role="listbox" className="absolute z-20 left-0 right-0 bottom-full mb-2 bg-surface border border-line rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                      {options.length === 0 && (
                        <li className="px-4 py-3 text-xs font-bold text-muted">{pool ? t.noMatches : t.loading}</li>
                      )}
                      {options.map((o, i) => (
                        <li key={o.id} role="option" aria-selected={i === draft.active}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => send(o)}
                            className={`w-full text-left px-4 py-2.5 transition-colors ${i === draft.active ? 'bg-page' : 'hover:bg-page'}`}
                          >
                            <span className="block text-sm font-bold text-ink truncate">{o.title}</span>
                            <span className="block text-2xs font-bold text-muted truncate">{o.artist}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => send(null)}
                  disabled={!canGuess}
                  className={`w-full py-2.5 flex items-center justify-center gap-2 ${BUTTON_SECONDARY}`}
                >
                  <SkipForward className="w-4 h-4" />
                  {myAttempts.length + 1 < MAX_ATTEMPTS
                    ? t.skip(secs(SNIPPET_SECONDS[myAttempts.length + 1] - SNIPPET_SECONDS[myAttempts.length], lang))
                    : t.giveUp}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-sm font-black text-ink">
                {myAttempts.some((a) => a.verdict === 'right')
                  ? <><Check className="w-5 h-5 text-emerald-600" /> {t.solved}</>
                  : <><X className="w-5 h-5 text-red-500" /> {t.outOfTries}</>}
                <span className="text-xs font-bold text-muted">· {t.hintWait}</span>
              </div>
            )}
          </>
        )}
      </div>
      {/* After the round, what it was. */}
      {song && !isPlaying && <SongCaption song={song} lang={lang} t={t} />}
    </div>
  );

  // ------------------------------------------------------------ the side --

  const statusTitle = !isPlaying ? t.roundOver : done ? (myAttempts.some((a) => a.verdict === 'right') ? t.solved : t.outOfTries) : t.whatSong;
  const side = (
    <>
      <TurnCard
        lang={lang}
        label={[
          t.roundOf(Math.min(roundNumber, settings.rounds), settings.rounds),
          CATEGORIES[settings.category]?.label[lang],
          ...(settings.difficulty !== 'any' ? [DIFFICULTIES[settings.difficulty].label[lang]] : [])
        ].filter(Boolean).join(' · ')}
        title={statusTitle}
        hint={isPlaying ? (done ? t.hintWait : t.hintPick) : undefined}
        secondsLeft={isPlaying && startsIn <= 0 ? secondsLeft : undefined}
        turnSeconds={settings.roundDuration}
      />

      <GameCard label={t.yourScore}>
        <div className="text-4xl font-black text-ink tabular-nums leading-none">{me?.score ?? 0}</div>
      </GameCard>

      {/* A leaderboard, as in Flager and Timler: everyone's total at all times. */}
      <PlayersCard
        lang={lang}
        rows={ranked.map((p) => {
          const pDone = isPlaying && isDone(p.attempts);
          const pRight = p.attempts.some((a) => a.verdict === 'right');
          return {
            id: p.id,
            name: p.name,
            avatarUrl: p.avatarUrl || defaultAvatar(p.id),
            isHost: p.isHost,
            isMe: p.id === userId,
            won: isFinished && winners.some((w) => w.id === p.id),
            stat: isPlaying ? (
              // During a round, the others see how far you are — not what you named.
              <span className={pDone ? (pRight ? 'text-emerald-600' : 'text-red-500') : ''}>
                {pDone ? (pRight ? t.guessed : t.missed) : t.triesOf(p.attempts.length + 1)}
              </span>
            ) : undefined,
            aside: <span className="text-sm font-black text-ink tabular-nums">{p.score}</span>
          };
        })}
      />
    </>
  );

  // ------------------------------------------------------- round results --

  const roundRows = gameState.players
    .map((p) => ({ p, r: p.history[gameState.roundIndex] as SonglerRoundResult | undefined }))
    .filter((x): x is { p: typeof x.p; r: SonglerRoundResult } => !!x.r)
    .sort((a, b) => b.r.score - a.r.score);

  return (
    <div className={GAME_PAGE}>
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />
      <GameHeader
        title={requireGame('songler').name[lang]}
        icon={Music}
        timeLeft={secondsLeft}
        showTime={isPlaying && startsIn <= 0}
        timeCaption={t.roundClock}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
      />
      <GameRulesModal isOpen={showRules} onClose={() => setShowRules(false)} rules={GAME_RULES[lang].songler} />

      <GameLayout board={board} side={side} boardWidth={720} />

      {/* Between rounds */}
      {isRoundEnd && song && (
        <div role="dialog" aria-modal="true" aria-label={t.roundOver} className={DIALOG_OVERLAY}>
          <div className={`${DIALOG_PANEL} max-w-lg max-h-[92vh] overflow-y-auto`}>
            <div className={LABEL}>{t.roundOf(roundNumber, settings.rounds)}</div>
            <div className="flex items-center gap-4 mt-3 mb-5">
              <Cover song={song} size={88} />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-ink leading-tight">{song.title}</h2>
                <p className="text-sm font-bold text-muted truncate">{song.artist}{song.year ? ` · ${song.year}` : ''}</p>
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!canPlay}
                  className="mt-2 inline-flex items-center gap-1.5 text-2xs font-black uppercase tracking-widest text-muted hover:text-accent disabled:opacity-40 transition-colors"
                >
                  {player.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {player.playing ? t.stop : t.whole}
                </button>
              </div>
            </div>

            <div className="divide-y divide-divider border-y border-divider mb-5">
              {roundRows.map(({ p, r }) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.isReadyForNextRound ? 'bg-emerald-500' : 'bg-line'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink truncate">{p.name}</div>
                    <div className="text-2xs font-bold text-muted tabular-nums">
                      {r.solvedOn !== null
                        ? <>{t.solvedOn(r.solvedOn + 1)}{typeof r.seconds === 'number' ? ` · ${r.seconds} ${lang === 'en' ? 's' : 'с'}` : ''}</>
                        : r.artist ? t.artistOnly : t.noSolve}
                    </div>
                  </div>
                  <div className="w-14 text-right text-sm font-black tabular-nums text-ink">+{r.score}</div>
                </div>
              ))}
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
        gameId="songler"
        parentState={gameState}
        onMenu={leaveGame}
        wide
      >
        <div className="divide-y divide-divider border-y border-divider">
          {ranked.map((p, i) => {
            const named = p.history.filter((h) => h.solvedOn !== null).length;
            return (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <span className="w-5 text-xs font-black text-muted tabular-nums">{i + 1}</span>
                <span className="flex-1 text-sm font-bold text-ink truncate text-left">{p.name}</span>
                <span className="text-xs font-bold text-muted tabular-nums" title={t.named}>{named}/{p.history.length}</span>
                <span className="w-14 text-right text-sm font-black tabular-nums">{p.score}</span>
              </div>
            );
          })}
        </div>
      </ResultDialog>
    </div>
  );
}

/**
 * How much of the song is open: the tries' steps along fifteen seconds, the
 * part you have earned dark, the playback running over it.
 */
function SnippetBar({ unlocked, scale, elapsed, showSteps }: { unlocked: number; scale: number; elapsed: number; showSteps: boolean }) {
  const pct = (s: number) => `${Math.min(100, (s / scale) * 100)}%`;
  return (
    <div className="relative h-3 rounded-full bg-divider overflow-hidden" aria-hidden>
      <div className="absolute inset-y-0 left-0 bg-line" style={{ width: pct(unlocked) }} />
      <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: pct(elapsed) }} />
      {showSteps && SNIPPET_SECONDS.slice(0, -1).map((s) => (
        <div key={s} className="absolute inset-y-0 w-px bg-surface" style={{ left: pct(s) }} />
      ))}
    </div>
  );
}

/** Your tries this round, one row each, the empty ones still to come. */
function AttemptRows({ attempts, t }: { attempts: readonly SonglerAttempt[]; t: Texts }) {
  const tone = {
    right: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    artist: 'border-amber-200 bg-amber-50 text-amber-700',
    wrong: 'border-red-100 bg-red-50 text-red-600',
    skip: 'border-line bg-page text-muted'
  };
  const label = { right: t.right, artist: t.artist, wrong: t.wrong, skip: t.skipped };
  return (
    <div className="mt-5">
      <div className={`${LABEL} mb-2`}>{t.tries}</div>
      <ol className="space-y-1.5">
        {Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
          const a = attempts[i];
          if (!a) return <li key={i} className="h-9 rounded-lg border border-dashed border-line" />;
          return (
            <li key={i} className={`h-9 px-3 rounded-lg border flex items-center gap-2 text-xs font-bold ${tone[a.verdict]}`}>
              <span className="truncate flex-1">{a.guess ? `${a.guess.title} — ${a.guess.artist}` : '—'}</span>
              <span className="shrink-0 uppercase tracking-wider text-3xs font-black">{label[a.verdict]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Cover({ song, size }: { song: SonglerSong; size: number }) {
  const src = coverUrl(song.cover, 250);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- a Deezer cover, sized by Deezer
    <img src={src} alt="" width={size} height={size} className="rounded-xl shrink-0 bg-divider object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-xl shrink-0 bg-divider flex items-center justify-center text-muted" style={{ width: size, height: size }}>
      <Music className="w-8 h-8" />
    </div>
  );
}

/** What the song was, with its cover and a link to it on Deezer. */
function SongCaption({ song, lang, t }: { song: SonglerSong; lang: 'ru' | 'en' | 'uk'; t: Texts }) {
  return (
    <div className="px-5 md:px-7 py-4 border-t border-divider flex items-center gap-4">
      <Cover song={song} size={64} />
      <div className="min-w-0 flex-1">
        <div className="text-base font-black text-ink truncate">{song.title}</div>
        <div className="text-sm font-bold text-muted truncate">{song.artist}{song.year ? ` · ${song.year}` : ''}</div>
        <a href={deezerUrl(song.id)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-2xs font-bold text-muted hover:text-accent" lang={lang}>
          <ExternalLink className="w-3 h-3" /> {t.onDeezer}
        </a>
      </div>
    </div>
  );
}
