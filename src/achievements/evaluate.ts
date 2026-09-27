import { ACHIEVEMENTS, TIERS, type Achievement, type Tier } from './definitions';
import type { Progress } from './progress';

/**
 * Where a player stands on every achievement, and the level that adds up to.
 * Pure: the page, the watcher that toasts new ones, and the tests share it.
 */

export interface AchievementStatus {
  achievement: Achievement;
  /** Highest tier reached, or null. A feat reaches its one tier or nothing. */
  tier: Tier | null;
  /** Where the count stands, and the next step to reach (null when complete). */
  value: number;
  target: number | null;
  /** Stored ids of every step reached — a ladder's are `id:tier`. */
  reachedIds: string[];
  complete: boolean;
}

/** The id a step is stored under. */
export const stepId = (achievement: Achievement, tier: Tier) =>
  achievement.kind === 'ladder' ? `${achievement.id}:${tier}` : achievement.id;

export function evaluate(progress: Progress): AchievementStatus[] {
  return ACHIEVEMENTS.map((achievement) => {
    if (achievement.kind === 'feat') {
      const done = achievement.reached(progress);
      return {
        achievement,
        tier: done ? achievement.tier : null,
        value: done ? 1 : 0,
        target: done ? null : 1,
        reachedIds: done ? [achievement.id] : [],
        complete: done
      };
    }

    const value = achievement.value(progress);
    const reached = TIERS.filter((_, i) => value >= achievement.steps[i]);
    const next = achievement.steps.find((step) => value < step) ?? null;
    return {
      achievement,
      tier: reached.at(-1) ?? null,
      value,
      target: next,
      reachedIds: reached.map((tier) => stepId(achievement, tier)),
      complete: next === null
    };
  });
}

/** Every stored id the player has reached. */
export const reachedIds = (statuses: readonly AchievementStatus[]) => statuses.flatMap((s) => s.reachedIds);

// ------------------------------------------------------------------ level --

/**
 * Experience: something for every match, more for a win, a little for time
 * spent (capped per match, so a long match is not worth ten short ones), and
 * a lump for each achievement step. The baseline earns it too, by the same
 * rules, so a player's level reflects everything they have played.
 */
export const XP = {
  match: 10,
  win: 15,
  minute: 1,
  minutesPerMatchCap: 30,
  tier: { bronze: 50, silver: 150, gold: 400 } as Record<Tier, number>
} as const;

export function experience(progress: Progress, statuses: readonly AchievementStatus[]): number {
  let xp = progress.matches * XP.match + progress.wins * XP.win;

  // Time from history is capped match by match; the baseline only kept a
  // total, so it is capped as if spread across its matches.
  const historySeconds = progress.history.reduce(
    (sum, row) => sum + Math.min(row.durationSeconds, XP.minutesPerMatchCap * 60), 0
  );
  const allHistorySeconds = progress.history.reduce((sum, row) => sum + row.durationSeconds, 0);
  const baselineSeconds = Math.min(
    Math.max(0, progress.seconds - allHistorySeconds),
    progress.baselineMatches * XP.minutesPerMatchCap * 60
  );
  xp += Math.floor((historySeconds + baselineSeconds) / 60) * XP.minute;

  for (const status of statuses) {
    if (status.achievement.kind === 'feat') {
      if (status.tier) xp += XP.tier[status.tier];
    } else {
      for (const id of status.reachedIds) xp += XP.tier[id.slice(id.lastIndexOf(':') + 1) as Tier];
    }
  }
  return xp;
}

/** Experience needed to reach a level from zero: 0, 100, 300, 600, 1000… */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelOf(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  return { level, into: xp - floor, span: xpForLevel(level + 1) - floor };
}
