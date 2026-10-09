import { stemmer as stemEnglish } from '@orama/stemmers/english';
import { stemmer as stemRussian } from '@orama/stemmers/russian';
import { stemmer as stemUkrainian } from '@orama/stemmers/ukrainian';
import { STOP_WORDS } from '@/data/wikiler/stopwords';
import type { WikilerArticleLang, WikilerArticleRef, WikilerVersion } from '@/types/wikiler';

/**
 * Wikiler's rules without a network or React: how an article becomes words,
 * which words go together, what a guess costs and what a round scores.
 * The agreed rules are docs/wikiler-spec.md; section numbers below refer to it.
 */

// ------------------------------------------------------------ languages --

/** Languages whose articles can be played. Adding one: stop words + a stemmer here. */
export const WIKILER_LANGS = ['ru', 'en', 'uk'] as const;
export type WikilerLang = (typeof WIKILER_LANGS)[number];

interface Language {
  stem: (word: string) => string;
  /** Latin-script languages compare without diacritics: `etat` finds `état`. */
  foldDiacritics: boolean;
  locale: string;
}

const LANGUAGES: Record<WikilerLang, Language> = {
  en: { stem: stemEnglish, foldDiacritics: true, locale: 'en' },
  // Diacritics carry letters here — й is not и — so only stress marks go.
  ru: { stem: stemRussian, foldDiacritics: false, locale: 'ru' },
  // The same for ї, й, ґ.
  uk: { stem: stemUkrainian, foldDiacritics: false, locale: 'uk' }
};

// ---------------------------------------------------------------- words --

/** Stress marks, as Russian Wikipedia writes them in a lead: «Я́блоко». */
const STRESS = /[̀́]/g;
const MARKS = /\p{M}/gu;
/** A word is a run of letters; hyphens, apostrophes and digits separate words. */
const WORD = /[\p{L}\p{M}]+/gu;
/**
 * In Ukrainian the apostrophe is inside the word — «м'яч», «сім'я» — and is
 * written three ways: ', ’ and ʼ. There it joins the letters instead of
 * parting them.
 */
const UK_WORD = /[\p{L}\p{M}]+(?:['’ʼ][\p{L}\p{M}]+)*/gu;
const wordPattern = (lang: WikilerLang) => (lang === 'uk' ? UK_WORD : WORD);

/** Case, stress marks and ё folded, the Ukrainian apostrophe to one form — how a word is compared. */
function clean(word: string, lang: WikilerLang): string {
  const lower = word.normalize('NFD').replace(STRESS, '').normalize('NFC').toLocaleLowerCase(LANGUAGES[lang].locale);
  if (lang === 'ru') return lower.replace(/ё/g, 'е');
  if (lang === 'uk') return lower.replace(/[’ʼ]/g, "'");
  return lower;
}

const fold = (s: string) => s.normalize('NFD').replace(MARKS, '').normalize('NFC');

const STOPS: Record<WikilerLang, Set<string>> = {
  en: new Set([...STOP_WORDS.en].map((w) => clean(w, 'en'))),
  ru: new Set([...STOP_WORDS.ru].map((w) => clean(w, 'ru'))),
  uk: new Set([...STOP_WORDS.uk].map((w) => clean(w, 'uk')))
};

/**
 * The group a word belongs to: every word with the same key opens together
 * (section 6, "related forms"). `null` for words shown from the start —
 * function words and single letters — which can never be guessed.
 */
export function wordKey(word: string, lang: WikilerLang): string | null {
  const w = clean(word, lang);
  if ([...w].length < 2 || STOPS[lang].has(w)) return null;
  const stem = LANGUAGES[lang].stem(w);
  return LANGUAGES[lang].foldDiacritics ? fold(stem) : stem;
}

/** Letters in a word — what a hidden block's hint says ("8 letters"). */
export const letterCount = (text: string) => (text.match(/\p{L}/gu) ?? []).length;

// --------------------------------------------------------------- tokens --

export interface WordToken {
  kind: 'word';
  text: string;
  /** Group key; `null` for a word that is always shown. */
  key: string | null;
}

export interface SepToken {
  kind: 'sep';
  /** Spaces, punctuation, digits — always shown. */
  text: string;
}

export type Token = WordToken | SepToken;

/**
 * Splits text into words and what lies between them, keeping every
 * character, so the article renders exactly as written. A hyphenated or
 * apostrophised word becomes several words joined by visible separators:
 * `state-of-the-art`, `Newton's` (section 6, "hyphens").
 */
export function tokenize(text: string, lang: WikilerLang): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(wordPattern(lang))) {
    const at = match.index ?? 0;
    if (at > last) tokens.push({ kind: 'sep', text: text.slice(last, at) });
    tokens.push({ kind: 'word', text: match[0], key: wordKey(match[0], lang) });
    last = at + match[0].length;
  }
  if (last < text.length) tokens.push({ kind: 'sep', text: text.slice(last) });
  return tokens;
}

const contentWords = (tokens: readonly Token[]) =>
  tokens.reduce((n, t) => n + (t.kind === 'word' && t.key !== null ? 1 : 0), 0);

