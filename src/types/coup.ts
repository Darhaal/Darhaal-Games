// types/coup.ts

export type Lang = 'ru' | 'en';
export type Role = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';

export type GamePhase =
  | 'choosing_action'
  | 'waiting_for_challenges'
  | 'waiting_for_blocks'
  | 'waiting_for_block_challenges'
  | 'resolving_exchange'
  | 'losing_influence';

export interface Card {
  role: Role;
  revealed: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatarUrl: string;
  coins: number;
  cards: Card[];
  isDead: boolean;
  isHost: boolean;
  isReady: boolean;
}

export type ActionResolution = 'blocked_end' | 'continue_action' | 'action_cancelled';

export interface PendingAction {
  type: string;
  player: string;
  target?: string;
  blockedBy?: string;
  nextPhase?: GamePhase | ActionResolution;
}

export interface GameLog {
  user: string;
  action: string;
  time: string;
}

export interface GameState {
  players: Player[];
  deck: Role[];
  turnIndex: number;
  logs: GameLog[];
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;

  phase: GamePhase;

  currentAction: PendingAction | null;
  pendingPlayerId?: string;
  exchangeBuffer?: Role[];

  // Track who passed to allow non-targeted actions to proceed when everyone passes
  passedPlayers: string[];

  lastActionTime: number;
  turnDeadline?: number;
  version: number;

  gameType?: 'coup';
  settings?: {
    maxPlayers: number;
  };
}