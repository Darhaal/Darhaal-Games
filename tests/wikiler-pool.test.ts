import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { POOL_TOPICS, TOPIC_PAGES } from '@/data/wikiler/topics';
import { WIKILER_LANGS, type WikilerLang } from '@/lib/gameLogic/wikiler';
import { byDifficulty, readPool, type PoolEntry } from '@/lib/wikiler/pick';

/**
 * The topic pool in public/wikiler/ (docs/wikiler-spec.md, sections 5–6) —
 * built by scripts/wikiler-pool.mjs, so a topic added to the dropdown without
 * a rebuild, or a rebuild that lost a section, fails here and not in a room.
 */

/** Fewer titles than this and a ten-round match would feel repetitive. */
const MIN_TITLES = 40;
/** And a difficulty — a third of a topic — needs at least this many. */
const MIN_PER_DIFFICULTY = 15;

const pool = (topic: string): PoolEntry[] =>
  readPool(JSON.parse(fs.readFileSync(path.join('public', 'wikiler', `${topic}.json`), 'utf8')));
const titles = (topic: string, lang: WikilerLang) => pool(topic).flatMap((e) => (e.titles[lang] ? [e.titles[lang]] : []));

describe('the topic pool (5)', () => {
  it('every topic says where its articles come from', () => {
    expect(Object.keys(TOPIC_PAGES).sort()).toEqual([...POOL_TOPICS].sort());
  });

  it('has one file per topic and nothing else', () => {
    const files = fs.readdirSync(path.join('public', 'wikiler')).map((f) => f.replace(/\.json$/, ''));
    expect(files.sort()).toEqual([...POOL_TOPICS].sort());
  });

  it.each(WIKILER_LANGS)('%s topics are playable lists of distinct titles', (lang) => {
    for (const topic of POOL_TOPICS) {
      const list = titles(topic, lang);
      expect(list.length, `${lang}/${topic}`).toBeGreaterThanOrEqual(MIN_TITLES);
      expect(new Set(list).size, `${lang}/${topic}`).toBe(list.length);
      expect(list.every((t) => t.trim() === t && t.length > 0)).toBe(true);
    }
  });

  // A room where each reads their own language draws from the rows that
  // have both — there must be enough of them.
  it('every topic has enough articles in both languages at once', () => {
    for (const topic of POOL_TOPICS) {
      const both = pool(topic).filter((e) => WIKILER_LANGS.every((l) => e.titles[l]));
      expect(both.length, topic).toBeGreaterThanOrEqual(MIN_TITLES);
    }
  });

  it.each(WIKILER_LANGS)('%s titles carry how much they are read, and every difficulty has enough', (lang) => {
    for (const topic of POOL_TOPICS) {
      const entries = pool(topic);
      const read = entries.filter((e) => e.titles[lang]);
      expect(read.every((e) => typeof e.views[lang] === 'number'), `${lang}/${topic} views`).toBe(true);
      for (const level of ['easy', 'medium', 'hard'] as const) {
        expect(byDifficulty(entries, lang, level).length, `${lang}/${topic}/${level}`).toBeGreaterThanOrEqual(MIN_PER_DIFFICULTY);
      }
    }
  });

  // "People#Sports figures" is a section of "People": its topic must be a
  // real part of the whole, not the whole again (the old subpages were
  // redirects, and every subtopic came out as its parent).
  it('narrow topics are a part of their broad one', () => {
    const broadOf = new Map(
      Object.entries(TOPIC_PAGES).flatMap(([topic, sources]) =>
        sources.length === 1 && !sources[0].includes('#') ? [[sources[0], topic]] : [])
    );
    for (const [topic, sources] of Object.entries(TOPIC_PAGES)) {
      const pages = new Set(sources.filter((s) => s.includes('#')).map((s) => s.split('#')[0]));
      if (pages.size !== 1 || sources.some((s) => !s.includes('#'))) continue;
      const broad = titles(broadOf.get([...pages][0])!, 'en');
      const narrow = titles(topic, 'en');
      const inBroad = new Set(broad);
      expect(narrow.every((t) => inBroad.has(t)), topic).toBe(true);
      expect(narrow.length, topic).toBeLessThan(broad.length / 2);
    }
  });
});

describe('reading a pool file', () => {
  it('turns rows into titles and views by language, leaving out the missing ones', () => {
    expect(readPool({
      langs: ['en', 'ru'],
      articles: [['Isaac Newton', 'Ньютон, Исаак', 312004, 61877], ['Stub', null, 900, null], [null, 'Только русская', null, 40]]
    })).toEqual([
      { titles: { en: 'Isaac Newton', ru: 'Ньютон, Исаак' }, views: { en: 312004, ru: 61877 } },
      { titles: { en: 'Stub' }, views: { en: 900 } },
      { titles: { ru: 'Только русская' }, views: { ru: 40 } }
    ]);
  });

  it('still reads a file of titles only', () => {
    expect(readPool({ langs: ['en', 'ru'], articles: [['Isaac Newton', null]] }))
      .toEqual([{ titles: { en: 'Isaac Newton' }, views: {} }]);
  });
});

describe('difficulty (5)', () => {
  const entries: PoolEntry[] = Array.from({ length: 9 }, (_, i) => ({
    titles: { en: `A${i}`, ...(i % 2 ? {} : { ru: `Б${i}` }) },
    views: { en: (i + 1) * 100, ...(i % 2 ? {} : { ru: 1000 - i * 100 }) }
  }));
  const names = (list: PoolEntry[], lang: WikilerLang) => list.map((e) => e.titles[lang]);

  it('cuts a topic in thirds by how much each article is read: the most read are easy', () => {
    expect(names(byDifficulty(entries, 'en', 'easy'), 'en')).toEqual(['A8', 'A7', 'A6']);
    expect(names(byDifficulty(entries, 'en', 'medium'), 'en')).toEqual(['A5', 'A4', 'A3']);
    expect(names(byDifficulty(entries, 'en', 'hard'), 'en')).toEqual(['A2', 'A1', 'A0']);
    expect(byDifficulty(entries, 'en', 'any')).toHaveLength(9);
  });

  it('ranks in the round’s own language, among the articles it has', () => {
    expect(names(byDifficulty(entries, 'ru', 'easy'), 'ru')).toEqual(['Б0', 'Б2']);
    expect(names(byDifficulty(entries, 'ru', 'hard'), 'ru')).toEqual(['Б8']);
  });
});
