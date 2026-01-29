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

  // Added missing phase property
  phase: GamePhase;

  currentAction: PendingAction | null;
  pendingPlayerId?: string;
  exchangeBuffer?: Role[];

  lastActionTime: number;
  turnDeadline?: number; // Server-authoritative timer
  version: number; // Optimistic locking

  // Optional because legacy/create might not set it immediately,
  // but strictly it should be there.
  // In create/page.tsx we set it, but we need to make sure the interface allows it.
  gameType?: 'coup';
  settings?: {
    maxPlayers: number;
  };
}