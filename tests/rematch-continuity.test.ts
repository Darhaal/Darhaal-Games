import { describe, it, expect } from 'vitest';
import { createInitialState, createRematchState } from '@/games/initialState';
import { rematchIdOf } from '@/lib/rematchId';
import type { SpyfallState } from '@/types/spyfall';

/**
 * "Play again" opens a new room rather than resetting the finished one. Two
 * things must survive that move: the running score, and the old room's link.
 */

const host = { id: 'host-1', name: 'Host', avatarUrl: '/avatar/host-1' };

const playedSpyfall = (): SpyfallState => {
  const parent = createInitialState('spyfall', host, 6, {
    roundMinutes: 8,
    packId: 'general1',
    spyCount: 1
  }) as SpyfallState;

  parent.players = [
    { ...parent.players[0], score: 3 },
    {
      id: 'guest-2', name: 'Rival', avatarUrl: '', isHost: false,
      isSpy: false, role: null, isReady: true, hasNominated: false, score: 5
    }
  ];
  parent.status = 'finished';
  return parent;
};

describe('the score survives a rematch', () => {
  it('carries every seat forward by id', () => {
    const again = createRematchState('spyfall', playedSpyfall());

    expect(again.carriedScores).toEqual({ 'host-1': 3, 'guest-2': 5 });
  });

  it('still opens with an empty roster', () => {
    // The scores travel beside the roster, not inside it — players arrive
    // through the usual join, which is what lets the second person press
    // "play again" and land in the same room.
    const again = createRematchState('spyfall', playedSpyfall());

    expect(again.players).toEqual([]);
    expect(again.status).toBe('waiting');
  });

  it('starts a player nobody has seen before at zero', () => {
    const again = createRematchState('spyfall', playedSpyfall());

    expect(again.carriedScores?.['someone-new']).toBeUndefined();
    // Which is what the seating code falls back on.
    expect(again.carriedScores?.['someone-new'] || 0).toBe(0);
  });

  it('treats a room that was never played as a clean slate', () => {
    const fresh = createInitialState('spyfall', host, 6, {
      roundMinutes: 8, packId: 'general1', spyCount: 1
    }) as SpyfallState;

    expect(createRematchState('spyfall', fresh).carriedScores).toEqual({ 'host-1': 0 });
  });
});

describe('rematchIdOf', () => {
  it('finds the successor a finished room records', () => {
    expect(rematchIdOf({ rematchLobbyId: 'abc' })).toBe('abc');
  });

  it('says nothing for a room that has no successor', () => {
    // The redirect hook keys off this: undefined means "stay put".
    expect(rematchIdOf({})).toBeUndefined();
    expect(rematchIdOf(null)).toBeUndefined();
    expect(rematchIdOf(undefined)).toBeUndefined();
  });
});
