import type { GameNotification } from './notification';

/**
 * Wall Rush — the Quoridor family: race a pawn to the far side of a 9x9 board,
 * or spend the turn walling your rival into a detour.
 *
 * Modes differ in more than headcount. Two players get ten walls each; four
 * players get five, because twenty walls on one board locks it solid. That
 * number is balance, not decoration.
 */

export type WallRushStatus = 'waiting' | 'playing' | 'finished';

/** `duel` = 1v1, `teams` = 2v2 with partners opposite, `ffa` = four, each alone. */
export type WallRushMode = 'duel' | 'teams' | 'ffa';

export type WallOrientation = 'h' | 'v';

/**
 * A wall, addressed by the top-left cell of the 2x2 block it runs through, so
 * x and y both live in `0 .. size - 2`.
 *
 * A horizontal wall at (x, y) separates row y from row y+1 across columns x
 * and x+1. A vertical wall at (x, y) separates column x from column x+1 across
 * rows y and y+1.
 */
export interface Wall {
  x: number;
  y: number;
  o: WallOrientation;
  /**
   * Who put it there. Optional because the rules never consult it — it only
   * colours the wall, so a state written before this existed still plays.
   */
  by?: string;
}

export interface Cell {
  x: number;
  y: number;
}

/** Which edge a pawn starts on; its goal is the opposite edge. */
export type Side = 'north' | 'south' | 'west' | 'east';

export interface WallRushPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;
  /**
   * Seat around the board, `0 .. 3`, fixed when the match starts. It decides
   * the starting edge, the goal edge and — in `teams` — the partner: seats 0
   * and 2 face each other and play together, as do 1 and 3.
   */
  seat: number;
  wallsLeft: number;
  /** Carried across rematches in the same room. */
  score: number;
}

export interface WallRushState {
  players: WallRushPlayer[];
  status: WallRushStatus;

  /** Cells per side. Nine in every mode; kept in state so a replay reads right. */
  size: number;
  /** Pawn position by player id. */
  pawns: Record<string, Cell>;
  walls: Wall[];

  /**
   * Whose turn it is, by id rather than by index: a player leaving mid-match
   * shortens the array, and an index would then point at someone else.
   */
  turnPlayerId: string | null;
  turnDeadline?: number;

  /** Winners. More than one id in `teams`, where a partnership wins together. */
  winnerIds: string[];

  startTime: number;
  lastActionTime: number;
  notifications?: GameNotification[];

  /**
   * The room this one's rematch went to, recorded by `create_rematch_lobby`.
   *
   * Both players press "play again", and the second must land in the same
   * successor rather than spawning a third room — so the successor's id lives
   * on the parent and the server hands it out.
   */
  rematchLobbyId?: string;

  version: number;
  gameType: 'wallrush';
  settings: {
    maxPlayers: number;
    mode: WallRushMode;
    /** Seconds per turn before it is passed on. */
    turnDuration: number;
  };
}
