import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Text sizes go through the scale, not through arbitrary pixels.
 *
 * `text-[10px]` cannot respond to anything — it is the same 10px on a phone
 * and on a 27" monitor, which is how a hundred captions ended up unreadable
 * on a large screen. The named tokens grow past 1280px; a literal cannot.
 */

const SOURCE = 'src';

/**
 * Glyphs sized to their container rather than to be read: skulls and crosses
 * inside a Battleship cell, and the action labels crammed onto a Coup card.
 * Growing these would burst the box they live in.
 */
const ALLOWED = new Set(['text-[7px]', 'text-[8px]']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('the type scale', () => {
  it('has no arbitrary pixel text sizes outside the few that are glyphs', () => {
    const offenders: string[] = [];

    for (const file of walk(SOURCE)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/text-\[\d+px\]/g)) {
        if (!ALLOWED.has(match[0])) {
          offenders.push(`${file}: ${match[0]}`);
        }
      }
    }

    expect(offenders, `use text-3xs / text-2xs / text-xs instead:\n${offenders.join('\n')}`)
      .toEqual([]);
  });

  it('defines the two sizes below Tailwind\u2019s smallest, and grows them on a wide screen', () => {
    const css = readFileSync(join('src', 'app', 'globals.css'), 'utf8');

    // Declared as variables, not inlined — an inlined value cannot be moved
    // by the media query below it.
    expect(css).toMatch(/@theme\s*\{[^}]*--text-2xs:/);
    expect(css).toMatch(/@theme\s*\{[^}]*--text-3xs:/);

    const wide = css.slice(css.indexOf('@media (min-width: 1280px)'));
    for (const token of ['--text-3xs', '--text-2xs', '--text-xs', '--text-sm']) {
      expect(wide, `${token} should grow on a wide screen`).toContain(token);
    }
  });
});
