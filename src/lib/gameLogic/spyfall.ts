export type SpyfallSide = 'spy' | 'locals';

export type SpyfallWinReason =
  | 'time' | 'guessed_loc' | 'spy_failed_guess' | 'spy_caught' | 'innocent_killed' | 'spy_left';

/** What a round is worth, in one place so nothing can quietly disagree. */
export const SPY_WIN = 5;
export const LOCAL_WIN = 1;
export const ACCUSER_BONUS = 1;

interface Scorable {
  id: string;
  isSpy?: boolean;
}

/**
 * What each player takes from a finished round.
 *
 * The spy is playing against everyone, so a win is worth five where a local's
 * is worth one — otherwise the side with more players wins the series by
 * arithmetic rather than by play. The extra point for the accusation that
 * actually caught the spy pays for the risk: naming the wrong person hands
 * the round to the spy.
 *
 * Both the running score inside a room and the score of a series read this.
 * Keeping the rule in two places is how they drift, and a series that
 * disagrees with the scoreboard it came from is worse than no series at all.
 */
export function roundAwards(
  players: readonly Scorable[],
  winner: SpyfallSide,
  reason?: SpyfallWinReason,
  accuserId?: string | null
): Record<string, number> {
  const awards: Record<string, number> = {};

  for (const player of players) {
    if (winner === 'spy') {
      if (player.isSpy) awards[player.id] = SPY_WIN;
      continue;
    }

    if (player.isSpy) continue;

    awards[player.id] =
      LOCAL_WIN + (reason === 'spy_caught' && accuserId === player.id ? ACCUSER_BONUS : 0);
  }

  return awards;
}
