import type { Wall, WallOrientation } from '@/types/wallrush';

/**
 * How the ends of Wall Rush walls meet — drawing only, the rules never read it.
 *
 * A wall covers cell + groove + cell. Where the grooves cross there is a
 * small square — an intersection — that no wall covers by its span alone,
 * and what belongs in it depends on what else ends there:
 *
 *   another wall runs through it   the end stops at its edge and butts up
 *                                  against that wall (a T); reaching in would
 *                                  draw over the middle of it
 *   two walls in line end there    each reaches half way, so they meet
 *   a wall of the other direction  an L: the horizontal one fills the square,
 *   ends there too                 the vertical stops at it — reaching half
 *                                  way each would leave the outer corner bitten
 *   nothing else                   the end stays flush with the cells, as a
 *                                  real wall piece is exactly that long
 *
 * The board edge counts as nothing else, so walls never stick out of the
 * board.
 */

/** How far each end reaches into the intersection beyond it, in grooves: 0, ½ or 1. */
export interface WallReach {
  /** Left end of a horizontal wall, top end of a vertical one. */
  start: number;
  /** Right end of a horizontal wall, bottom end of a vertical one. */
  end: number;
}

const keyOf = (o: WallOrientation, x: number, y: number) => `${o}${x},${y}`;

export const wallKey = (w: Pick<Wall, 'o' | 'x' | 'y'>) => keyOf(w.o, w.x, w.y);

export function wallReaches(walls: Wall[], size: number): Map<string, WallReach> {
  const placed = new Set(walls.map(wallKey));
  const has = (o: WallOrientation, x: number, y: number) => placed.has(keyOf(o, x, y));
  const last = size - 2;

  /** The reach of one end of an `o` wall into intersection (ix, iy). */
  const reachInto = (o: WallOrientation, ix: number, iy: number): number => {
    if (ix < 0 || iy < 0 || ix > last || iy > last) return 0;

    // A wall's middle is its own intersection, so a wall "at" (ix, iy) runs
    // straight through this one.
    if (has('h', ix, iy) || has('v', ix, iy)) return 0;

    const hEnds = Number(has('h', ix - 1, iy)) + Number(has('h', ix + 1, iy));
    const vEnds = Number(has('v', ix, iy - 1)) + Number(has('v', ix, iy + 1));
    const inLine = o === 'h' ? hEnds : vEnds;
    const across = o === 'h' ? vEnds : hEnds;

    if (inLine === 2) return 0.5;
    if (across === 2) return 0;
    if (across === 1) return o === 'h' ? 1 : 0;
    return 0;
  };

  const reaches = new Map<string, WallReach>();
  for (const w of walls) {
    reaches.set(
      wallKey(w),
      w.o === 'h'
        ? { start: reachInto('h', w.x - 1, w.y), end: reachInto('h', w.x + 1, w.y) }
        : { start: reachInto('v', w.x, w.y - 1), end: reachInto('v', w.x, w.y + 1) }
    );
  }
  return reaches;
}
