import { describe, it, expect } from 'vitest';
import {
  accuracyPoints, along, datePoints, formatIso, matchDetails, parseDate, placeBonuses, roundPoints, scoreRound,
  stackRows, timelineAxis, timePenalty, toYears, validDay, yearPoints, yearScale, FIRST_YEAR
} from '@/lib/gameLogic/timler';

/**
 * Timler's core rules, as agreed in docs/timler-spec.md (section numbers in
 * the test names).
 */

describe('dates', () => {
  it('reads and writes the two forms the pool uses', () => {
    expect(parseDate('1939-09-01')).toEqual({ year: 1939, month: 9, day: 1 });
    expect(parseDate('1939')).toEqual({ year: 1939 });
    expect(parseDate('Sept 1939')).toBeNull();
    expect(formatIso({ year: 1969, month: 7, day: 20 })).toBe('1969-07-20');
    expect(formatIso({ year: 1969 })).toBe('1969');
  });

  it('knows which days exist', () => {
    expect(validDay({ year: 2024, month: 2, day: 29 })).toBe(true);
    expect(validDay({ year: 2023, month: 2, day: 29 })).toBe(false);
    expect(validDay({ year: 2023, month: 4, day: 31 })).toBe(false);
    expect(validDay({ year: 2023 })).toBe(true);
  });

  it('puts a year at its middle and a day where it falls', () => {
    expect(toYears({ year: 1939 })).toBe(1939.5);
    expect(toYears({ year: 1939, month: 1, day: 1 })).toBeCloseTo(1939.0014, 3);
    expect(toYears({ year: 1939, month: 9, day: 1 })).toBeCloseTo(1939.667, 2);
  });
});

describe('the score (4)', () => {
  it('the year: 1000 on the year whatever the photo, less the further off, either way', () => {
    for (const y of [1850, 1939, 2015]) expect(yearPoints(y, y)).toBe(1000);
    expect(yearPoints(1929, 1939)).toBe(yearPoints(1949, 1939));
    const off = [0, 1, 2, 5, 10, 20, 50].map((d) => yearPoints(1939 + d, 1939));
    expect(off).toEqual([...off].sort((a, b) => b - a));
    expect(off.at(-1)).toBeLessThan(150);
  });

  it('forgives a miss in proportion to the photo’s age: a quarter of it, never under two years', () => {
    const thisYear = new Date().getFullYear();
    expect(yearScale(thisYear - 40)).toBe(10);
    expect(yearScale(FIRST_YEAR)).toBe((thisYear - FIRST_YEAR) / 4);
    expect(yearScale(thisYear - 1)).toBe(2);
    expect(yearScale(thisYear)).toBe(2);
    const fiveOff = [1840, 1870, 1900, 1939, 1969, 1990, 2005, 2015].map((y) => yearPoints(y - 5, y));
    expect(fiveOff).toEqual([...fiveOff].sort((a, b) => b - a));
    expect(new Set(fiveOff).size).toBe(fiveOff.length);
    // Five years off: next to nothing on the first photographs, nearly everything on a recent one.
    expect(fiveOff[0]).toBeGreaterThan(880);
    expect(yearPoints(thisYear - 6, thisYear - 1)).toBe(Math.round(1000 * Math.exp(-2.5)));
  });

  it('the date is a bet: +300 for the day, −100 far off, nothing without a date', () => {
    const answer = { year: 1939, month: 9, day: 1 };
    const off = (days: number) => {
      const d = new Date(Date.UTC(1939, 8, 1 + days));
      return datePoints({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }, answer);
    };
    expect([0, 3, 7, 14, 30, 365].map(off)).toEqual([300, 223, 143, 47, -53, -100]);
    expect(off(-7)).toBe(143);
    expect(datePoints({ year: 1939 }, answer)).toBeNull();
    // A photo known only to the year takes no date bet.
    expect(datePoints({ year: 1939, month: 9, day: 1 }, { year: 1939 })).toBeNull();
  });

  it('a guessed day in the right year adds to the year; a wild one costs', () => {
    const answer = { year: 1969, month: 7, day: 20 };
    expect(accuracyPoints({ year: 1969, month: 7, day: 20 }, answer)).toBe(1300);
    expect(accuracyPoints({ year: 1969 }, answer)).toBe(1000);
    expect(accuracyPoints({ year: 1969, month: 1, day: 1 }, answer)).toBe(900);
  });

  it('time costs from the first second, up to 200 at the end: the first to answer loses least', () => {
    expect(timePenalty(0, 60_000)).toBe(0);
    expect(timePenalty(3_000, 60_000)).toBe(10);
    expect(timePenalty(30_000, 60_000)).toBe(100);
    expect(timePenalty(60_000, 60_000)).toBe(200);
    expect(timePenalty(90_000, 60_000)).toBe(200);
  });

  it('never below zero', () => {
    expect(roundPoints(36, 0, 200)).toBe(0);
    expect(roundPoints(1000, 100, 50)).toBe(1050);
  });
});

