import {
  countContentWords, MIN_CONTENT_WORDS, type Paragraph, type WikilerLang
} from '@/lib/gameLogic/wikiler';
import type { WikilerArticleRef, WikilerVersion } from '@/types/wikiler';

/**
 * Everything Wikiler asks of Wikipedia, and every address it links to —
 * docs/wikiler-spec.md, sections 5 and 8.
 *
 * The player's browser talks to Wikipedia directly: both APIs allow any site
 * to read them and accept our identifying header (checked 2026-09-29), so
 * nothing passes through our servers. Wikipedia rate-limits anonymous
 * clients — a dozen quick requests from one address were refused while this
 * was written — so the random pick is capped at a few batches and only the
 * host makes it.
 */

// ---------------------------------------------------------------- links --

const host = (lang: WikilerLang) => `https://${lang}.wikipedia.org`;
/** Titles go into URLs with underscores, as Wikipedia writes them. */
const slug = (title: string) => encodeURIComponent(title.trim().replace(/ /g, '_'));

export const articleUrl = (lang: WikilerLang, title: string) => `${host(lang)}/wiki/${slug(title)}`;
/** The article's history — its list of authors, for the attribution. */
export const historyUrl = (lang: WikilerLang, title: string) =>
  `${host(lang)}/w/index.php?title=${slug(title)}&action=history`;
export const wikipediaHome = (lang: WikilerLang) => `${host(lang)}/`;

/** The licence page in the reader's interface language. */
export const CC_BY_SA_URL = {
  ru: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru',
  en: 'https://creativecommons.org/licenses/by-sa/4.0/',
  uk: 'https://creativecommons.org/licenses/by-sa/4.0/deed.uk'
} as const;

export const WIKIMEDIA_PRIVACY_URL = {
  ru: 'https://foundation.wikimedia.org/wiki/Policy:Privacy_policy/ru',
  en: 'https://foundation.wikimedia.org/wiki/Policy:Privacy_policy',
  uk: 'https://foundation.wikimedia.org/wiki/Policy:Privacy_policy/uk'
} as const;

/**
 * How we introduce ourselves. Wikimedia's API etiquette asks every client to
 * identify itself (https://www.mediawiki.org/wiki/API:Etiquette); a browser
 * cannot set User-Agent, so it goes in the header they read instead.
 */
export const WIKI_HEADERS = { 'Api-User-Agent': 'DarhaalGames-Wikiler/1.0 (https://games.okhten.com)' } as const;

export class WikipediaError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: WIKI_HEADERS });
  if (!res.ok) throw new WikipediaError(res.status, `Wikipedia answered ${res.status} for ${url}`);
  return res;
}

// -------------------------------------------------------------- article --

/**
 * Sections that are lists of sources and links rather than prose, by heading,
 * lower case. Everything after one of these headings is dropped until the
 * next heading of the same level.
 */
const SKIPPED_SECTIONS: Record<WikilerLang, string[]> = {
  ru: ['примечания', 'литература', 'ссылки', 'см. также', 'источники', 'комментарии', 'галерея',
    'библиография', 'сочинения', 'труды', 'публикации', 'фильмография', 'дискография', 'награды'],
  en: ['references', 'notes', 'see also', 'external links', 'further reading', 'bibliography', 'sources',
    'citations', 'footnotes', 'gallery', 'works', 'publications', 'filmography', 'discography', 'awards'],
  uk: ['примітки', 'література', 'посилання', 'див. також', 'джерела', 'коментарі', 'галерея', 'виноски',
    'бібліографія', 'зовнішні посилання', 'твори', 'праці', 'публікації', 'фільмографія', 'дискографія', 'нагороди']
};

/**
 * What goes before reading: footnote marks, infoboxes, tables, images,
 * formulas, navigation boxes, maintenance notices — and hatnotes, which
 * usually name the article outright ("For the fruit, see Apple").
 */
const REMOVED = [
  'sup', '.mw-ref', '.reference', '.hatnote', '[role="note"]', '.ambox', '.metadata', '.navbox',
  '.infobox', 'table', 'figure', '.thumb', '.gallery', 'style', 'script', 'math', '.mwe-math-element',
  '.noprint', '.mw-empty-elt', '.mw-editsection'
].join(', ');

/** Elements whose text must not run into the next: `First sense` + a nested list. */
const BLOCKS = new Set(['UL', 'OL', 'LI', 'DL', 'DT', 'DD', 'DIV', 'P', 'BR']);

