import type { DotsState, Edge, EdgeOrientation } from '@/types/dots';

/**
 * Pure rules for Dots & Boxes. No React, no Supabase — a function of its
 * arguments, which is what makes the rulebook testable rather than only
 * reachable by clicking.
 *
 * Index arithmetic, once, here:
 *
 *   horizontal edge (row, col)  →  row * size + col,  row in 0..size, col in 0..size-1
 *   vertical   edge (row, col)  →  row * (size+1) + col, row in 0..size-1, col in 0..size
 *   box        (row, col)       →  row * size + col
 *
 * A horizontal edge at (r, c) runs along the top of box (r, c) and the bottom
 * of box (r-1, c). A vertical edge at (r, c) runs down the left of box (r, c)
 * and the right of box (r, c-1).
 */

export const DEFAULT_SIZE = 5;
export const MIN_SIZE = 3;
export const MAX_SIZE = 8;

export const hCount = (size: number): number => (size + 1) * size;
export const vCount = (size: number): number => size * (size + 1);
export const boxCount = (size: number): number => size * size;

export const edgeKey = (e: Edge): string => `${e.orientation}${e.index}`;

/** The four edges around a box, as indices into their own arrays. */
export function boxEdges(size: number, row: number, col: number) {
  return {
    top: row * size + col,
    bottom: (row + 1) * size + col,
    left: row * (size + 1) + col,
    right: row * (size + 1) + col + 1
  };
}

/** The boxes an edge borders — two in the middle of the board, one at a rim. */
export function boxesTouching(size: number, e: Edge): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = [];

  if (e.orientation === 'h') {
    const row = Math.floor(e.index / size);
    const col = e.index % size;
    if (row > 0) out.push({ row: row - 1, col });      // the box above
    if (row < size) out.push({ row, col });            // the box below
  } else {
    const row = Math.floor(e.index / (size + 1));
    const col = e.index % (size + 1);
    if (col > 0) out.push({ row, col: col - 1 });      // the box to the left
    if (col < size) out.push({ row, col });            // the box to the right
  }

  return out;
}

export function isEdgeDrawn(state: DotsState, e: Edge): boolean {
  const lines = e.orientation === 'h' ? state.hLines : state.vLines;
  return lines[e.index] != null;
}

export function isEdgeInBounds(size: number, e: Edge): boolean {
  const limit = e.orientation === 'h' ? hCount(size) : vCount(size);
  return Number.isInteger(e.index) && e.index >= 0 && e.index < limit;
}

/** All four sides drawn. */
export function isBoxClosed(state: DotsState, row: number, col: number): boolean {
  const { top, bottom, left, right } = boxEdges(state.size, row, col);
  return (
    state.hLines[top] != null &&
    state.hLines[bottom] != null &&
    state.vLines[left] != null &&
    state.vLines[right] != null
  );
}

/** An edge may be drawn if it is on the board and nobody has drawn it yet. */
export function canDrawEdge(state: DotsState, e: Edge): boolean {
  return isEdgeInBounds(state.size, e) && !isEdgeDrawn(state, e);
}

export interface DrawResult {
  /** The state after the line is drawn and any boxes are awarded. */
  state: DotsState;
  /** How many boxes this line closed — non-zero means the player goes again. */
  claimed: number;
}

/**
 * Draws a line for `playerId`, awarding any box it closes.
 *
 * Closing a box grants another turn, which is why the count comes back rather
 * than the caller re-deriving it: a single line can close two boxes at once,
 * and both belong to whoever drew it.
 */
export function drawEdge(state: DotsState, e: Edge, playerId: string): DrawResult | null {
  if (!canDrawEdge(state, e)) return null;

  const next: DotsState = {
    ...state,
    hLines: [...state.hLines],
    vLines: [...state.vLines],
    boxes: [...state.boxes]
  };

  if (e.orientation === 'h') next.hLines[e.index] = playerId;
  else next.vLines[e.index] = playerId;

  let claimed = 0;
  for (const { row, col } of boxesTouching(next.size, e)) {
    const at = row * next.size + col;
    if (next.boxes[at] == null && isBoxClosed(next, row, col)) {
      next.boxes[at] = playerId;
      claimed++;
    }
  }

  if (claimed > 0) {
    next.players = next.players.map((p) =>
      p.id === playerId ? { ...p, score: (p.score || 0) + claimed } : p
    );
  }

  return { state: next, claimed };
}

/** Every line drawn: nothing left to play. */
export function isBoardFull(state: DotsState): boolean {
  return state.hLines.every((o) => o != null) && state.vLines.every((o) => o != null);
}

/** Boxes held per player id, counted from the board rather than the score. */
export function boxTally(state: DotsState): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const owner of state.boxes) {
    if (owner) tally[owner] = (tally[owner] || 0) + 1;
  }
  return tally;
}

/** Everyone on the top score — more than one when the match ends level. */
export function leaders(state: DotsState): string[] {
  if (state.players.length === 0) return [];

  const tally = boxTally(state);
  const best = Math.max(...state.players.map((p) => tally[p.id] || 0));
  return state.players.filter((p) => (tally[p.id] || 0) === best).map((p) => p.id);
}

/** A fresh board of the given size, every line and box unowned. */
export function emptyBoard(size: number) {
  return {
    hLines: Array<string | null>(hCount(size)).fill(null),
    vLines: Array<string | null>(vCount(size)).fill(null),
    boxes: Array<string | null>(boxCount(size)).fill(null)
  };
}

/** Every line still open, for a hint or a timed-out turn. */
export function openEdges(state: DotsState): Edge[] {
  const out: Edge[] = [];
  const kinds: EdgeOrientation[] = ['h', 'v'];

  for (const orientation of kinds) {
    const lines = orientation === 'h' ? state.hLines : state.vLines;
    lines.forEach((owner, index) => {
      if (owner == null) out.push({ orientation, index });
    });
  }

  return out;
}
