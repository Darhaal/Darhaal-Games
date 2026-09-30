/**
 * Builds Wikiler's topic pool — docs/wikiler-spec.md, section 5.
 *
 *   node scripts/wikiler-pool.mjs
 *
 * Source: English Wikipedia's level-4 vital articles, which come sorted into
 * topics. For each topic it collects the linked articles, keeps those long
 * enough to play, finds each one's title in the other languages through
 * Wikipedia's interlanguage links, and keeps those long enough there too.
 *
 * Writes public/wikiler/<topic>.json — the topic's articles as rows of their
 * titles, one column per language (null where that language's article is
 * missing or too short), so a room whose players read different languages can
 * draw one article that exists in all of theirs:
 *
 *   { "langs": ["en", "ru"], "articles": [["Isaac Newton", "Ньютон, Исаак"], …] }
 *
 * Only the host of a room fetches one, when a round starts.
 *
 * Requests go one at a time, identify themselves and back off when told to,
 * as Wikimedia's API etiquette asks: https://www.mediawiki.org/wiki/API:Etiquette
 */
import fs from 'node:fs';
import path from 'node:path';

const UA = 'DarhaalGames-Wikiler/1.0 (https://games.okhten.com; topic pool builder)';
const LANGS = ['en', 'ru'];
/** Byte length an article needs to have enough prose — the same bar as the random pick. */
const MIN_BYTES = 12_000;
const PAUSE_MS = 400;

/**
 * Level 4 is one page per broad topic; the old subpages ("People/Sports
 * figures") are redirects to the whole page since 2025, so narrow topics are
 * read from its sections instead.
 */
const VITAL = 'Wikipedia:Vital articles/Level 4';
/**
 * Which pages feed each topic — "People" for a whole page, "People#Sports
 * figures" for one of its sections. The game reads the same file.
 */
const TOPICS = JSON.parse(fs.readFileSync(path.join('src', 'data', 'wikiler', 'topic-sources.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

async function api(lang, params) {
  const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({
    format: 'json', formatversion: '2', maxlag: '5', ...params
  });
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(PAUSE_MS);
    requests++;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    if (res.status === 429 || res.status >= 500) {
      const wait = Math.max(retryAfter * 1000, 5000 * 2 ** attempt);
      console.log(`  ${res.status} — waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    const body = await res.json();
    if (body.error?.code === 'maxlag') {
      await sleep(Math.max(retryAfter * 1000, 5000));
      continue;
    }
    if (body.error) throw new Error(`${lang}: ${body.error.code} ${body.error.info}`);
    return body;
  }
  throw new Error(`gave up on ${url}`);
}

/**
 * Articles linked from one vital-articles page, with their length and title
 * elsewhere, keyed by English title — and the redirects followed on the way,
 * so a section that links a redirect still finds its article.
 */
async function linkedArticles(page) {
  const found = new Map();
  const redirects = new Map();
  let cont = {};
  do {
    const body = await api('en', {
      action: 'query', generator: 'links', titles: `${VITAL}/${page}`, gplnamespace: '0', gpllimit: 'max',
      prop: 'info|langlinks', lllimit: 'max', lllang: 'ru', redirects: '1', ...cont
    });
    for (const r of body.query?.redirects ?? []) redirects.set(r.from, r.to);
    for (const p of body.query?.pages ?? []) {
      if (p.missing) continue;
      const entry = found.get(p.title) ?? { en: p.title, enBytes: p.length ?? 0, ru: null };
      const ru = p.langlinks?.find((l) => l.lang === 'ru');
      if (ru) entry.ru = ru.title;
      if (p.length) entry.enBytes = p.length;
      found.set(p.title, entry);
    }
    cont = body.continue ?? null;
  } while (cont);
  return { entries: found, redirects };
}

const stripTags = (s) => s.replace(/<[^>]+>/g, '').trim();

/** The articles one section of a page links to (its subsections included). */
async function sectionTitles(page, heading) {
  const sections = (await api('en', { action: 'parse', page: `${VITAL}/${page}`, prop: 'sections' })).parse.sections;
  const section = sections.find((s) => stripTags(s.line) === heading);
  if (!section) throw new Error(`no section "${heading}" on ${page}`);
  const body = await api('en', { action: 'parse', page: `${VITAL}/${page}`, section: section.index, prop: 'links' });
  return body.parse.links.filter((l) => l.ns === 0).map((l) => l.title);
}

/** Byte lengths of titles on one wiki, fifty at a time, redirects followed. */
async function lengths(lang, titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const body = await api(lang, { action: 'query', titles: batch.join('|'), prop: 'info', redirects: '1' });
    const redirect = new Map((body.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const normal = new Map((body.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const byTitle = new Map((body.query?.pages ?? []).filter((p) => !p.missing).map((p) => [p.title, p.length ?? 0]));
    for (const t of batch) {
      const n = normal.get(t) ?? t;
      const final = redirect.get(n) ?? n;
      if (byTitle.has(final)) out.set(t, { title: final, bytes: byTitle.get(final) });
    }
    if ((i / 50) % 20 === 0) console.log(`  ${lang}: ${Math.min(i + 50, titles.length)}/${titles.length}`);
  }
  return out;
}

const sources = [...new Set(Object.values(TOPICS).flat())];
const pages = [...new Set(sources.map((s) => s.split('#')[0]))];

// Each page once, however many topics and sections use it.
const byPage = new Map();
for (const page of pages) {
  console.log(`page: ${page}`);
  byPage.set(page, await linkedArticles(page));
}

// A source's articles: a whole page, or the page's articles that one section links.
const bySource = new Map();
for (const source of sources) {
  const [page, heading] = source.split('#');
  const { entries, redirects } = byPage.get(page);
  if (!heading) {
    bySource.set(source, [...entries.values()]);
    continue;
  }
  const titles = await sectionTitles(page, heading);
  const picked = titles.map((t) => entries.get(redirects.get(t) ?? t)).filter(Boolean);
  console.log(`  ${source}: ${picked.length}`);
  bySource.set(source, picked);
}

const allRu = [...new Set([...byPage.values()].flatMap((p) => [...p.entries.values()]).map((e) => e.ru).filter(Boolean))];
console.log(`ru lengths for ${allRu.length} titles`);
const ruLengths = await lengths('ru', allRu);

const dir = path.join('public', 'wikiler');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
for (const [topic, topicSources] of Object.entries(TOPICS)) {
  const entries = new Map();
  for (const source of topicSources) for (const e of bySource.get(source)) entries.set(e.en, e);
  const all = [...entries.values()];
  const rows = [];
  const seenRu = new Set();
  for (const e of all.sort((a, b) => a.en.localeCompare(b.en, 'en'))) {
    const en = e.enBytes >= MIN_BYTES ? e.en : null;
    const ruPage = e.ru && ruLengths.get(e.ru);
    // Two English articles can link the same Russian one; it is drawn once.
    let ru = ruPage && ruPage.bytes >= MIN_BYTES && !seenRu.has(ruPage.title) ? ruPage.title : null;
    if (ru) seenRu.add(ru);
    if (en || ru) rows.push([en, ru]);
  }
  const count = (i) => rows.filter((r) => r[i]).length;
  console.log(`${topic}: linked ${all.length} · en ${count(0)} · ru ${count(1)} · both ${rows.filter((r) => r[0] && r[1]).length}`);
  fs.writeFileSync(path.join(dir, `${topic}.json`), JSON.stringify({ langs: LANGS, articles: rows }));
}
console.log(`done — ${requests} requests`);
