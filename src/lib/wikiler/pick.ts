import { countContentWords, MIN_CONTENT_WORDS, type WikilerLang } from '@/lib/gameLogic/wikiler';
import { POOL_TOPICS, type WikilerTopic } from '@/data/wikiler/topics';
import type { WikilerArticleRef } from '@/types/wikiler';
import { articleRef, fetchArticle, otherVersions, pickRandomArticle } from './wikipedia';

/**
 * Draws a round's article — docs/wikiler-spec.md, sections 5 and 6. Only the
 * host calls this; the others fetch the revisions it settles on.
 *
 * `random` tries all of Wikipedia first and falls back to a random topic of
 * the pool; a topic draws from its pool file. Titles played earlier in the
 * match are never drawn again. When players read their own languages
 * (`also`), the article must be playable in each of them too. `null` only
 * when Wikipedia cannot be reached or nothing fits.
 */

/** Pool articles tried before giving up on a topic. */
const POOL_TRIES = 6;

/** One pool article: its title in each language that has it long enough. */
export type PoolEntry = Partial<Record<WikilerLang, string>>;

/** public/wikiler/<topic>.json, as scripts/wikiler-pool.mjs writes it. */
interface PoolFile {
  langs: WikilerLang[];
  articles: Array<Array<string | null>>;
}

export function readPool(file: PoolFile): PoolEntry[] {
  return file.articles.map((row) =>
    Object.fromEntries(file.langs.flatMap((lang, i) => (row[i] ? [[lang, row[i]]] : [])))
  );
}

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
  also: readonly WikilerLang[]
): Promise<WikilerArticleRef | null> {
  const entries = shuffled((await poolEntries(topic))
    .filter((e) => e[lang] && !played.has(e[lang]) && also.every((l) => e[l])));
  for (const entry of entries.slice(0, POOL_TRIES)) {
    try {
      const article = await fetchArticle(lang, entry[lang]!);
      if (played.has(article.title) || countContentWords(article.paragraphs, lang) < MIN_CONTENT_WORDS) continue;
      const versions = await otherVersions(lang, article.title, also, entry);
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
  also: readonly WikilerLang[] = []
): Promise<WikilerArticleRef | null> {
  if (topic !== 'random') return fromPool(lang, topic, played, also);

  try {
    const ref = await pickRandomArticle(lang, played, also);
    if (ref) return ref;
  } catch {
    // Rate-limited or offline: the pool still works from our own files.
  }
  for (const fallback of shuffled(POOL_TOPICS).slice(0, 3)) {
    const ref = await fromPool(lang, fallback, played, also);
    if (ref) return ref;
  }
  return null;
}

/** A round's seed — decides which words open at the start, the same for everyone. */
export const newSeed = () => Math.random().toString(36).slice(2, 12);
