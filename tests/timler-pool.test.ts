import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eligible, POOL_ERAS, readPool } from '@/lib/timler/pool';
import { FIRST_YEAR, parseDate, validDay } from '@/lib/gameLogic/timler';
import type { TimlerPhoto, TimlerState } from '@/types/timler';

/**
 * The photo pool in public/timler/ (docs/timler-spec.md, section 7) — built
 * by scripts/timler-pool.mjs. A rebuild that lost an era, or let a broken
 * date through, fails here and not in a room.
 */

/** A twenty-round match at the hardest setting still needs fresh photos. */
const MIN_PER_DIFFICULTY = 20;
const ERA_YEARS: Record<(typeof POOL_ERAS)[number], [number, number]> = {
  before1900: [FIRST_YEAR, 1899],
  '1900-1945': [1900, 1945],
  '1946-2000': [1946, 2000],
  since2001: [2001, new Date().getFullYear()]
};

const pool = (era: string): TimlerPhoto[] =>
  readPool(JSON.parse(fs.readFileSync(path.join('public', 'timler', `${era}.json`), 'utf8')));
const settings = (over: Partial<TimlerState['settings']> = {}): TimlerState['settings'] =>
  ({ maxPlayers: 20, rounds: 5, roundDuration: 60, era: 'all', difficulty: 'any', adult: false, ...over });

describe('the photo pool (7)', () => {
  it('has one file per era and nothing else', () => {
    const files = fs.readdirSync(path.join('public', 'timler')).map((f) => f.replace(/\.json$/, ''));
    expect(files.sort()).toEqual([...POOL_ERAS].sort());
  });

  it.each(POOL_ERAS.map((e) => [e]))('%s: real dates inside the era, one row per file', (era) => {
    const photos = pool(era);
    const [from, to] = ERA_YEARS[era];
    for (const p of photos) {
      const d = parseDate(p.date);
      expect(d, `${p.file}: ${p.date}`).not.toBeNull();
      expect(validDay(d!), `${p.file}: ${p.date}`).toBe(true);
      expect(d!.year, p.file).toBeGreaterThanOrEqual(from);
      expect(d!.year, p.file).toBeLessThanOrEqual(to);
      expect(p.title.ru ?? p.title.en, `${p.file} has a name`).toBeTruthy();
    }
    expect(new Set(photos.map((p) => p.file)).size).toBe(photos.length);
  });

  it.each(POOL_ERAS.map((e) => [e]))('%s: enough photos at every difficulty without 18+', (era) => {
    const photos = pool(era);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(eligible(photos, settings({ difficulty }), new Set()).length, `${era}/${difficulty}`).toBeGreaterThanOrEqual(MIN_PER_DIFFICULTY);
    }
  });
});

describe('drawing from the pool', () => {
  const photo = (file: string, fame: number, adult = false): TimlerPhoto => ({
    file, date: '1950', adult, fame,
    title: { ru: null, en: file }, description: { ru: null, en: null }, article: { ru: null, en: null }, author: '', license: ''
  });
  const photos = [photo('a', 90), photo('b', 80, true), photo('c', 70), photo('d', 60), photo('e', 50), photo('f', 40), photo('g', 30)];
  const files = (list: TimlerPhoto[]) => list.map((p) => p.file);

  it('leaves 18+ photos out unless the room allows them', () => {
    expect(files(eligible(photos, settings(), new Set()))).not.toContain('b');
    expect(files(eligible(photos, settings({ adult: true }), new Set()))).toContain('b');
  });

  it('takes the third of the known that the difficulty asks for, never a photo already shown', () => {
    expect(files(eligible(photos, settings({ difficulty: 'easy' }), new Set()))).toEqual(['a', 'c']);
    expect(files(eligible(photos, settings({ difficulty: 'hard' }), new Set()))).toEqual(['f', 'g']);
    expect(files(eligible(photos, settings({ difficulty: 'easy' }), new Set(['a'])))).toEqual(['c']);
  });

  it('reads a pool file by its column names', () => {
    expect(readPool({
      fields: ['file', 'date', 'adult', 'fame', 'en', 'ru', 'enDesc', 'ruDesc', 'enwiki', 'ruwiki', 'author', 'license'],
      photos: [['Moon.jpg', '1969-07-20', 0, 99, 'Apollo 11', 'Аполлон-11', null, 'высадка', 'Apollo 11', null, 'NASA', 'PD']]
    })).toEqual([{
      file: 'Moon.jpg', date: '1969-07-20', adult: false, fame: 99,
      title: { ru: 'Аполлон-11', en: 'Apollo 11' }, description: { ru: 'высадка', en: null },
      article: { ru: null, en: 'Apollo 11' }, author: 'NASA', license: 'PD'
    }]);
  });
});
