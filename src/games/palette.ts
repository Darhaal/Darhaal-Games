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

/**
 * Colours for a crowd — up to twenty players at once, as on Timler's results
 * timeline — where four seat colours run out. Distinct hues first, so a small
 * table gets the clearest ones; each player also wears their avatar, so a
 * colour seen twice in a room of twenty is still told apart.
 */
export const CROWD_COLORS = [
  '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777',
  '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#c026d3', '#ca8a04'
] as const;

export const crowdColor = (index: number): string => CROWD_COLORS[index % CROWD_COLORS.length];
