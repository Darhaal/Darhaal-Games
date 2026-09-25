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

/** Text written once into shared state and read in either language. */
export interface LocalizedText {
  ru: string;
  en: string;
}

/** `GameLog.user` for entries the game itself writes, shown as «Система» / "System". */
export const SYSTEM = '__system__';

export interface GameLog {
  /** A player's name, `SYSTEM`, or an emoji. Rooms written before entries were bilingual say «Система». */
  user: string;
  /** Both languages; a plain Russian string in rooms written before that. */
  action: LocalizedText | string;
  time: string;
}

export interface GameState {
  players: Player[];
  deck: Role[];
  turnIndex: number;
  logs: GameLog[];
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;      // Winner display name (for UI)
  winnerId?: string;    // Winner id (reliable identification)
  startTime?: number;   // Match start (epoch ms) — used to measure duration

  phase: GamePhase;

  currentAction: PendingAction | null;
  pendingPlayerId?: string;
  exchangeBuffer?: Role[];

  // Track who passed to allow non-targeted actions to proceed when everyone passes
  passedPlayers: string[];

  lastActionTime: number;
  turnDeadline?: number;
  version: number;

  /*
   * Both were optional because Coup shipped first, back when it was the only
   * game and neither field existed. Every state written since has carried
   * them, and rooms untouched for a week are collected by the daily cleanup
   * job, so nothing that old survives — the optionality only hid the fact that
   * the lobby screens read `settings.maxPlayers` to decide if a room is full.
   */
  gameType: 'coup';
  settings: {
    maxPlayers: number;
  };
}