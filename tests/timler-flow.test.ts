// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => import('./support/fakeSupabase'));
vi.mock('@/lib/matchRecords', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/matchRecords')>()),
  recordMatch: vi.fn(async () => true)
}));
// The pool is a static file; here it is two known photos.
vi.mock('@/lib/timler/pool', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/timler/pool')>()),
  pickPhoto: vi.fn(async (_settings: unknown, played: ReadonlySet<string>) => (played.has('Moon.jpg') ? WALL : MOON))
}));

import { db } from './support/fakeSupabase';
import { seat, play } from './support/players';
import { useTimlerGame } from '@/hooks/useTimlerGame';
import type { TimlerPhoto, TimlerPlayer, TimlerState } from '@/types/timler';
import { yearPoints } from '@/lib/gameLogic/timler';

/**
 * Timler's rounds, played through the real hook by several players at once
 * against one shared row: answering, the round scored for everyone when the
 * last answer lands or the time runs out, and the move to the next photo.
 */

const LOBBY = 'lobby-timler';

const photo = (file: string, date: string): TimlerPhoto => ({
  file, date, adult: false, fame: 10,
  title: { ru: null, en: file }, description: { ru: null, en: null }, article: { ru: null, en: null },
  author: 'NASA', license: 'Public domain'
});
const MOON = photo('Moon.jpg', '1969-07-20');
const WALL = photo('Wall.jpg', '1989-11-09');

const player = (id: string): TimlerPlayer => ({
  id, name: id.toUpperCase(), avatarUrl: '', isHost: id === 'a', score: 0, guess: null, history: [], isReadyForNextRound: false
});

/** Round one of two under way, opened a second ago: the Moon landing. */
function match(ids: string[], over: Partial<TimlerState> = {}): TimlerState {
  return {
    players: ids.map(player),
    status: 'playing',
    round: { photo: MOON, startTime: Date.now() - 1000 },
    roundIndex: 0,
    next: null,
    played: ['Moon.jpg'],
    startTime: Date.now() - 2000,
    lastActionTime: 0,
    notifications: [],
    version: 1,
    gameType: 'timler',
    settings: { maxPlayers: 4, rounds: 2, roundDuration: 60, era: 'all', difficulty: 'any', adult: false },
    ...over
  };
}

const stored = () => db.state<TimlerState>(LOBBY);
const who = (id: string) => stored().players.find((p) => p.id === id)!;

async function sit(...ids: string[]) {
  const hooks = [];
  for (const id of ids) hooks.push(await seat(() => useTimlerGame(LOBBY, id)));
  return hooks;
}

beforeEach(() => {
  db.reset();
});

describe('Timler — a round', () => {
  it('an answer is written once, and the round waits for the others', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a] = await sit('a', 'b');

    await play(() => a.current.answer({ year: 1969, month: 7, day: 20 }));
    await play(() => a.current.answer({ year: 1900 }));

    expect(stored().status).toBe('playing');
    expect(who('a').guess).toMatchObject({ year: 1969, month: 7, day: 20 });
  });

  it('the last answer scores the round for everyone: accuracy, place, history', async () => {
    db.seed(LOBBY, match(['a', 'b', 'c']));
    const [a, b, c] = await sit('a', 'b', 'c');

    await play(() => a.current.answer({ year: 1969, month: 7, day: 20 }));
    await play(() => b.current.answer({ year: 1971 }));
    await play(() => c.current.answer({ year: 1940 }));

    expect(stored().status).toBe('round_end');
    // A second into the round: a few points of time already gone.
    const first = who('a').history[0];
    expect(first).toMatchObject({ accuracy: 1300, place: 100 });
    expect(first.penalty).toBeGreaterThan(0);
    expect(first.penalty).toBeLessThan(10);
    expect(first.score).toBe(1400 - first.penalty);
    expect(who('b').history[0]).toMatchObject({ accuracy: yearPoints(1971, 1969), place: 60 });
    expect(who('c').history[0]).toMatchObject({ place: 0 });
    expect(who('a').score).toBe(first.score);
  });

  it('a date where the photo has only a year counts as the year', async () => {
    db.seed(LOBBY, match(['a', 'b'], { round: { photo: photo('Old.jpg', '1888'), startTime: Date.now() - 1000 } }));
    const [a] = await sit('a', 'b');

    await play(() => a.current.answer({ year: 1888, month: 3, day: 1 }));

    expect(who('a').guess).toEqual({ year: 1888, at: expect.any(Number) });
  });

  it('after the time, anyone closes the round; no answer scores nothing', async () => {
    const state = match(['a', 'b'], { round: { photo: MOON, startTime: Date.now() - 62_000 } });
    state.players[0].guess = { year: 1969, at: 3_000 };
    db.seed(LOBBY, state);
    const [, b] = await sit('a', 'b');

    expect(stored().status).toBe('playing');
    await play(() => b.current.forceRoundEnd());

    expect(stored().status).toBe('round_end');
    expect(who('b').history[0]).toMatchObject({ guess: null, score: 0 });
    expect(who('a').history[0].score).toBeGreaterThan(0);
  });

  it('a late answer, after the time and its grace, is refused', async () => {
    db.seed(LOBBY, match(['a', 'b'], { round: { photo: MOON, startTime: Date.now() - 65_000 } }));
    const [a] = await sit('a', 'b');

    await play(() => a.current.answer({ year: 1969 }));

    expect(who('a').guess).toBeNull();
  });
});

describe('Timler — between rounds', () => {
  it('the host draws the next photo, and everyone ready starts it', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.answer({ year: 1969 }));
    await play(() => b.current.answer({ year: 1970 }));
    expect(stored().next?.file).toBe('Wall.jpg');

    await play(() => a.current.readyNextRound());
    await play(() => b.current.readyNextRound());

    expect(stored()).toMatchObject({ status: 'playing', roundIndex: 1, played: ['Moon.jpg', 'Wall.jpg'] });
    expect(stored().round?.photo.file).toBe('Wall.jpg');
    expect(who('a').guess).toBeNull();
  });

  it('a player walking out mid-round closes it when everyone else has answered', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.answer({ year: 1969 }));
    await play(() => b.current.leaveGame());

    expect(stored().players.map((p) => p.id)).toEqual(['a']);
    expect(stored().status).toBe('round_end');
  });
});
