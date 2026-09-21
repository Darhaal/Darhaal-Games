import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SIZE, hCount, vCount, boxCount, boxEdges, boxesTouching,
  emptyBoard, canDrawEdge, drawEdge, isBoxClosed, isBoardFull,
  boxTally, leaders, openEdges
} from '@/lib/gameLogic/dots';
import type { DotsState, Edge } from '@/types/dots';

const h = (index: number): Edge => ({ orientation: 'h', index });
const v = (index: number): Edge => ({ orientation: 'v', index });

function board(size = 3, players = ['a', 'b']): DotsState {
  return {
    players: players.map((id, seat) => ({
      id, name: id, avatarUrl: '', isHost: seat === 0, seat, score: 0
    })),
    status: 'playing',
    size,
    ...emptyBoard(size),
    turnPlayerId: players[0],
    winnerIds: [],
    startTime: 0,
    lastActionTime: 0,
    version: 1,
    gameType: 'dots',
    settings: { maxPlayers: players.length, size, turnDuration: 30 }
  };
}

/** Draws every side of one box, returning the state after the last line. */
function closeBox(state: DotsState, row: number, col: number, by: string) {
  const { top, bottom, left, right } = boxEdges(state.size, row, col);
  let current = state;
  let last = { state: current, claimed: 0 };

  for (const e of [h(top), h(bottom), v(left), v(right)]) {
    const step = drawEdge(current, e, by);
    if (step) { current = step.state; last = step; }
  }

  return last;
}

