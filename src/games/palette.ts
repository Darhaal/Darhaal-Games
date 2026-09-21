/**
 * Seat colours, shared by every game that seats players around a board.
 *
 * Server-safe like the rest of `src/games`: plain strings, no React, so the
 * statically rendered pages can read them too.
 *
 * Colour alone is a weak signal on a four-player board and no signal at all to
 * someone who cannot separate red from green, so each seat also carries a
 * shape — see `PlayerToken`. The two must stay in the same order.
 */

export const SEAT_COLORS = ['#16a34a', '#d97706', '#2563eb', '#dc2626'] as const;

/** Partners share a hue so a team board reads as two sides, not four players. */
export const TEAM_COLORS = ['#16a34a', '#dc2626', '#4ade80', '#f87171'] as const;

/** Anything on the board with no owner recorded. */
export const UNOWNED = '#9ca3af';

export const seatColor = (seat: number, teamed = false): string =>
  (teamed ? TEAM_COLORS : SEAT_COLORS)[seat % 4];
