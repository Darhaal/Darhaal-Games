import { FIRST_PAINTING_YEAR, FIRST_YEAR, LAST_PAINTING_YEAR } from '@/lib/gameLogic/timler';
import type { TimlerEra, TimlerMedium, TimlerPhoto } from '@/types/timler';

/**
 * Timler's eras and what each medium has in them — docs/timler-spec.md,
 * sections 6 and 13. Pure data, shared by the lobby options, the pool and
 * the answer slider.
 */

export type PoolEra = Exclude<TimlerEra, 'all'>;
export type PoolMedium = Exclude<TimlerMedium, 'both'>;

const THIS_YEAR = new Date().getFullYear();

/** The years of each era. */
export const ERA_YEARS: Record<PoolEra, [number, number]> = {
  before1600: [FIRST_PAINTING_YEAR, 1599],
  '1600-1799': [1600, 1799],
  '1800-1899': [1800, 1899],
  '1900-1945': [1900, 1945],
  '1946-2000': [1946, 2000],
  since2001: [2001, THIS_YEAR]
};

/** The eras each medium has pictures from — one pool file each, public/timler/<medium>/<era>.json. */
export const MEDIUM_ERAS: Record<PoolMedium, readonly PoolEra[]> = {
  photos: ['1800-1899', '1900-1945', '1946-2000', 'since2001'],
  paintings: ['before1600', '1600-1799', '1800-1899', '1900-1945']
};

/** The years a medium's pictures can be from. */
export const MEDIUM_YEARS: Record<PoolMedium, [number, number]> = {
  photos: [FIRST_YEAR, THIS_YEAR],
  paintings: [FIRST_PAINTING_YEAR, LAST_PAINTING_YEAR]
};

/** The media a room's setting draws from. */
export const mediaOf = (medium: TimlerMedium | undefined): PoolMedium[] =>
  medium === 'both' ? ['photos', 'paintings'] : medium === 'paintings' ? ['paintings'] : ['photos'];

/** Whether the lobby offers an era for a medium: \`all\` always, the rest where there are pictures. */
export const eraFits = (era: TimlerEra, medium: TimlerMedium | undefined): boolean =>
  era === 'all' || mediaOf(medium).some((m) => MEDIUM_ERAS[m].includes(era));

/**
 * A room's era as it is stored. Rooms from before paintings may say
 * \`before1900\`, which was 1839–1899 — the photos of 1800–1899.
 */
export const roomEra = (era: string): TimlerEra => (era === 'before1900' ? '1800-1899' : (era as TimlerEra));

export const pictureMedium = (photo: Pick<TimlerPhoto, 'kind'>): PoolMedium => (photo.kind === 'painting' ? 'paintings' : 'photos');

/** The answer slider's range: the room's era, within the years the picture's medium can be from. */
export function answerRange(era: string, photo: Pick<TimlerPhoto, 'kind'>): [number, number] {
  const [from, to] = MEDIUM_YEARS[pictureMedium(photo)];
  const e = roomEra(era);
  if (e === 'all') return [from, to];
  const [eraFrom, eraTo] = ERA_YEARS[e];
  return eraFrom > to || eraTo < from ? [from, to] : [Math.max(from, eraFrom), Math.min(to, eraTo)];
}
