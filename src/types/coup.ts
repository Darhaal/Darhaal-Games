export type Lang = 'ru' | 'en';
export type Role = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';

export type GamePhase =
  | 'choosing_action'
  | 'waiting_for_challenges' // Ждем, оспорит ли кто-то действие
  | 'waiting_for_blocks'     // Ждем, заблокирует ли кто-то (для Foreign Aid, Steal, Assassinate)
  | 'waiting_for_block_challenges' // Ждем, оспорят ли блок
  | 'resolving_exchange'     // Посол выбирает карты
  | 'losing_influence';      // Игрок должен выбрать карту для сброса

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
  type: string; // tax, steal, assassinate, etc.
  player: string; // id игрока, который делает действие
  target?: string; // id цели (для steal, coup, assassinate)
  blockedBy?: string; // id игрока, который поставил блок
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

  // Новые поля для полной логики
  phase: GamePhase;
  currentAction: PendingAction | null; // Текущее заявленное действие
  timerStart?: number; // Для таймеров (опционально)
  actionResult?: string | null; // Для отображения результата последнего действия
}