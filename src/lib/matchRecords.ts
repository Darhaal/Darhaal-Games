import { supabase } from '@/lib/supabase';
import type { GameId } from '@/games/registry';
import { track } from '@/lib/analytics';
import { GA_EVENTS } from '@/constants/analytics';

/**
 * Every finished match, one row per player, written once.
 *
 * This replaced `playerStats.ts`, which rewrote a JSON blob of totals from the
 * browser after each match. That could not tell a new match from one already
 * counted, so every reload of a finished room counted it again; nor could it
 * keep a history to build streaks, records and achievements from. Now a match
 * is identified by its key, and the database ignores a second write of it —
 * see supabase/migrations/20260925000000_match_history.sql.
 */

export type MatchResult = 'win' | 'loss';
export type MatchMode = 'single' | 'multi';
/** What a game's achievements need to know about one match. Flat on purpose. */
export type MatchDetails = Record<string, number | boolean | string>;

export interface MatchRecord {
  game: GameId;
  /** Identifies the match — see `matchKey`. */
  key: string;
  result: MatchResult;
  mode?: MatchMode;
  durationSeconds: number;
  /** The game's own number: boxes, discs, points. */
  score?: number;
  details?: MatchDetails;
}

/**
 * One match: the room and the moment it started. A room hosts many matches —
 * rematches in place, Spyfall's rounds — so the room alone is not enough.
 */
export const matchKey = (lobbyId: string, startedAt: number | string) => `${lobbyId}:${startedAt}`;

/** Fired after a match is recorded for the first time; the achievement watcher listens. */
export const MATCH_RECORDED_EVENT = 'dg:match-recorded';

/**
 * How long a match took, from its start to its last write.
 *
 * Not "until now": the results can be opened long after the match ended — a
 * reload, a player coming back — and the first write wins, so it has to be
 * right whenever it happens. `lastActionTime` is touched by every write, and
 * the one that finished the match is the last.
 */
export function matchSeconds(startedAt: number | undefined, endedAt: number | undefined, fallbackSeconds: number): number {
  if (!startedAt || !endedAt || endedAt < startedAt) return fallbackSeconds;
  return Math.max(1, Math.round((endedAt - startedAt) / 1000));
}

/** Records a match. Resolves true when it was new, false when already counted or on failure. */
export async function recordMatch(record: MatchRecord): Promise<boolean> {
  const { data, error } = await supabase.rpc('record_match', {
    p_game: record.game,
    p_match_key: record.key,
    p_result: record.result,
    p_mode: record.mode ?? 'multi',
    p_duration_seconds: Math.round(record.durationSeconds),
    p_score: record.score ?? null,
    p_details: record.details ?? {}
  });

  if (error) {
    console.error('Could not record the match:', error.message);
    return false;
  }
  if (data !== true) return false;

  // Only a new match is an event: the same result opened twice is not a
  // second match, for the statistics or for the analytics.
  track(GA_EVENTS.matchFinished, {
    game: record.game,
    result: record.result,
    duration_seconds: Math.round(record.durationSeconds)
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MATCH_RECORDED_EVENT));
  return true;
}