describe('places (4)', () => {
  const bonuses = (accs: Array<number | null>) =>
    [...placeBonuses(accs.map((accuracy, i) => ({ id: `p${i}`, accuracy }))).values()];

  it('the three most accurate: +100, +60, +30, the last place never', () => {
    expect(bonuses([900, 1000, 500, 700, 100])).toEqual([60, 100, 0, 30, 0]);
    expect(bonuses([900, 1000, 500])).toEqual([60, 100, 0]);
  });

  it('two players: one bonus; alone: none', () => {
    expect(bonuses([400, 800])).toEqual([0, 100]);
    expect(bonuses([1000])).toEqual([0]);
  });

  it('a tie shares the place', () => {
    expect(bonuses([1000, 1000, 500])).toEqual([100, 100, 0]);
    expect(bonuses([1000, 700, 700, 300])).toEqual([100, 60, 60, 0]);
    expect(bonuses([500, 500])).toEqual([0, 0]);
  });

  it('a player who did not answer is below everyone who did', () => {
    expect(bonuses([500, null])).toEqual([100, 0]);
  });
});

describe('the timeline (5)', () => {
  const years = (...ys: number[]) => ys.map((y) => ({ at: y + 0.5, day: false }));

  it('the spec’s example: 1923, 1938, 1944 and 1939 → 1910–1950 in tens', () => {
    const axis = timelineAxis(years(1923, 1938, 1944, 1939));
    expect([axis.from, axis.to, axis.step]).toEqual([1910, 1950, 10]);
    expect(axis.ticks).toEqual([1910, 1920, 1930, 1940, 1950]);
  });

  it('keeps at least five years of room, and widens to fit a wide spread', () => {
    const tight = timelineAxis(years(1939, 1939));
    expect(tight.from).toBeLessThanOrEqual(1934.5);
    expect(tight.to).toBeGreaterThanOrEqual(1944.5);
    const wide = timelineAxis(years(1850, 2020));
    expect([wide.from, wide.to, wide.step]).toEqual([1800, 2100, 50]);
  });

  it('goes to months when every point is within a year and one names a day', () => {
    const axis = timelineAxis([
      { at: toYears({ year: 1939, month: 9, day: 1 }), day: true },
      { at: toYears({ year: 1939, month: 8, day: 20 }), day: true }
    ]);
    expect(axis.step).toBeLessThan(1);
    expect(axis.to - axis.from).toBeLessThan(1);
  });

  it('places every point inside the axis', () => {
    const axis = timelineAxis(years(1901, 1999, 1950));
    for (const y of [1901.5, 1999.5, 1950.5]) {
      expect(along(axis, y)).toBeGreaterThan(0);
      expect(along(axis, y)).toBeLessThan(1);
    }
  });
});

describe('the bubbles (5)', () => {
  it('stack close answers and keep far ones on the first row', () => {
    expect(stackRows([0.1, 0.5, 0.9], 0.08)).toEqual([0, 0, 0]);
    expect(stackRows([0.5, 0.52, 0.53, 0.9], 0.08)).toEqual([0, 1, 2, 0]);
    expect(stackRows([0.5, 0.52, 0.6], 0.08)).toEqual([0, 1, 0]);
  });
});

describe('a round scored at once (4)', () => {
  const photo = { file: 'Moon landing.jpg', date: '1969-07-20' };

  it('scores everyone from their answers: accuracy, place, time', () => {
    const results = scoreRound([
      { id: 'a', guess: { year: 1969, month: 7, day: 20, at: 3_000 } },
      { id: 'b', guess: { year: 1970, at: 32_500 } },
      { id: 'c', guess: null }
    ], photo, 60_000);
    expect(results.get('a')).toMatchObject({ accuracy: 1300, place: 100, penalty: 10, score: 1390, seconds: 3, guess: { year: 1969, month: 7, day: 20 } });
    const b = yearPoints(1970, 1969);
    expect(results.get('b')).toMatchObject({ accuracy: b, place: 60, penalty: 108, score: b + 60 - 108 });
    expect(results.get('c')).toMatchObject({ guess: null, accuracy: 0, place: 0, score: 0 });
    expect(results.get('c')).not.toHaveProperty('seconds');
  });
});

describe('a match in numbers (9)', () => {
  const round = (answer: string, guess: { year: number; month?: number; day?: number } | null, seconds?: number, score = 500) =>
    ({ file: 'f.jpg', answer, guess, accuracy: 0, place: 0, penalty: 0, score, ...(seconds === undefined ? {} : { seconds }) });

  it('counts exact years and dates, one-offs, old photos and the fastest exact year', () => {
    const details = matchDetails([
      round('1969-07-20', { year: 1969, month: 7, day: 20 }, 9, 1400),
      round('1888', { year: 1888 }, 4),
      round('1945', { year: 1946 }, 20),
      round('2001-09-11', { year: 2001 }, 12)
    ]);
    expect(details).toEqual({
      rounds: 4, answered: 4, exactYears: 3, exactDates: 1, oneOff: 1, oldExact: 1, fastExact: 4, worstError: 1, bestRound: 1400
    });
  });

  it('has no worst miss when a round went unanswered', () => {
    expect(matchDetails([round('1969', { year: 1969 }), round('1970', null)])).not.toHaveProperty('worstError');
  });
});
