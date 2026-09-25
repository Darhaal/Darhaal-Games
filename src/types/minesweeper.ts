import type { GameNotification } from './notification';

export type MinesweeperStatus = 'waiting' | 'playing' | 'finished';

export type CellStatus = 'hidden' | 'open' | 'flagged' | 'exploded';

export interface Cell {
  x: number;
  y: number;
  isMine: boolean;
  isOpen: boolean;
  isFlagged: boolean;
  neighborCount: number;
}

export interface MinesweeperPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;

  // Game state
  board: Cell[][];
  status: 'playing' | 'won' | 'lost' | 'left'; // 'left' status included
  minesLeft: number;
  score: number; // Completion time in seconds

  // Camera control (local only)
  view?: { x: number, y: number, zoom: number };
}

export interface MinesweeperState {
  players: Record<string, MinesweeperPlayer>;
  status: MinesweeperStatus;

  startTime: number;
  lastActionTime: number;
  version: number;
  winner: string | null;   // Winner display name (for UI)
  winnerId?: string | null; // Winner id (reliable identification)

  /** Who hit a mine, who left — shown as a toast. */
  notifications?: GameNotification[];

  gameType: 'minesweeper';
  settings: {
    maxPlayers: number;
    width: number;
    height: number;
    minesCount: number;
    timeLimit: number; // Time in seconds
    difficulty: 'easy' | 'medium' | 'hard' | 'custom';
  };
}