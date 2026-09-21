/**
 * Pure rules for Reversi. No React, no Supabase — a function of its arguments,
 * which is what makes the rulebook testable rather than only reachable by
 * clicking.
 *
 * The board is a flat array of seat numbers, row-major: `row * size + col`.
 * `null` is an empty square.
 */

export const BOARD_SIZE = 8;

/** Seat 0 plays dark and opens, as the game has always been played. */
export const DARK = 0;
export const LIGHT = 1;

export type Board = (number | null)[];

/** The eight directions a line can run. */
const DIRECTIONS: Array<[number, number]> = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1]
];

export const at = (size: number, col: number, row: number): number => row * size + col;
export const colOf = (size: number, index: number): number => index % size;
export const rowOf = (size: number, index: number): number => Math.floor(index / size);

const inBounds = (size: number, col: number, row: number): boolean =>
  col >= 0 && row >= 0 && col < size && row < size;

/**
 * The opening four, placed in the middle with each colour on a diagonal.
 *
 * That diagonal is what makes the first move possible at all: a symmetrical
 * block of one colour would trap nothing.
 */
export function startingBoard(size = BOARD_SIZE): Board {
  const board: Board = Array<number | null>(size * size).fill(null);
  const mid = size / 2;

  board[at(size, mid - 1, mid - 1)] = LIGHT;
  board[at(size, mid, mid)] = LIGHT;
  board[at(size, mid, mid - 1)] = DARK;
  board[at(size, mid - 1, mid)] = DARK;

  return board;
}

/**
 * Every disc that would turn over if `seat` played `index`.
 *
 * A direction counts only when a run of the rival's discs is closed by one of
 * yours — running off the board or into a gap traps nothing, which is the rule
 * most home-made versions get wrong.
 */
export function flipsFor(board: Board, size: number, index: number, seat: number): number[] {
  if (index < 0 || index >= board.length) return [];
  if (board[index] != null) return [];

  const col0 = colOf(size, index);
  const row0 = rowOf(size, index);
  const flips: number[] = [];

  for (const [dx, dy] of DIRECTIONS) {
    const run: number[] = [];
    let col = col0 + dx;
    let row = row0 + dy;

    while (inBounds(size, col, row)) {
      const cell = board[at(size, col, row)];
      if (cell == null) break;                 // a gap closes nothing
      if (cell === seat) {                     // our own disc closes the run
        flips.push(...run);
        break;
      }
      run.push(at(size, col, row));
      col += dx;
      row += dy;
    }
  }

  return flips;
}

/** A move is legal exactly when it turns at least one disc over. */
export function isLegalMove(board: Board, size: number, index: number, seat: number): boolean {
  return flipsFor(board, size, index, seat).length > 0;
}

export function legalMoves(board: Board, size: number, seat: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (isLegalMove(board, size, i, seat)) out.push(i);
  }
  return out;
}

export function hasMove(board: Board, size: number, seat: number): boolean {
  for (let i = 0; i < board.length; i++) {
    if (isLegalMove(board, size, i, seat)) return true;
  }
  return false;
}

/** Places a disc and turns over everything it traps, or null if illegal. */
export function applyMove(board: Board, size: number, index: number, seat: number): Board | null {
  const flips = flipsFor(board, size, index, seat);
  if (flips.length === 0) return null;

  const next = [...board];
  next[index] = seat;
  for (const i of flips) next[i] = seat;
  return next;
}

/** Discs held per seat. */
export function tally(board: Board): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const cell of board) {
    if (cell != null) counts[cell] = (counts[cell] || 0) + 1;
  }
  return counts;
}

/**
 * Seats on the top count — both when the match ends level.
 *
 * Counted over the seats given rather than over the board, so a colour that
 * has been wiped off entirely still registers as having lost rather than
 * vanishing from the result.
 */
export function leaders(board: Board, seats: number[]): number[] {
  if (seats.length === 0) return [];

  const counts = tally(board);
  const best = Math.max(...seats.map((s) => counts[s] || 0));
  return seats.filter((s) => (counts[s] || 0) === best);
}

/**
 * Whether the match is over.
 *
 * Reversi ends when neither side can move — usually because the board is
 * full, but a colour can also be wiped out or boxed in with squares to spare.
 */
export function isOver(board: Board, size: number, seats: number[]): boolean {
  return !seats.some((seat) => hasMove(board, size, seat));
}