/** An element's text, with block boundaries kept as spaces and whitespace collapsed. */
function text(el: Element): string {
  let out = '';
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent ?? '';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const block = BLOCKS.has((child as Element).tagName);
        if (block) out += ' ';
        walk(child);
        if (block) out += ' ';
      }
    }
  };
  walk(el);
  return out.replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------- the opening sentence --

/** Marks where the opening bracket starts and ends, until `extractParagraphs` reads them off. */
const HOLD_START = '\uE000';
const HOLD_END = '\uE001';

/**
 * The bracket that follows the bold title in an opening paragraph —
 * «Аристотель (др.-греч. Ἀριστοτέλης, 384 до н. э. — 322 до н. э.)»,
 * "Aristotle (Ancient Greek: Ἀριστοτέλης, romanized: Aristotélēs; …)" —
 * as the text nodes and offsets of its "(" and its ")", or null.
 */
function openingBracket(p: Element): { open: Text; openAt: number; close: Text; closeAt: number } | null {
  const walker = p.ownerDocument.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let seenBold = !p.querySelector('b, strong');
  let open: { node: Text; at: number } | null = null;
  let depth = 0;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!seenBold) {
      if (node.parentElement?.closest('b, strong')) seenBold = true;
      continue;
    }
    for (let i = 0; i < node.data.length; i++) {
      const ch = node.data[i];
      if (ch === '(') {
        if (depth === 0 && !open) open = { node, at: i };
        depth++;
      } else if (ch === ')' && depth > 0) {
        depth--;
        if (depth === 0 && open) return { open: open.node, openAt: open.at, close: node, closeAt: i };
      }
    }
  }
  return null;
}

/**
 * Marks the opening bracket in the lead's first paragraph. It holds the
 * title in other languages, its transcription and pronunciation — words
 * that would give the answer away if the start opened them by chance, so
 * they stay hidden until a player types them (section 2).
 */
function markOpeningBracket(lead: Element) {
  const p = Array.from(lead.querySelectorAll('p')).find((el) => (el.textContent ?? '').trim() !== '');
  const bracket = p && openingBracket(p);
  if (!bracket) return;
  const { open, openAt, close, closeAt } = bracket;
  // The end first: in a bracket within one text node it sits after the start.
  close.data = close.data.slice(0, closeAt + 1) + HOLD_END + close.data.slice(closeAt + 1);
  open.data = open.data.slice(0, openAt) + HOLD_START + open.data.slice(openAt);
}

/** A paragraph's text with the marks read off into `hold`. */
function withHold(text: string): Paragraph {
  const start = text.indexOf(HOLD_START);
  const end = text.indexOf(HOLD_END);
  const clean = text.replace(HOLD_START, '').replace(HOLD_END, '');
  return start >= 0 && end > start ? { text: clean, hold: [start, end - 1] } : { text: clean };
}

/**
 * The prose of a Wikipedia article's HTML, as headings and paragraphs, in
 * order. List items count as paragraphs; nested ones are part of their parent.
 */
export function extractParagraphs(doc: Document, lang: WikilerLang): Paragraph[] {
  const body = doc.body;
  body.querySelectorAll(REMOVED).forEach((el) => el.remove());
  // Parsoid wraps the lead — everything before the first heading — in section 0.
  const lead = body.querySelector('section[data-mw-section-id="0"]');
  if (lead) markOpeningBracket(lead);

  const paragraphs: Paragraph[] = [];
  let skippingLevel: number | null = null;

  for (const el of Array.from(body.querySelectorAll('h2, h3, h4, p, li'))) {
    const tag = el.tagName.toLowerCase();
    if (tag.startsWith('h')) {
      const level = Number(tag[1]);
      if (skippingLevel !== null && level > skippingLevel) continue;
      skippingLevel = null;
      const heading = text(el);
      if (SKIPPED_SECTIONS[lang].includes(heading.toLocaleLowerCase(lang))) {
        skippingLevel = level;
        continue;
      }
      if (heading) paragraphs.push({ text: heading, heading: true });
      continue;
    }
    if (skippingLevel !== null) continue;
    if (tag === 'li' && el.parentElement?.closest('li')) continue;
    const paragraph = withHold(text(el));
    if (paragraph.text) paragraphs.push(paragraph);
  }
  return paragraphs;
}

export interface FetchedArticle {
  /** Wikipedia's own spelling of the title. */
  title: string;
  /** The revision fetched — the round stores it so every player reads the same text. */
  revision: number;
  paragraphs: Paragraph[];
}

