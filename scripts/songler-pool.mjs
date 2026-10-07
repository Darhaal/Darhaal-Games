/**
 * Builds Songler's song pool — docs/songler-spec.md, section 7.
 *
 *   node scripts/songler-pool.mjs
 *
 * Songs come from Deezer: editors' playlists for most categories, and the
 * most popular tracks of named artists where Deezer has no editor (Russian,
 * Soviet and Ukrainian music). Every track is then looked up on its own for
 * the release year and to check it still has a preview.
 *
 * Writes public/songler/songs.json — every song once, as rows — and
 * public/songler/categories.json — category → indices into the songs. The
 * audio is never stored: a preview link expires in about fifteen minutes, so
 * the game asks /api/songler/preview/<id> for a fresh one each round.
 *
 * Answers are cached on disk for a day under node_modules/.cache/songler-pool.
 * Deezer allows 50 requests per 5 seconds; this stays well under.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UA = 'DarhaalGames-Songler/1.0 (https://games.okhten.com; song pool builder)';
const PAUSE_MS = 130;
const ARTIST_TOP = 8;

/**
 * Category → where its songs come from: Deezer playlist ids, or artist names
 * (their top tracks). `years`, when set, is the range a release year must fall
 * in to be shown — a remaster's or reissue's year outside it is dropped
 * rather than shown wrong. Labels live in src/data/songler/categories.ts.
 */