describe('dots and boxes', () => {
  describe('the grid', () => {
    it('counts edges and boxes for the board it is given', () => {
      // 3x3 boxes: 4 rows of 3 horizontals, 3 rows of 4 verticals.
      expect(hCount(3)).toBe(12);
      expect(vCount(3)).toBe(12);
      expect(boxCount(3)).toBe(9);

      expect(hCount(5)).toBe(30);
      expect(vCount(5)).toBe(30);
      expect(boxCount(DEFAULT_SIZE)).toBe(25);
    });

    it('starts with nothing drawn and nothing owned', () => {
      const b = emptyBoard(4);
      expect(b.hLines).toHaveLength(hCount(4));
      expect(b.vLines).toHaveLength(vCount(4));
      expect(b.boxes).toHaveLength(boxCount(4));
      expect([...b.hLines, ...b.vLines, ...b.boxes].every((o) => o === null)).toBe(true);
    });

    it('names the four sides of a box without overlap', () => {
      const e = boxEdges(3, 1, 1);
      expect(e).toEqual({ top: 4, bottom: 7, left: 5, right: 6 });
      // The box below shares its top with this box's bottom.
      expect(boxEdges(3, 2, 1).top).toBe(e.bottom);
      // The box to the right shares its left with this box's right.
      expect(boxEdges(3, 1, 2).left).toBe(e.right);
    });

    it('gives an inner edge two boxes and a rim edge one', () => {
      // Top rim: only the box below it.
      expect(boxesTouching(3, h(0))).toEqual([{ row: 0, col: 0 }]);
      // Bottom rim: only the box above it.
      expect(boxesTouching(3, h(9))).toEqual([{ row: 2, col: 0 }]);
      // Between two rows.
      expect(boxesTouching(3, h(3))).toEqual([{ row: 0, col: 0 }, { row: 1, col: 0 }]);
      // Left rim, then between two columns.
      expect(boxesTouching(3, v(0))).toEqual([{ row: 0, col: 0 }]);
      expect(boxesTouching(3, v(1))).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
      expect(boxesTouching(3, v(3))).toEqual([{ row: 0, col: 2 }]);
    });
  });

  describe('drawing a line', () => {
    it('records who drew it', () => {
      const result = drawEdge(board(), h(0), 'a');
      expect(result).not.toBeNull();
      expect(result!.state.hLines[0]).toBe('a');
      expect(result!.claimed).toBe(0);
    });

    it('refuses a line already drawn', () => {
      const once = drawEdge(board(), h(0), 'a')!;
      expect(canDrawEdge(once.state, h(0))).toBe(false);
      expect(drawEdge(once.state, h(0), 'b')).toBeNull();
    });

    it('refuses a line that is not on the board', () => {
      const b = board(3);
      expect(canDrawEdge(b, h(-1))).toBe(false);
      expect(canDrawEdge(b, h(hCount(3)))).toBe(false);
      expect(canDrawEdge(b, v(vCount(3)))).toBe(false);
      expect(drawEdge(b, h(99), 'a')).toBeNull();
    });

    it('leaves the original state untouched', () => {
      // The hook clones before writing; the rules must not mutate either.
      const before = board();
      drawEdge(before, h(0), 'a');
      expect(before.hLines[0]).toBeNull();
    });
  });

  describe('closing a box', () => {
    it('awards the box and the point to whoever drew the fourth side', () => {
      const last = closeBox(board(), 0, 0, 'a');
      expect(last.claimed).toBe(1);
      expect(isBoxClosed(last.state, 0, 0)).toBe(true);
      expect(last.state.boxes[0]).toBe('a');
      expect(last.state.players.find((p) => p.id === 'a')!.score).toBe(1);
    });

    it('does not award a box that is still open', () => {
      const { top, left, right } = boxEdges(3, 0, 0);
      let s = board();
      for (const e of [h(top), v(left), v(right)]) s = drawEdge(s, e, 'a')!.state;

      expect(isBoxClosed(s, 0, 0)).toBe(false);
      expect(s.boxes[0]).toBeNull();
      expect(s.players[0].score).toBe(0);
    });

    it('gives both boxes to one line that closes two at once', () => {
      // Box (0,0) and box (1,0) share the horizontal edge between them, so
      // drawing it last takes the pair — and the turn again with it.
      const shared = boxEdges(3, 0, 0).bottom;
      let s = board();

      for (const e of [h(boxEdges(3, 0, 0).top), v(boxEdges(3, 0, 0).left), v(boxEdges(3, 0, 0).right),
                       h(boxEdges(3, 1, 0).bottom), v(boxEdges(3, 1, 0).left), v(boxEdges(3, 1, 0).right)]) {
        s = drawEdge(s, e, 'a')!.state;
      }

      const last = drawEdge(s, h(shared), 'b')!;
      expect(last.claimed).toBe(2);
      expect(last.state.boxes[0]).toBe('b');
      expect(last.state.boxes[3]).toBe('b');
      expect(last.state.players.find((p) => p.id === 'b')!.score).toBe(2);
    });

    it('never re-awards a box that is already owned', () => {
      const first = closeBox(board(), 0, 0, 'a');
      // Every side is drawn, so nothing more can be claimed here.
      const again = drawEdge(first.state, h(boxEdges(3, 0, 0).top), 'b');
      expect(again).toBeNull();
      expect(boxTally(first.state)).toEqual({ a: 1 });
    });
  });

  describe('the end of the match', () => {
    it('is not over while a line is still open', () => {
      const s = drawEdge(board(), h(0), 'a')!.state;
      expect(isBoardFull(s)).toBe(false);
      expect(openEdges(s)).toHaveLength(hCount(3) + vCount(3) - 1);
    });

    it('is over once every line is drawn', () => {
      let s = board();
      for (const e of openEdges(s)) s = drawEdge(s, e, 'a')!.state;

      expect(isBoardFull(s)).toBe(true);
      expect(openEdges(s)).toHaveLength(0);
      // A full board means every box is closed too.
      expect(s.boxes.every((o) => o != null)).toBe(true);
      expect(boxTally(s)).toEqual({ a: boxCount(3) });
    });

    it('names the player holding the most boxes', () => {
      const s = closeBox(board(), 0, 0, 'a').state;
      expect(leaders(s)).toEqual(['a']);
    });

    it('names everyone level at the top', () => {
      // One box each: nobody is ahead.
      const first = closeBox(board(), 0, 0, 'a').state;
      const second = closeBox(first, 2, 2, 'b').state;
      expect(leaders(second).sort()).toEqual(['a', 'b']);
    });

    it('counts a scoreless board as level rather than won', () => {
      expect(leaders(board()).sort()).toEqual(['a', 'b']);
    });
  });
});
