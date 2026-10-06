/**
 * Builds Timler's painting pool — docs/timler-spec.md, section 13.
 *
 *   node scripts/timler-paintings.mjs
 *
 * POOL_BUDGET_MIN=9 makes a run stop cleanly after nine minutes with exit
 * code 3; answers are cached on disk, so the next run carries on.
 *
 * Candidates come from Wikidata, through QLever (the Query Service times out
 * on a million paintings): paintings with a picture, on two or more
 * Wikipedias, whose date of creation is a year or a day — not "circa", not a
 * range, not two different years. Each picture is then checked on Commons:
 * it must be an image, and its categories, with what Wikidata says the
 * painting depicts, decide what is 18+ and what never goes in.
 *
 * Writes public/timler/paintings/<era>.json, rows as the photo pool's plus
 * the painter's name in both languages, under "kind": "painting".
 */
import path from 'node:path';
import { commonsInfo, commonsUse, fileOf, qid, qlever, requestCount, strip, writePool } from './lib/wikimedia.mjs';

const FIRST_YEAR = 1300;
/**
 * Paintings stop at 1945: Commons may only host free files, so later ones are
 * few — 44 on two or more Wikipedias when this was written, too few for an era.
 */
const LAST_YEAR = 1945;
/** The painting eras of the lobby (src/lib/timler/eras.ts). */
const ERAS = [
  ['before1600', FIRST_YEAR, 1599],
  ['1600-1799', 1600, 1799],
  ['1800-1899', 1800, 1899],
  ['1900-1945', 1900, 1945]
];
const MIN_WIKIPEDIAS = 2;

/**
 * Never, 18+ or not: gore, severed heads, torture, the killing of children.
 * Classical art has a lot of it, and "not too hard" (section 8) holds for
 * paintings as for photos.
 */
const ALWAYS_OUT = /behead|decapitat|severed head|head of (saint |st\.? )?john the baptist|head of holofernes|\bjudith\b|salome|flay|skinned|cannibal|devour|tortur|gore\b|blood|disembowel|dismember|mutilat|massacre of the innocents|slaughter of the innocents|anatomy lesson|autopsy|обезглав|отрубленн|пытк|избиение младенцев/i;
/**
 * 18+: nudity — mythology is mostly nudes, so its usual scenes count too —
 * war and battle, death and dying, martyrdom, violence.
 */
const ADULT = /\bnud(e|es|ity)\b|naked|nakedness|erotic|breast|venus|bather|bathing|odalisque|nymph|satyr|bacchan|three graces|judge?ment of paris|psyche|\bdiana\b|callisto|galatea|andromeda|нимф|вакханал|\bleda\b|dana[eë]|susanna|bathsheba|adam and eve|\bwar\b|battle|siege|combat|execution|death|dead (christ|body|bodies|man|men|woman|women|soldier|child|toreador)|dying|corpse|cadaver|crucifi|deposition|lamentation|entombment|piet[aà]\b|martyr|murder|suicide|shipwreck|massacre|\brape\b|abduction|violence|killing|hell\b|inferno|last judgment|обнаж|нагая|битва|сражение|казнь|смерть|распят|убийств/i;

/**
 * Whether a file's name doubts the date: "1432 ca.", a short range like
 * "1413-15", or another year close to it ("1328" for 1327). A painter's life
 * — "(ca. 1406 - 1469)" — and far-off years (a theft, an inventory number)
 * are not doubts. The game asks for one year; a painting dated two ways
 * would mark a right answer wrong.
 */
function nameDoubts(file, year) {
  let name = file.replace(/\.[a-z]+$/i, '');
  for (const m of name.matchAll(/(?:\b(?:ca|c)\.?\s*)?(1[3-9]\d\d)\s*[-–]\s*(1[3-9]\d\d|\d{2})(?!\d)/gi)) {
    const from = Number(m[1]);
    const to = m[2].length === 2 ? Number(m[1].slice(0, 2) + m[2]) : Number(m[2]);
    if (to > from && to - from < 20) return true;
    name = name.replace(m[0], ' ');
  }
  if (/\b(ca|circa|c)\.?\s*1[3-9]\d\d|1[3-9]\d\d\s*,?\s*(ca|circa)\b|\bcirca\b/i.test(name)) return true;
  const years = [...name.matchAll(/(?<!\d)(1[3-9]\d\d)(?!\d)/g)].map((m) => Number(m[1]));
  return years.some((y) => y !== year && Math.abs(y - year) <= 30);
}

