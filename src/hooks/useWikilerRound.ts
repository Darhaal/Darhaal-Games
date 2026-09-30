'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildArticle, evaluateGuess, initialReveal, roundScore, titleGuessMatches, titleSolved,
  WRONG_TITLE_PENALTY, type Article, type WikilerLang
} from '@/lib/gameLogic/wikiler';
import { fetchArticle, resolveTitle } from '@/lib/wikiler/wikipedia';
import type { WikilerRound, WikilerRoundResult, WikilerVersion } from '@/types/wikiler';

/**
 * One player's side of a Wikiler round: the article, what they have opened,
 * their attempts and score — docs/wikiler-spec.md, sections 2–4.
 *
 * All of it stays in this browser (and in localStorage, so a reload keeps the
 * round); the table only learns the attempt count and, at the end, the result.
 */

export interface GuessEntry {
  kind: 'word' | 'title';
  text: string;
  /** Word guesses: how often the word occurs. */
  occurrences?: number;
  /** The group it opened, for scrolling to it. */
  key?: string;
  cost: number;
  /** Title guesses: whether it named the article. */
  correct?: boolean;
}

export type Feedback =
  | { kind: 'word'; text: string; occurrences: number; cost: number }
  | { kind: 'repeat' }
  | { kind: 'invalid'; reason: 'empty' | 'several' | 'open' }
  | { kind: 'title-wrong'; text: string }
  | { kind: 'solved' }
  | { kind: 'wait' };

interface Saved {
  guesses: GuessEntry[];
}

const storageKey = (lobbyId: string, seed: string) => `wikiler:${lobbyId}:${seed}`;

function load(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: Saved) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the round still plays, it just will not survive a reload.
  }
}

