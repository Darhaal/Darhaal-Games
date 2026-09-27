import { supabase } from '@/lib/supabase';
import type { GameId } from '@/games/registry';
import type { MatchDetails, MatchMode, MatchResult } from '@/lib/matchRecords';
import { buildProgress, type Baseline, type MatchRow, type Progress } from './progress';
import { evaluate, experience, levelOf, reachedIds, type AchievementStatus } from './evaluate';

/**
 * Loads everything the progress page and the achievement toast need, and
 * brings the stored unlocks up to date with what the numbers say.
 */

export interface LoadedProgress {
  progress: Progress;
  statuses: AchievementStatus[];
  /** Stored id → when it was first reached. */
  unlocks: Record<string, string>;
  xp: number;
  level: ReturnType<typeof levelOf>;
}

/** PostgREST hands out at most this many rows per request. */
const PAGE = 1000;

async function loadHistory(userId: string): Promise<MatchRow[]> {
  const rows: MatchRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('match_results')
      .select('game, result, mode, duration_seconds, score, details, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) {
      rows.push({
        game: r.game as GameId,
        result: r.result as MatchResult,
        mode: r.mode as MatchMode,
        durationSeconds: r.duration_seconds,
        score: r.score,
        details: (r.details ?? {}) as MatchDetails,
        playedAt: r.played_at
      });
    }
    if (!data || data.length < PAGE) return rows;
  }
}

export async function loadProgress(userId: string): Promise<LoadedProgress> {
  const [baselineRes, history, unlocksRes] = await Promise.all([
    supabase.from('player_stats').select('details').eq('user_id', userId).maybeSingle(),
    loadHistory(userId),
    supabase.from('achievement_unlocks').select('achievement_id, unlocked_at').eq('user_id', userId)
  ]);

  const progress = buildProgress((baselineRes.data?.details ?? null) as Baseline | null, history);
  const statuses = evaluate(progress);
  const unlocks = Object.fromEntries(
    (unlocksRes.data ?? []).map((u) => [u.achievement_id as string, u.unlocked_at as string])
  );
  const xp = experience(progress, statuses);
  return { progress, statuses, unlocks, xp, level: levelOf(xp) };
}

/**
 * Stores every step reached but not stored yet, and returns the ones that are
 * new. The numbers are the authority — an unlock only records when it was
 * first seen — so this is safe to call as often as the data is loaded.
 */
export async function syncUnlocks(loaded: LoadedProgress): Promise<string[]> {
  const missing = reachedIds(loaded.statuses).filter((id) => !loaded.unlocks[id]);
  if (missing.length === 0) return [];

  const { data, error } = await supabase.rpc('unlock_achievements', { p_ids: missing });
  if (error) {
    console.error('Could not store achievements:', error.message);
    return [];
  }
  const fresh = (data ?? []) as string[];
  const now = new Date().toISOString();
  for (const id of fresh) loaded.unlocks[id] = now;
  return fresh;
}
