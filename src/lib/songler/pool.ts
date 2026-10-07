import { byFame } from '@/data/difficulty';
import type { SonglerCategory } from '@/data/songler/categories';
import type { SonglerSong, SonglerState } from '@/types/songler';
import { normalize } from '@/lib/gameLogic/songler';

/**
 * Songler's pool — docs/songler-spec.md, section 7. Built ahead by
 * scripts/songler-pool.mjs into public/songler/songs.json (every song once)
 * and categories.json (category → song indices). Every player loads the
 * songs, for the suggestions; the host draws from them. The audio itself is
 * fetched per round through /api/songler/preview/<id>.
 */

interface SongsFile {
  fields: string[];
  songs: Array<Array<string | number | null>>;
}

export function readSongs(file: SongsFile): SonglerSong[] {
  const at = (name: string) => file.fields.indexOf(name);
  const [id, title, artist, cover, year, rank] = ['id', 'title', 'artist', 'cover', 'year', 'rank'].map(at);
  return file.songs.map((row) => ({
    id: Number(row[id]),
    title: String(row[title]),
    artist: String(row[artist]),
    cover: typeof row[cover] === 'string' && row[cover] !== '' ? (row[cover] as string) : null,
    year: typeof row[year] === 'number' ? (row[year] as number) : null,
    rank: Number(row[rank]) || 0
  }));
}

export interface SonglerPool {
  songs: SonglerSong[];
  categories: Partial<Record<SonglerCategory, number[]>>;
}

let loading: Promise<SonglerPool> | null = null;

/** The pool, loaded once per page. A failed load is forgotten, so the next call tries again. */
export function loadPool(): Promise<SonglerPool> {
  if (!loading) {
    loading = Promise.all([
      fetch('/songler/songs.json').then((r) => (r.ok ? r.json() : { fields: [], songs: [] })),
      fetch('/songler/categories.json').then((r) => (r.ok ? r.json() : {}))
    ])
      .then(([songs, categories]: [SongsFile, SonglerPool['categories']]) => ({ songs: readSongs(songs), categories }))
      .catch(() => ({ songs: [], categories: {} }));
    loading.then((pool) => { if (pool.songs.length === 0) loading = null; });
  }
  return loading;
}

/** The songs of a category; "all" is every song in the pool. */
export function songsOf(pool: SonglerPool, category: SonglerCategory): SonglerSong[] {
  if (category === 'all') return pool.songs;
  return (pool.categories[category] ?? []).map((i) => pool.songs[i]).filter(Boolean);
}

/** The songs one draw may take from: the category's third the difficulty asks for, not yet played. */
export function eligible(songs: readonly SonglerSong[], settings: SonglerState['settings'], played: ReadonlySet<number>): SonglerSong[] {
  return byFame(songs, (s) => s.rank, settings.difficulty).filter((s) => !played.has(s.id));
}

/** A round's song, or null when the pool cannot be loaded or every song has been played. */
export async function pickSong(settings: SonglerState['settings'], played: ReadonlySet<number>): Promise<SonglerSong | null> {
  const options = eligible(songsOf(await loadPool(), settings.category), settings, played);
  return options.length ? options[Math.floor(Math.random() * options.length)] : null;
}

/**
 * What a typed name could be: the songs whose title or artist contains every
 * word typed — those whose title or artist starts with it first ("queen"
 * brings Queen's songs as well as "Queen of Hearts"), then the best known.
 * From the whole pool, not the category — the suggestions must not narrow
 * the answer.
 */
export function suggest(pool: SonglerPool, query: string, limit = 8, skip: ReadonlySet<number> = new Set()): SonglerSong[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const scored: Array<{ song: SonglerSong; starts: boolean }> = [];
  for (const song of pool.songs) {
    if (skip.has(song.id)) continue;
    const title = normalize(song.title);
    const artist = normalize(song.artist);
    const hay = `${title} ${artist}`;
    if (!words.every((w) => hay.includes(w))) continue;
    scored.push({ song, starts: title.startsWith(words[0]) || artist.startsWith(words[0]) });
  }
  return scored
    .sort((a, b) => Number(b.starts) - Number(a.starts) || b.song.rank - a.song.rank)
    .slice(0, limit)
    .map((s) => s.song);
}

// ------------------------------------------------------------------ links --

/** The album cover, from Deezer's image server. */
export const coverUrl = (cover: string | null, size = 250) =>
  cover ? `https://e-cdns-images.dzcdn.net/images/cover/${cover}/${size}x${size}-000000-80-0-0.jpg` : null;

/** The 30-second preview: our route looks up a fresh link and redirects to it. */
export const previewPath = (id: number) => `/api/songler/preview/${id}`;

/** The song on Deezer. */
export const deezerUrl = (id: number) => `https://www.deezer.com/track/${id}`;
