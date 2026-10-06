import type { TimlerRoundResult } from '@/types/timler';

/**
 * Timler's rules without a network or React: dates, what a guess scores, who
 * takes the places, and how the results timeline is drawn. The agreed rules
 * are docs/timler-spec.md; section numbers below refer to it.
 */

// ------------------------------------------------------------------ dates --

/** The first year a photo can be from: the daguerreotype was announced in 1839. */
export const FIRST_YEAR = 1839;

/** The first year a painting in the pool can be from (scripts/timler-paintings.mjs). */
export const FIRST_PAINTING_YEAR = 1300;

/** The last: Commons hosts only free files, so later paintings are too few for an era. */
export const LAST_PAINTING_YEAR = 1945;

/** A date to the day, or only its year when that is all that is named or known. */
export interface TimlerDate {
  year: number;
  /** 1–12, with `day`, or neither. */
  month?: number;
  day?: number;
}

export const hasDay = (d: TimlerDate): d is Required<TimlerDate> => d.month !== undefined && d.day !== undefined;

/** "1939-09-01" or "1939" — how the pool and the state write a date. */
export function parseDate(text: string): TimlerDate | null {
  const m = text.match(/^(\d{4})(?:-(\d{2})-(\d{2}))?$/);
  if (!m) return null;
  return m[2] ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : { year: Number(m[1]) };
}

export const formatIso = (d: TimlerDate): string =>
  hasDay(d) ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : String(d.year);

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Whether a day and a month exist together in that year: no 30 February, 29 February only in a leap year. */
export const validDay = (d: TimlerDate) =>
  !hasDay(d) || (d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= daysInMonth(d.year, d.month));

const dayNumber = (d: Required<TimlerDate>) => Date.UTC(d.year, d.month - 1, d.day) / 86_400_000;

/**
 * Where a date sits on the timeline, in years: a day exactly, a year at its
 * middle — a guess of "1939" is drawn half way through 1939.
 */
export function toYears(d: TimlerDate): number {
  if (!hasDay(d)) return d.year + 0.5;
  const start = Date.UTC(d.year, 0, 1);
  const length = Date.UTC(d.year + 1, 0, 1) - start;
  return d.year + (Date.UTC(d.year, d.month - 1, d.day) - start + 43_200_000) / length;
}

// ------------------------------------------------------------------ score --

/** The year part: 1000 for the right year, less the further off (section 4). */
export const YEAR_POINTS = 1000;
/**
 * How forgiving a year off is: in proportion to how old the photo is. The
 * older a photo, the harder it is to date, so a miss weighs against its age —
 * five years off is nothing on a photo from 1840 and everything on one from
 * last year. The scale is a quarter of the photo's age in years, never less
 * than two: five years off is worth 898 on a photo from 1840, 704 on one from
 * 1969, 162 on one from 2015 and 82 on one from the last few years.
 */
export const YEAR_SCALE_PER_AGE = 1 / 4;
export const YEAR_SCALE_MIN = 2;
export const yearScale = (answerYear: number) =>
  Math.max(YEAR_SCALE_MIN, (new Date().getFullYear() - answerYear) * YEAR_SCALE_PER_AGE);
/** The date part, a bet: +300 for the very day, down to −100 far off. */
export const DATE_POINTS = 400;
export const DATE_SCALE = 14;
export const DATE_STAKE = 100;
/** The three most accurate, from two players up — never the last one. */
export const PLACE_BONUS = [100, 60, 30] as const;
/** Time costs up to this much, melting from the moment the round opens. */
export const TIME_PENALTY_MAX = 200;

export const yearPoints = (guessYear: number, answerYear: number) =>
  Math.round(YEAR_POINTS * Math.exp(-Math.abs(guessYear - answerYear) / yearScale(answerYear)));

/**
 * The date part, only when the player named a day and the photo has one:
 * `400 × e^(−Δ days / 14) − 100` — the very day +300, a week +143, a month
 * −53, anything further about −100. Null when there is no date bet.
 */
export function datePoints(guess: TimlerDate, answer: TimlerDate): number | null {
  if (!hasDay(guess) || !hasDay(answer)) return null;
  const days = Math.abs(dayNumber(guess) - dayNumber(answer));
  return Math.round(DATE_POINTS * Math.exp(-days / DATE_SCALE) - DATE_STAKE);
}

/** How close a guess is, in points: the year part and the date bet. */
export const accuracyPoints = (guess: TimlerDate, answer: TimlerDate) =>
  yearPoints(guess.year, answer.year) + (datePoints(guess, answer) ?? 0);

/**
 * What the time took: from the moment the round opens, evenly up to 200 at
 * its end — whoever answers first loses the least.
 */
export function timePenalty(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.round(TIME_PENALTY_MAX * Math.min(1, Math.max(0, elapsedMs / durationMs)));
}

/**
 * Place bonuses (section 4): the most accurate +100, the next +60, the next
 * +30, ranked by accuracy without the time. A tie shares its place. Only
 * places with someone below them pay — the last place never does, so two
 * players see one bonus and a solo player none. A player who did not answer
 * is below everyone who did.
 */
export function placeBonuses(players: ReadonlyArray<{ id: string; accuracy: number | null }>): Map<string, number> {
  const out = new Map<string, number>(players.map((p) => [p.id, 0]));
  const answered = [...new Set(players.flatMap((p) => (p.accuracy === null ? [] : [p.accuracy])))].sort((a, b) => b - a);
  const silent = players.some((p) => p.accuracy === null);
  const lastRank = answered.length + (silent ? 1 : 0);
  for (const p of players) {
    if (p.accuracy === null) continue;
    const rank = answered.indexOf(p.accuracy) + 1;
    if (rank < lastRank && rank <= PLACE_BONUS.length) out.set(p.id, PLACE_BONUS[rank - 1]);
  }
  return out;
}

