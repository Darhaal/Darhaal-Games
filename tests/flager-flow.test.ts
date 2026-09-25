// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => import('./support/fakeSupabase'));
vi.mock('@/lib/playerStats', () => ({ updatePlayerStats: vi.fn() }));

import { db } from './support/fakeSupabase';
import { seat, play } from './support/players';
import { useFlagerGame } from '@/hooks/useFlagerGame';
import type { FlagerPlayerState, FlagerState } from '@/types/flager';

/**
 * Flager's rounds, played through the real hook by several players at once
 * against one shared row: answering, the round closing, the ready-up between
 * rounds, and what a player walking out does to each of those.
 */

const LOBBY = 'lobby-flager';

const racer = (id: string): FlagerPlayerState => ({
  id,
  name: id.toUpperCase(),
  avatarUrl: '',
  isHost: id === 'a',
  score: 0,
  guesses: [],
  hasFinishedRound: false,
  roundScore: 0,
  history: [],
  isReadyForNextRound: false
});

/** Round one of two under way: France, then Germany. */
function match(ids: string[], over: Partial<FlagerState> = {}): FlagerState {
  return {
    players: ids.map(racer),
    status: 'playing',
    targetChain: ['FR', 'DE'],
    currentRoundIndex: 0,
    roundStartTime: Date.now() - 1000,
    lastActionTime: 0,
    version: 1,
    notifications: [],
    gameType: 'flager',
    settings: { maxPlayers: 4, totalRounds: 2, roundDuration: 60 },
    ...over
  };
}

const stored = () => db.state<FlagerState>(LOBBY);
const who = (id: string) => stored().players.find((p) => p.id === id)!;

async function sit(...ids: string[]) {
  const hooks = [];
  for (const id of ids) hooks.push(await seat(() => useFlagerGame(LOBBY, id)));
  return hooks;
}

beforeEach(() => {
  db.reset();
});

describe('Flager — a round', () => {
  it('a wrong answer is kept and the round goes on', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a] = await sit('a', 'b');

    await play(() => a.current.makeGuess('DE'));

    expect(who('a')).toMatchObject({ guesses: ['de'], hasFinishedRound: false, score: 0 });
  });

  it('the right answer scores and finishes the round for that player only', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a] = await sit('a', 'b');

    await play(() => a.current.makeGuess('DE'));
    await play(() => a.current.makeGuess('FR'));

    expect(who('a').hasFinishedRound).toBe(true);
    expect(who('a').score).toBeGreaterThan(0);
    expect(stored().status).toBe('playing');
  });

  it('ten wrong answers finish the round with nothing', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a] = await sit('a', 'b');

    for (const code of ['DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'PL', 'SE', 'NO', 'FI']) {
      await play(() => a.current.makeGuess(code));
    }

    expect(who('a')).toMatchObject({ hasFinishedRound: true, roundScore: 0, score: 0 });
  });

  it('answers before the countdown ends are ignored', async () => {
    db.seed(LOBBY, match(['a', 'b'], { roundStartTime: Date.now() + 3000 }));
    const [a] = await sit('a', 'b');

    await play(() => a.current.makeGuess('FR'));

    expect(db.stats.writes).toBe(0);
  });

  it('closes when everyone is done, and writes the round into each history', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.makeGuess('FR'));
    await play(() => b.current.handleTimeout());

    expect(stored().status).toBe('round_end');
    expect(who('a').history).toEqual([expect.objectContaining({ flagCode: 'fr', isCorrect: true, attempts: 1 })]);
    expect(who('b').history).toEqual([expect.objectContaining({ flagCode: 'fr', isCorrect: false, attempts: 0, points: 0 })]);
  });

  it('answers given at the same instant are both kept', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.makeGuess('FR'), () => b.current.makeGuess('FR'));

    expect(stored().status).toBe('round_end');
    expect(who('a').score).toBeGreaterThan(0);
    expect(who('b').score).toBeGreaterThan(0);
  });
});

