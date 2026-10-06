import { byFame } from '@/data/difficulty';
import type { TimlerPhoto, TimlerState } from '@/types/timler';
import { MEDIUM_ERAS, mediaOf, roomEra, type PoolEra, type PoolMedium } from './eras';

/**
 * Timler's pool — docs/timler-spec.md, sections 7 and 13. Built ahead by
 * scripts/timler-pool.mjs (photos) and scripts/timler-paintings.mjs into
 * public/timler/<medium>/<era>.json; only the host loads a file, when it
 * draws a round's picture. The pictures themselves come straight from
 * Wikimedia Commons to each player's browser.
 */

/** public/timler/<medium>/<era>.json: column names, then one row per picture. */
interface PoolFile {
  /** "painting" in the painting files. */
  kind?: string;
  fields: string[];
  photos: Array<Array<string | number | null>>;
}

export function readPool(file: PoolFile): TimlerPhoto[] {
  const at = (name: string) => file.fields.indexOf(name);
  const col = Object.fromEntries(['file', 'date', 'adult', 'fame', 'en', 'ru', 'enDesc', 'ruDesc', 'enwiki', 'ruwiki', 'author', 'license', 'creatorEn', 'creatorRu']
    .map((name) => [name, at(name)]));
  const painting = file.kind === 'painting';
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
    license: text(row, 'license') ?? '',
    ...(painting ? { kind: 'painting' as const, creator: { ru: text(row, 'creatorRu'), en: text(row, 'creatorEn') } } : {})
  }));
}

const loaded = new Map<string, Promise<TimlerPhoto[]>>();

function loadFile(medium: PoolMedium, era: PoolEra): Promise<TimlerPhoto[]> {
  const key = `${medium}/${era}`;
  let photos = loaded.get(key);
  if (!photos) {
    photos = fetch(`/timler/${key}.json`)
      .then((res) => (res.ok ? res.json() : { fields: [], photos: [] }))
      .then((file: PoolFile) => readPool(file))
      .catch(() => []);
    // A failed load is forgotten, so the next draw tries again.
    photos.then((list) => { if (list.length === 0) loaded.delete(key); });
    loaded.set(key, photos);
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
  const allowed = photos.filter((p) => (settings.adultOnly ? p.adult : settings.adult || !p.adult));
  return byFame(allowed, (p) => p.fame, settings.difficulty).filter((p) => !played.has(p.file));
}

/**
 * A round's picture. "Both" takes photos or paintings at even odds, then
 * "all time" a random era of that medium, so each turns up as often as the
 * others however many pictures it has; an era one medium does not have is
 * the other's. Null only when the pool cannot be loaded or every picture has
 * been shown.
 */
export async function pickPhoto(settings: TimlerState['settings'], played: ReadonlySet<string>): Promise<TimlerPhoto | null> {
  const era = roomEra(settings.era);
  for (const medium of shuffled(mediaOf(settings.medium))) {
    const eras = era === 'all' ? shuffled(MEDIUM_ERAS[medium]) : MEDIUM_ERAS[medium].filter((e) => e === era);
    for (const e of eras) {
      const options = eligible(await loadFile(medium, e), settings, played);
      if (options.length > 0) return options[Math.floor(Math.random() * options.length)];
    }
  }
  return null;
}

// ------------------------------------------------------------------ links --

/** The picture, scaled by Commons to the width asked — originals run to tens of megabytes. */
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
