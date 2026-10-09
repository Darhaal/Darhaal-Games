import { countContentWords, MIN_CONTENT_WORDS, type WikilerLang } from '@/lib/gameLogic/wikiler';
import { POOL_TOPICS, type WikilerDifficulty, type WikilerTopic } from '@/data/wikiler/topics';
import { byFame } from '@/data/difficulty';
import type { WikilerArticleRef } from '@/types/wikiler';
import { articleRef, fetchArticle, otherVersions, pickRandomArticle } from './wikipedia';

/**
 * Draws a round's article — docs/wikiler-spec.md, sections 5 and 6. Only the
 * host calls this; the others fetch the revisions it settles on.
 *
 * `random` tries all of Wikipedia first and falls back to a random topic of
 * the pool; a topic draws from its pool file. Titles played earlier in the
 * match are never drawn again. When players read their own languages
 * (`also`), the article must be playable in each of them too. A difficulty
 * narrows either to articles read about as much as it asks. `null` only when
 * Wikipedia cannot be reached or nothing fits.
 */

/** Pool articles tried before giving up on a topic. */
const POOL_TRIES = 6;

/** One pool article: its title in each language that has it long enough, and its views there. */
export interface PoolEntry {
  titles: Partial<Record<WikilerLang, string>>;
  /** Views in the 30 days before the pool was built. */
  views: Partial<Record<WikilerLang, number>>;
}

/**
 * public/wikiler/<topic>.json, as scripts/wikiler-pool.mjs writes it: per
 * row the titles in `langs` order, then the views in the same order.
 */
interface PoolFile {
  langs: WikilerLang[];
  articles: Array<Array<string | number | null>>;
}

export function readPool(file: PoolFile): PoolEntry[] {
  const n = file.langs.length;
  return file.articles.map((row) => {
    const entry: PoolEntry = { titles: {}, views: {} };
    file.langs.forEach((lang, i) => {
      const title = row[i];
      const views = row[n + i];
      if (typeof title === 'string') entry.titles[lang] = title;
      if (typeof views === 'number') entry.views[lang] = views;
    });
    return entry;
  });
}

/**
 * A topic's articles in one language at one difficulty: ranked by how much
 * they are read there and cut in thirds — the most read third is easy, the
 * least read hard.
 */
export function byDifficulty(entries: readonly PoolEntry[], lang: WikilerLang, difficulty: WikilerDifficulty): PoolEntry[] {
  return byFame(entries.filter((e) => e.titles[lang]), (e) => e.views[lang] ?? 0, difficulty);
}

/**
 * Views in the last 30 days a random article needs for a difficulty, from–to.
 * A random article is read far less than a vital one, so these are set apart
 * from the pool's thirds; Russian Wikipedia is read about a fifth as much per
 * article, Ukrainian about a seventh as much as Russian.
 */
export const RANDOM_BANDS: Record<WikilerLang, Record<WikilerDifficulty, readonly [number, number]>> = {
  en: { any: [0, Infinity], easy: [20_000, Infinity], medium: [3_000, 20_000], hard: [0, 3_000] },
  ru: { any: [0, Infinity], easy: [5_000, Infinity], medium: [800, 5_000], hard: [0, 800] },
  uk: { any: [0, Infinity], easy: [700, Infinity], medium: [120, 700], hard: [0, 120] }
};

async function poolEntries(topic: Exclude<WikilerTopic, 'random'>): Promise<PoolEntry[]> {
  const res = await fetch(`/wikiler/${topic}.json`);
  if (!res.ok) return [];
  return readPool((await res.json()) as PoolFile);
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function fromPool(
  lang: WikilerLang,
  topic: Exclude<WikilerTopic, 'random'>,
  played: ReadonlySet<string>,
  also: readonly WikilerLang[],
  difficulty: WikilerDifficulty
): Promise<WikilerArticleRef | null> {
  const entries = shuffled(byDifficulty(await poolEntries(topic), lang, difficulty)
    .filter((e) => !played.has(e.titles[lang]!) && also.every((l) => e.titles[l])));
  for (const entry of entries.slice(0, POOL_TRIES)) {
    try {
      const article = await fetchArticle(lang, entry.titles[lang]!);
      if (played.has(article.title) || countContentWords(article.paragraphs, lang) < MIN_CONTENT_WORDS) continue;
      const versions = await otherVersions(lang, article.title, also, entry.titles);
      if (versions) return articleRef(article, versions);
    } catch {
      // A refused or missing article: try the next one.
    }
  }
  return null;
}

export async function pickArticle(
  lang: WikilerLang,
  topic: WikilerTopic,
  played: ReadonlySet<string> = new Set(),
  also: readonly WikilerLang[] = [],
  difficulty: WikilerDifficulty = 'any'
): Promise<WikilerArticleRef | null> {
  if (topic !== 'random') {
    // A third of a small topic can run out in a long match (20 rounds, 13 hard
    // Ukrainian sports figures): the rest of the topic beats a round that never comes.
    return (await fromPool(lang, topic, played, also, difficulty))
      ?? (difficulty === 'any' ? null : fromPool(lang, topic, played, also, 'any'));
  }

  try {
    const ref = await pickRandomArticle(lang, played, also, RANDOM_BANDS[lang][difficulty]);
    if (ref) return ref;
  } catch {
    // Rate-limited or offline: the pool still works from our own files.
  }
  for (const fallback of shuffled(POOL_TOPICS).slice(0, 3)) {
    const ref = await fromPool(lang, fallback, played, also, difficulty);
    if (ref) return ref;
  }
  return null;
}

/** A round's seed — decides which words open at the start, the same for everyone. */
export const newSeed = () => Math.random().toString(36).slice(2, 12);