const CATEGORIES = {
  now: { playlists: [13650084141], chart: true },
  '1960s': { playlists: [620264073, 9002635962, 1437011185], years: [1955, 1969] },
  '1970s': { playlists: [1470022445, 8496467462, 8403499142], years: [1970, 1979] },
  '1980s': { playlists: [867825522, 1913763402, 8512471762, 8403360702], years: [1980, 1989] },
  '1990s': { playlists: [878989033, 2322259622, 8403350722, 8873744282], years: [1990, 1999] },
  '2000s': { playlists: [248297032, 1977689462, 8777319042, 8326097522], years: [2000, 2009] },
  '2010s': { playlists: [14917741483, 715215865, 8282573142], years: [2010, 2019] },
  '2020s': { playlists: [13650084141, 13681195421], years: [2020, 2099] },
  pop: { playlists: [1036183001, 1282483245] },
  rock: { playlists: [1306931615, 3126664682, 1728093421, 1419215845, 1180358611] },
  metal: { playlists: [2655390504, 761604441, 8981140762] },
  punk: { playlists: [1371750135, 861202821, 9032055402] },
  alternative: { playlists: [668126235, 8716319082, 8929584182, 5714797982] },
  hiphop: { playlists: [1976915302, 7662551722, 12547421383, 12052031251] },
  rnb: { playlists: [2021626162, 1257789321, 1950386602, 8462280522] },
  funk: { playlists: [3798795702, 12566903723, 9180883602] },
  dance: { playlists: [1902101402, 706093725, 11233152384, 8974688542] },
  latin: { playlists: [5104249748, 14648359001, 789123393, 1273315391] },
  kpop: { playlists: [4096400722, 11012274682, 9001527742] },
  country: { playlists: [1294431447, 1130102843] },
  jazz: { playlists: [1615514485, 1767932902] },
  classical: { playlists: [747148961, 7058646664, 764481841] },
  afro: { playlists: [3153080842, 10759580842] },
  movies: { playlists: [754776991, 6223140704] },
  disney: { playlists: [1962379246, 11817251201] },
  games: { playlists: [4380597982, 1050403591] },
  anime: { playlists: [9016993522, 5206929684, 11225266244] },
  eurovision: { playlists: [12593394863, 12442015903, 13580028081] },
  christmas: { playlists: [8454338222, 3833591862] },
  summer: { playlists: [4884747864, 5922972724, 6122724024] },
  french: { playlists: [1420459465, 700895155] },
  'ru-pop': {
    artists: ['Алла Пугачёва', 'Филипп Киркоров', 'Валерий Меладзе', 'Руки Вверх', 't.A.T.u.', 'ВИА Гра', 'Ёлка',
      'Полина Гагарина', 'Zivert', 'Монеточка', 'Иван Дорн', 'Сергей Лазарев', 'Дима Билан', 'NYUSHA', 'Макsим',
      'Леонид Агутин', 'Григорий Лепс', 'Ани Лорак', 'Artik & Asti', 'Макс Корж', 'Звери', 'Uma2rman', 'Ленинград',
      'SEREBRO', 'Mumiy Troll', 'HammAli & Navai', 'Jony', 'Клава Кока', 'Мот', 'Земфира']
  },
  'ru-rock': {
    artists: ['Кино', 'ДДТ', 'Ария', 'Король и Шут', 'Сплин', 'Би-2', 'Агата Кристи', 'Наутилус Помпилиус', 'Чайф',
      'Алиса', 'Пикник', 'Сектор Газа', 'Машина Времени', 'Ночные Снайперы', 'Кукрыниксы', 'Lumen', 'Louna',
      'Аквариум', 'Animal ДжаZ', 'Танцы Минус', 'Смысловые Галлюцинации', 'Земфира', 'Mumiy Troll', 'Пилот']
  },
  'ru-rap': {
    artists: ['Баста', 'Oxxxymiron', 'Скриптонит', 'Noize MC', 'Каста', 'Miyagi & Andy Panda', 'Pharaoh', 'Kizaru',
      'MORGENSHTERN', 'Big Baby Tape', 'FEDUK', 'Элджей', 'Timati', 'FACE', 'Хаски', 'Jah Khalib',
      'Miyagi & Эндшпиль', 'Макс Корж', 'Markul']
  },
  soviet: {
    artists: ['Vladimir Vysotsky', 'Муслим Магомаев', 'Лев Лещенко', 'Юрий Антонов', 'Песняры', 'Земляне', 'Самоцветы',
      'Ласковый май', 'Валерий Леонтьев', 'Иосиф Кобзон', 'Эдуард Хиль', 'Мираж', 'Кар-Мэн', 'Алла Пугачёва',
      'София Ротару', 'Машина Времени', 'Карел Готт', 'Синяя птица'],
    years: [1950, 1991]
  },
  ukrainian: {
    artists: ['Okean Elzy', 'Бумбокс', 'Jamala', 'Go_A', 'KALUSH', 'Тина Кароль', 'MONATIK', 'The Hardkiss',
      'Jerry Heil', 'alyona alyona', 'DakhaBrakha', 'Скрябін', 'Время и Стекло', 'Verka Serduchka', 'Max Barskih',
      'Друга Ріка', 'Антитіла', 'Христина Соловій', 'DOROFEEVA', 'Wellboy', 'KOLA', 'Klavdia Petrivna', 'MELOVIN',
      'TVORCHI', 'Артем Пивоваров', 'София Ротару']
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

const CACHE = path.join('node_modules', '.cache', 'songler-pool');
fs.mkdirSync(CACHE, { recursive: true });
const cacheFile = (url) => path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex'));

/** A Deezer API answer, cached; quota errors are waited out. */
async function deezer(pathAndQuery) {
  const url = `https://api.deezer.com${pathAndQuery}`;
  const f = cacheFile(url);
  if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 24 * 3_600_000) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(PAUSE_MS);
    requests++;
    let body;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      body = await res.json();
    } catch (e) {
      console.log(`  ${e.name}: ${url} — again in ${5 * (attempt + 1)}s`);
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (body.error) {
      // Quota (code 4) is temporary; anything else (no such item) is an answer.
      if (body.error.code === 4 || body.error.code === 700) { await sleep(5000 * (attempt + 1)); continue; }
      return body;
    }
    fs.writeFileSync(f, JSON.stringify(body));
    return body;
  }
  throw new Error(`gave up on ${url}`);
}

/** Every page of a list endpoint. */
async function all(pathAndQuery) {
  const out = [];
  let next = pathAndQuery + (pathAndQuery.includes('?') ? '&' : '?') + 'limit=100';
  while (next) {
    const body = await deezer(next);
    out.push(...(body.data ?? []));
    next = body.next ? body.next.replace('https://api.deezer.com', '') : null;
    if (out.length >= 400) break;
  }
  return out;
}

/** For matching: lower case, no accents, no versions ("Remastered 2011", "Live"), letters and digits only. */
export const norm = (s = '') => s
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\s*[([][^)\]]*[)\]]/g, ' ')
  .replace(/\s+-\s+.*$/, ' ')
  .replace(/ё/g, 'е')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const sameName = (a, b) => norm(a).replace(/\s/g, '') === norm(b).replace(/\s/g, '');

/** A title as shown: without the remaster note a reissue carries ("(Remastered 1994)", "- 2011 Remaster"). */
const shown = (title = '') => title
  .replace(/\s*[([][^)\]]*remaster[^)\]]*[)\]]/gi, '')
  .replace(/\s+-\s+[^-]*remaster.*$/i, '')
  .trim();

// ------------------------------------------------------------- candidates --

