import type { GameNotification } from './notification';
import type { Difficulty } from '@/data/difficulty';
import type { SonglerCategory } from '@/data/songler/categories';

/**
 * Songler — name the song from a snippet that grows with every try. See
 * docs/songler-spec.md.
 *
 * Shaped like Timler for twenty players in one row: a player's tries are
 * written as they make them; the round is scored once, by whoever closes it,
 * because the places need everyone's result at once.
 */

/** A song as the pool holds it and the round carries it. */
export interface SonglerSong {
  /** Deezer track id — the preview is fetched fresh by it each round. */
  id: number;
  title: string;
  artist: string;
  /** Deezer's image id for the album cover; null when it has none. */
  cover: string | null;
  /** Release year, or null when the pool doubts the one it has. */
  year: number | null;
  /** Deezer's popularity — sets the difficulty. */
  rank: number;
}

/** What a try came to: the song, its artist but another song, wrong, or a skip. */
export type SonglerVerdict = 'right' | 'artist' | 'wrong' | 'skip';

/** One try, as written when the player makes it. */
export interface SonglerAttempt {
  verdict: SonglerVerdict;
  /** The song named; absent for a skip. */
  guess?: { id: number; title: string; artist: string };
  /** Milliseconds after the round opened. */
  at: number;
}

/** One finished round of one player, as it is kept for the results and the statistics. */
export interface SonglerRoundResult {
  song: number;
  /** Which try named it (0 = the first snippet); null when none did. */
  solvedOn: number | null;
  /** Named the artist on some try without naming the song. */
  artist: boolean;
  /** The points for the try (section 4), or the artist's consolation. */
  base: number;
  place: number;
  penalty: number;
  score: number;
  /** Seconds into the round when the song was named. */
  seconds?: number;
}

export interface SonglerPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;

  /** Match total, added up at the end of each round. */
  score: number;
  /** This round's tries — shown to the others only as a count until it ends. */
  attempts: SonglerAttempt[];
  history: SonglerRoundResult[];
  isReadyForNextRound: boolean;
}

export interface SonglerRound {
  song: SonglerSong;
  /** When guessing opens; a few seconds after the round is written, to load the audio. */
  startTime: number;
}

export interface SonglerState {
  players: SonglerPlayer[];
  status: 'waiting' | 'playing' | 'round_end' | 'finished';
  round: SonglerRound | null;
  /** Zero-based. */
  roundIndex: number;
  /** The next round's song, drawn by the host while everyone looks at the results. */
  next: SonglerSong | null;
  /** Songs already played this match, never drawn twice. */
  played: number[];
  roundEndedAt?: number;

  startTime: number;
  lastActionTime: number;
  notifications?: GameNotification[];

  version: number;
  gameType: 'songler';
  settings: {
    maxPlayers: number;
    rounds: number;
    /** Seconds per round. */
    roundDuration: number;
    category: SonglerCategory;
    difficulty: Difficulty;
  };
}
