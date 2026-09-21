import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE, DARK, LIGHT, at, colOf, rowOf,
  startingBoard, flipsFor, isLegalMove, legalMoves, hasMove,
  applyMove, tally, leaders, isOver, type Board
} from '@/lib/gameLogic/reversi';

const N = BOARD_SIZE;
const cell = (col: number, row: number) => at(N, col, row);

/** A board with only the squares named occupied — for isolating one rule. */
function sparse(entries: Array<[number, number, number]>, size = N): Board {
  const board: Board = Array<number | null>(size * size).fill(null);
  for (const [col, row, seat] of entries) board[at(size, col, row)] = seat;
  return board;
}

describe('reversi', () => {
  describe('the opening position', () => {
    it('puts four discs in the middle, each colour on a diagonal', () => {
      const board = startingBoard();
      expect(board[cell(3, 3)]).toBe(LIGHT);
      expect(board[cell(4, 4)]).toBe(LIGHT);
      expect(board[cell(4, 3)]).toBe(DARK);
      expect(board[cell(3, 4)]).toBe(DARK);
      expect(tally(board)).toEqual({ [DARK]: 2, [LIGHT]: 2 });
    });

    it('leaves everything else empty', () => {
      expect(startingBoard().filter((c) => c != null)).toHaveLength(4);
    });

    it('gives the opener exactly the four classic moves', () => {
      // The only squares that trap anything on turn one.
      const moves = legalMoves(startingBoard(), N, DARK).sort((a, b) => a - b);
      expect(moves).toEqual([cell(3, 2), cell(2, 3), cell(5, 4), cell(4, 5)].sort((a, b) => a - b));
    });

    it('translates between a square and its coordinates', () => {
      expect(colOf(N, cell(5, 2))).toBe(5);
      expect(rowOf(N, cell(5, 2))).toBe(2);
    });
  });

  describe('what a move traps', () => {
    it('turns over a run closed by one of your own', () => {
      // dark . light light dark  → playing dark at col 0 traps both lights.
      const board = sparse([[1, 0, LIGHT], [2, 0, LIGHT], [3, 0, DARK]]);
      const flips = flipsFor(board, N, cell(0, 0), DARK);
      expect(flips.sort()).toEqual([cell(1, 0), cell(2, 0)].sort());
    });

    it('traps nothing when the run reaches the board edge', () => {
      // No disc of ours beyond the run: it runs off the board and closes nothing.
      const board = sparse([[1, 0, LIGHT], [2, 0, LIGHT]]);
      expect(flipsFor(board, N, cell(0, 0), DARK)).toEqual([]);
      expect(isLegalMove(board, N, cell(0, 0), DARK)).toBe(false);
    });

    it('traps nothing across a gap', () => {
      // dark . light _ dark: the empty square breaks the line.
      const board = sparse([[1, 0, LIGHT], [3, 0, DARK]]);
      expect(flipsFor(board, N, cell(0, 0), DARK)).toEqual([]);
    });

    it('traps nothing when your own disc is immediately adjacent', () => {
      // A run needs at least one rival disc in it.
      const board = sparse([[1, 0, DARK]]);
      expect(flipsFor(board, N, cell(0, 0), DARK)).toEqual([]);
    });

    it('works along a diagonal, not only rows and columns', () => {
      const board = sparse([[1, 1, LIGHT], [2, 2, LIGHT], [3, 3, DARK]]);
      expect(flipsFor(board, N, cell(0, 0), DARK).sort()).toEqual([cell(1, 1), cell(2, 2)].sort());
    });

    it('collects every direction at once', () => {
      // Lights to the right and below, each closed by a dark.
      const board = sparse([
        [1, 0, LIGHT], [2, 0, DARK],
        [0, 1, LIGHT], [0, 2, DARK]
      ]);
      expect(flipsFor(board, N, cell(0, 0), DARK).sort()).toEqual([cell(1, 0), cell(0, 1)].sort());
    });

    it('refuses a square that is already taken', () => {
      const board = startingBoard();
      expect(flipsFor(board, N, cell(3, 3), DARK)).toEqual([]);
      expect(isLegalMove(board, N, cell(3, 3), DARK)).toBe(false);
    });

    it('refuses a square off the board', () => {
      expect(flipsFor(startingBoard(), N, -1, DARK)).toEqual([]);
      expect(flipsFor(startingBoard(), N, N * N, DARK)).toEqual([]);
    });
  });

  describe('playing a move', () => {
    it('places the disc and turns over what it trapped', () => {
      const after = applyMove(startingBoard(), N, cell(3, 2), DARK)!;
      expect(after[cell(3, 2)]).toBe(DARK);
      // The light disc it trapped is now dark.
      expect(after[cell(3, 3)]).toBe(DARK);
      // Four on the board became five, and the count shifted by two.
      expect(tally(after)).toEqual({ [DARK]: 4, [LIGHT]: 1 });
    });

    it('refuses a move that traps nothing', () => {
      expect(applyMove(startingBoard(), N, cell(0, 0), DARK)).toBeNull();
    });

    it('leaves the original board untouched', () => {
      // The hook clones before writing; the rules must not mutate either.
      const before = startingBoard();
      applyMove(before, N, cell(3, 2), DARK);
      expect(before[cell(3, 2)]).toBeNull();
      expect(before[cell(3, 3)]).toBe(LIGHT);
    });

    it('hands the reply to the other colour', () => {
      const after = applyMove(startingBoard(), N, cell(3, 2), DARK)!;
      expect(hasMove(after, N, LIGHT)).toBe(true);
      expect(legalMoves(after, N, LIGHT).length).toBeGreaterThan(0);
    });
  });

  describe('the end of the match', () => {
    it('is not over while either colour can still play', () => {
      expect(isOver(startingBoard(), N, [DARK, LIGHT])).toBe(false);
    });

    it('is over when neither colour can play', () => {
      // A single disc traps nothing for anybody.
      const board = sparse([[0, 0, DARK]]);
      expect(hasMove(board, N, DARK)).toBe(false);
      expect(hasMove(board, N, LIGHT)).toBe(false);
      expect(isOver(board, N, [DARK, LIGHT])).toBe(true);
    });

    it('is over with squares to spare when one colour is wiped out', () => {
      // Reversi does not need a full board to finish.
      const board = sparse([[0, 0, DARK], [1, 1, DARK]]);
      expect(board.filter((c) => c == null).length).toBeGreaterThan(0);
      expect(isOver(board, N, [DARK, LIGHT])).toBe(true);
    });

    it('names the colour holding the most discs', () => {
      const board = sparse([[0, 0, DARK], [1, 0, DARK], [2, 0, LIGHT]]);
      expect(leaders(board, [DARK, LIGHT])).toEqual([DARK]);
    });

    it('names both when the count is level', () => {
      const board = sparse([[0, 0, DARK], [1, 0, LIGHT]]);
      expect(leaders(board, [DARK, LIGHT])).toEqual([DARK, LIGHT]);
    });

    it('counts a wiped-out colour as losing rather than absent', () => {
      const board = sparse([[0, 0, DARK]]);
      expect(leaders(board, [DARK, LIGHT])).toEqual([DARK]);
    });

    it('calls the opening position level', () => {
      expect(leaders(startingBoard(), [DARK, LIGHT])).toEqual([DARK, LIGHT]);
    });
  });
});
