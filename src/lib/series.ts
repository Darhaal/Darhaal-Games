import type { GameId } from '@/games/registry';
import { roundAwards, type SpyfallSide, type SpyfallWinReason } from '@/lib/gameLogic/spyfall';

/**
 * The running score of a series — what each player has taken since the first
 * room in the chain.
 *
 * "Play again" opens a new room each time, so without this every rematch
 * starts a table that has no memory of the three games before it. The tally
 * travels with the successor and is shown in its lobby.
 *
 * Read and written loosely, the way `rematchLobbyId` already is: adding the
 * same optional field to eight state interfaces that never use it themselves
 * buys nothing.
 */

export type SeriesWins = Record<string, number>;

interface LoosePlayer {
  id?: unknown;
  name?: unknown;
  isSpy?: unknown;
  score?: unknown;
}

const playersOf = (state: unknown): LoosePlayer[] => {
  const players = (state as { players?: unknown } | null)?.players;
  if (Array.isArray(players)) return players as LoosePlayer[];
  if (players && typeof players === 'object') return Object.values(players) as LoosePlayer[];
  return [];
};

/**
 * Who won the match a state describes.
 *
 * Every game answers this differently, and rather than pretend otherwise the
 * differences are listed here in one place:
 *
 *   winnerIds   dots, reversi, wall rush — already a list of ids
 *   winnerId    minesweeper, coup        — one id, beside a display name
 *   winner      battleship               — one id, despite the name
 *   winner      spyfall                  — a *side*, so the ids are derived
 *   (none)      flager                   — highest score takes it
 *
 * An unfinished match has no winner and returns nothing, which is what keeps
 * a tally from counting a room twice.
 */
export function winnersOf(gameId: GameId, state: unknown): string[] {
  const s = (state ?? {}) as Record<string, unknown>;
  if (s.status !== 'finished') return [];

  if (Array.isArray(s.winnerIds)) {
    return s.winnerIds.filter((id): id is string => typeof id === 'string');
  }

  if (typeof s.winnerId === 'string' && s.winnerId) return [s.winnerId];

  if (gameId === 'battleship' && typeof s.winner === 'string' && s.winner) {
    return [s.winner];
  }

  if (gameId === 'spyfall' && (s.winner === 'spy' || s.winner === 'locals')) {
    return Object.keys(spyfallAwards(s));
  }

  if (gameId === 'flager') {
    const scored = playersOf(s).filter(
      (p) => typeof p.id === 'string' && typeof p.score === 'number'
    );
    if (scored.length === 0) return [];

    const best = Math.max(...scored.map((p) => p.score as number));
    // A round nobody scored in has no winner rather than four of them.
    if (best <= 0) return [];
    return scored.filter((p) => p.score === best).map((p) => p.id as string);
  }

  return [];
}

/**
 * Spyfall does not score by the head.
 *
 * The spy plays against everyone, so their win is worth five where a local's
 * is worth one — counting a win as a win would hand the series to whichever
 * side simply has more players in it. The rule is read from
 * `gameLogic/spyfall.ts`, the same place the room's own scoreboard reads it.
 */
function spyfallAwards(state: Record<string, unknown>): Record<string, number> {
  const players = playersOf(state)
    .filter((p): p is { id: string; isSpy?: boolean } => typeof p.id === 'string')
    .map((p) => ({ id: p.id, isSpy: Boolean(p.isSpy) }));

  const nomination = state.nomination as { authorId?: string } | null | undefined;

  return roundAwards(
    players,
    state.winner as SpyfallSide,
    state.winReason as SpyfallWinReason | undefined,
    nomination?.authorId
  );
}

/**
 * What a finished room adds to the series, per player.
 *
 * One point a win everywhere except Spyfall, which has its own arithmetic.
 */
export function awardsOf(gameId: GameId, state: unknown): Record<string, number> {
  const s = (state ?? {}) as Record<string, unknown>;

  if (gameId === 'spyfall' && s.status === 'finished'
      && (s.winner === 'spy' || s.winner === 'locals')) {
    return spyfallAwards(s);
  }

  const awards: Record<string, number> = {};
  for (const id of winnersOf(gameId, state)) awards[id] = 1;
  return awards;
}

/** The tally a state is already carrying. */
export function seriesWinsOf(state: unknown): SeriesWins {
  const raw = (state as { seriesWins?: unknown } | null | undefined)?.seriesWins;
  if (!raw || typeof raw !== 'object') return {};

  const out: SeriesWins = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[id] = value;
  }
  return out;
}

/**
 * The tally the next room in the chain should carry: what the parent held,
 * plus whoever just won it.
 *
 * A draw credits everyone who tied, which is the same thing the scoreboard
 * on the finished room says.
 */
export function nextSeriesWins(gameId: GameId, parent: unknown): SeriesWins {
  const tally = { ...seriesWinsOf(parent) };
  for (const [id, points] of Object.entries(awardsOf(gameId, parent))) {
    tally[id] = (tally[id] ?? 0) + points;
  }
  return tally;
}

/**
 * Names to go with the tally.
 *
 * The successor starts empty, so a player who has not rejoined yet would
 * otherwise appear in the score of the series as a dash. Carried from the
 * room before, and overridden by the live roster the moment they arrive.
 */
export function nextSeriesNames(parent: unknown): Record<string, string> {
  const carried = (parent as { seriesNames?: unknown } | null)?.seriesNames;
  const names: Record<string, string> = {};

  if (carried && typeof carried === 'object') {
    for (const [id, value] of Object.entries(carried as Record<string, unknown>)) {
      if (typeof value === 'string' && value) names[id] = value.slice(0, 40);
    }
  }

  for (const p of playersOf(parent)) {
    if (typeof p.id === 'string' && typeof p.name === 'string' && p.name) {
      names[p.id] = p.name.slice(0, 40);
    }
  }

  return names;
}

/** The names a state is already carrying. */
export function seriesNamesOf(state: unknown): Record<string, string> {
  const raw = (state as { seriesNames?: unknown } | null | undefined)?.seriesNames;
  if (!raw || typeof raw !== 'object') return {};

  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value) out[id] = value.slice(0, 40);
  }
  return out;
}

/** True once there is anything worth showing. */
export const hasSeries = (wins: SeriesWins): boolean =>
  Object.values(wins).some((n) => n > 0);