/** track id → the track as a playlist gives it; category → track ids. */
const tracks = new Map();
const members = new Map();
const add = (category, list) => {
  const ids = members.get(category) ?? [];
  for (const t of list) {
    if (!t?.id || !t.readable || !t.preview) continue;
    tracks.set(t.id, t);
    ids.push(t.id);
  }
  members.set(category, ids);
};

const missingArtists = [];
for (const [category, source] of Object.entries(CATEGORIES)) {
  if (source.chart) add(category, (await deezer('/chart/0/tracks?limit=100')).data ?? []);
  for (const id of source.playlists ?? []) add(category, await all(`/playlist/${id}/tracks`));
  for (const name of source.artists ?? []) {
    const found = ((await deezer(`/search/artist?limit=5&q=${encodeURIComponent(name)}`)).data ?? []).find((a) => sameName(a.name, name));
    if (!found) { missingArtists.push(`${category}: ${name}`); continue; }
    // An artist's top tracks include ones where they are only a guest or a
    // remix's source: only theirs count.
    const top = (await deezer(`/artist/${found.id}/top?limit=${ARTIST_TOP * 2}`)).data ?? [];
    add(category, top.filter((t) => t.artist?.id === found.id).slice(0, ARTIST_TOP));
  }
  console.log(`${category}: ${members.get(category)?.length ?? 0} tracks`);
}
if (missingArtists.length) console.log(`artists not found (left out): ${missingArtists.join('; ')}`);
console.log(`${tracks.size} distinct tracks`);

// ----------------------------------------------- one song per title + artist --

/**
 * The same song turns up as a single, an album track, a remaster: they are
 * one answer. Keyed by title and main artist, the most popular version kept.
 */
const keyOf = (t) => `${norm(t.title_short || t.title)}|${norm(t.artist?.name)}`;
const songs = new Map();
for (const t of tracks.values()) {
  const key = keyOf(t);
  if (!key.split('|')[0] || !key.split('|')[1]) continue;
  const have = songs.get(key);
  if (!have || (t.rank ?? 0) > (have.rank ?? 0)) songs.set(key, t);
}
console.log(`${songs.size} songs`);

// --------------------------------------------- each song: year and a preview --

console.log('Deezer: each song on its own (release year, preview)');
const details = new Map();
let done = 0;
for (const [key, t] of songs) {
  const d = await deezer(`/track/${t.id}`);
  if (!d.error) details.set(key, d);
  if (++done % 500 === 0) console.log(`  ${done}/${songs.size}`);
}

// ------------------------------------------------------------------ write --

const order = [...songs.keys()].filter((k) => details.get(k)?.readable && details.get(k)?.preview)
  .sort((a, b) => (songs.get(b).rank ?? 0) - (songs.get(a).rank ?? 0));
const index = new Map(order.map((k, i) => [k, i]));

/** The categories a song is in, for the year check below. */
const categoriesOf = new Map();
for (const [category, ids] of members) {
  for (const id of ids) {
    const k = keyOf(tracks.get(id));
    if (!index.has(k)) continue;
    categoriesOf.set(k, [...(categoriesOf.get(k) ?? []), category]);
  }
}

const FIELDS = ['id', 'title', 'artist', 'cover', 'year', 'rank'];
let yearsDropped = 0;
const rows = order.map((k) => {
  const t = songs.get(k);
  const d = details.get(k);
  let year = Number((d.release_date ?? '').slice(0, 4)) || null;
  // A remaster or a reissue carries its own year: outside any range the
  // song's categories set, it is not shown at all rather than shown wrong.
  for (const c of categoriesOf.get(k) ?? []) {
    const range = CATEGORIES[c].years;
    if (year && range && (year < range[0] || year > range[1])) { year = null; yearsDropped++; break; }
  }
  // The cover is kept as its id; the URL is built in the app.
  const cover = (t.album?.md5_image ?? d.album?.md5_image ?? '') || null;
  return [d.id, shown(d.title_short || d.title) || d.title, d.artist?.name ?? t.artist.name, cover, year, d.rank ?? t.rank ?? 0];
});

const categories = Object.fromEntries([...members].map(([c, ids]) => [
  c, [...new Set(ids.map((id) => index.get(keyOf(tracks.get(id)))).filter((i) => i !== undefined))].sort((a, b) => a - b)
]));

const dir = path.join('public', 'songler');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'songs.json'), JSON.stringify({ fields: FIELDS, songs: rows }));
fs.writeFileSync(path.join(dir, 'categories.json'), JSON.stringify(categories));
for (const [c, list] of Object.entries(categories)) console.log(`  ${c}: ${list.length}`);
console.log(`${rows.length} songs written, ${yearsDropped} years left out as doubtful — ${requests} requests`);
