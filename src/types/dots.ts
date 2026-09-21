import type { GameNotification } from './notification';

/**
 * Dots & Boxes — draw one line a turn between neighbouring dots; close a box
 * and it is yours, and you go again.
 *
 * That "go again" is the whole game: a long chain of boxes falls to one player
 * in a single turn, so the real skill is deciding when to hand one over.
 */

export type DotsStatus = 'waiting' | 'playing' | 'finished';

export type EdgeOrientation = 'h' | 'v';

export interface Edge {
  orientation: EdgeOrientation;
  index: number;
}

export interface DotsPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;
  /** Seat around the table, fixed at the start; decides colour and turn order. */
  seat: number;
  /** Boxes closed in this match. */
  score: number;
}

export interface DotsState {
  players: DotsPlayer[];
  status: DotsStatus;

  /**
   * Boxes per side. The grid therefore has `size + 1` dots per side,
   * `(size + 1) * size` horizontal edges and `size * (size + 1)` vertical
   * ones — see `src/lib/gameLogic/dots.ts` for the index arithmetic.
   */
  size: number;

  /** Who drew each edge, or null while it is still open. Row-major. */
  hLines: (string | null)[];
  vLines: (string | null)[];
  /** Who closed each box, or null while it is still open. Row-major. */
  boxes: (string | null)[];

  /**
   * Whose turn it is, by id rather than by index: a player leaving mid-match
   * shortens the array, and an index would then point at someone else.
   */
  turnPlayerId: string | null;
  turnDeadline?: number;

  /** Ids on the top score. More than one when the match ends level. */
  winnerIds: string[];

  startTime: number;
  lastActionTime: number;
  notifications?: GameNotification[];

  version: number;
  gameType: 'dots';
  settings: {
    maxPlayers: number;
    /** Boxes per side. */
    size: number;
    /** Seconds per turn before it is passed on. */
    turnDuration: number;
  };
}
