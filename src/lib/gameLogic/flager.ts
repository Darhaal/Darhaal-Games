export const FLAGER_BASE_SCORE = 1000;
export const FLAGER_MIN_SCORE = 10;
export const FLAGER_GUESS_PENALTY = 50;   // per attempt after the first
export const FLAGER_TIME_PENALTY = 10;    // per second

/**
 * Points for a guessed flag: base 1000, -50 per extra attempt,
 * -10 per second, minimum 10.
 */
export const calcFlagerPoints = (attemptsUsed: number, timeTakenSeconds: number): number => {
  const guessPenalty = (attemptsUsed - 1) * FLAGER_GUESS_PENALTY;
  const timePenalty = Math.floor(timeTakenSeconds * FLAGER_TIME_PENALTY);
  return Math.max(FLAGER_MIN_SCORE, FLAGER_BASE_SCORE - guessPenalty - timePenalty);
};

/**
 * How long the between-rounds screen waits on players who never press
 * "next" — a closed tab would otherwise hold the next round back for good.
 */
export const FLAGER_BETWEEN_ROUNDS_SECONDS = 60;