/**
 * Paintings on enough Wikipedias, as a subquery the queries below share.
 * The count is filtered outside: QLever's HAVING kept about one in seven.
 */
const FAMOUS = `{ SELECT ?e (COUNT(DISTINCT ?sl) AS ?w) WHERE {
    ?e wdt:P31 wd:Q3305213 .
    ?sl schema:about ?e . ?sl schema:isPartOf ?site . ?site wikibase:wikiGroup "wikipedia" .
  } GROUP BY ?e }
  FILTER(?w >= ${MIN_WIKIPEDIAS})`;

// ------------------------------------------------------------- candidates --

console.log('Wikidata (QLever): paintings with a picture and a date');
const rows = await qlever(`SELECT ?e ?w ?img ?d ?p ?circa ?early ?late ?creator WHERE {
  ${FAMOUS}
  ?e wdt:P18 ?img .
  # Every statement, deprecated ones too: a deprecated date that disagrees
  # leaves the painting out, which is the safe side. (A rank filter here
  # keeps almost nothing on QLever.)
  ?e p:P571 ?st .
  ?st psv:P571 ?v . ?v wikibase:timePrecision ?p . ?v wikibase:timeValue ?d .
  OPTIONAL { ?st pq:P1480 ?circa }
  OPTIONAL { ?st pq:P1319 ?early }
  OPTIONAL { ?st pq:P1326 ?late }
  OPTIONAL { ?e wdt:P170 ?creator }
}`);
console.log(`  ${rows.length} rows`);

/** item → everything Wikidata says about its date, its pictures and its painter. */
const items = new Map();
for (const r of rows) {
  const id = qid(r.e);
  const item = items.get(id) ?? { id, wikis: Number(r.w), files: new Set(), creators: new Set(), dates: new Map() };
  item.files.add(fileOf(r.img));
  if (r.creator) item.creators.add(qid(r.creator));
  // One date statement may come back several times, once per picture or painter.
  item.dates.set(`${r.d}|${r.p}`, { iso: r.d, precision: Number(r.p), vague: Boolean(r.circa || r.early || r.late) });
  items.set(id, item);
}

const candidates = [];
let vague = 0, disagree = 0, outside = 0, noImage = 0, doubted = 0;
for (const item of items.values()) {
  const dates = [...item.dates.values()];
  if (dates.some((d) => d.vague || d.precision < 9)) { vague++; continue; }
  const years = new Set(dates.map((d) => Number(d.iso.slice(0, 4))));
  if (years.size !== 1) { disagree++; continue; }
  const year = [...years][0];
  if (year < FIRST_YEAR || year > LAST_YEAR) { outside++; continue; }
  const file = [...item.files].sort().find((f) => /\.(jpe?g|png|tiff?)$/i.test(f));
  if (!file) { noImage++; continue; }
  if (nameDoubts(file, year)) { doubted++; continue; }
  // The day only when the one statement there is knows it.
  const date = dates.length === 1 && dates[0].precision >= 11 ? dates[0].iso.slice(0, 10) : String(year);
  candidates.push({ item: item.id, file, date, wikis: item.wikis, creators: [...item.creators].sort() });
}
console.log(`${candidates.length} candidates — vague date ${vague}, dates disagree ${disagree}, outside ${FIRST_YEAR}–${LAST_YEAR} ${outside}, no image ${noImage}, the file name doubts the date ${doubted}`);

console.log('Wikidata (QLever): what they depict, and their genre');
const subjectRows = await qlever(`SELECT ?e ?l WHERE {
  ${FAMOUS}
  { ?e wdt:P180 ?x } UNION { ?e wdt:P136 ?x }
  ?x rdfs:label ?l . FILTER(LANG(?l) = "en")
}`);
const subjects = new Map();
for (const r of subjectRows) {
  const id = qid(r.e);
  subjects.set(id, `${subjects.get(id) ?? ''} ${r.l}`);
}

// ------------------------------------------------------ the files on Commons --

console.log('Commons: what each file is');
const info = await commonsInfo(candidates.map((c) => c.file), 'LicenseShortName');
const images = candidates.filter((c) => /^image\/(jpeg|png|tiff)$/.test(info.get(c.file)?.mime ?? ''));
console.log(`${images.length} images`);

console.log('Commons: categories and use');
const use = await commonsUse(images.map((c) => c.file));

// ------------------------------------------------- names, in both languages --

/**
 * Labels, descriptions and article titles in English and Russian, for the
 * paintings (`?e`) or their painters (`?x`) — from QLever too, which does
 * not stop answering while Wikidata's own API waits out replication lag.
 */
