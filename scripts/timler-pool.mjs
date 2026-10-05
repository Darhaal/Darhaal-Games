/**
 * Builds Timler's photo pool — docs/timler-spec.md, section 7.
 *
 *   node scripts/timler-pool.mjs
 *
 * It takes a while — tens of thousands of files to check. POOL_BUDGET_MIN=9
 * makes a run stop cleanly after nine minutes with exit code 3; answers are
 * cached on disk, so the next run carries on where this one stopped.
 *
 * Candidates come from Wikidata: notable events (on 8+ Wikipedias) with a
 * picture and a date, and items that are photographs with a date. Each
 * picture is then checked on Wikimedia Commons: it must be a photograph
 * (JPEG) whose own date of creation falls in the event's year — which leaves
 * out paintings, maps, logos and later pictures of a memorial. The date asked
 * is the photo's own: to the day when Commons knows it, otherwise the year.
 *
 * Writes public/timler/<era>.json — the photos of one era, as rows:
 *
 *   { "fields": [...], "photos": [["File.jpg", "1939-09-01", 0, 312, "en label", …], …] }
 *
 * Requests go one at a time, identify themselves and back off when told to,
 * as Wikimedia's API etiquette asks: https://www.mediawiki.org/wiki/API:Etiquette
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UA = 'DarhaalGames-Timler/1.0 (https://games.okhten.com; photo pool builder)';
const PAUSE_MS = 300;
const FIRST_YEAR = 1839;
const LAST_YEAR = new Date().getFullYear();
/** The eras of the lobby, by the year a photo was taken. */
const ERAS = [
  ['before1900', FIRST_YEAR, 1899],
  ['1900-1945', 1900, 1945],
  ['1946-2000', 1946, 2000],
  ['since2001', 2001, LAST_YEAR]
];

const ALWAYS_OUT = /corps|dead bod|death|execut|massacre|genocid|atrocit|lynch|beheading|mass grave|murder|mutilat|autopsy|gore|wounded|injur|blood|victims|casualt|torture|suicide|hanging|убит|казн|трупы|резня|расстрел/i;
const ADULT = /\bwar\b|wars\b|battle|combat|bombing|bomb|attack|shooting|terror|invasion|siege|riot|military operation|offensive|airstrike|explosion|disaster|earthquake|tsunami|crash|derail|shipwreck|sinking|fire\b|wildfire|holocaust|concentration camp|ghetto|nazi|nude|nudity|naked|erotic|weapon|война|битва|сражение|штурм|бомбардир|теракт|катастроф|землетрясен|концлагер/i;
/** Studio portraits and crops of them: a face says little about a year. */
const PORTRAIT = /portrait|porträt|portret|headshot|\(cropped\)|cropped\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

/**
 * Answers kept on disk for a day, so a build cut short by the network picks
 * up where it stopped instead of asking Wikimedia everything again.
 * Under node_modules/.cache, which git ignores.
 */
const CACHE = path.join('node_modules', '.cache', 'timler-pool');
const CACHE_HOURS = 24;
fs.mkdirSync(CACHE, { recursive: true });
const cacheFile = (url) => path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex'));
function cached(url) {
  const f = cacheFile(url);
  if (!fs.existsSync(f) || Date.now() - fs.statSync(f).mtimeMs > CACHE_HOURS * 3_600_000) return null;
  return fs.readFileSync(f, 'utf8');
}
const remember = (url, text) => fs.writeFileSync(cacheFile(url), text);

const BUDGET_MS = Number(process.env.POOL_BUDGET_MIN ?? 0) * 60_000;
const startedAt = Date.now();
/** Before asking the network: out of this run's time, stop — the cache keeps what is done. */
function withinBudget() {
  if (BUDGET_MS && Date.now() - startedAt > BUDGET_MS) {
    console.log(`out of time after ${requests} requests — run again to carry on`);
    process.exit(3);
  }
}

/** fetch, with a dropped connection retried like a 503 rather than ending the build. */
async function fetchRetrying(url, init, tries = 6) {
  withinBudget();
  for (let attempt = 0; ; attempt++) {
    try {
      // A stalled connection is given up on after 30 s, not the default five minutes.
      return await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      if (attempt >= tries - 1) throw e;
      console.log(`  ${e.cause?.code ?? e.name ?? e.message} — again in ${5 * 2 ** attempt}s`);
      await sleep(5000 * 2 ** attempt);
    }
  }
}