describe('Flager — between rounds', () => {
  const roundOver = () => match(['a', 'b'], {
    status: 'round_end',
    players: [
      { ...racer('a'), hasFinishedRound: true, score: 900, roundScore: 900 },
      { ...racer('b'), hasFinishedRound: true }
    ]
  });

  it('the next round starts once everyone is ready, with a clean slate', async () => {
    db.seed(LOBBY, roundOver());
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.readyNextRound());
    expect(stored().status).toBe('round_end');

    await play(() => b.current.readyNextRound());

    expect(stored()).toMatchObject({ status: 'playing', currentRoundIndex: 1 });
    expect(who('a')).toMatchObject({ guesses: [], hasFinishedRound: false, roundScore: 0, score: 900 });
  });

  it('ready given at the same instant starts the round', async () => {
    db.seed(LOBBY, roundOver());
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.readyNextRound(), () => b.current.readyNextRound());

    expect(stored()).toMatchObject({ status: 'playing', currentRoundIndex: 1 });
  });

  it('after the last round, ready finishes the match', async () => {
    db.seed(LOBBY, { ...roundOver(), currentRoundIndex: 1 });
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.readyNextRound(), () => b.current.readyNextRound());

    expect(stored().status).toBe('finished');
  });
});

describe('Flager — leaving', () => {
  it('a player who leaves mid-round does not strand those who answered', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.makeGuess('FR'));
    await play(() => b.current.leaveGame());

    expect(stored().status).toBe('round_end');
    expect(stored().notifications?.at(-1)?.message).toEqual({ ru: 'B покинул игру', en: 'B left the game' });
  });

  it('a player who leaves between rounds does not strand those who are ready', async () => {
    db.seed(LOBBY, match(['a', 'b', 'c'], { status: 'round_end' }));
    const [a, b, c] = await sit('a', 'b', 'c');

    await play(() => a.current.readyNextRound());
    await play(() => b.current.readyNextRound());
    await play(() => c.current.leaveGame());

    expect(stored()).toMatchObject({ status: 'playing', currentRoundIndex: 1 });
  });

  it('the host who leaves hands the room on', async () => {
    db.seed(LOBBY, match(['a', 'b', 'c']));
    const [a] = await sit('a', 'b', 'c');

    await play(() => a.current.leaveGame());

    expect(who('b').isHost).toBe(true);
  });
});

describe('Flager — a player who vanished', () => {
  it('the round is closed for them once it is well past its end', async () => {
    db.seed(LOBBY, match(['a', 'b'], { roundStartTime: Date.now() - 75_000 }));
    const [a] = await sit('a', 'b');

    await play(() => a.current.makeGuess('FR'));
    await play(() => a.current.forceRoundEnd());

    expect(stored().status).toBe('round_end');
  });

  it('the next round is not held back by someone who never presses “next”', async () => {
    db.seed(LOBBY, match(['a', 'b'], { status: 'round_end', roundEndedAt: Date.now() - 61_000 }));
    const [a] = await sit('a', 'b');

    await play(() => a.current.readyNextRound());
    expect(stored().status).toBe('round_end');

    await play(() => a.current.forceNextRound());

    expect(stored()).toMatchObject({ status: 'playing', currentRoundIndex: 1 });
    expect(stored().roundEndedAt).toBeUndefined();
  });

  it('the between-rounds minute is not cut short', async () => {
    db.seed(LOBBY, match(['a', 'b'], { status: 'round_end', roundEndedAt: Date.now() - 30_000 }));
    const [a] = await sit('a', 'b');

    await play(() => a.current.forceNextRound());

    expect(stored().status).toBe('round_end');
    expect(db.stats.writes).toBe(0);
  });

  it('a round that closes records when, for the between-rounds clock', async () => {
    db.seed(LOBBY, match(['a', 'b']));
    const [a, b] = await sit('a', 'b');

    await play(() => a.current.makeGuess('FR'), () => b.current.makeGuess('FR'));

    expect(stored().roundEndedAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('but not a moment early', async () => {
    db.seed(LOBBY, match(['a', 'b'], { roundStartTime: Date.now() - 65_000 }));
    const [a] = await sit('a', 'b');

    await play(() => a.current.forceRoundEnd());

    expect(stored().status).toBe('playing');
    expect(db.stats.writes).toBe(0);
  });
});
