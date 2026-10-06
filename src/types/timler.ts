import type { GameNotification } from './notification';
import type { Difficulty } from '@/data/difficulty';

/**
 * Timler — say when a photo was taken, or a painting painted. See
 * docs/timler-spec.md.
 *
 * Shaped for twenty players in one row: a guess is written once, when the
 * player answers; the round is scored once, by whoever closes it, from the
 * guesses in the state — places need everyone's answer at once.
 */

/** What the rounds show: photos (the default), paintings, or either. */
export const TIMLER_MEDIA = ['photos', 'paintings', 'both'] as const;
export type TimlerMedium = (typeof TIMLER_MEDIA)[number];

/**
 * The lobby's eras; `all` draws each round from one at random. Photos have
 * the last four, paintings the first four — src/lib/timler/eras.ts.
 */
export const TIMLER_ERAS = ['all', 'before1600', '1600-1799', '1800-1899', '1900-1945', '1946-2000', 'since2001'] as const;
export type TimlerEra = (typeof TIMLER_ERAS)[number];

/**
 * A picture as the pool holds it and the round carries it — a photo, or a
 * painting when `kind` says so (the name stayed from when there were only photos).
 */
export interface TimlerPhoto {
  /** Absent for a photo, and in rooms from before paintings. */
  kind?: 'painting';
  /** File name on Wikimedia Commons. */
  file: string;
  /** When it was taken: "1939-09-01", or "1939" when only the year is known. */
  date: string;
  /** Shown only with 18+ on (section 8). */
  adult: boolean;
  /** How well known: Wikipedias about it plus articles using it. Sets the difficulty. */
  fame: number;
  title: { ru: string | null; en: string | null };
  description: { ru: string | null; en: string | null };
  /** Wikipedia articles about what it shows. */
  article: { ru: string | null; en: string | null };
  /** Who took the photo, or who made the file, as Commons names them. */
  author: string;
  license: string;
  /** A painting's painter, from Wikidata. */
  creator?: { ru: string | null; en: string | null };
}

/** A guess as written when the player answers. */
export interface TimlerGuess {
  year: number;
  month?: number;
  day?: number;
  /** Milliseconds after the round opened. */
  at: number;
}

/** One finished round of one player, as it is kept for the results and the statistics. */
export interface TimlerRoundResult {
  file: string;
  /** The photo's date, as `TimlerPhoto.date`. */
  answer: string;
  /** Null when the player did not answer in time. */
  guess: { year: number; month?: number; day?: number } | null;
  /** The year and date parts (section 4). */
  accuracy: number;
  place: number;
  penalty: number;
  score: number;
  /** Seconds into the round when the player answered. */
  seconds?: number;
}

export interface TimlerPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;

  /** Match total, added up at the end of each round. */
  score: number;
  /** This round's answer — written once, shown to the others only when the round ends. */
  guess: TimlerGuess | null;
  history: TimlerRoundResult[];
  isReadyForNextRound: boolean;
}

export interface TimlerRound {
  photo: TimlerPhoto;
  /** When answering opens; a few seconds after the round is written, to load the photo. */
  startTime: number;
}

export interface TimlerState {
  players: TimlerPlayer[];
  status: 'waiting' | 'playing' | 'round_end' | 'finished';
  round: TimlerRound | null;
  /** Zero-based. */
  roundIndex: number;
  /** The next round's photo, drawn by the host while everyone looks at the results. */
  next: TimlerPhoto | null;
  /** Files already shown this match, never drawn twice. */
  played: string[];
  roundEndedAt?: number;

  startTime: number;
  lastActionTime: number;
  notifications?: GameNotification[];

  version: number;
  gameType: 'timler';
  settings: {
    maxPlayers: number;
    rounds: number;
    /** Seconds per round. */
    roundDuration: number;
    /** Absent in rooms from before paintings: photos. */
    medium?: TimlerMedium;
    era: TimlerEra;
    difficulty: Difficulty;
    /** Pictures marked 18+ may be drawn (section 8). */
    adult: boolean;
    /** Only pictures marked 18+ — absent in rooms from before it, i.e. no. */
    adultOnly?: boolean;
  };
}