async function getJson(url, init = {}, tries = 6) {
  const hit = cached(url);
  if (hit) return JSON.parse(hit);
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(PAUSE_MS);
    requests++;
    const res = await fetchRetrying(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } }, tries);
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    if (res.status === 429 || res.status >= 500) {
      const wait = Math.max(retryAfter * 1000, 5000 * 2 ** attempt);
      console.log(`  ${res.status} — waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    const body = JSON.parse(text);
    if (body.error?.code === 'maxlag') {
      await sleep(Math.max(retryAfter * 1000, 5000));
      continue;
    }
    if (body.error) throw new Error(`${body.error.code} ${body.error.info}`);
    remember(url, text);
    return body;
  }
  throw new Error(`gave up on ${url}`);
}

const api = (host, params, tries = 6) =>
  getJson(`https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params }), {}, tries);

/**
 * A SPARQL query's rows. As TSV, which is a third of the JSON: a query that
 * runs into the 60-second limit is cut off mid-answer, and a cut answer is
 * retried rather than half read.
 */
async function sparql(query) {
  const url = 'https://query.wikidata.org/sparql?' + new URLSearchParams({ query });
  for (let attempt = 0; attempt < 4; attempt++) {
    let text = cached(url);
    let ok = text !== null;
    if (!ok) {
      await sleep(PAUSE_MS);
      requests++;
      const res = await fetchRetrying(url, { headers: { 'User-Agent': UA, Accept: 'text/tab-separated-values' } });
      text = await res.text();
      ok = res.ok && !text.includes('java.util.concurrent') && !text.includes('SPARQL-QUERY');
      if (ok) remember(url, text);
    }
    if (ok) {
      const [head, ...lines] = text.trim().split('\n');
      const keys = head.split('\t').map((k) => k.replace(/^\?/, ''));
      // TSV wraps IRIs in <> and literals in quotes, with ^^type after a date.
      const value = (v) => v.replace(/^<(.*)>$/, '$1').replace(/^"(.*)"(\^\^.*|@.*)?$/, '$1');
      return lines.filter(Boolean).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [keys[i], value(v)])));
    }
    console.log(`  query cut off or refused — again in ${10 * (attempt + 1)}s`);
    await sleep(10_000 * (attempt + 1));
  }
  throw new Error('SPARQL gave up');
}

/** Year ranges small enough for one query each. */
const SLICES = [
  [1839, 1900], [1900, 1930], [1930, 1946], [1946, 1970], [1970, 1985], [1985, 1995], [1995, 2000],
  [2000, 2004], [2004, 2007], [2007, 2010], [2010, 2012], [2012, 2014], [2014, 2016], [2016, 2018],
  [2018, 2020], [2020, 2022], [2022, 2024], [2024, 2027]
];
const inSlice = ([from, to]) => `FILTER(?d >= "${from}-01-01T00:00:00Z"^^xsd:dateTime && ?d < "${to}-01-01T00:00:00Z"^^xsd:dateTime)`;

async function sliced(pattern) {
  const rows = [];
  for (const slice of SLICES) {
    const part = await sparql(`SELECT ?e ?d ?img ?s WHERE { ${pattern} ${inSlice(slice)} }`);
    console.log(`  ${slice[0]}–${slice[1] - 1}: ${part.length}`);
    rows.push(...part);
  }
  return rows;
}

