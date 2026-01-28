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

// Добавляем этот тип, чтобы TS не ругался на nextPhase
export type ActionResolution = 'blocked_end' | 'continue_action' | 'action_cancelled';

export interface PendingAction {
  type: string;
  player: string;
  target?: string;
  blockedBy?: string;
  // Разрешаем и фазы, и статусы резолюции
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

  // State Machine
  phase: GamePhase;
  currentAction: PendingAction | null;

  // Кто сейчас должен совершить действие (сбросить карту или выбрать при обмене)
  pendingPlayerId?: string;

  // Временный буфер карт для Посла (Ambassador)
  exchangeBuffer?: Role[];
}