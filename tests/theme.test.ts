import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The dark theme works by redefining colour tokens (src/app/globals.css), so
 * it reaches only what is written with them. A hard-coded design colour in a
 * class — `bg-[#F8FAFC]`, `text-[#1A1F26]`, a solid `bg-white` — stays light
 * in the dark theme. These checks keep new code on the tokens.
 */

const ROOT = path.resolve(__dirname, '..');
// Open Graph images are rendered on the server as pictures, always light
const SKIP = [/opengraph-image\.tsx$/, /[\\/]lib[\\/]og\.tsx$/];

function sources(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !SKIP.some((r) => r.test(p))) out.push(p);
  }
  return out;
}

const files = sources(path.join(ROOT, 'src')).map((p) => ({
  name: path.relative(ROOT, p).replaceAll('\\', '/'),
  code: fs.readFileSync(p, 'utf8'),
}));

// A line marked `keep-white` is white on purpose in both themes (a mark on a seat colour)
const offenders = (re: RegExp) =>
  files.flatMap(({ name, code }) =>
    code.split(/\r?\n/).flatMap((line, i) => (re.test(line) && !line.includes('keep-white') ? [`${name}:${i + 1}`] : []))
  );

describe('theme tokens', () => {
  it('no design colour is written as a hex class', () => {
    // page, surface, line, divider, ink, muted, accent — use the token utilities
    expect(offenders(/-\[#(F8FAFC|E6E1DC|F1F5F9|1A1F26|8A9099|9E1316|F5F5F0|F4F3F0|B5B3AD)\]/i)).toEqual([]);
  });

  it('a surface is bg-surface, not a solid bg-white', () => {
    // Faint white (under /50) over a coloured fill is a highlight and stays white
    expect(offenders(/(?<![\w-])((?:[a-z-]+:)*)(bg|border|ring|ring-offset|from|via|to)-white(?!\/([1-9]|[1-4]\d)\b)(?![\w-])/)).toEqual([]);
  });

  it('every token the components use is defined for both themes', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
    const light = css.match(/:root\s*\{\s*color-scheme: light;([^}]*)\}/)?.[1] ?? '';
    const dark = css.match(/\.dark\s*\{([^}]*)\}/)?.[1] ?? '';
    for (const token of ['page', 'surface', 'line', 'divider', 'ink', 'on-ink', 'muted', 'faded', 'accent', 'warm', 'scrim', 'shade', 'night']) {
      expect(css).toContain(`--color-${token}: var(--${token});`);
      expect(light).toContain(`--${token}:`);
      expect(dark).toContain(`--${token}:`);
    }
  });

  it('the theme is applied before the first paint', () => {
    const layout = fs.readFileSync(path.join(ROOT, 'src/app/layout.tsx'), 'utf8');
    expect(layout).toContain('THEME_SCRIPT');
    expect(layout).toContain('suppressHydrationWarning');
  });
});