/** A round's points: accuracy and place, less the time; never below 0. */
export const roundPoints = (accuracy: number, place: number, penalty: number) => Math.max(0, accuracy + place - penalty);

/** A player's answer as the round holds it: the date and when it came, in ms after the round opened. */
export interface Answer extends TimlerDate {
  at: number;
}

const bare = ({ year, month, day }: TimlerDate): TimlerDate =>
  month !== undefined && day !== undefined ? { year, month, day } : { year };

/**
 * A whole round scored at once (section 4) — the places need every answer:
 * accuracy, place among those who answered, time; no answer scores 0.
 */
export function scoreRound(
  players: ReadonlyArray<{ id: string; guess: Answer | null }>,
  photo: { file: string; date: string },
  durationMs: number
): Map<string, TimlerRoundResult> {
  const out = new Map<string, TimlerRoundResult>();
  const answer = parseDate(photo.date);
  if (!answer) return out;
  const accuracy = new Map(players.map((p) => [p.id, p.guess ? accuracyPoints(p.guess, answer) : null]));
  const places = placeBonuses(players.map((p) => ({ id: p.id, accuracy: accuracy.get(p.id) ?? null })));
  for (const p of players) {
    const acc = accuracy.get(p.id) ?? null;
    const place = places.get(p.id) ?? 0;
    const penalty = p.guess ? timePenalty(p.guess.at, durationMs) : 0;
    out.set(p.id, {
      file: photo.file,
      answer: photo.date,
      guess: p.guess ? bare(p.guess) : null,
      accuracy: acc ?? 0,
      place,
      penalty,
      score: acc === null ? 0 : roundPoints(acc, place, penalty),
      ...(p.guess ? { seconds: Math.round(p.guess.at / 1000) } : {})
    });
  }
  return out;
}

/** What a player's match adds up to, for the statistics and the achievements (section 9). */
export function matchDetails(history: readonly TimlerRoundResult[]) {
  const errors: number[] = [];
  let exactYears = 0, exactDates = 0, oneOff = 0, oldExact = 0;
  let fastExact = Infinity;
  for (const r of history) {
    const answer = parseDate(r.answer);
    if (!answer || !r.guess) continue;
    const error = Math.abs(r.guess.year - answer.year);
    errors.push(error);
    if (error === 1) oneOff++;
    if (error !== 0) continue;
    exactYears++;
    if (answer.year < 1900) oldExact++;
    if (typeof r.seconds === 'number') fastExact = Math.min(fastExact, r.seconds);
    if (hasDay(r.guess) && hasDay(answer) && r.guess.month === answer.month && r.guess.day === answer.day) exactDates++;
  }
  return {
    rounds: history.length,
    answered: errors.length,
    exactYears,
    exactDates,
    oneOff,
    oldExact,
    ...(fastExact < Infinity ? { fastExact } : {}),
    // Only a match where every round was answered has a worst miss to speak of.
    ...(history.length > 0 && errors.length === history.length ? { worstError: Math.max(...errors) } : {}),
    bestRound: Math.max(0, ...history.map((h) => h.score))
  };
}

// --------------------------------------------------------------- timeline --

export interface Axis {
  /** Years, the left and right ends. */
  from: number;
  to: number;
  /** Years between ticks. Under a year the ticks are months. */
  step: number;
  ticks: number[];
}

const STEPS = [1 / 12, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100] as const;
const MAX_INTERVALS = 6;

/**
 * The results timeline (section 5): from the earliest to the latest point —
 * answers and the right date — with room either side, a quarter of the span
 * and at least five years (a few weeks when every point sits within a year
 * and one names a day), then out to whole ticks: the smallest step that fits
 * in six intervals. 1923, 1938, 1944 and 1939 give 1910–1950 in tens.
 */
export function timelineAxis(points: ReadonlyArray<{ at: number; day: boolean }>): Axis {
  const ats = points.map((p) => p.at);
  const min = Math.min(...ats);
  const max = Math.max(...ats);
  const span = max - min;
  const close = span < 1 && points.some((p) => p.day);
  const pad = Math.max(span / 4, close ? 1 / 12 : 5);
  const lo = min - pad;
  const hi = max + pad;
  const step = STEPS.find((s) => Math.ceil(hi / s - 1e-9) - Math.floor(lo / s + 1e-9) <= MAX_INTERVALS) ?? 100;
  const from = Math.floor(lo / step + 1e-9) * step;
  const to = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++) ticks.push(from + i * step);
  return { from, to, step, ticks };
}

/** A point's place across the axis, 0–1. */
export const along = (axis: Axis, at: number) => (at - axis.from) / (axis.to - axis.from);

/**
 * Rows for the answer bubbles, so that close answers stack instead of
 * covering each other: each bubble takes the lowest row whose last bubble is
 * at least `gap` away along the axis (both 0–1). Returns a row per bubble,
 * in the order given.
 */
export function stackRows(positions: readonly number[], gap: number): number[] {
  const order = positions.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const rowEnds: number[] = [];
  const rows = new Array<number>(positions.length);
  for (const { x, i } of order) {
    let row = rowEnds.findIndex((end) => x - end >= gap);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = x;
    rows[i] = row;
  }
  return rows;
}