// -------------------------------------------------------------- article --

export interface Paragraph {
  text: string;
  /** A section heading rather than body text. */
  heading?: boolean;
  /**
   * Where the bracket after the title sits, `[from, to)` in `text` — its
   * words are the title in other languages and never open at the start.
   */
  hold?: [number, number];
}

export interface Block {
  heading: boolean;
  tokens: Token[];
}

export interface Article {
  title: string;
  titleTokens: Token[];
  blocks: Block[];
  /** How often each group occurs, title included. */
  counts: Map<string, number>;
  /** The groups the title is made of — all open means the round is won. */
  titleKeys: string[];
  /** Groups the start never opens: the title's translations, in the bracket after it. */
  heldKeys: string[];
  /** Content words shown — at most the limit, give or take a paragraph. */
  contentWords: number;
}

/** A playable article has at least this many content words (section 5). */
export const MIN_CONTENT_WORDS = 500;
/** And shows at most about this many (section 5). */
export const MAX_CONTENT_WORDS = 1200;

/** Content words in a whole article, before any cut — to judge if it is playable. */
export function countContentWords(paragraphs: readonly Paragraph[], lang: WikilerLang): number {
  return paragraphs.reduce((n, p) => n + (p.heading ? 0 : contentWords(tokenize(p.text, lang))), 0);
}

/**
 * The article as it is played: tokenised, cut after the last whole paragraph
 * that fits under the limit, trailing headings dropped. A first paragraph
 * longer than the limit is kept whole — cutting mid-paragraph reads badly.
 */
export function buildArticle(
  title: string,
  paragraphs: readonly Paragraph[],
  lang: WikilerLang,
  limit = MAX_CONTENT_WORDS
): Article {
  const blocks: Block[] = [];
  const held = new Set<string>();
  let total = 0;
  for (const p of paragraphs) {
    let tokens: Token[];
    if (p.hold) {
      // Split at the brackets, which are never inside a word.
      const [from, to] = p.hold;
      const inside = tokenize(p.text.slice(from, to), lang);
      for (const t of inside) if (t.kind === 'word' && t.key !== null) held.add(t.key);
      tokens = [...tokenize(p.text.slice(0, from), lang), ...inside, ...tokenize(p.text.slice(to), lang)];
    } else {
      tokens = tokenize(p.text, lang);
    }
    const n = contentWords(tokens);
    if (!p.heading && total > 0 && total + n > limit) break;
    blocks.push({ heading: !!p.heading, tokens });
    total += n;
  }
  while (blocks.length > 0 && blocks[blocks.length - 1].heading) blocks.pop();

  const titleTokens = tokenize(title, lang);
  const counts = new Map<string, number>();
  for (const t of [...titleTokens, ...blocks.flatMap((b) => b.tokens)]) {
    if (t.kind === 'word' && t.key !== null) counts.set(t.key, (counts.get(t.key) ?? 0) + 1);
  }
  const titleKeys = [...new Set(titleTokens.flatMap((t) => (t.kind === 'word' && t.key !== null ? [t.key] : [])))];

  return {
    title, titleTokens, blocks, counts, titleKeys,
    heldKeys: [...held].filter((k) => counts.has(k)),
    contentWords: contentWords(blocks.flatMap((b) => b.tokens))
  };
}

// --------------------------------------------------------------- guesses --

/** The attempt limit the word costs are set for (section 3). */
export const COST_BASE_ATTEMPTS = 50;
/** A word the article does not have. */
export const MISS_COST = 10;
/** A word the article has, however often. */
export const FOUND_COST = 2;

/**
 * Cost of a word guess (section 3): 10 for a miss and 2 for a word the
 * article has, at 50 attempts a round. A tighter limit makes each attempt
 * dearer in proportion — at 10 attempts a miss costs 50 and a find 10 — so
 * spending every attempt weighs the same whatever the limit; an unlimited
 * round costs the base.
 */
export function guessCost(occurrences: number, limit: number | null = null): number {
  const scale = limit !== null && limit > 0 && limit < COST_BASE_ATTEMPTS ? COST_BASE_ATTEMPTS / limit : 1;
  return Math.round((occurrences > 0 ? FOUND_COST : MISS_COST) * scale);
}

export type WordGuess =
  | { kind: 'invalid'; reason: 'empty' | 'several' | 'open' }
  | { kind: 'repeat'; key: string }
  | { kind: 'word'; key: string; occurrences: number; cost: number };

/**
 * What a typed word does. Not a guess at all: nothing typed, several words at
 * once, or a word that is always shown. A repeat is free and not an attempt.
 * `limit` is the round's attempt limit, null when unlimited — it sets the cost.
 */
