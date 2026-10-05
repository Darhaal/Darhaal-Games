import { byFame } from '@/data/difficulty';
import type { TimlerEra, TimlerPhoto, TimlerState } from '@/types/timler';

/**
 * Timler's photo pool — docs/timler-spec.md, section 7. Built ahead by
 * scripts/timler-pool.mjs into public/timler/<era>.json; only the host loads
 * a file, when it draws a round's photo. The photos themselves come straight
 * from Wikimedia Commons to each player's browser.
 */

export const POOL_ERAS = ['before1900', '1900-1945', '1946-2000', 'since2001'] as const satisfies readonly TimlerEra[];

/** public/timler/<era>.json: column names, then one row per photo. */
interface PoolFile {
  fields: string[];
  photos: Array<Array<string | number | null>>;
}

export function readPool(file: PoolFile): TimlerPhoto[] {
  const at = (name: string) => file.fields.indexOf(name);
  const col = Object.fromEntries(['file', 'date', 'adult', 'fame', 'en', 'ru', 'enDesc', 'ruDesc', 'enwiki', 'ruwiki', 'author', 'license']
    .map((name) => [name, at(name)]));
  const text = (row: PoolFile['photos'][number], name: string) => {
    const v = col[name] >= 0 ? row[col[name]] : null;
    return typeof v === 'string' && v !== '' ? v : null;
  };
  return file.photos.map((row) => ({
    file: String(row[col.file]),
    date: String(row[col.date]),
    adult: row[col.adult] === 1,
    fame: Number(row[col.fame]) || 0,
    title: { ru: text(row, 'ru'), en: text(row, 'en') },
    description: { ru: text(row, 'ruDesc'), en: text(row, 'enDesc') },
    article: { ru: text(row, 'ruwiki'), en: text(row, 'enwiki') },
    author: text(row, 'author') ?? '',
    license: text(row, 'license') ?? ''
  }));
}

const loaded = new Map<string, Promise<TimlerPhoto[]>>();

function loadEra(era: (typeof POOL_ERAS)[number]): Promise<TimlerPhoto[]> {
  let photos = loaded.get(era);
  if (!photos) {
    photos = fetch(`/timler/${era}.json`)
      .then((res) => (res.ok ? res.json() : { fields: [], photos: [] }))
      .then((file: PoolFile) => readPool(file))
      .catch(() => []);
    // A failed load is forgotten, so the next draw tries again.
    photos.then((list) => { if (list.length === 0) loaded.delete(era); });
    loaded.set(era, photos);
  }
  return photos;
}

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The photos one draw may take from, as the room's settings allow. */
export function eligible(photos: readonly TimlerPhoto[], settings: TimlerState['settings'], played: ReadonlySet<string>): TimlerPhoto[] {
  const allowed = photos.filter((p) => settings.adult || !p.adult);
  return byFame(allowed, (p) => p.fame, settings.difficulty).filter((p) => !played.has(p.file));
}

/**
 * A round's photo. "All time" takes a random era first, so each era turns up
 * as often as the others however many photos it has. Null only when the pool
 * cannot be loaded or every photo has been shown.
 */
export async function pickPhoto(settings: TimlerState['settings'], played: ReadonlySet<string>): Promise<TimlerPhoto | null> {
  const eras = settings.era === 'all' ? shuffled(POOL_ERAS) : [settings.era];
  for (const era of eras) {
    const options = eligible(await loadEra(era), settings, played);
    if (options.length > 0) return options[Math.floor(Math.random() * options.length)];
  }
  return null;
}

// ------------------------------------------------------------------ links --

/** The photo, scaled by Commons to the width asked — originals run to tens of megabytes. */
export const imageUrl = (file: string, width = 1280) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

/** The file's page on Commons: its author, licence and history. */
export const filePage = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replaceAll(' ', '_'))}`;

export const articleUrl = (lang: 'ru' | 'en', title: string) =>
  `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;

/** Starts loading a photo before its round, so it is on screen when guessing opens. */
export function preload(photo: TimlerPhoto) {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.src = imageUrl(photo.file);
}
