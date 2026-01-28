export type Lang = 'ru' | 'en';
export type Role = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';

export type GamePhase = 
  | 'choosing_action'              // Игрок выбирает действие
  | 'waiting_for_challenges'       // Ждем, оспорит ли кто-то действие
  | 'waiting_for_blocks'           // Ждем, заблокирует ли кто-то (для Foreign Aid, Steal, Assassinate)
  | 'waiting_for_block_challenges' // Ждем, оспорят ли блок
  | 'resolving_exchange'           // Посол выбирает карты
  | 'losing_influence';            // Игрок выбирает карту для сброса

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
  // Контекст для возврата после резолюции челенджа/потери карты
  nextPhase?: GamePhase;
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