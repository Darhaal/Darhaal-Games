import type { Cell, Side, Wall, WallRushMode } from '@/types/wallrush';

/**
 * Pure rules for Wall Rush (Quoridor). No React, no Supabase — every function
 * here is a function of its arguments, which is what makes the rulebook
 * testable instead of only reachable by clicking.
 *
 * The rule that costs the most to get right is the last one: a wall may never
 * cut off a player's only remaining route. Checking it means a path search
 * from every pawn after every hypothetical placement, and skipping it turns
 * the game into "wall your rival into a box and win", which is not the game.
 */

/** The duel board. Four at a table uses a bigger one — see BOARD_FOR_MODE. */
export const BOARD_SIZE = 9;

/** Seats in clockwise order, so partners in `teams` are never consecutive. */
export const SEATS: Side[] = ['north', 'east', 'south', 'west'];

/**
 * What a pawn is running towards.
 *
 * `opposite` is the classic race across the board. `centre` is the four-player
 * table, where all four converge on the single middle square instead — which
 * is why that mode needs an odd, larger board and a different wall allowance.
 */
export type GoalKind = 'opposite' | 'centre';

export const BOARD_FOR_MODE: Record<WallRushMode, number> = {
  duel: 9,
  teams: 9,
  ffa: 11
};

export const GOAL_FOR_MODE: Record<WallRushMode, GoalKind> = {
  duel: 'opposite',
  teams: 'opposite',
  ffa: 'centre'
};

/** Walls per player. Four players share a board, so they each get fewer. */
export const WALLS_FOR_MODE: Record<WallRushMode, number> = {
  duel: 10,
  teams: 5,
  ffa: 7
};

export const PLAYERS_FOR_MODE: Record<WallRushMode, number> = {
  duel: 2,
  teams: 4,
  ffa: 4
};

/** The single square every pawn races for in the four-player table. */
export const centreCell = (size: number): Cell => ({
  x: Math.floor(size / 2),
  y: Math.floor(size / 2)
});

/** Seats used by a mode: a duel is played across the board, north to south. */
export function seatsForMode(mode: WallRushMode): Side[] {
  return mode === 'duel' ? ['north', 'south'] : SEATS;
}

/** In `teams`, facing seats play together: 0 with 2, 1 with 3. */
export function teamOf(seat: number): number {
  return seat % 2;
}

export function startCell(side: Side, size = BOARD_SIZE): Cell {
  const mid = Math.floor(size / 2);
  switch (side) {
    case 'north': return { x: mid, y: 0 };
    case 'south': return { x: mid, y: size - 1 };
    case 'west': return { x: 0, y: mid };
    case 'east': return { x: size - 1, y: mid };
  }
}

/**
 * True once a pawn has arrived: the opposite edge in a race, or the middle
 * square when four players are converging on it.
 */
export function isGoal(
  side: Side,
  cell: Cell,
  size = BOARD_SIZE,
  goal: GoalKind = 'opposite'
): boolean {
  if (goal === 'centre') return sameCell(cell, centreCell(size));

  switch (side) {
    case 'north': return cell.y === size - 1;
    case 'south': return cell.y === 0;
    case 'west': return cell.x === size - 1;
    case 'east': return cell.x === 0;
  }
}

export const inBounds = (c: Cell, size = BOARD_SIZE): boolean =>
  c.x >= 0 && c.y >= 0 && c.x < size && c.y < size;

export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

/**
 * Whether a wall stands between two orthogonally adjacent cells.
 *
 * A horizontal wall at (x, y) seals the seam below row y for columns x and
 * x+1; a vertical wall seals the seam right of column x for rows y and y+1.
 */
export function isBlocked(walls: Wall[], from: Cell, to: Cell): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) + Math.abs(dy) !== 1) return true; // not a single step

  if (dy === 1) return walls.some((w) => w.o === 'h' && w.y === from.y && (w.x === from.x || w.x === from.x - 1));
  if (dy === -1) return walls.some((w) => w.o === 'h' && w.y === to.y && (w.x === from.x || w.x === from.x - 1));
  if (dx === 1) return walls.some((w) => w.o === 'v' && w.x === from.x && (w.y === from.y || w.y === from.y - 1));
  return walls.some((w) => w.o === 'v' && w.x === to.x && (w.y === from.y || w.y === from.y - 1));
}

const STEPS: Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

/** Cells reachable in one step, ignoring pawns — the graph the path search walks. */
export function openNeighbours(walls: Wall[], from: Cell, size = BOARD_SIZE): Cell[] {
  return STEPS
    .map((s) => ({ x: from.x + s.x, y: from.y + s.y }))
    .filter((to) => inBounds(to, size) && !isBlocked(walls, from, to));
}

/**
 * Breadth-first search for any route from `from` to the edge `side` must
 * reach. Pawns are deliberately ignored: they move, walls do not, so a pawn
 * standing in the way is not the same as being cut off.
 */
