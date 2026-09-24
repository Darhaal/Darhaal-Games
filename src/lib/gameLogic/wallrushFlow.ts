import type { WallRushPlayer, WallRushState } from '@/types/wallrush';
import { teamOf } from './wallrush';

/**
 * How a Wall Rush match moves on: whose turn it is next, when it is over,
 * and what giving up does to it.
 *
 * Pure functions over the state, kept apart from the hook because the hook
 * pulls in the Supabase client and cannot be imported by a test. The part
 * that goes wrong quietly — a turn handed to somebody who is no longer
 * racing, so the table sits for thirty seconds on a spectator — is exactly
 * the part that needs one.
 *
 * All of them mutate the state they are given; the hook passes a clone.
 */

/** Seats in play, in turn order. */
export const seated = (state: WallRushState): WallRushPlayer[] =>
  [...state.players].sort((a, b) => a.seat - b.seat);

const deadline = (state: WallRushState, at: number) =>
  at + state.settings.turnDuration * 1000;

/** The next seat round the table, skipping anyone who has left. */
export function advanceTurn(state: WallRushState, at = Date.now()): void {
  const order = seated(state);
  if (order.length === 0) {
    state.turnPlayerId = null;
    return;
  }

  const current = order.findIndex((p) => p.id === state.turnPlayerId);

  // Walk on until somebody still in the race is found. A player who has
  // resigned keeps their seat and their view but no longer takes a turn —
  // without this the table would stop for thirty seconds on a spectator.
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(current + step) % order.length];
    if (state.pawns[candidate.id]) {
      state.turnPlayerId = candidate.id;
      state.turnDeadline = deadline(state, at);
      return;
    }
  }

  state.turnPlayerId = null;
}

/**
 * Declares the winner. In `teams` a partnership wins together, so both ids go
 * in — the scoreboard and the statistics both read this list rather than
 * re-deriving who was allied with whom.
 */
export function finish(state: WallRushState, winner: WallRushPlayer): WallRushState {
  const partners = state.settings.mode === 'teams'
    ? state.players.filter((p) => teamOf(p.seat) === teamOf(winner.seat))
    : [winner];

  state.status = 'finished';
  state.winnerIds = partners.map((p) => p.id);
  state.turnPlayerId = null;
  state.turnDeadline = undefined;
  state.players = state.players.map((p) =>
    state.winnerIds.includes(p.id) ? { ...p, score: (p.score || 0) + 1 } : p
  );

  return state;
}

/** Ends the match when only one side is left standing. */
export function finishIfUncontested(state: WallRushState): WallRushState | null {
  const remaining = state.players.filter((p) => state.pawns[p.id]);
  if (remaining.length === 0) return null;

  const sidesLeft = state.settings.mode === 'teams'
    ? new Set(remaining.map((p) => teamOf(p.seat))).size
    : remaining.length;

  return sidesLeft <= 1 ? finish(state, remaining[0]) : null;
}

/**
 * Takes a player out of the race but leaves them at the table.
 *
 * Losing the pawn is what "out" means everywhere else — `finishIfUncontested`
 * counts pawns, the move rules read them, `advanceTurn` walks past anyone
 * without one — so resigning is the removal leaving performs, minus taking
 * the player out of the room.
 *
 * Returns null when there is nothing to do: the match is not running, or the
 * player is already out.
 */
export function resignPlayer(
  state: WallRushState,
  playerId: string,
  at = Date.now()
): WallRushState | null {
  if (state.status !== 'playing') return null;
  if (!state.pawns[playerId]) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  delete state.pawns[playerId];
  state.resigned = [...(state.resigned ?? []), playerId];

  if (!state.notifications) state.notifications = [];
  state.notifications.push({
    id: at,
    message: { ru: `${player.name} сдался`, en: `${player.name} resigned` },
    type: 'leave'
  });

  const over = finishIfUncontested(state);
  if (over) return over;

  // Somebody has to move next, and it must not be the player who stopped.
  if (state.turnPlayerId === playerId) advanceTurn(state, at);
  return state;
}
