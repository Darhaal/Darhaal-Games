import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eligible, readSongs, songsOf, suggest, type SonglerPool } from '@/lib/songler/pool';
import { SONGLER_CATEGORIES } from '@/data/songler/categories';
import type { SonglerState } from '@/types/songler';

/**
 * The pool in public/songler/ (docs/songler-spec.md, section 7) — built by
 * scripts/songler-pool.mjs. A rebuild that lost a category, or let a broken
 * row through, fails here and not in a room.
 */

/** A twenty-round match at the hardest setting still needs fresh songs. */
const MIN_PER_DIFFICULTY = 20;

const dir = path.join('public', 'songler');
const pool: SonglerPool = {
  songs: readSongs(JSON.parse(fs.readFileSync(path.join(dir, 'songs.json'), 'utf8'))),
  categories: JSON.parse(fs.readFileSync(path.join(dir, 'categories.json'), 'utf8'))
};
const settings = (over: Partial<SonglerState['settings']> = {}): SonglerState['settings'] =>
  ({ maxPlayers: 20, rounds: 5, roundDuration: 60, category: 'all', difficulty: 'any', ...over });

describe('the song pool (7)', () => {
  it('has every category the lobby offers, and nothing else', () => {
    expect(Object.keys(pool.categories).sort()).toEqual(SONGLER_CATEGORIES.filter((c) => c !== 'all').sort());
  });

  it('holds whole rows, each song once', () => {
    expect(pool.songs.length).toBeGreaterThan(1000);
    for (const s of pool.songs) {
      expect(Number.isInteger(s.id) && s.id > 0, String(s.id)).toBe(true);
      expect(s.title.length, String(s.id)).toBeGreaterThan(0);
      expect(s.artist.length, String(s.id)).toBeGreaterThan(0);
      if (s.year !== null) expect(s.year, `${s.title}`).toBeGreaterThan(1900);
    }
    expect(new Set(pool.songs.map((s) => s.id)).size).toBe(pool.songs.length);
  });

  it('points every category at real songs', () => {
    for (const [category, indices] of Object.entries(pool.categories)) {
      for (const i of indices ?? []) expect(pool.songs[i], `${category}: ${i}`).toBeDefined();
    }
  });

  it.each(SONGLER_CATEGORIES.map((c) => [c]))('%s: enough songs at every difficulty', (category) => {
    const songs = songsOf(pool, category);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(eligible(songs, settings({ category, difficulty }), new Set()).length, `${category}/${difficulty}`).toBeGreaterThanOrEqual(MIN_PER_DIFFICULTY);
    }
  });
});

describe('suggestions', () => {
  const tiny: SonglerPool = {
    songs: [
      { id: 1, title: 'Bohemian Rhapsody', artist: 'Queen', cover: null, year: 1975, rank: 900 },
      { id: 2, title: 'Radio Ga Ga', artist: 'Queen', cover: null, year: 1984, rank: 800 },
      { id: 3, title: 'Группа крови', artist: 'Кино', cover: null, year: 1988, rank: 700 },
      { id: 4, title: 'Queen of Hearts', artist: 'Juice Newton', cover: null, year: 1981, rank: 100 }
    ],
    categories: {}
  };
  const ids = (q: string, skip?: Set<number>) => suggest(tiny, q, 8, skip).map((s) => s.id);

  it('finds a song by its title or its artist, those that start with it first, then the best known', () => {
    expect(ids('queen')).toEqual([1, 2, 4]);
    expect(ids('hearts')).toEqual([4]);
    expect(ids('кино')).toEqual([3]);
    expect(ids('rhaps')).toEqual([1]);
  });

  it('wants every word typed, ignoring case and accents', () => {
    expect(ids('ga queen')).toEqual([2]);
    expect(ids('ГРУППА')).toEqual([3]);
  });

  it('leaves out the songs already tried', () => {
    expect(ids('queen', new Set([4, 1]))).toEqual([2]);
  });
});
