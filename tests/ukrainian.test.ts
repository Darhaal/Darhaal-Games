import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * Ukrainian has no ы, э, ъ or ё. A `uk` value carrying one of them is
 * Russian that was copied in and never translated — the commonest way a
 * third language rots. The type checker already makes every `uk` exist;
 * this keeps what is in it Ukrainian.
 */

const ROOT = path.resolve(__dirname, '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const propName = (p: ts.PropertyAssignment) =>
  ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;

function ukTexts(file: string): { line: number; text: string }[] {
  const code = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && propName(node) === 'uk') {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const grab = (n: ts.Node) => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) found.push({ line, text: n.text });
        else if (ts.isTemplateExpression(n)) found.push({ line, text: n.getText(sf) });
        else ts.forEachChild(n, grab);
      };
      grab(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

// Both cases parse every source file: seconds on a busy machine, past the 5 s default.
describe('Ukrainian text', { timeout: 30_000 }, () => {
  it('has no Russian-only letters', () => {
    const offenders = sources(path.join(ROOT, 'src')).flatMap((file) =>
      ukTexts(file)
        .filter(({ text }) => /[ыЫэЭъЪёЁ]/.test(text))
        .map(({ line, text }) => `${path.relative(ROOT, file)}:${line} ${text.slice(0, 60)}`)
    );
    expect(offenders).toEqual([]);
  });

  it('exists: there is Ukrainian to check', () => {
    const count = sources(path.join(ROOT, 'src')).reduce((n, f) => n + ukTexts(f).length, 0);
    expect(count).toBeGreaterThan(5000);
  });
});
