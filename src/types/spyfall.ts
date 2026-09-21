import type { GameNotification } from './notification';

export type SpyfallStatus = 'waiting' | 'playing' | 'voting' | 'finished';

export interface SpyfallRole {
  name: { ru: string; en: string };
}

export interface SpyfallLocation {
  id: string;
  name: { ru: string; en: string };
  roles: SpyfallRole[];
  /**
   * Optional artwork path. No location currently ships one: every reader
   * guards with `loc.image ? ... : fallback`, and the card already renders the
   * location name over a scrim, so the fallback reads perfectly well.
   */
  image?: string;
}

export interface SpyfallPack {
  id: string;
  name: { ru: string; en: string };
  locations: SpyfallLocation[];
  emoji: string;
}

export interface SpyfallPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;

  // Game data
  isSpy: boolean;
  role: string | null;
  isReady: boolean;
  hasNominated?: boolean; // Whether the player already nominated this round
  score: number; // Score across a series of games
}

export interface Nomination {
  authorId: string; // Who started the vote
  targetId: string; // Who is accused
  votes: Record<string, boolean>; // player id -> yes/no
  /**
   * When the vote opened. The round clock is frozen during a vote, so without
   * this deadline a single player closing their tab left the room stuck in
   * `voting` with nothing able to move it on.
   */
  startTime: number;
}

export interface SpyfallState {
  players: SpyfallPlayer[];
  status: SpyfallStatus;

  // Settings
  settings: {
    roundDuration: number;
    spyCount: number;
    useCustomLocations: boolean;
    customLocations: string[];
    packId: string; // Selected pack id (exactly one)
    /**
     * Player cap. Every other game declared this and Spyfall did not, even
     * though the create screen wrote it in anyway and the lobby list reads it
     * to decide whether a room is full — so the field existed in the database
     * while the type denied it.
     */
    maxPlayers: number;
  };

  /**
   * Scores from the room this one replaced, keyed by player id.
   *
   * `score` is documented as running "across a series of games", and inside a
   * room it does — but "play again" opens a *new* room with an empty roster,
   * so the series used to reset every time the table wanted another game.
   * Whoever comes back gets their score back; anyone new starts at zero.
   */
  carriedScores?: Record<string, number>;

  // Round
  currentLocationId: string | null;
  locationList: string[]; // Location ids of the current round
  startTime: number;
  winner: 'spy' | 'locals' | null;
  winReason?: 'time' | 'guessed_loc' | 'spy_failed_guess' | 'spy_caught' | 'innocent_killed' | 'spy_left';

  // Voting
  nomination: Nomination | null;

  // Notifications. Localized like every other game's: these used to be bare
  // Russian strings, which was invisible only because nothing rendered them.
  notifications: GameNotification[];

  version: number;
  gameType: 'spyfall';
}