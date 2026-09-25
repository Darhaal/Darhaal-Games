import type { GameNotification } from './notification';

/**
 * Reversi — place a disc so it traps a line of your rival's between the new
 * one and one of yours, and every trapped disc turns over.
 *
 * Deliberately called Reversi and not the other name: the mechanic is from
 * 1883 and free to use, while the better-known title is a registered
 * trademark.
 */

export type ReversiStatus = 'waiting' | 'playing' | 'finished';

export interface ReversiPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;
  /** Seat 0 plays dark and moves first; seat 1 plays light. */
  seat: number;
  /** Discs held at the end of the last finished match in this series. */
  score: number;
}

export interface ReversiState {
  players: ReversiPlayer[];
  status: ReversiStatus;

  /** Cells per side. Eight, as the game has been played since 1883. */
  size: number;
  /** Seat holding each square, or null while it is empty. Row-major. */
  board: (number | null)[];

  /**
   * Whose turn it is, by id rather than by index: a player leaving mid-match
   * shortens the array, and an index would then point at someone else.
   */
  turnPlayerId: string | null;
  turnDeadline?: number;

  /**
   * How many turns in a row have been passed for want of a legal move. Two
   * means neither side can play and the match is over — the only way Reversi
   * ends before the board fills.
   */
  passes: number;

  /** Board index of the last disc placed, marked so it can be found. Optional: older rooms lack it. */
  lastMove?: number;

  /** Ids on the top count. Two when the match ends level. */
  winnerIds: string[];

  startTime: number;
  lastActionTime: number;
  notifications?: GameNotification[];

  version: number;
  gameType: 'reversi';
  settings: {
    maxPlayers: number;
    /** Seconds per turn before it is passed on. */
    turnDuration: number;
  };
}