/**
 * An article's HTML, at a given revision when one is named. Parsed with the
 * browser's DOMParser; nothing of it is executed.
 */
export async function fetchArticle(lang: WikilerLang, title: string, revision?: number): Promise<FetchedArticle> {
  const url = `${host(lang)}/api/rest_v1/page/html/${slug(title)}${revision ? `/${revision}` : ''}`;
  const html = await (await get(url)).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Parsoid names the revision it rendered on the root element.
  const about = doc.documentElement.getAttribute('about') ?? '';
  const rev = Number(about.match(/revision\/(\d+)/)?.[1] ?? revision ?? 0);
  const name = doc.querySelector('title')?.textContent?.trim() || title;
  return { title: name, revision: rev, paragraphs: extractParagraphs(doc, lang) };
}

/** The article if it has enough prose to play — `null` for a short one. */
async function playable(lang: WikilerLang, title: string): Promise<FetchedArticle | null> {
  const article = await fetchArticle(lang, title);
  return countContentWords(article.paragraphs, lang) >= MIN_CONTENT_WORDS ? article : null;
}

// ---------------------------------------------------- other languages --

/** The article's titles in other Wikipedias, through its interlanguage links. */
export async function languageLinks(
  lang: WikilerLang,
  title: string,
  targets: readonly WikilerLang[]
): Promise<Partial<Record<WikilerLang, string>>> {
  if (targets.length === 0) return {};
  const url = `${host(lang)}/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=langlinks&lllimit=max` +
    '&redirects=1&format=json&formatversion=2&origin=*';
  const data = await (await get(url)).json() as {
    query?: { pages?: Array<{ langlinks?: Array<{ lang: string; title: string }> }> };
  };
  const links = data.query?.pages?.[0]?.langlinks ?? [];
  const out: Partial<Record<WikilerLang, string>> = {};
  for (const target of targets) {
    const link = links.find((l) => l.lang === target);
    if (link) out[target] = link.title;
  }
  return out;
}

/**
 * The same article in each of `langs`, playable there too and at the revision
 * its readers will share — `null` when one is missing or too short, and the
 * article cannot serve this room (docs/wikiler-spec.md, section 6). `known`
 * titles, from the topic pool, save asking Wikipedia for the links.
 */
export async function otherVersions(
  lang: WikilerLang,
  title: string,
  langs: readonly WikilerLang[],
  known: Partial<Record<WikilerLang, string | null>> = {}
): Promise<Partial<Record<WikilerLang, WikilerVersion>> | null> {
  if (langs.length === 0) return {};
  const missing = langs.filter((l) => !known[l]);
  const links = { ...known, ...(await languageLinks(lang, title, missing)) };
  const versions: Partial<Record<WikilerLang, WikilerVersion>> = {};
  for (const other of langs) {
    const linked = links[other];
    if (!linked) return null;
    const article = await playable(other, linked);
    if (!article) return null;
    versions[other] = { title: article.title, revision: article.revision };
  }
  return versions;
}

/** A round's article: its host-language version, and the others when there are any. */
export const articleRef = (article: FetchedArticle, versions: Partial<Record<WikilerLang, WikilerVersion>>): WikilerArticleRef =>
  Object.keys(versions).length > 0
    ? { title: article.title, revision: article.revision, versions }
    : { title: article.title, revision: article.revision };

// ---------------------------------------------------------------- preview --

export interface ArticleSummary {
  title: string;
  /** A few words: "Сочный плод яблони", "English physicist". */
  description?: string;
  /** The first paragraph, as plain text. */
  extract: string;
  /** A small picture from Wikimedia Commons, when the article has one. */
  thumbnail?: { source: string; width: number; height: number };
}

/**
 * The article's preview card — shown once the round is over for a player, so
 * someone who missed it sees what it was (docs/wikiler-spec.md, section 7).
 */
export async function fetchSummary(lang: WikilerLang, title: string): Promise<ArticleSummary> {
  const data = await (await get(`${host(lang)}/api/rest_v1/page/summary/${slug(title)}`)).json() as {
    title?: string; description?: string; extract?: string;
    thumbnail?: { source: string; width: number; height: number };
  };
  return {
    title: data.title ?? title,
    description: data.description,
    extract: data.extract ?? '',
    thumbnail: data.thumbnail
  };
}

// ------------------------------------------------------------ random pick --