export function useWikilerRound(opts: {
  lobbyId: string | null;
  round: WikilerRound | null;
  /** The version of the round's article this player reads, and its language. */
  version: (WikilerVersion & { lang: WikilerLang }) | null;
  hidden: number;
  durationMs: number;
  /** Attempts allowed, or null for unlimited. */
  limit: number | null;
  /** The table already has this player's result — nothing more to send. */
  alreadyDone: boolean;
  onFinish: (result: WikilerRoundResult) => void;
}) {
  const { lobbyId, round, version, hidden, durationMs, limit, alreadyDone, onFinish } = opts;
  const lang = version?.lang ?? 'ru';
  const seed = round?.seed ?? null;

  // Everything below is keyed by the round's seed, so a new round starts clean
  // without resetting state in an effect.
  const [loaded, setLoaded] = useState<{ seed: string; article: Article | null } | null>(null);
  const article = loaded?.seed === seed ? loaded.article : null;
  const loadError = loaded?.seed === seed && loaded.article === null;

  // Guesses saved by this browser before a reload, if it played this round.
  const savedGuesses = useMemo(
    () => (lobbyId && seed ? load(storageKey(lobbyId, seed))?.guesses ?? [] : []),
    [lobbyId, seed]
  );
  const [store, setStore] = useState<{ seed: string | null; guesses: GuessEntry[] }>({ seed: null, guesses: [] });
  const guesses = store.seed === seed ? store.guesses : savedGuesses;
  const addGuess = useCallback((entry: GuessEntry) => {
    setStore((prev) => ({ seed, guesses: [...(prev.seed === seed ? prev.guesses : savedGuesses), entry] }));
  }, [seed, savedGuesses]);

  const [pending, setPending] = useState(false);
  const finished = useRef<string | null>(null);

  // The round's article, at the revision everyone reading this language shares.
  useEffect(() => {
    if (!round || !version) return;
    let cancelled = false;
    fetchArticle(version.lang, version.title, version.revision)
      .then((a) => { if (!cancelled) setLoaded({ seed: round.seed, article: buildArticle(version.title, a.paragraphs, version.lang) }); })
      .catch(() => { if (!cancelled) setLoaded({ seed: round.seed, article: null }); });
    return () => { cancelled = true; };
    // The seed names the round and the version never changes within one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    if (lobbyId && seed && store.seed === seed) save(storageKey(lobbyId, seed), { guesses: store.guesses });
  }, [store, lobbyId, seed]);

  const opened = useMemo(
    () => (article && seed ? initialReveal(article, hidden, seed) : new Set<string>()),
    [article, hidden, seed]
  );
  const revealed = useMemo(() => {
    const set = new Set(opened);
    for (const g of guesses) if (g.key) set.add(g.key);
    return set;
  }, [opened, guesses]);

  const attempts = guesses.length;
  const wordPenalty = guesses.reduce((n, g) => n + (g.kind === 'word' ? g.cost : 0), 0);
  const wrongTitles = guesses.filter((g) => g.kind === 'title' && !g.correct).length;
  const misses = guesses.filter((g) => (g.kind === 'word' && g.occurrences === 0) || (g.kind === 'title' && !g.correct)).length;
  const solvedByTitle = guesses.some((g) => g.kind === 'title' && g.correct);
  const solvedByWords = !!article && titleSolved(article, revealed);
  const solved = solvedByTitle || solvedByWords;
  const outOfAttempts = limit !== null && attempts >= limit && !solved;

  /** What the round would score if solved right now — the live counter. */
  const scoreNow = useCallback((at: number) => roundScore({
    solved: true,
    elapsedMs: round ? at - round.startTime : 0,
    durationMs,
    wordPenalty,
    wrongTitles
  }), [round, durationMs, wordPenalty, wrongTitles]);

  const finish = useCallback((result: WikilerRoundResult) => {
    if (!seed || finished.current === seed || alreadyDone) return;
    finished.current = seed;
    onFinish(result);
  }, [seed, alreadyDone, onFinish]);

  // Solved or out of attempts: the round is over for this player.
  useEffect(() => {
    if (!round || !article) return;
    if (solved) {
      finish({
        title: round.title,
        score: scoreNow(Date.now()),
        solved: true,
        attempts,
        by: solvedByTitle ? 'title' : 'words',
        misses,
        lastTry: limit !== null && attempts === limit,
        seconds: Math.max(0, Math.round((Date.now() - round.startTime) / 1000))
      });
    } else if (outOfAttempts) {
      finish({ title: round.title, score: 0, solved: false, attempts, by: null, misses, lastTry: false });
    }
  }, [solved, outOfAttempts, round, article, attempts, misses, limit, solvedByTitle, scoreNow, finish]);

  /** The clock ran out before this player solved it. */
  const timeUp = useCallback(() => {
    if (!round) return;
    finish({ title: round.title, score: 0, solved: false, attempts, by: null, misses, lastTry: false });
  }, [round, attempts, misses, finish]);

  const canGuess = !!article && !!round && !solved && !outOfAttempts && !alreadyDone;

  const guessWord = useCallback((input: string): Feedback => {
    if (!canGuess || !article || Date.now() < (round?.startTime ?? 0)) return { kind: 'wait' };
    const outcome = evaluateGuess(article, input, revealed, lang);
    if (outcome.kind === 'invalid') return outcome;
    if (outcome.kind === 'repeat') return { kind: 'repeat' };
    const text = input.trim();
    addGuess({ kind: 'word', text, key: outcome.key, occurrences: outcome.occurrences, cost: outcome.cost });
    return { kind: 'word', text, occurrences: outcome.occurrences, cost: outcome.cost };
  }, [canGuess, article, round, revealed, lang, addGuess]);

  const guessTitle = useCallback(async (input: string): Promise<Feedback> => {
    const text = input.trim();
    if (!text) return { kind: 'invalid', reason: 'empty' };
    if (!canGuess || !round || !version || pending || Date.now() < round.startTime) return { kind: 'wait' };
    let correct = titleGuessMatches(text, version.title, lang);
    if (!correct) {
      // «Ньютон» or «Исаак Ньютон» name «Ньютон, Исаак» through Wikipedia's redirects.
      setPending(true);
      try {
        const resolved = await resolveTitle(lang, text);
        correct = !!resolved && titleGuessMatches(resolved, version.title, lang);
      } catch {
        correct = false;
      } finally {
        setPending(false);
      }
    }
    addGuess({ kind: 'title', text, cost: correct ? 0 : WRONG_TITLE_PENALTY, correct });
    return correct ? { kind: 'solved' } : { kind: 'title-wrong', text };
  }, [canGuess, round, version, pending, lang, addGuess]);

  return {
    article, loadError, guesses, revealed, attempts, misses, solved, outOfAttempts,
    pending, canGuess, scoreNow, timeUp, guessWord, guessTitle
  };
}
