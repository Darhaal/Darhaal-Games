import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { APP_VERSION, VERSION_HISTORY, formatReleaseDate, formatReleaseRange, type VersionLog } from '@/constants/version';
import { LEGACY_HISTORY } from '@/constants/versionLegacy';
import { changelogMetadata } from '@/lib/seo';

/**
 * The version history — the game's timeline (2.0 on) and the changelog page
 * (every version). Every release is its own entry, patches included, so the
 * history has to stay in order and in both languages as it grows.
 */

const all: VersionLog[] = [...VERSION_HISTORY, ...LEGACY_HISTORY];
const parts = (ver: string) => ver.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

describe('the version history', () => {
  it('starts at the current version, the one package.json and the changelog carry', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };
    expect(VERSION_HISTORY[0].ver).toBe(APP_VERSION);
    expect(pkg.version).toBe(APP_VERSION);
    expect(fs.readFileSync('CHANGELOG.md', 'utf8')).toContain(`## [${APP_VERSION}]`);
  });

  it('shows 2.0 on in the game and keeps the 1.x line for the changelog page', () => {
    expect(VERSION_HISTORY.every((v) => parts(v.ver)[0] >= 2)).toBe(true);
    expect(LEGACY_HISTORY.every((v) => parts(v.ver)[0] === 1)).toBe(true);
    expect(all[all.length - 1].ver).toBe('1.0.0');
  });

  it('runs newest first, every version once, with dates that never go forward', () => {
    for (let i = 1; i < all.length; i++) {
      expect(newer(all[i - 1].ver, all[i].ver), `${all[i - 1].ver} before ${all[i].ver}`).toBe(true);
      expect(all[i - 1].date >= all[i].date, `${all[i - 1].ver} dated after ${all[i].ver}`).toBe(true);
    }
  });

  it.each(all.map((v) => [v.ver, v] as const))('%s says something, in both languages', (_, v) => {
    expect(v.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(v.desc || v.fixes, 'a description or a list of fixes').toBeTruthy();
    if (v.desc) expect(v.desc.ru && v.desc.en).toBeTruthy();
    if (v.fixes) {
      expect(v.fixes.ru.length).toBeGreaterThan(0);
      expect(v.fixes.en.length).toBe(v.fixes.ru.length);
      expect([...v.fixes.ru, ...v.fixes.en].every((f) => f.trim().length > 0)).toBe(true);
    }
    // A release line opens with a named version; a patch rides on its line's name.
    if (v.type !== 'patch') expect(v.title?.ru && v.title?.en).toBeTruthy();
  });

  it('spells dates out without a time zone to trip on', () => {
    expect(formatReleaseDate('2026-01-27', 'ru')).toBe('27 января 2026');
    expect(formatReleaseDate('2026-09-30', 'en')).toBe('30 September 2026');
    expect(formatReleaseDate('2026-09-30', 'ru', 'short')).toBe('30 сен 2026');
    expect(formatReleaseRange('2026-09-26', '2026-09-28', 'ru')).toBe('26–28 сен 2026');
    expect(formatReleaseRange('2026-07-09', '2026-08-05', 'en')).toBe('9 Jul — 5 Aug 2026');
    expect(formatReleaseRange('2026-09-30', '2026-09-30', 'en')).toBe('30 September 2026');
  });
});

describe('the changelog page', () => {
  it('has its own address in each language and a title that fits a search result', () => {
    for (const locale of ['ru', 'en'] as const) {
      const meta = changelogMetadata(locale);
      expect(String(meta.title).length + ' · Darhaal Games'.length).toBeLessThanOrEqual(60);
      expect(String(meta.description).length).toBeLessThanOrEqual(160);
      expect(meta.alternates?.canonical).toBe(`https://games.okhten.com${locale === 'ru' ? '/ru' : ''}/changelog`);
    }
  });
});
