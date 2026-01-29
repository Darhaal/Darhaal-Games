export type Lang = 'ru' | 'en';

export type ShipType = 'battleship' | 'cruiser' | 'destroyer' | 'submarine';
export type Orientation = 'horizontal' | 'vertical';
export type CellStatus = 'empty' | 'ship' | 'hit' | 'miss' | 'killed';

export interface Coordinate {
  x: number;
  y: number;
}

export interface Ship {
  id: string;
  type: ShipType;
  size: number;
  orientation: Orientation;
  position: Coordinate;
  hits: number;
}

export interface PlayerBoard {
  userId: string;
  name: string;       // Добавлено
  avatarUrl: string;  // Добавлено
  ships: Ship[];
  shots: Record<string, CellStatus>;
  isReady: boolean;
  isHost: boolean;
  aliveShipsCount: number;
}

export interface BattleshipState {
  players: Record<string, PlayerBoard>;
  turn: string | null;
  phase: 'setup' | 'playing' | 'finished';
  status: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  logs: { text: string; time: string }[];
  lastActionTime: number;
  version: number;
  gameType: 'battleship';
  settings: {
    maxPlayers: number;
  };
}

export const FLEET_CONFIG: { type: ShipType; size: number; count: number }[] = [
  { type: 'battleship', size: 4, count: 1 },
  { type: 'cruiser', size: 3, count: 2 },
  { type: 'destroyer', size: 2, count: 3 },
  { type: 'submarine', size: 1, count: 4 },
];