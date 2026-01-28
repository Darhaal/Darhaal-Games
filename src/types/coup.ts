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

export interface PendingAction {
  type: string; 
  player: string; 
  target?: string; 
  blockedBy?: string; 
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
  
  // State Machine
  phase: GamePhase;
  currentAction: PendingAction | null;
  pendingLoserId?: string; // ID игрока, который должен сбросить карту
}