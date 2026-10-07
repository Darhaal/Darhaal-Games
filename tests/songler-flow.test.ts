// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => import('./support/fakeSupabase'));
vi.mock('@/lib/matchRecords', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/matchRecords')>()),
  recordMatch: vi.fn(async () => true)
}));
// The pool is a static file; here it is two known songs.
vi.mock('@/lib/songler/pool', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/songler/pool')>()),
  pickSong: vi.fn(async (_settings: unknown, played: ReadonlySet<number>) => (played.has(1) ? IMAGINE : BOHEMIAN))
}));

import { db } from './support/fakeSupabase';
import { seat, play } from './support/players';
import { useSonglerGame } from '@/hooks/useSonglerGame';
import type { SonglerPlayer, SonglerSong, SonglerState } from '@/types/songler';

/**
 * Songler's rounds, played through the real hook by several players at once
 * against one shared row: tries and skips, the round scored for everyone
 * when the last player is done or the time runs out, and the next song.
 */

const LOBBY = 'lobby-songler';

const song = (id: number, title: string, artist: string): SonglerSong => ({ id, title, artist, cover: null, year: 1975, rank: 10 });
const BOHEMIAN = song(1, 'Bohemian Rhapsody', 'Queen');
const IMAGINE = song(2, 'Imagine', 'John Lennon');
const RADIO = song(3, 'Radio Ga Ga', 'Queen');

const player = (id: string): SonglerPlayer => ({
  id, name: id.toUpperCase(), avatarUrl: '', isHost: id === 'a', score: 0, attempts: [], history: [], isReadyForNextRound: false
});

/** Round one of two under way, opened a second ago. */
function match(ids: string[], over: Partial<SonglerState> = {}): SonglerState {
  return {
    players: ids.map(player),
    status: 'playing',
    round: { song: BOHEMIAN, startTime: Date.now() - 1000 },
    roundIndex: 0,
    next: null,
    played: [1],
    startTime: Date.now() - 2000,
    lastActionTime: 0,
    notifications: [],
    version: 1,
    gameType: 'songler',
    settings: { maxPlayers: 4, rounds: 2, roundDuration: 60, category: 'all', difficulty: 'any' },
    ...over
  };
}

const stored = () => db.state<SonglerState>(LOBBY);
const who = (id: string) => stored().players.find((p) => p.id === id)!;

async function sit(...ids: string[]) {
  const hooks = [];
  for (const id of ids) hooks.push(await seat(() => useSonglerGame(LOBBY, id)));
  return hooks;
}

beforeEach(() => {
  db.reset();
});

describe('Songler — a round', () => {
  it('a try is written with its verdict, and the round waits for the others', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a] = await sit('a', 'b');

    await play(() => a.current.attempt(RADIO));
    await play(() => a.current.attempt(null));

    expect(who('a').attempts.map((t) => t.verdict)).toEqual(['artist', 'skip']);
    expect(stored().status).toBe('playing');
  });

  it('the same wrong song twice is not a second try', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a] = await sit('a', 'b');

    await play(() => a.current.attempt(IMAGINE));
    await play(() => a.current.attempt(IMAGINE));

    expect(who('a').attempts).toHaveLength(1);
  });

  it('naming it ends your tries; the last one done scores the round for everyone', async () => {
    db.seed(LOBBY, match(['a', 'b', 'c']));
    const [a, b, c] = await sit('a', 'b', 'c');

    await play(() => a.current.attempt(BOHEMIAN));
    await play(() => a.current.attempt(IMAGINE)); // after naming it: refused
    await play(() => b.current.attempt(null));
    await play(() => b.current.attempt({ ...BOHEMIAN, id: 99, title: 'Bohemian Rhapsody - Remastered 2011' }));
    for (let i = 0; i < 6; i++) await play(() => c.current.attempt(null));

    expect(stored().status).toBe('round_end');
    expect(who('a').attempts).toHaveLength(1);
    expect(who('a').history[0]).toMatchObject({ solvedOn: 0, base: 1000, place: 100 });
    expect(who('b').history[0]).toMatchObject({ solvedOn: 1, base: 800, place: 60 });
    expect(who('c').history[0]).toMatchObject({ solvedOn: null, score: 0 });
    expect(who('a').score).toBe(who('a').history[0].score);
  });

  it('after the time, anyone closes the round with the tries it has', async () => {
    const state = match(['a', 'b'], { round: { song: BOHEMIAN, startTime: Date.now() - 62_000 } });
    state.players[0].attempts = [{ verdict: 'artist', guess: RADIO, at: 3000 }];
    db.seed(LOBBY, state);
    const [, b] = await sit('a', 'b');

    await play(() => b.current.forceRoundEnd());

    expect(stored().status).toBe('round_end');
    expect(who('a').history[0]).toMatchObject({ artist: true, score: 100 });
    expect(who('b').history[0].score).toBe(0);
  });

  it('a try after the time and its grace is refused', async () => {
    db.seed(LOBBY, match(['a', 'b'], { round: { song: BOHEMIAN, startTime: Date.now() - 65_000 } }));
    const [a] = await sit('a', 'b');

    await play(() => a.current.attempt(BOHEMIAN));

    expect(who('a').attempts).toHaveLength(0);
  });
});

describe('Songler — between rounds', () => {
  it('the host draws the next song, and everyone ready starts it', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.attempt(BOHEMIAN));
    await play(() => b.current.attempt(BOHEMIAN));
    expect(stored().next?.id).toBe(2);

    await play(() => a.current.readyNextRound());
    await play(() => b.current.readyNextRound());

    expect(stored()).toMatchObject({ status: 'playing', roundIndex: 1, played: [1, 2] });
    expect(stored().round?.song.id).toBe(2);
    expect(who('a').attempts).toEqual([]);
  });

  it('a player walking out mid-round closes it when everyone else is done', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.attempt(BOHEMIAN));
    await play(() => b.current.leaveGame());

    expect(stored().players.map((p) => p.id)).toEqual(['a']);
    expect(stored().status).toBe('round_end');
  });
});