export function hasPathToGoal(
  walls: Wall[],
  from: Cell,
  side: Side,
  size = BOARD_SIZE,
  goal: GoalKind = 'opposite'
): boolean {
  const seen = new Set<number>([from.y * size + from.x]);
  const queue: Cell[] = [from];

  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (isGoal(side, cell, size, goal)) return true;

    for (const next of openNeighbours(walls, cell, size)) {
      const key = next.y * size + next.x;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }

  return false;
}

/** Shortest number of steps to the goal edge, or null when there is no route. */
export function distanceToGoal(
  walls: Wall[],
  from: Cell,
  side: Side,
  size = BOARD_SIZE,
  goal: GoalKind = 'opposite'
): number | null {
  const seen = new Set<number>([from.y * size + from.x]);
  let frontier: Cell[] = [from];
  let steps = 0;

  while (frontier.length > 0) {
    const next: Cell[] = [];
    for (const cell of frontier) {
      if (isGoal(side, cell, size, goal)) return steps;
      for (const n of openNeighbours(walls, cell, size)) {
        const key = n.y * size + n.x;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(n);
      }
    }
    frontier = next;
    steps++;
  }

  return null;
}

/** Two walls clash when they share a slot, cross, or overlap along their length. */
export function wallsClash(a: Wall, b: Wall): boolean {
  if (a.x === b.x && a.y === b.y) return true; // same slot, including a crossing
  if (a.o !== b.o) return false;
  if (a.o === 'h') return a.y === b.y && Math.abs(a.x - b.x) === 1;
  return a.x === b.x && Math.abs(a.y - b.y) === 1;
}

export interface PawnOnBoard {
  cell: Cell;
  side: Side;
}

/**
 * Whether a wall may go down: in bounds, clear of every wall already placed,
 * and leaving every pawn a route home.
 */
export function canPlaceWall(
  walls: Wall[],
  wall: Wall,
  pawns: PawnOnBoard[],
  size = BOARD_SIZE,
  goal: GoalKind = 'opposite'
): boolean {
  if (wall.x < 0 || wall.y < 0 || wall.x > size - 2 || wall.y > size - 2) return false;
  if (walls.some((w) => wallsClash(w, wall))) return false;

  // The rule holds for everyone still in the game at once, not just the pawn
  // you are aiming at.
  const next = [...walls, wall];
  return pawns.every((p) => hasPathToGoal(next, p.cell, p.side, size, goal));
}

/**
 * Every cell the pawn at `from` may step to.
 *
 * Beyond the four orthogonal steps, Quoridor's jump: standing face to face
 * with another pawn you hop over it, and when a wall (or the board's edge, or
 * a third pawn) stands behind it you step to either side of it instead. That
 * side-step is the only way a pawn ever leaves its row and column in one move.
 */
export function legalMoves(
  walls: Wall[],
  from: Cell,
  others: Cell[],
  size = BOARD_SIZE,
  allowDoubleJump = false
): Cell[] {
  const occupied = (c: Cell) => others.some((o) => sameCell(o, c));
  const moves: Cell[] = [];

  for (const step of STEPS) {
    const adjacent = { x: from.x + step.x, y: from.y + step.y };
    if (!inBounds(adjacent, size) || isBlocked(walls, from, adjacent)) continue;

    if (!occupied(adjacent)) {
      moves.push(adjacent);
      continue;
    }

    // Face to face: try to hop straight over.
    const beyond = { x: adjacent.x + step.x, y: adjacent.y + step.y };
    if (inBounds(beyond, size) && !isBlocked(walls, adjacent, beyond)) {
      if (!occupied(beyond)) {
        moves.push(beyond);
        continue;
      }

      // Four at a table can queue up: with two pawns in a line ahead, the hop
      // clears both. Only that mode allows it, which is why it is a flag
      // rather than the default.
      //
      // Deviation worth knowing: the published rule permits this only when
      // every other option would send you backwards. "Backwards" has no
      // meaning when all four pawns converge on the centre, so the move is
      // simply offered whenever the landing square is free.
      const beyondTwo = { x: beyond.x + step.x, y: beyond.y + step.y };
      if (
        allowDoubleJump &&
        inBounds(beyondTwo, size) &&
        !isBlocked(walls, beyond, beyondTwo) &&
        !occupied(beyondTwo)
      ) {
        moves.push(beyondTwo);
        continue;
      }
    }

    // Blocked behind them — go around, to either side of their pawn.
    const sidesteps = step.x === 0
      ? [{ x: adjacent.x - 1, y: adjacent.y }, { x: adjacent.x + 1, y: adjacent.y }]
      : [{ x: adjacent.x, y: adjacent.y - 1 }, { x: adjacent.x, y: adjacent.y + 1 }];

    for (const side of sidesteps) {
      if (!inBounds(side, size)) continue;
      if (isBlocked(walls, adjacent, side)) continue;
      if (occupied(side)) continue;
      moves.push(side);
    }
  }

  // The side-step branches can propose the same cell twice when two pawns sit
  // side by side, and a duplicate would render as two overlapping targets.
  return moves.filter(
    (m, i) => moves.findIndex((other) => sameCell(other, m)) === i
  );
}
