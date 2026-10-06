/**
 * What Timler's pool builders share: polite, cached requests to Wikidata,
 * Wikimedia Commons and the SPARQL endpoints, and the passes over Commons
 * files and Wikidata items both builders make.
 *
 * Requests go one at a time, identify themselves and back off when told to,
 * as Wikimedia's API etiquette asks: https://www.mediawiki.org/wiki/API:Etiquette
 *
 * Answers are kept on disk for a day under node_modules/.cache/timler-pool
 * (git ignores it), so a build cut short picks up where it stopped. With
 * POOL_BUDGET_MIN set, a build stops cleanly after that many minutes with
 * exit code 3; the next run carries on from the cache.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UA = 'DarhaalGames-Timler/1.0 (https://games.okhten.com; photo pool builder)';
const PAUSE_MS = 300;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;
export const requestCount = () => requests;

const CACHE = path.join('node_modules', '.cache', 'timler-pool');
const CACHE_HOURS = 24;
fs.mkdirSync(CACHE, { recursive: true });
const cacheFile = (key) => path.join(CACHE, crypto.createHash('sha1').update(key).digest('hex'));
function cached(key) {
  const f = cacheFile(key);
  if (!fs.existsSync(f) || Date.now() - fs.statSync(f).mtimeMs > CACHE_HOURS * 3_600_000) return null;
  return fs.readFileSync(f, 'utf8');
}
const remember = (key, text) => fs.writeFileSync(cacheFile(key), text);

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
async function fetchRetrying(url, init, tries = 6, timeoutMs = 30_000) {
  withinBudget();
  for (let attempt = 0; ; attempt++) {
    try {
      // A stalled connection is given up on after 30 s, not the default five minutes.
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
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
  // Replication lag on Wikidata can last minutes; a lagged answer is waited
  // out, longer each time, rather than ending the build.
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(PAUSE_MS);
    requests++;
    const res = await fetchRetrying(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } }, tries);
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    if (res.status === 429 || res.status >= 500) {
      const wait = Math.max(retryAfter * 1000, 5000 * 2 ** Math.min(attempt, 5));
      console.log(`  ${res.status} — waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    const body = JSON.parse(text);
    if (body.error?.code === 'maxlag') {
      console.log(`  maxlag (${body.error.lag ?? '?'} s) — waiting`);
      await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
      continue;
    }
    if (body.error) throw new Error(`${body.error.code} ${body.error.info}`);
    remember(url, text);
    return body;
  }
  throw new Error(`gave up on ${url}`);
}

/** A MediaWiki action API call. Keep `maxlag` as it is: it is part of every cache key. */
export const api = (host, params, tries = 6) =>
  getJson(`https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params }), {}, tries);

/** TSV wraps IRIs in <> and literals in quotes, with ^^type or @lang after them. */
function readTsv(text) {
  const [head, ...lines] = text.trim().split('\n');
  const keys = head.split('\t').map((k) => k.replace(/^\?/, ''));
  const value = (v = '') => v.replace(/^<(.*)>$/, '$1').replace(/^"(.*)"(\^\^.*|@.*)?$/, '$1');
  return lines.filter(Boolean).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [keys[i], value(v)])));
}

/**
 * A query's rows from the Wikidata Query Service. As TSV, which is a third of
 * the JSON: a query that runs into the 60-second limit is cut off mid-answer,
 * and a cut answer is retried rather than half read.
 */
export async function sparql(query) {
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
    if (ok) return readTsv(text);
    console.log(`  query cut off or refused — again in ${10 * (attempt + 1)}s`);
    await sleep(10_000 * (attempt + 1));
  }
  throw new Error('SPARQL gave up');
}

const QLEVER = 'https://qlever.dev/api/wikidata';
const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
`;

/**
 * A query's rows from QLever, the University of Freiburg's Wikidata endpoint
 * — for the questions the Query Service times out on: "every painting on two
 * or more Wikipedias" has to look at a million paintings first. Its copy of
 * Wikidata trails the live one by days, which a pool does not mind.
 */
export async function qlever(query) {
  const body = PREFIXES + query;
  for (let attempt = 0; attempt < 4; attempt++) {
    let text = cached(QLEVER + body);
    if (text === null) {
      await sleep(PAUSE_MS);
      requests++;
      const res = await fetchRetrying(QLEVER, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'text/tab-separated-values', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query: body })
      }, 6, 180_000);
      text = await res.text();
      if (!res.ok) {
        console.log(`  QLever ${res.status}: ${text.slice(0, 200)} — again in ${10 * (attempt + 1)}s`);
        await sleep(10_000 * (attempt + 1));
        continue;
      }
      remember(QLEVER + body, text);
    }
    return readTsv(text);
  }
  throw new Error('QLever gave up');
}

export const fileOf = (url) => decodeURIComponent(url.replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, '')).replaceAll('_', ' ');
export const qid = (url) => url.replace(/^.*\//, '');
export const strip = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Pass one over Commons files: what each file is, and the metadata fields
 * asked for — imageinfo only, which answers fifty files in one request.
 * Returns file → { mime, meta }.
 */
export async function commonsInfo(files, fields = 'DateTimeOriginal|Artist|LicenseShortName') {
  const out = new Map();
  // Some file makes Commons hang over its metadata: a batch that does not
  // answer is split in two until the file that hangs stands alone, and is
  // left out.
  const fetchBatch = async (batch) => {
    let body;
    try {
      body = await api('commons.wikimedia.org', {
        action: 'query', titles: batch.map((f) => `File:${f}`).join('|'), prop: 'imageinfo',
        iiprop: 'mime|extmetadata', iiextmetadatafilter: fields
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
    if ((i / 50) % 100 === 0) console.log(`  files: ${Math.min(i + 50, files.length)}/${files.length}`);
  }
  return out;
}

/** Continuations a batch may take for its lists — popular files are used on hundreds of pages. */
const MAX_CONTINUES = 3;

/**
 * Pass two over Commons files: their categories (for 18+) and the articles
 * using them (for fame). A file used on hundreds of pages is counted only so
 * far — enough to rank it. Returns file → { categories, usage }.
 */
export async function commonsUse(files) {
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

/** Labels, descriptions and article titles of Wikidata items, fifty at a time. */
export async function itemNames(ids) {
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

/** One pool file: column names, then one row per picture; `extra` goes at the top level. */
export function writePool(file, fields, rows, extra = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...extra, fields, photos: rows }));
}