const fileOf = (url) => decodeURIComponent(url.replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, '')).replaceAll('_', ' ');
const qid = (url) => url.replace(/^.*\//, '');
const strip = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * A Commons date field as a date: Commons writes it for people — "29 April
 * 1941", "November 1989", "2014-07-13 18:02:11" — and, when it was entered as
 * structured data, also as "date QS:P571,+1941-04-29T00:00:00Z/11" (11 = day,
 * 10 = month, 9 = year). Returns [year, month, day] with what is known, or null.
 */
function parseCommonsDate(raw) {
  if (!raw) return null;
  const qs = raw.match(/QS:P\d+,\+(\d{4})-(\d{2})-(\d{2})T[^/]*\/(\d+)/);
  if (qs) {
    const [, y, m, d, p] = qs.map(Number);
    return p >= 11 ? [y, m, d] : p === 10 ? [y, m, null] : p === 9 ? [y, null, null] : null;
  }
  const text = strip(raw);
  // A range ("between 1860 and 1875", "1910s", "circa") is no answer to give.
  if (/between|circa|\bca\.|\bc\.|ок\.|\d0s\b|\bor\b|–|—|\d{4}\s*-\s*\d{4}/i.test(text)) return null;
  const iso = text.match(/^(\d{4})(?:[-:](\d{2})(?:[-:](\d{2}))?)?/);
  if (iso) return [Number(iso[1]), iso[2] ? Number(iso[2]) : null, iso[3] ? Number(iso[3]) : null];
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const human = text.toLowerCase().match(/^(?:(\d{1,2})\s+)?([a-z]+)\s+(\d{4})$/);
  if (human && months.includes(human[2])) return [Number(human[3]), months.indexOf(human[2]) + 1, human[1] ? Number(human[1]) : null];
  const year = text.match(/^(\d{4})$/);
  return year ? [Number(year[1]), null, null] : null;
}

// ------------------------------------------------------------- candidates --

console.log('Wikidata: events with a picture and a date');
const events = await sliced('?e wdt:P585 ?d; wdt:P18 ?img; wikibase:sitelinks ?s. FILTER(?s >= 8)');
console.log(`  ${events.length}`);

console.log('Wikidata: photographs with a date');
const photographs = await sliced('?e wdt:P31 wd:Q125191; wdt:P571 ?d; wdt:P18 ?img; wikibase:sitelinks ?s.');
console.log(`  ${photographs.length}`);

/** file → { item, eventYear, sitelinks, kind } — the first claim on a file wins. */
const candidates = new Map();
for (const [rows, kind] of [[events, 'event'], [photographs, 'photograph']]) {
  for (const r of rows) {
    const year = Number(r.d.slice(0, 4));
    if (!(year >= FIRST_YEAR && year <= LAST_YEAR)) continue;
    const file = fileOf(r.img);
    if (!/\.jpe?g$/i.test(file) || candidates.has(file)) continue;
    // A museum's print nobody has written about is rarely worth a round —
    // and Commons is slow to describe the tens of thousands of them.
    if (kind === 'photograph' && Number(r.s) < 1) continue;
    candidates.set(file, { item: qid(r.e), eventYear: year, sitelinks: Number(r.s), kind });
  }
}
console.log(`${candidates.size} JPEG candidates`);

// ------------------------------------------------------ the files on Commons --

/**
 * Pass one, for every candidate: what the file is and when it was made —
 * imageinfo only, which answers fifty files in one request.
 */
async function commonsDates(files) {
  const out = new Map();
  // Some file makes Commons hang over its metadata: a batch that does not
  // answer is split in two until the file that hangs stands alone, and is
  // left out.
  const fetchBatch = async (batch) => {
    let body;
    try {
      body = await api('commons.wikimedia.org', {
        action: 'query', titles: batch.map((f) => `File:${f}`).join('|'), prop: 'imageinfo',
        iiprop: 'mime|extmetadata', iiextmetadatafilter: 'DateTimeOriginal|Artist|LicenseShortName'
      }, 2);
    } catch {
      if (batch.length === 1) { console.log(`  skipped, Commons does not answer for it: ${batch[0]}`); return; }
      const half = Math.ceil(batch.length / 2);
      await fetchBatch(batch.slice(0, half));
      await fetchBatch(batch.slice(half));
      return;
    }
    const normal = new Map((body.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of body.query?.pages ?? []) {
      if (p.missing || !p.imageinfo?.[0]) continue;
      out.set((normal.get(p.title) ?? p.title).replace(/^File:/, ''), { mime: p.imageinfo[0].mime, meta: p.imageinfo[0].extmetadata ?? {} });
    }
  };
  for (let i = 0; i < files.length; i += 50) {
    await fetchBatch(files.slice(i, i + 50));
    if ((i / 50) % 100 === 0) console.log(`  dates: ${Math.min(i + 50, files.length)}/${files.length}`);
  }
  return out;
}

/** Continuations a batch may take for its lists — popular files are used on hundreds of pages. */
const MAX_CONTINUES = 3;

/**
 * Pass two, only for the files that passed one: their categories (for 18+
 * and portraits) and the articles using them (for fame). A file used on
 * hundreds of pages is counted only so far — enough to rank it.
 */
async function commonsUse(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50).map((f) => `File:${f}`);
    let cont = {};
    for (let round = 0; cont && round <= MAX_CONTINUES; round++) {
      const body = await api('commons.wikimedia.org', {
        action: 'query', titles: batch.join('|'), prop: 'categories|globalusage',
        cllimit: 'max', clshow: '!hidden', gunamespace: '0', gulimit: 'max', ...cont
      });
      const normal = new Map((body.query?.normalized ?? []).map((n) => [n.to, n.from]));
      for (const p of body.query?.pages ?? []) {
        if (p.missing) continue;
        const key = (normal.get(p.title) ?? p.title).replace(/^File:/, '');
        const entry = out.get(key) ?? { categories: [], usage: new Set() };
        for (const c of p.categories ?? []) entry.categories.push(c.title.replace(/^Category:/, ''));
        for (const u of p.globalusage ?? []) entry.usage.add(`${u.wiki}:${u.title}`);
        out.set(key, entry);
      }
      cont = body.continue ?? null;
    }
    if ((i / 50) % 40 === 0) console.log(`  use: ${Math.min(i + 50, files.length)}/${files.length}`);
  }
  return out;
}