async function names(target) {
  const rows = await qlever(`SELECT ?x ?en ?ru ?enDesc ?ruDesc ?enwiki ?ruwiki WHERE {
    ${FAMOUS}
    ${target === 'painters' ? '?e wdt:P170 ?x .' : 'BIND(?e AS ?x)'}
    OPTIONAL { ?x rdfs:label ?en . FILTER(LANG(?en) = "en") }
    OPTIONAL { ?x rdfs:label ?ru . FILTER(LANG(?ru) = "ru") }
    OPTIONAL { ?x schema:description ?enDesc . FILTER(LANG(?enDesc) = "en") }
    OPTIONAL { ?x schema:description ?ruDesc . FILTER(LANG(?ruDesc) = "ru") }
    OPTIONAL { ?a schema:about ?x . ?a schema:isPartOf <https://en.wikipedia.org/> . ?a schema:name ?enwiki }
    OPTIONAL { ?b schema:about ?x . ?b schema:isPartOf <https://ru.wikipedia.org/> . ?b schema:name ?ruwiki }
  }`);
  const out = new Map();
  for (const r of rows) {
    const id = qid(r.x);
    if (out.has(id)) continue;
    const v = (k) => (r[k] ? r[k].replace(/\\"/g, '"') : null);
    out.set(id, { en: v('en'), ru: v('ru'), enDesc: v('enDesc'), ruDesc: v('ruDesc'), enwiki: v('enwiki'), ruwiki: v('ruwiki') });
  }
  return out;
}

console.log('Wikidata (QLever): names of the paintings and the painters');
const paintingNames = await names('paintings');
const painterNames = await names('painters');
console.log(`  ${paintingNames.size} paintings, ${painterNames.size} painters`);

const kept = [];
let out = 0, unnamed = 0;
const seenFiles = new Set();
for (const c of images) {
  const n = paintingNames.get(c.item);
  // A painting with no name in either language cannot be explained afterwards.
  if (!n || !(n.en || n.ru)) { unnamed++; continue; }
  if (seenFiles.has(c.file)) continue;
  seenFiles.add(c.file);
  const u = use.get(c.file) ?? { categories: [], usage: new Set() };
  const text = `${c.file} ${n.en ?? ''} ${n.ru ?? ''} ${subjects.get(c.item) ?? ''} ${u.categories.join(' ')}`;
  if (ALWAYS_OUT.test(text)) { out++; continue; }
  // Two painters is usually a workshop, sometimes vandalism (an actor as
  // Kandinsky's co-author): the one the description or the file names wins.
  const said = `${c.file} ${n.enDesc ?? ''} ${n.ruDesc ?? ''}`.toLowerCase();
  const named = (id) => [painterNames.get(id)?.en, painterNames.get(id)?.ru]
    .some((name) => name && said.includes(name.split(/[\s,]+/).filter(Boolean).at(-1).toLowerCase()));
  const creator = c.creators.length > 1 ? c.creators.find(named) ?? c.creators[0] : c.creators[0];
  const painter = creator ? painterNames.get(creator) : null;
  kept.push({
    ...c, n,
    adult: ADULT.test(text),
    fame: c.wikis + u.usage.size,
    creatorEn: painter?.en ?? null,
    creatorRu: painter?.ru ?? null,
    license: strip(info.get(c.file)?.meta.LicenseShortName?.value)
  });
}
console.log(`kept ${kept.length} — no name ${unnamed}, left out ${out}`);

// ------------------------------------------------------------------ write --

const FIELDS = ['file', 'date', 'adult', 'fame', 'en', 'ru', 'enDesc', 'ruDesc', 'enwiki', 'ruwiki', 'author', 'license', 'creatorEn', 'creatorRu'];
for (const [era, from, to] of ERAS) {
  const paintings = kept
    .filter((k) => { const y = Number(k.date.slice(0, 4)); return y >= from && y <= to; })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((k) => [k.file, k.date, k.adult ? 1 : 0, k.fame, k.n.en, k.n.ru, k.n.enDesc, k.n.ruDesc, k.n.enwiki, k.n.ruwiki, '', k.license, k.creatorEn, k.creatorRu]);
  const adult = paintings.filter((p) => p[2]).length;
  console.log(`${era}: ${paintings.length} paintings (${paintings.length - adult} without 18+)`);
  writePool(path.join('public', 'timler', 'paintings', `${era}.json`), FIELDS, paintings, { kind: 'painting' });
}
console.log(`done — ${requestCount()} requests`);
