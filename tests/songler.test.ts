import { describe, it, expect } from 'vitest';
import {
  ARTIST_POINTS, ATTEMPT_POINTS, MAX_ATTEMPTS, SNIPPET_SECONDS,
  isDone, matchDetails, normalize, placeBonuses, sameSong, scoreRound, snippetSeconds, timePenalty, verdictOf
} from '@/lib/gameLogic/songler';
import type { SonglerAttempt, SonglerSong } from '@/types/songler';

/** Songler's rules (docs/songler-spec.md, sections 2 and 4). */

const song = (id: number, title: string, artist: string): SonglerSong => ({ id, title, artist, cover: null, year: 1975, rank: 1 });
const BOHEMIAN = song(1, 'Bohemian Rhapsody', 'Queen');
const try_ = (verdict: SonglerAttempt['verdict'], at = 1000): SonglerAttempt => ({ verdict, at });

describe('snippets (2)', () => {
  it('grow from half a second to fifteen over six tries', () => {
    expect([...SNIPPET_SECONDS]).toEqual([0.5, 1, 2, 4, 8, 15]);
    expect(MAX_ATTEMPTS).toBe(6);
    expect(snippetSeconds(0, false)).toBe(0.5);
    expect(snippetSeconds(3, false)).toBe(4);
    expect(snippetSeconds(9, false)).toBe(15);
  });

  it('open the whole preview to a player who is done', () => {
    expect(snippetSeconds(2, true)).toBe(30);
  });
});

describe('the same song', () => {
  it('is the same track, or the same title by the same artist in another version', () => {
    expect(sameSong(BOHEMIAN, song(2, 'Bohemian Rhapsody - Remastered 2011', 'Queen'))).toBe(true);
    expect(sameSong(BOHEMIAN, song(3, 'Bohemian Rhapsody (Live Aid)', 'QUEEN'))).toBe(true);
    expect(sameSong(BOHEMIAN, song(4, 'Bohemian Rhapsody', 'Panic! At The Disco'))).toBe(false);
  });

  it('reads ё as е and ignores punctuation', () => {
    expect(normalize('Ёлка — «Прованс»!')).toBe(normalize('елка прованс'));
  });

  it('tells a right song, the right artist, a miss and a skip apart', () => {
    expect(verdictOf(song(9, 'Bohemian Rhapsody', 'Queen'), BOHEMIAN)).toBe('right');
    expect(verdictOf(song(8, 'Radio Ga Ga', 'Queen'), BOHEMIAN)).toBe('artist');
    expect(verdictOf(song(7, 'Imagine', 'John Lennon'), BOHEMIAN)).toBe('wrong');
    expect(verdictOf(null, BOHEMIAN)).toBe('skip');
  });

  it('is done when named, or out of tries', () => {
    expect(isDone([try_('wrong'), try_('right')])).toBe(true);
    expect(isDone(Array.from({ length: 6 }, () => try_('skip')))).toBe(true);
    expect(isDone([try_('artist')])).toBe(false);
  });
});

describe('score (4)', () => {
  it('pays by the try that named it', () => {
    expect([...ATTEMPT_POINTS]).toEqual([1000, 800, 600, 400, 250, 100]);
  });

  it('melts time from the first second, up to 200', () => {
    expect(timePenalty(0, 60_000)).toBe(0);
    expect(timePenalty(30_000, 60_000)).toBe(100);
    expect(timePenalty(90_000, 60_000)).toBe(200);
  });

  it('gives places by the fewest tries, then the quicker; never to the last place', () => {
    const places = placeBonuses([
      { id: 'a', solved: { on: 1, at: 5000 } },
      { id: 'b', solved: { on: 0, at: 9000 } },
      { id: 'c', solved: { on: 1, at: 3000 } },
      { id: 'd', solved: null }
    ]);
    expect(Object.fromEntries(places)).toEqual({ b: 100, c: 60, a: 30, d: 0 });
    // Two who both named it: one bonus, the last place gets none.
    expect(Object.fromEntries(placeBonuses([{ id: 'a', solved: { on: 0, at: 1 } }, { id: 'b', solved: { on: 2, at: 1 } }]))).toEqual({ a: 100, b: 0 });
    // Alone, never.
    expect(placeBonuses([{ id: 'a', solved: { on: 0, at: 1 } }]).get('a')).toBe(0);
  });

  it('scores a round for everyone at once', () => {
    const results = scoreRound([
      { id: 'a', attempts: [try_('right', 6000)] },
      { id: 'b', attempts: [try_('artist'), try_('skip'), try_('wrong')] },
      { id: 'c', attempts: [] }
    ], BOHEMIAN, 60_000);
    expect(results.get('a')).toMatchObject({ solvedOn: 0, base: 1000, place: 100, penalty: 20, score: 1080, seconds: 6 });
    expect(results.get('b')).toMatchObject({ solvedOn: null, artist: true, base: ARTIST_POINTS, place: 0, score: 100 });
    expect(results.get('c')).toMatchObject({ solvedOn: null, artist: false, score: 0 });
  });
});

describe('match details (9)', () => {
  it('counts first notes, last chances and the worst try', () => {
    const r = (solvedOn: number | null, seconds?: number) => ({ song: 1, solvedOn, artist: false, base: 0, place: 0, penalty: 0, score: 0, ...(seconds ? { seconds } : {}) });
    expect(matchDetails([r(0, 4), r(5, 40), r(1, 12)])).toEqual({
      rounds: 3, solved: 3, firstNote: 1, lastChance: 1, artistOnly: 0, worstTry: 5, fastest: 4
    });
    expect(matchDetails([r(0, 4), r(null)])).not.toHaveProperty('worstTry');
  });
});
