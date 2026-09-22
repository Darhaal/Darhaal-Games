import { describe, it, expect } from 'vitest';
import { randomIndex, randomOf, shuffled } from '@/lib/turnOrder';

/**
 * Every game used to hand the opening move to `players[0]` — the host. These
 * cover the draw that replaced it.
 */

describe('randomIndex', () => {
  it('stays inside the list', () => {
    for (let i = 0; i < 500; i++) {
      const n = randomIndex(4);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(4);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('reaches every seat at a table of four', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randomIndex(4));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('has only one answer for a table of one, and none to crash on for zero', () => {
    expect(randomIndex(1)).toBe(0);
    expect(randomIndex(0)).toBe(0);
  });
});

describe('randomOf', () => {
  it('picks somebody who is actually there', () => {
    const players = ['a', 'b', 'c'];
    for (let i = 0; i < 300; i++) expect(players).toContain(randomOf(players));
  });

  it('does not always pick the host', () => {
    // The whole point: 300 draws landing on players[0] every time would mean
    // the shuffle is not happening at all.
    const players = ['host', 'guest'];
    const picks = new Set(Array.from({ length: 300 }, () => randomOf(players)));
    expect(picks).toEqual(new Set(['host', 'guest']));
  });

  it('has nothing to return for an empty table', () => {
    expect(randomOf([])).toBeUndefined();
  });
});

describe('shuffled', () => {
  it('keeps every element exactly once', () => {
    const input = [1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 200; i++) {
      expect([...shuffled(input)].sort((a, b) => a - b)).toEqual(input);
    }
  });

  it('leaves the input alone', () => {
    const input = ['a', 'b', 'c'];
    shuffled(input);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('actually reorders', () => {
    // Reversi seats through this, so a shuffle that never moved anything
    // would leave the host playing Dark every game.
    const input = [0, 1, 2, 3, 4, 5, 6, 7];
    const orders = new Set(Array.from({ length: 200 }, () => shuffled(input).join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('puts each seat first sometimes, over many runs', () => {
    const first = new Set(Array.from({ length: 400 }, () => shuffled([0, 1])[0]));
    expect(first).toEqual(new Set([0, 1]));
  });
});
