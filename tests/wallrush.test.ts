import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE, BOARD_FOR_MODE, GOAL_FOR_MODE, SEATS, WALLS_FOR_MODE, PLAYERS_FOR_MODE,
  seatsForMode, teamOf, startCell, isGoal, isBlocked, wallsClash, centreCell,
  canPlaceWall, hasPathToGoal, distanceToGoal, legalMoves, openNeighbours, sameCell
} from '@/lib/gameLogic/wallrush';
import type { Cell, Wall, WallRushMode } from '@/types/wallrush';

/** Every mode, so a new one is covered by the checks below the moment it exists. */
const MODES: WallRushMode[] = ['duel', 'trio', 'teams', 'ffa'];

const h = (x: number, y: number): Wall => ({ x, y, o: 'h' });
const v = (x: number, y: number): Wall => ({ x, y, o: 'v' });
const at = (x: number, y: number): Cell => ({ x, y });
const has = (cells: Cell[], x: number, y: number) => cells.some((c) => c.x === x && c.y === y);

describe('wall rush rules', () => {
  describe('board and modes', () => {
    it('starts every pawn on the middle of its own edge', () => {
      expect(startCell('north')).toEqual({ x: 4, y: 0 });
      expect(startCell('south')).toEqual({ x: 4, y: 8 });
      expect(startCell('west')).toEqual({ x: 0, y: 4 });
      expect(startCell('east')).toEqual({ x: 8, y: 4 });
    });

    it('sends every pawn to the opposite edge', () => {
      expect(isGoal('north', at(0, 8))).toBe(true);
      expect(isGoal('north', at(0, 7))).toBe(false);
      expect(isGoal('south', at(3, 0))).toBe(true);
      expect(isGoal('west', at(8, 1))).toBe(true);
      expect(isGoal('east', at(0, 1))).toBe(true);
    });

    it('gives every mode its own board, allowance and target', () => {
      // These numbers are balance, not decoration: twenty walls on one board
      // locks it solid, and a table that converges on the middle needs an
      // odd, larger board for a middle to exist.
      expect(WALLS_FOR_MODE).toEqual({ duel: 10, trio: 8, teams: 5, ffa: 7 });
      expect(BOARD_FOR_MODE).toEqual({ duel: 9, trio: 11, teams: 9, ffa: 11 });
      expect(GOAL_FOR_MODE).toEqual({
        duel: 'opposite', trio: 'centre', teams: 'opposite', ffa: 'centre'
      });
      expect(PLAYERS_FOR_MODE).toEqual({ duel: 2, trio: 3, teams: 4, ffa: 4 });
    });

    it('seats each mode on as many sides as it has players', () => {
      for (const mode of MODES) {
        const sides = seatsForMode(mode);
        expect(new Set(sides).size, `${mode} seats somebody twice`).toBe(sides.length);
        expect(sides.length, `${mode} has the wrong number of sides`)
          .toBe(PLAYERS_FOR_MODE[mode]);
      }
    });

    it('gives every mode that races to the middle a board with one', () => {
      for (const mode of MODES) {
        if (GOAL_FOR_MODE[mode] !== 'centre') continue;
        expect(BOARD_FOR_MODE[mode] % 2, `${mode} has no centre square`).toBe(1);
      }
    });

    it('starts three players on three different squares, none of them the goal', () => {
      const size = BOARD_FOR_MODE.trio;
      const starts = seatsForMode('trio').map((side) => startCell(side, size));

      expect(new Set(starts.map((c) => `${c.x},${c.y}`)).size).toBe(3);
      for (const start of starts) {
        expect(sameCell(start, centreCell(size)), 'a pawn starts on the goal').toBe(false);
      }
    });

    it('puts a four-player table on an odd board so a centre square exists', () => {
      expect(BOARD_FOR_MODE.ffa % 2).toBe(1);
      expect(centreCell(11)).toEqual({ x: 5, y: 5 });
    });

    it('starts a four on the middle of each side of the bigger board', () => {
      const n = BOARD_FOR_MODE.ffa;
      expect(startCell('north', n)).toEqual({ x: 5, y: 0 });
      expect(startCell('east', n)).toEqual({ x: 10, y: 5 });
      expect(startCell('south', n)).toEqual({ x: 5, y: 10 });
      expect(startCell('west', n)).toEqual({ x: 0, y: 5 });
    });

    it('plays a duel across the board rather than around it', () => {
      expect(seatsForMode('duel')).toEqual(['north', 'south']);
      expect(seatsForMode('teams')).toEqual(SEATS);
      expect(seatsForMode('ffa')).toEqual(SEATS);
    });

    it('partners facing seats, so turns alternate between the teams', () => {
      // Seats run clockwise, so 0/2 face each other and 1/3 face each other;
      // partnering neighbours instead would give one team two turns in a row.
      expect(teamOf(0)).toBe(teamOf(2));
      expect(teamOf(1)).toBe(teamOf(3));
      expect(teamOf(0)).not.toBe(teamOf(1));
    });
  });

  describe('walls block the seam they straddle', () => {
    it('separates the two rows a horizontal wall runs between', () => {
      const walls = [h(3, 4)]; // seam below row 4, across columns 3 and 4
      expect(isBlocked(walls, at(3, 4), at(3, 5))).toBe(true);
      expect(isBlocked(walls, at(4, 4), at(4, 5))).toBe(true);
      // and nothing else
      expect(isBlocked(walls, at(5, 4), at(5, 5))).toBe(false);
      expect(isBlocked(walls, at(2, 4), at(2, 5))).toBe(false);
      expect(isBlocked(walls, at(3, 3), at(3, 4))).toBe(false);
    });

    it('separates the two columns a vertical wall runs between', () => {
      const walls = [v(3, 4)]; // seam right of column 3, across rows 4 and 5
      expect(isBlocked(walls, at(3, 4), at(4, 4))).toBe(true);
      expect(isBlocked(walls, at(3, 5), at(4, 5))).toBe(true);
      expect(isBlocked(walls, at(3, 6), at(4, 6))).toBe(false);
      expect(isBlocked(walls, at(3, 4), at(3, 5))).toBe(false);
    });

    it('blocks the same seam from either side', () => {
      const walls = [h(3, 4)];
      expect(isBlocked(walls, at(3, 5), at(3, 4))).toBe(true);
      expect(isBlocked(walls, [at(3, 4), at(3, 5)][1], at(3, 4))).toBe(true);
    });

    it('refuses anything that is not a single orthogonal step', () => {
      expect(isBlocked([], at(3, 3), at(4, 4))).toBe(true);
      expect(isBlocked([], at(3, 3), at(3, 5))).toBe(true);
      expect(isBlocked([], at(3, 3), at(3, 3))).toBe(true);
    });

    it('keeps pawns on the board', () => {
      expect(openNeighbours([], at(0, 0))).toHaveLength(2);
      expect(openNeighbours([], at(4, 4))).toHaveLength(4);
      expect(openNeighbours([], at(8, 8))).toHaveLength(2);
    });
  });

  describe('walls cannot share space', () => {
    it('rejects a wall crossing another at the same slot', () => {
      expect(wallsClash(h(3, 3), v(3, 3))).toBe(true);
      expect(wallsClash(h(3, 3), h(3, 3))).toBe(true);
    });

    it('rejects an overlap along the wall length', () => {
      expect(wallsClash(h(3, 3), h(4, 3))).toBe(true);
      expect(wallsClash(h(3, 3), h(2, 3))).toBe(true);
      expect(wallsClash(v(3, 3), v(3, 4))).toBe(true);
    });

    it('allows walls that merely touch end to end or sit parallel', () => {
      expect(wallsClash(h(3, 3), h(5, 3))).toBe(false);
      expect(wallsClash(h(3, 3), h(3, 4))).toBe(false);
      expect(wallsClash(v(3, 3), v(4, 3))).toBe(false);
      expect(wallsClash(h(3, 3), v(4, 4))).toBe(false);
    });
  });

  describe('a wall may never take away the last route', () => {
    const pawn = { cell: at(0, 0), side: 'north' as const };
    // Seals the seam under row 0 for columns 0-7. Column 8 stays open, because
    // a fifth horizontal wall there would overlap the fourth — the geometry
    // will not let a line be closed with horizontals alone.
    const line = [h(0, 0), h(2, 0), h(4, 0), h(6, 0)];

    it('allows the line itself, which still leaves a way through', () => {
      expect(hasPathToGoal(line, pawn.cell, pawn.side)).toBe(true);
      expect(canPlaceWall(line.slice(0, 3), line[3], [pawn])).toBe(true);
    });

    it('refuses the wall that closes the last gap', () => {
      // v(7,0) cuts column 7 off from column 8, which is the only way down.
      expect(canPlaceWall(line, v(7, 0), [pawn])).toBe(false);
      expect(hasPathToGoal([...line, v(7, 0)], pawn.cell, pawn.side)).toBe(false);
    });

    it('allows that same wall while a gap remains elsewhere', () => {
      const leaky = [h(0, 0), h(2, 0), h(4, 0)]; // columns 6 and 7 still open
      expect(canPlaceWall(leaky, v(7, 0), [pawn])).toBe(true);
    });

    it('checks every pawn, not only the one being walled in', () => {
      const other = { cell: at(4, 8), side: 'south' as const };
      expect(canPlaceWall(line, v(7, 0), [other, pawn])).toBe(false);
    });

    it('refuses a wall off the board or on top of another', () => {
      expect(canPlaceWall([], h(-1, 0), [pawn])).toBe(false);
      expect(canPlaceWall([], h(8, 0), [pawn])).toBe(false);
      expect(canPlaceWall([], h(0, 8), [pawn])).toBe(false);
      expect(canPlaceWall([h(3, 3)], v(3, 3), [pawn])).toBe(false);
    });
  });

  describe('distance', () => {
    it('measures the open board honestly', () => {
      expect(distanceToGoal([], startCell('north'), 'north')).toBe(BOARD_SIZE - 1);
      expect(distanceToGoal([], startCell('west'), 'west')).toBe(BOARD_SIZE - 1);
    });

    it('grows when a wall forces a detour', () => {
      const detour = distanceToGoal([h(4, 0), h(2, 0)], at(4, 0), 'north');
      expect(detour).toBeGreaterThan(BOARD_SIZE - 1);
    });

    it('reports no route rather than a wrong number', () => {
      const sealed = [h(0, 0), h(2, 0), h(4, 0), h(6, 0), v(7, 0)];
      expect(distanceToGoal(sealed, at(0, 0), 'north')).toBeNull();
    });
  });

  describe('moving, jumping and going around', () => {
    it('offers the four orthogonal steps on an open board', () => {
      const moves = legalMoves([], at(4, 4), []);
      expect(moves).toHaveLength(4);
      expect(has(moves, 4, 3)).toBe(true);
      expect(has(moves, 4, 5)).toBe(true);
      expect(has(moves, 3, 4)).toBe(true);
      expect(has(moves, 5, 4)).toBe(true);
    });

    it('drops a step a wall stands in the way of', () => {
      const moves = legalMoves([h(4, 4)], at(4, 4), []);
      expect(has(moves, 4, 5)).toBe(false);
      expect(moves).toHaveLength(3);
    });

    it('hops straight over a pawn standing face to face', () => {
      const moves = legalMoves([], at(4, 4), [at(4, 5)]);
      expect(has(moves, 4, 5)).toBe(false); // cannot land on them
      expect(has(moves, 4, 6)).toBe(true);  // over them
    });

    it('goes around when a wall stands behind that pawn', () => {
      // h(4,5) seals the seam under row 5, so the hop has nowhere to land.
      const moves = legalMoves([h(4, 5)], at(4, 4), [at(4, 5)]);
      expect(has(moves, 4, 6)).toBe(false);
      expect(has(moves, 3, 5)).toBe(true);
      expect(has(moves, 5, 5)).toBe(true);
    });

    it('goes around when the board edge is behind that pawn', () => {
      const moves = legalMoves([], at(4, 7), [at(4, 8)]);
      expect(has(moves, 4, 8)).toBe(false);
      expect(has(moves, 3, 8)).toBe(true);
      expect(has(moves, 5, 8)).toBe(true);
    });

    it('will not side-step onto a third pawn or through a wall', () => {
      const moves = legalMoves([h(4, 5), v(4, 5)], at(4, 4), [at(4, 5), at(3, 5)]);
      expect(has(moves, 3, 5)).toBe(false); // occupied
      expect(has(moves, 5, 5)).toBe(false); // v(4,5) seals column 4 from 5
    });

    it('never offers the same cell twice', () => {
      // Two pawns side by side can both propose the cell between their flanks.
      const moves = legalMoves([h(4, 5), h(3, 5)], at(4, 4), [at(4, 5), at(3, 4)]);
      const keys = moves.map((m) => `${m.x},${m.y}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('keeps jumps inside the board', () => {
      const moves = legalMoves([], at(0, 0), [at(1, 0)]);
      expect(moves.every((m) => m.x >= 0 && m.y >= 0 && m.x < 9 && m.y < 9)).toBe(true);
    });

    it('clears two queued pawns only at a four-player table', () => {
      // Four at a table lets a hop pass over two pawns in a line; the duel and
      // the team game keep the single hop, which is why it is a flag.
      const others = [at(4, 5), at(4, 6)];
      expect(has(legalMoves([], at(4, 4), others, 9, true), 4, 7)).toBe(true);
      expect(has(legalMoves([], at(4, 4), others, 9, false), 4, 7)).toBe(false);
    });

    it('still refuses a double jump into a wall or a third pawn', () => {
      const others = [at(4, 5), at(4, 6)];
      expect(has(legalMoves([h(4, 6)], at(4, 4), others, 9, true), 4, 7)).toBe(false);
      expect(has(legalMoves([], at(4, 4), [...others, at(4, 7)], 9, true), 4, 7)).toBe(false);
    });

    it('falls back to the side-step when the double jump is not available', () => {
      // Two in a line with the board edge behind them: no landing square, so
      // the move goes around the near pawn instead.
      const moves = legalMoves([], at(4, 6), [at(4, 7), at(4, 8)], 9, true);
      expect(has(moves, 3, 7)).toBe(true);
      expect(has(moves, 5, 7)).toBe(true);
    });
  });

  describe('four at a table races for the centre', () => {
    const N = BOARD_FOR_MODE.ffa;
    const CENTRE = centreCell(N);

    it('counts the middle square as home for every side', () => {
      for (const side of SEATS) {
        expect(isGoal(side, CENTRE, N, 'centre')).toBe(true);
        expect(isGoal(side, at(0, 0), N, 'centre')).toBe(false);
      }
    });

    it('does not treat the far edge as home any more', () => {
      // The edge is the duel's target; in a four it is just another square.
      expect(isGoal('north', at(5, N - 1), N, 'centre')).toBe(false);
      expect(isGoal('north', at(5, N - 1), N, 'opposite')).toBe(true);
    });

    it('measures the distance from each side to the middle', () => {
      for (const side of SEATS) {
        expect(distanceToGoal([], startCell(side, N), side, N, 'centre')).toBe(5);
      }
    });

    it('refuses a wall that seals the centre off from anyone', () => {
      // Box the middle square in on three sides, then try to close the fourth.
      const boxed = [h(4, 4), h(4, 5), v(4, 4)];
      const pawns = SEATS.map((side) => ({ cell: startCell(side, N), side }));

      expect(canPlaceWall(boxed, v(5, 4), pawns, N, 'centre')).toBe(false);
      // The same wall is fine while the centre is only boxed on two sides.
      expect(canPlaceWall([h(4, 4), h(4, 5)], v(5, 4), pawns, N, 'centre')).toBe(true);
    });

    it('still lets ordinary walls through', () => {
      const pawns = SEATS.map((side) => ({ cell: startCell(side, N), side }));
      expect(canPlaceWall([], h(0, 0), pawns, N, 'centre')).toBe(true);
      expect(canPlaceWall([], v(7, 7), pawns, N, 'centre')).toBe(true);
    });
  });
});