export function evaluateGuess(
  article: Article,
  input: string,
  revealed: ReadonlySet<string>,
  lang: WikilerLang,
  limit: number | null = null
): WordGuess {
  const words = tokenize(input.trim(), lang).filter((t): t is WordToken => t.kind === 'word');
  if (words.length === 0) return { kind: 'invalid', reason: 'empty' };
  if (words.length > 1) return { kind: 'invalid', reason: 'several' };
  const key = words[0].key;
  if (key === null) return { kind: 'invalid', reason: 'open' };
  if (revealed.has(key)) return { kind: 'repeat', key };
  const occurrences = article.counts.get(key) ?? 0;
  return { kind: 'word', key, occurrences, cost: guessCost(occurrences, limit) };
}

/** The fallback way to win: every group of the title is open (section 2). */
export function titleSolved(article: Article, revealed: ReadonlySet<string>): boolean {
  return article.titleKeys.length > 0 && article.titleKeys.every((k) => revealed.has(k));
}

/** A title reduced to its words, compared exactly — no stemming for a title guess. */
function titleWords(text: string, lang: WikilerLang): string[] {
  return (text.match(wordPattern(lang)) ?? []).map((w) => fold(clean(w, lang)));
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Whether a typed title names the article (section 6): case, stress and ё
 * aside, with or without the qualifier in brackets, in any word order
 * («Исаак Ньютон» for «Ньютон, Исаак»). Redirects are checked separately,
 * against Wikipedia.
 */
export function titleGuessMatches(guess: string, title: string, lang: WikilerLang): boolean {
  const typed = titleWords(guess, lang);
  if (typed.length === 0) return false;
  const bare = title.replace(/\s*\([^)]*\)\s*$/, '');
  return [title, bare].some((variant) => {
    const words = titleWords(variant, lang);
    return same(typed, words) || same([...typed].sort(), [...words].sort());
  });
}

// ----------------------------------------------------------------- score --

export const ROUND_POINTS = 1000;
export const TIME_PENALTY_MAX = 500;
export const WRONG_TITLE_PENALTY = 50;
export const SCORE_FLOOR = 10;

/**
 * A round's score (section 3): 1000, less up to 500 for time taken, less the
 * word costs (`guessCost`), less 50 for each wrong title; never below 10 once
 * solved, and 0 if not solved.
 */
export function roundScore(round: {
  solved: boolean;
  elapsedMs: number;
  durationMs: number;
  wordPenalty: number;
  wrongTitles: number;
}): number {
  if (!round.solved) return 0;
  const share = round.durationMs > 0 ? Math.min(1, Math.max(0, round.elapsedMs / round.durationMs)) : 1;
  const score = ROUND_POINTS - TIME_PENALTY_MAX * share - round.wordPenalty - WRONG_TITLE_PENALTY * round.wrongTitles;
  return Math.max(SCORE_FLOOR, Math.round(score));
}

// ---------------------------------------------------------------- reveal --

/** A small seeded generator (mulberry32 over a string hash), the same in every browser. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The hidden share is 50–100% (section 2). */
export const HIDDEN_MIN = 50;
export const HIDDEN_MAX = 100;
/**
 * Three words in four hidden unless the host says otherwise: the scattered
 * open ones give the first guesses something to start from, and the title
 * and its translations are never among them.
 */
export const HIDDEN_DEFAULT = 75;

/**
 * The groups open from the start when less than all is hidden: a seeded
 * random share of the article's content groups — never one from the title,
 * nor one from the title's translations in the bracket after it. The seed
 * is the round's, so every player starts from the same text.
 */
export function initialReveal(article: Article, hiddenPercent: number, seed: string): Set<string> {
  const hidden = Math.min(HIDDEN_MAX, Math.max(HIDDEN_MIN, hiddenPercent));
  const never = new Set([...article.titleKeys, ...(article.heldKeys ?? [])]);
  const keys = [...article.counts.keys()].filter((k) => !never.has(k)).sort();
  const random = seeded(seed);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return new Set(keys.slice(0, Math.round((keys.length * (100 - hidden)) / 100)));
}

// ------------------------------------------------------ whose language --

interface ArticleLangSettings {
  /** The host's language — the round's own. */
  lang: WikilerLang;
  articles?: WikilerArticleLang;
}

/**
 * The version of the round's article a player reads (section 6): their own
 * language when the room reads each their own and the host found it there,
 * otherwise the host's.
 */
export function readingVersion(
  ref: WikilerArticleRef,
  settings: ArticleLangSettings,
  playerLang: WikilerLang | undefined
): WikilerVersion & { lang: WikilerLang } {
  const own = settings.articles === 'own' && playerLang ? ref.versions?.[playerLang] : undefined;
  return own && playerLang
    ? { title: own.title, revision: own.revision, lang: playerLang }
    : { title: ref.title, revision: ref.revision, lang: settings.lang };
}

/**
 * The languages besides the host's that the next article must also exist in:
 * those of the players at the table, when each reads their own. A room of one
 * language draws from everything its Wikipedia has.
 */
export function languagesNeeded(settings: ArticleLangSettings, players: ReadonlyArray<{ lang?: WikilerLang }>): WikilerLang[] {
  if (settings.articles !== 'own') return [];
  const langs = players.flatMap((p) => (p.lang && p.lang !== settings.lang ? [p.lang] : []));
  return [...new Set(langs)].sort();
}
