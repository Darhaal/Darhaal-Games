import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eligible, readPool } from '@/lib/timler/pool';
import { ERA_YEARS, MEDIUM_ERAS, MEDIUM_YEARS, answerRange, eraFits, roomEra, type PoolEra, type PoolMedium } from '@/lib/timler/eras';
import { FIRST_PAINTING_YEAR, FIRST_YEAR, LAST_PAINTING_YEAR, parseDate, validDay } from '@/lib/gameLogic/timler';
import type { TimlerPhoto, TimlerState } from '@/types/timler';

/**
 * The pool in public/timler/<medium>/ (docs/timler-spec.md, sections 7 and
 * 13) — built by scripts/timler-pool.mjs and scripts/timler-paintings.mjs. A
 * rebuild that lost an era, or let a broken date through, fails here and not
 * in a room.
 */

/** A twenty-round match at the hardest setting still needs fresh pictures. */
const MIN_PER_DIFFICULTY = 20;
const MEDIA = Object.keys(MEDIUM_ERAS) as PoolMedium[];
const FILES = MEDIA.flatMap((medium) => MEDIUM_ERAS[medium].map((era) => [medium, era] as [PoolMedium, PoolEra]));

const pool = (medium: PoolMedium, era: PoolEra): TimlerPhoto[] =>
  readPool(JSON.parse(fs.readFileSync(path.join('public', 'timler', medium, `${era}.json`), 'utf8')));
const settings = (over: Partial<TimlerState['settings']> = {}): TimlerState['settings'] =>
  ({ maxPlayers: 20, rounds: 5, roundDuration: 60, era: 'all', difficulty: 'any', adult: false, ...over });

describe('the pool (7, 13)', () => {
  it('has a folder per medium and one file per era of it, nothing else', () => {
    expect(fs.readdirSync(path.join('public', 'timler')).sort()).toEqual([...MEDIA].sort());
    for (const medium of MEDIA) {
      const files = fs.readdirSync(path.join('public', 'timler', medium)).map((f) => f.replace(/\.json$/, ''));
      expect(files.sort(), medium).toEqual([...MEDIUM_ERAS[medium]].sort());
    }
  });

  it.each(FILES)('%s/%s: real dates inside the era, one row per file', (medium, era) => {
    const pictures = pool(medium, era);
    const from = Math.max(ERA_YEARS[era][0], MEDIUM_YEARS[medium][0]);
    const to = Math.min(ERA_YEARS[era][1], MEDIUM_YEARS[medium][1]);
    for (const p of pictures) {
      expect(p.kind === 'painting', p.file).toBe(medium === 'paintings');
      const d = parseDate(p.date);
      expect(d, `${p.file}: ${p.date}`).not.toBeNull();
      expect(validDay(d!), `${p.file}: ${p.date}`).toBe(true);
      expect(d!.year, p.file).toBeGreaterThanOrEqual(from);
      expect(d!.year, p.file).toBeLessThanOrEqual(to);
      expect(p.title.ru ?? p.title.en, `${p.file} has a name`).toBeTruthy();
    }
    expect(new Set(pictures.map((p) => p.file)).size).toBe(pictures.length);
  });

  it.each(FILES)('%s/%s: enough at every difficulty without 18+', (medium, era) => {
    const pictures = pool(medium, era);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(eligible(pictures, settings({ difficulty }), new Set()).length, `${medium}/${era}/${difficulty}`).toBeGreaterThanOrEqual(MIN_PER_DIFFICULTY);
    }
  });

  it.each(FILES)('%s/%s: enough at every difficulty with 18+ only', (medium, era) => {
    const pictures = pool(medium, era);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(eligible(pictures, settings({ difficulty, adult: true, adultOnly: true }), new Set()).length, `${medium}/${era}/${difficulty}`).toBeGreaterThanOrEqual(MIN_PER_DIFFICULTY);
    }
  });

  it('names the painter of most paintings', () => {
    const paintings = MEDIUM_ERAS.paintings.flatMap((era) => pool('paintings', era));
    const named = paintings.filter((p) => p.creator?.en || p.creator?.ru).length;
    expect(named / paintings.length).toBeGreaterThan(0.9);
  });
});

describe('eras (6, 13)', () => {
  it('offers each medium the eras it has pictures from', () => {
    expect(eraFits('before1600', 'photos')).toBe(false);
    expect(eraFits('before1600', 'paintings')).toBe(true);
    expect(eraFits('since2001', 'paintings')).toBe(false);
    expect(eraFits('since2001', 'both')).toBe(true);
    expect(eraFits('all', 'paintings')).toBe(true);
  });

  it('reads a room from before paintings as photos of the 19th century', () => {
    expect(roomEra('before1900')).toBe('1800-1899');
    expect(roomEra('1900-1945')).toBe('1900-1945');
  });

  it('spans the slider over the era, within what the picture can be', () => {
    const photo = {};
    const painting = { kind: 'painting' as const };
    expect(answerRange('all', photo)).toEqual([FIRST_YEAR, new Date().getFullYear()]);
    expect(answerRange('all', painting)).toEqual([FIRST_PAINTING_YEAR, LAST_PAINTING_YEAR]);
    expect(answerRange('1800-1899', photo)).toEqual([FIRST_YEAR, 1899]);
    expect(answerRange('1800-1899', painting)).toEqual([1800, 1899]);
    expect(answerRange('before1900', photo)).toEqual([FIRST_YEAR, 1899]);
    // "Both", 1946–2000: only photos have it, so a painting falls back to its own years.
    expect(answerRange('1946-2000', painting)).toEqual([FIRST_PAINTING_YEAR, LAST_PAINTING_YEAR]);
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

  it('draws nothing but 18+ when the room asks for only that', () => {
    expect(files(eligible(photos, settings({ adult: true, adultOnly: true }), new Set()))).toEqual(['b']);
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

  it('reads a painting file with its painter', () => {
    const [painting] = readPool({
      kind: 'painting',
      fields: ['file', 'date', 'adult', 'fame', 'en', 'ru', 'enDesc', 'ruDesc', 'enwiki', 'ruwiki', 'author', 'license', 'creatorEn', 'creatorRu'],
      photos: [['Nightwatch.jpg', '1642', 0, 120, 'The Night Watch', 'Ночной дозор', null, null, 'The Night Watch', 'Ночной дозор', '', 'Public domain', 'Rembrandt', 'Рембрандт']]
    });
    expect(painting.kind).toBe('painting');
    expect(painting.creator).toEqual({ ru: 'Рембрандт', en: 'Rembrandt' });
  });
});
