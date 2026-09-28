import { GAMES, type GameId } from '@/games/registry';
import type { MatchDetails, MatchMode, MatchResult } from '@/lib/matchRecords';

/**
 * A player's progress, computed from two sources:
 *
 * - the **baseline** — totals recorded before match history existed
 *   (`player_stats.details`, frozen in 2.11.0): wins, losses and minutes per
 *   game, nothing more;
 * - the **history** — one row per match since then (`match_results`).
 *
 * Totals add the two. Streaks, records and the history list can only come
 * from the second, because the first never kept the order of anything.
 *
 * Pure, so the page, the achievement watcher and the tests share it.
 */

export interface MatchRow {
  game: GameId;
  result: MatchResult;
  mode: MatchMode;
  durationSeconds: number;
  score: number | null;
  details: MatchDetails;
  playedAt: string;
}

/** One game's line in `player_stats.details`: time in minutes, as it was recorded. */
export interface BaselineGame {
  wins: number;
  lost: number;
  time: number;
  extra?: number;
}

export type Baseline = Partial<Record<string, BaselineGame>>;

export interface GameProgress {
  matches: number;
  wins: number;
  losses: number;
  seconds: number;
  /** Fastest win, from history. */
  fastestWin: number | null;
  /** Highest score in one match, from history. */
  bestScore: number | null;
  /** Split by mode, from history — for games with a solo mode. */
  modes: Record<MatchMode, { matches: number; wins: number }>;
  /** Matches against other players — what the win rate is taken from. */
  rated: { matches: number; wins: number };
  lastPlayedAt: string | null;
}

export interface Progress {
  matches: number;
  wins: number;
  losses: number;
  seconds: number;
  games: Record<GameId, GameProgress>;
  /** Newest first. */
  history: MatchRow[];
  /** Winning streaks against other players; solo matches neither add nor break them. */
  streak: { current: number; best: number };
  /** Matches against other players, across every game — for the win rate. */
  rated: { matches: number; wins: number };
  /** Games with at least one match. */
  gamesPlayed: number;
  /** Matches in the baseline, i.e. before history. */
  baselineMatches: number;
}

const emptyGame = (): GameProgress => ({
  matches: 0,
  wins: 0,
  losses: 0,
  seconds: 0,
  fastestWin: null,
  bestScore: null,
  modes: { single: { matches: 0, wins: 0 }, multi: { matches: 0, wins: 0 } },
  rated: { matches: 0, wins: 0 },
  lastPlayedAt: null
});

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

export function buildProgress(baseline: Baseline | null | undefined, rows: readonly MatchRow[]): Progress {
  const games = Object.fromEntries(GAMES.map((g) => [g.id, emptyGame()])) as Record<GameId, GameProgress>;
  let baselineMatches = 0;

  for (const game of GAMES) {
    const b = baseline?.[game.id];
    if (!b) continue;
    const g = games[game.id];
    const wins = count(b.wins);
    const lost = count(b.lost);
    g.wins += wins;
    g.losses += lost;
    g.matches += wins + lost;
    g.seconds += count(b.time) * 60;
    baselineMatches += wins + lost;
    // A win rate is a record against other people. Games with a solo mode
    // kept solo and together apart until 2.11, and the baseline folded them
    // into one line, so their old totals cannot say which were which and stay
    // out of it; every other game is played against someone by definition.
    if (!game.hasSoloMode) {
      g.rated.matches += wins + lost;
      g.rated.wins += wins;
    }
  }

  const history = [...rows].sort((a, b) => b.playedAt.localeCompare(a.playedAt));

  for (const row of history) {
    const g = games[row.game];
    if (!g) continue; // a game that has since been removed
    g.matches++;
    g.seconds += count(row.durationSeconds);
    g.modes[row.mode === 'single' ? 'single' : 'multi'].matches++;
    if (row.mode !== 'single') {
      g.rated.matches++;
      if (row.result === 'win') g.rated.wins++;
    }
    if (row.result === 'win') {
      g.wins++;
      g.modes[row.mode === 'single' ? 'single' : 'multi'].wins++;
      if (row.durationSeconds > 0 && (g.fastestWin === null || row.durationSeconds < g.fastestWin)) {
        g.fastestWin = row.durationSeconds;
      }
    } else {
      g.losses++;
    }
    if (typeof row.score === 'number' && (g.bestScore === null || row.score > g.bestScore)) g.bestScore = row.score;
    if (!g.lastPlayedAt) g.lastPlayedAt = row.playedAt;
  }

  // Streaks read the history oldest first, and only matches against others:
  // a solo game is not a win over anyone, and losing one breaks nothing.
  let current = 0;
  let best = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].mode === 'single') continue;
    current = history[i].result === 'win' ? current + 1 : 0;
    best = Math.max(best, current);
  }

  const all = Object.values(games);
  return {
    matches: all.reduce((n, g) => n + g.matches, 0),
    wins: all.reduce((n, g) => n + g.wins, 0),
    losses: all.reduce((n, g) => n + g.losses, 0),
    seconds: all.reduce((n, g) => n + g.seconds, 0),
    games,
    history,
    streak: { current, best },
    rated: {
      matches: all.reduce((n, g) => n + g.rated.matches, 0),
      wins: all.reduce((n, g) => n + g.rated.wins, 0)
    },
    gamesPlayed: all.filter((g) => g.matches > 0).length,
    baselineMatches
  };
}

/** Share of matches won, 0–100. */
export const winRate = (wins: number, matches: number) => (matches > 0 ? Math.round((wins / matches) * 100) : 0);
