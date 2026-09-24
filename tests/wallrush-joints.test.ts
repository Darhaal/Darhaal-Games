import { describe, it, expect } from 'vitest';
import { wallReaches } from '@/lib/gameLogic/wallrushJoints';
import type { Wall } from '@/types/wallrush';

/**
 * How Wall Rush walls meet where grooves cross.
 *
 * Drawing only, but the failures are the visible kind: a barrier with a hole
 * in it, a wall end painted over the middle of another, a corner with a bite
 * out of it, a wall hanging off the edge of the board.
 */

const SIZE = 9;
const reach = (walls: Wall[], w: Wall) =>
  wallReaches(walls, SIZE).get(`${w.o}${w.x},${w.y}`);

describe('where walls meet', () => {
  it('stays flush with the tiles when nothing else is there', () => {
    const w: Wall = { x: 3, y: 3, o: 'h' };
    expect(reach([w], w)).toEqual({ start: 0, end: 0 });
  });

  it('closes the gap between two walls in line, half each', () => {
    const a: Wall = { x: 1, y: 2, o: 'h' };
    const b: Wall = { x: 3, y: 2, o: 'h' };

    expect(reach([a, b], a)).toEqual({ start: 0, end: 0.5 });
    expect(reach([a, b], b)).toEqual({ start: 0.5, end: 0 });
  });

  it('does the same for vertical walls', () => {
    const a: Wall = { x: 6, y: 1, o: 'v' };
    const b: Wall = { x: 6, y: 3, o: 'v' };

    expect(reach([a, b], a)?.end).toBe(0.5);
    expect(reach([a, b], b)?.start).toBe(0.5);
  });

  it('butts a wall up against one running through, without drawing over it', () => {
    // A T: the horizontal passes through intersection (5, 2); the vertical
    // below it ends there.
    const bar: Wall = { x: 5, y: 2, o: 'h' };
    const stem: Wall = { x: 5, y: 3, o: 'v' };

    expect(reach([bar, stem], stem)).toEqual({ start: 0, end: 0 });
    expect(reach([bar, stem], bar)).toEqual({ start: 0, end: 0 });
  });

  it('fills the corner of an L once, from the horizontal side', () => {
    // Horizontal ends at intersection (4, 4) from the left; vertical ends
    // there from below.
    const h: Wall = { x: 3, y: 4, o: 'h' };
    const v: Wall = { x: 4, y: 5, o: 'v' };

    expect(reach([h, v], h)?.end).toBe(1);
    expect(reach([h, v], v)?.start).toBe(0);
  });

  it('lets an in-line pair win over a single wall ending across it', () => {
    const left: Wall = { x: 2, y: 4, o: 'h' };
    const right: Wall = { x: 4, y: 4, o: 'h' };
    const down: Wall = { x: 3, y: 5, o: 'v' };
    const walls = [left, right, down];

    expect(reach(walls, left)?.end).toBe(0.5);
    expect(reach(walls, right)?.start).toBe(0.5);
    expect(reach(walls, down)?.start).toBe(0);
  });

  it('never reaches past the edge of the board', () => {
    const first: Wall = { x: 0, y: 0, o: 'h' };
    const last: Wall = { x: SIZE - 2, y: SIZE - 2, o: 'v' };

    expect(reach([first], first)?.start).toBe(0);
    expect(reach([last], last)?.end).toBe(0);
  });
});