/** How much a random article must have to be worth drawing (section 5). */
const MIN_BYTES = 12_000;
/**
 * Views in 30 days below which nobody reads it. Ukrainian Wikipedia is read
 * about a tenth as much as Russian (52 M views a month against 533 M,
 * September 2026), so the bar there is lower in proportion per article.
 */
const MIN_MONTHLY_VIEWS: Record<WikilerLang, number> = { en: 300, ru: 300, uk: 50 };
/** Batches of random articles tried before giving up — Wikipedia rate-limits. */
const RANDOM_BATCHES = 3;
const BATCH_SIZE = 50;

interface RandomPage {
  title: string;
  length?: number;
}

/**
 * Views in the last 30 days of each title, continuation followed. Asked for
 * the titles themselves: on a random generator the API fills in views for
 * only part of the batch and leaves the rest to a continuation, so most
 * pages used to read as unread — Ukrainian ones almost all of them.
 */
async function pageViews(lang: WikilerLang, titles: readonly string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let cont: Record<string, string> | null = {};
  while (cont) {
    const url: string = `${host(lang)}/w/api.php?` + new URLSearchParams({
      action: 'query', titles: titles.join('|'), prop: 'pageviews', pvipdays: '30',
      format: 'json', formatversion: '2', origin: '*', ...cont
    });
    const data = await (await get(url)).json() as {
      query?: { pages?: Array<{ title: string; pageviews?: Record<string, number | null> }> };
      continue?: Record<string, string>;
    };
    for (const p of data.query?.pages ?? []) {
      if (!p.pageviews) continue;
      const sum = Object.values(p.pageviews).reduce<number>((a, b) => a + (b ?? 0), 0);
      out.set(p.title, (out.get(p.title) ?? 0) + sum);
    }
    cont = data.continue ?? null;
  }
  return out;
}

/**
 * A random article from all of Wikipedia that is long enough and read by
 * someone — about one in fifty qualifies (measured 2026-09-29), so a few
 * batches usually find one — and, when players read other languages (`also`),
 * that is long enough in theirs too. `null` means none did; the caller falls
 * back to the topic pool.
 */
export async function pickRandomArticle(
  lang: WikilerLang,
  exclude: ReadonlySet<string> = new Set(),
  also: readonly WikilerLang[] = [],
  /** Views in the last 30 days it must have, from–to: a difficulty's band. */
  band: readonly [number, number] = [MIN_MONTHLY_VIEWS[lang], Infinity]
): Promise<WikilerArticleRef | null> {
  for (let batch = 0; batch < RANDOM_BATCHES; batch++) {
    const url = `${host(lang)}/w/api.php?action=query&generator=random&grnnamespace=0&grnlimit=${BATCH_SIZE}` +
      '&prop=info&format=json&formatversion=2&origin=*';
    const data = await (await get(url)).json() as { query?: { pages?: RandomPage[] } };
    const long = (data.query?.pages ?? []).filter((p) => (p.length ?? 0) >= MIN_BYTES && !exclude.has(p.title));
    if (long.length === 0) continue;
    const viewsOf = await pageViews(lang, long.map((p) => p.title));
    const views = (p: RandomPage) => viewsOf.get(p.title) ?? 0;
    const candidates = long
      .filter((p) => views(p) >= Math.max(MIN_MONTHLY_VIEWS[lang], band[0]) && views(p) < band[1])
      .sort((a, b) => views(b) - views(a))
      .slice(0, 2);
    for (const c of candidates) {
      const article = await playable(lang, c.title);
      if (!article) continue;
      const versions = await otherVersions(lang, article.title, also);
      if (versions) return articleRef(article, versions);
    }
  }
  return null;
}

// ------------------------------------------------------------- redirects --

/**
 * Where a typed title leads on Wikipedia, redirects followed — how «Исаак
 * Ньютон» or «Ньютон» count as naming «Ньютон, Исаак». `null` when there is no
 * such article.
 */
export async function resolveTitle(lang: WikilerLang, typed: string): Promise<string | null> {
  const t = typed.trim();
  if (!t) return null;
  const url = `${host(lang)}/w/api.php?action=query&titles=${encodeURIComponent(t)}&redirects=1` +
    '&format=json&formatversion=2&origin=*';
  const data = await (await get(url)).json() as { query?: { pages?: Array<{ title: string; missing?: boolean; invalid?: boolean }> } };
  const page = data.query?.pages?.[0];
  return page && !page.missing && !page.invalid ? page.title : null;
}
