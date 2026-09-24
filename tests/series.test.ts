import { describe, it, expect } from 'vitest';
import { awardsOf, hasSeries, nextSeriesWins, seriesWinsOf, winnersOf } from '@/lib/series';
import { ACCUSER_BONUS, LOCAL_WIN, SPY_WIN } from '@/lib/gameLogic/spyfall';
import { GAME_IDS } from '@/games/registry';

/**
 * The running score of a series.
 *
 * Every game reports its winner differently, so the extractor is the part
 * worth testing: getting it wrong means a tally that silently never moves,
 * which looks exactly like a feature nobody uses.
 */

const finished = (over: Record<string, unknown>) => ({ status: 'finished', ...over });

describe('winnersOf', () => {
  it('reads the list games that keep one', () => {
    for (const game of ['dots', 'reversi', 'wallrush'] as const) {
      expect(winnersOf(game, finished({ winnerIds: ['a', 'b'] }))).toEqual(['a', 'b']);
    }
  });

  it('reads the single id Minesweeper and Coup keep beside the display name', () => {
    expect(winnersOf('minesweeper', finished({ winnerId: 'a', winner: 'Alice' }))).toEqual(['a']);
    expect(winnersOf('coup', finished({ winnerId: 'b', winner: 'Bob' }))).toEqual(['b']);
  });

  it('reads Battleship, whose `winner` is an id despite the name', () => {
    expect(winnersOf('battleship', finished({ winner: 'a' }))).toEqual(['a']);
  });

  it('turns a Spyfall side into the players on it', () => {
    const state = finished({
      winner: 'spy',
      players: [{ id: 'a', isSpy: true }, { id: 'b' }, { id: 'c', isSpy: false }]
    });

    expect(winnersOf('spyfall', state)).toEqual(['a']);
    expect(winnersOf('spyfall', { ...state, winner: 'locals' })).toEqual(['b', 'c']);
  });

  it('gives Flager to the top score, and to nobody when nobody scored', () => {
    const players = [{ id: 'a', score: 3 }, { id: 'b', score: 7 }, { id: 'c', score: 7 }];

    expect(winnersOf('flager', finished({ players }))).toEqual(['b', 'c']);
    expect(winnersOf('flager', finished({ players: [{ id: 'a', score: 0 }] }))).toEqual([]);
  });

  it('finds no winner in a match still being played', () => {
    // This is what stops a room being counted twice, or counted early.
    for (const game of GAME_IDS) {
      expect(winnersOf(game, { status: 'playing', winnerIds: ['a'], winnerId: 'a', winner: 'a' }))
        .toEqual([]);
    }
  });

  it('survives a state that is missing everything', () => {
    for (const game of GAME_IDS) {
      expect(winnersOf(game, undefined)).toEqual([]);
      expect(winnersOf(game, finished({}))).toEqual([]);
    }
  });
});

describe('the tally', () => {
  it('adds the winner of the room just finished', () => {
    const parent = finished({ winnerIds: ['a'], seriesWins: { a: 1, b: 2 } });

    expect(nextSeriesWins('dots', parent)).toEqual({ a: 2, b: 2 });
  });

  it('starts one when the first match ends', () => {
    expect(nextSeriesWins('reversi', finished({ winnerIds: ['a'] }))).toEqual({ a: 1 });
  });

  it('credits everyone who tied', () => {
    const parent = finished({ winnerIds: ['a', 'b'] });

    expect(nextSeriesWins('dots', parent)).toEqual({ a: 1, b: 1 });
  });

  it('carries the tally through a room nobody won', () => {
    // A room abandoned mid-match must not reset the series.
    const parent = { status: 'playing', seriesWins: { a: 3 } };

    expect(nextSeriesWins('dots', parent)).toEqual({ a: 3 });
  });

  it('ignores a tally that has been tampered with', () => {
    const parent = finished({ seriesWins: { a: 'lots', b: -5, c: 2, d: null } });

    expect(seriesWinsOf(parent)).toEqual({ c: 2 });
  });

  it('knows when there is nothing worth showing', () => {
    expect(hasSeries({})).toBe(false);
    expect(hasSeries({ a: 0 })).toBe(false);
    expect(hasSeries({ a: 1 })).toBe(true);
  });
});

describe('Spyfall scores its own way', () => {
  const round = (winner: string, over: Record<string, unknown> = {}) => finished({
    winner,
    players: [
      { id: 'spy', isSpy: true },
      { id: 'a', isSpy: false },
      { id: 'b', isSpy: false },
      { id: 'c', isSpy: false }
    ],
    ...over
  });

  it('pays the spy five for beating the whole table', () => {
    expect(awardsOf('spyfall', round('spy'))).toEqual({ spy: SPY_WIN });
  });

  it('pays each local one', () => {
    expect(awardsOf('spyfall', round('locals'))).toEqual({
      a: LOCAL_WIN, b: LOCAL_WIN, c: LOCAL_WIN
    });
  });

  it('adds a point for the accusation that actually caught the spy', () => {
    const state = round('locals', {
      winReason: 'spy_caught',
      nomination: { authorId: 'b' }
    });

    expect(awardsOf('spyfall', state)).toEqual({
      a: LOCAL_WIN, b: LOCAL_WIN + ACCUSER_BONUS, c: LOCAL_WIN
    });
  });

  it('is worth more to the one spy than to any one local', () => {
    // The point of the five: the spy plays the whole table alone, so a round
    // won has to be worth more to them than to any single opponent. It is
    // deliberately not a claim about the sides' totals — with enough locals
    // theirs is larger, and that is the game working, not a bug.
    const spyRound = awardsOf('spyfall', round('spy'));
    const localRound = awardsOf('spyfall', round('locals'));

    expect(Math.max(...Object.values(spyRound)))
      .toBeGreaterThan(Math.max(...Object.values(localRound)));
  });

  it('carries that arithmetic into the series', () => {
    const parent = round('spy', { seriesWins: { spy: 5, a: 2 } });

    expect(nextSeriesWins('spyfall', parent)).toEqual({ spy: 10, a: 2 });
  });

  it('gives every other game one point a win', () => {
    expect(awardsOf('dots', finished({ winnerIds: ['a', 'b'] }))).toEqual({ a: 1, b: 1 });
  });
});
