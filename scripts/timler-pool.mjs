/**
 * Builds Timler's photo pool — docs/timler-spec.md, section 7. The paintings
 * have their own builder, scripts/timler-paintings.mjs.
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
 * Writes public/timler/photos/<era>.json — the photos of one era, as rows:
 *
 *   { "fields": [...], "photos": [["File.jpg", "1939-09-01", 0, 312, "en label", …], …] }
 */
import path from 'node:path';
import { commonsInfo, commonsUse, fileOf, itemNames, qid, requestCount, sparql, strip, writePool } from './lib/wikimedia.mjs';

const FIRST_YEAR = 1839;
const LAST_YEAR = new Date().getFullYear();
/** The photo eras of the lobby (src/lib/timler/eras.ts), by the year a photo was taken. */
const ERAS = [
  ['1800-1899', FIRST_YEAR, 1899],
  ['1900-1945', 1900, 1945],
  ['1946-2000', 1946, 2000],
  ['since2001', 2001, LAST_YEAR]
];

const ALWAYS_OUT = /corps|dead bod|death|execut|massacre|genocid|atrocit|lynch|beheading|mass grave|murder|mutilat|autopsy|gore|wounded|injur|blood|victims|casualt|torture|suicide|hanging|убит|казн|трупы|резня|расстрел/i;
const ADULT = /\bwar\b|wars\b|battle|combat|bombing|bomb|attack|shooting|terror|invasion|siege|riot|military operation|offensive|airstrike|explosion|disaster|earthquake|tsunami|crash|derail|shipwreck|sinking|fire\b|wildfire|holocaust|concentration camp|ghetto|nazi|nude|nudity|naked|erotic|weapon|война|битва|сражение|штурм|бомбардир|теракт|катастроф|землетрясен|концлагер/i;
/** Studio portraits and crops of them: a face says little about a year. */
const PORTRAIT = /portrait|porträt|portret|headshot|\(cropped\)|cropped\b/i;

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

console.log('Commons: what each picture is and when it was taken');
const dates = await commonsInfo([...candidates.keys()]);

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

console.log('Wikidata: names');
const names = await itemNames([...new Set(kept.map((k) => k.item))]);
// A photo with no name in either language cannot be explained afterwards.
const named = kept.filter((k) => { const n = names.get(k.item); return n && (n.en || n.ru); });
// One item is one answer: keep its most used picture, never the same scene twice.
const byItem = new Map();
for (const k of named.sort((a, b) => b.fame - a.fame)) if (!byItem.has(k.item)) byItem.set(k.item, k);

// ------------------------------------------------------------------ write --

const FIELDS = ['file', 'date', 'adult', 'fame', 'en', 'ru', 'enDesc', 'ruDesc', 'enwiki', 'ruwiki', 'author', 'license'];
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
  writePool(path.join('public', 'timler', 'photos', `${era}.json`), FIELDS, photos);
}
console.log(`done — ${requestCount()} requests`);