console.log('Commons: what each picture is and when it was taken');
const dates = await commonsDates([...candidates.keys()]);

const dated = [];
let notPhoto = 0, noDate = 0, otherYear = 0, portrait = 0, out = 0;
for (const [file, c] of candidates) {
  const f = dates.get(file);
  if (!f || f.mime !== 'image/jpeg') { notPhoto++; continue; }
  const date = parseCommonsDate(f.meta.DateTimeOriginal?.value);
  if (!date) { noDate++; continue; }
  // An event's picture must be from the event's year; a photograph item's
  // own date already is the photo's.
  if (c.kind === 'event' && date[0] !== c.eventYear) { otherYear++; continue; }
  if (date[0] < FIRST_YEAR || date[0] > LAST_YEAR) { otherYear++; continue; }
  if (PORTRAIT.test(file)) { portrait++; continue; }
  dated.push({ file, c, f, date });
}
console.log(`${dated.length} dated photos`);

console.log('Commons: categories and use');
const use = await commonsUse(dated.map((d) => d.file));

const kept = [];
for (const { file, c, f, date } of dated) {
  const u = use.get(file) ?? { categories: [], usage: new Set() };
  const text = `${file} ${u.categories.join(' ')}`;
  if (PORTRAIT.test(text)) { portrait++; continue; }
  if (ALWAYS_OUT.test(text)) { out++; continue; }
  kept.push({
    file, item: c.item, kind: c.kind,
    date: date[1] && date[2] ? `${date[0]}-${String(date[1]).padStart(2, '0')}-${String(date[2]).padStart(2, '0')}` : String(date[0]),
    adult: ADULT.test(text),
    fame: c.sitelinks + u.usage.size,
    author: strip(f.meta.Artist?.value).slice(0, 120),
    license: strip(f.meta.LicenseShortName?.value)
  });
}
console.log(`kept ${kept.length} — not a photo ${notPhoto}, no clear date ${noDate}, another year ${otherYear}, portraits ${portrait}, left out ${out}`);

// ------------------------------------------------- names, in both languages --

/** Labels, descriptions and article titles of the items, fifty at a time. */
async function itemNames(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const body = await api('www.wikidata.org', {
      action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'),
      props: 'labels|descriptions|sitelinks', languages: 'en|ru', sitefilter: 'enwiki|ruwiki'
    });
    for (const [id, e] of Object.entries(body.entities ?? {})) {
      out.set(id, {
        en: e.labels?.en?.value ?? null, ru: e.labels?.ru?.value ?? null,
        enDesc: e.descriptions?.en?.value ?? null, ruDesc: e.descriptions?.ru?.value ?? null,
        enwiki: e.sitelinks?.enwiki?.title ?? null, ruwiki: e.sitelinks?.ruwiki?.title ?? null
      });
    }
    if ((i / 50) % 40 === 0) console.log(`  names: ${Math.min(i + 50, ids.length)}/${ids.length}`);
  }
  return out;
}

console.log('Wikidata: names');
const names = await itemNames([...new Set(kept.map((k) => k.item))]);
// A photo with no name in either language cannot be explained afterwards.
const named = kept.filter((k) => { const n = names.get(k.item); return n && (n.en || n.ru); });
// One item is one answer: keep its most used picture, never the same scene twice.
const byItem = new Map();
for (const k of named.sort((a, b) => b.fame - a.fame)) if (!byItem.has(k.item)) byItem.set(k.item, k);

// ------------------------------------------------------------------ write --

const FIELDS = ['file', 'date', 'adult', 'fame', 'en', 'ru', 'enDesc', 'ruDesc', 'enwiki', 'ruwiki', 'author', 'license'];
const dir = path.join('public', 'timler');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
for (const [era, from, to] of ERAS) {
  const photos = [...byItem.values()]
    .filter((k) => { const y = Number(k.date.slice(0, 4)); return y >= from && y <= to; })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((k) => {
      const n = names.get(k.item);
      return [k.file, k.date, k.adult ? 1 : 0, k.fame, n.en, n.ru, n.enDesc, n.ruDesc, n.enwiki, n.ruwiki, k.author, k.license];
    });
  const days = photos.filter((p) => p[1].length === 10).length;
  const adult = photos.filter((p) => p[2]).length;
  console.log(`${era}: ${photos.length} photos (${photos.length - adult} without 18+, ${days} with a day)`);
  fs.writeFileSync(path.join(dir, `${era}.json`), JSON.stringify({ fields: FIELDS, photos }));
}
console.log(`done — ${requests} requests`);
