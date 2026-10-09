import { describe, it, expect } from 'vitest';
import {
  wordKey, tokenize, buildArticle, countContentWords, evaluateGuess, guessCost, titleSolved,
  titleGuessMatches, roundScore, initialReveal, letterCount, readingVersion, languagesNeeded,
  type Paragraph, type WordToken
} from '@/lib/gameLogic/wikiler';

/**
 * Wikiler's core rules, as agreed in docs/wikiler-spec.md (section numbers
 * in the test names).
 */

const words = (text: string, lang: 'ru' | 'en' | 'uk') =>
  tokenize(text, lang).filter((t): t is WordToken => t.kind === 'word');

describe('words and their groups (6)', () => {
  it('grammatical forms of a word share a group', () => {
    const key = wordKey('work', 'en');
    expect(['works', 'worked', 'working', 'Work'].map((w) => wordKey(w, 'en'))).toEqual([key, key, key, key]);
    const apple = wordKey('яблоко', 'ru');
    expect(['яблока', 'яблоки', 'Яблоком'].map((w) => wordKey(w, 'ru'))).toEqual([apple, apple, apple]);
  });

  it('a different word stays apart, even when it starts the same', () => {
    expect(wordKey('worker', 'en')).not.toBe(wordKey('work', 'en'));
    expect(wordKey('smither', 'en')).not.toBe(wordKey('smith', 'en'));
  });

  it('stress marks, ё and letter case do not matter', () => {
    expect(wordKey('Я́блоко', 'ru')).toBe(wordKey('яблоко', 'ru'));
    expect(wordKey('ёж', 'ru')).toBe(wordKey('еж', 'ru'));
    expect(wordKey('NEWTON', 'en')).toBe(wordKey('newton', 'en'));
  });

  it('Latin diacritics do not matter; Cyrillic letters with marks stay letters', () => {
    expect(wordKey('état', 'en')).toBe(wordKey('etat', 'en'));
    // й is its own letter, not и with a mark.
    expect(wordKey('йод', 'ru')).not.toBe(wordKey('иод', 'ru'));
  });

  it('function words and single letters are shown from the start, never guessed (2)', () => {
    for (const w of ['the', 'and', 'of', 'was', 'X']) expect(wordKey(w, 'en'), w).toBeNull();
    for (const w of ['и', 'в', 'который', 'её', 'ещё', 'я']) expect(wordKey(w, 'ru'), w).toBeNull();
  });

  it('counts letters for the hint on a hidden word', () => {
    expect(letterCount('Newton')).toBe(6);
    expect(letterCount('Я́блоко')).toBe(6);
  });
});

describe('Ukrainian articles', () => {
  it('grammatical forms of a word share a group', () => {
    const city = wordKey('місто', 'uk');
    expect(['міста', 'містом', 'Містами'].map((w) => wordKey(w, 'uk'))).toEqual([city, city, city]);
  });

  it('a word with an apostrophe is one word, however the apostrophe is written', () => {
    expect(words("м'яч", 'uk').map((w) => w.text)).toEqual(["м'яч"]);
    const ball = wordKey("м'яч", 'uk');
    expect(['м’яча', 'мʼячем', "М'яч"].map((w) => wordKey(w, 'uk'))).toEqual([ball, ball, ball]);
  });

  it('an apostrophe still parts words in Russian and English', () => {
    expect(words("Newton's", 'en').map((w) => w.text)).toEqual(['Newton', 's']);
  });

  it('function words are shown from the start, never guessed', () => {
    for (const w of ['і', 'та', 'що', 'який', 'її', 'вже', 'був']) expect(wordKey(w, 'uk'), w).toBeNull();
  });

  it('ї, є and ґ stay letters of their own', () => {
    expect(wordKey('їжак', 'uk')).not.toBe(wordKey('іжак', 'uk'));
    expect(wordKey('ґанок', 'uk')).not.toBe(wordKey('ганок', 'uk'));
  });

  it('a typed title matches with any apostrophe, in any word order', () => {
    expect(titleGuessMatches("Сім'я", 'Сімʼя', 'uk')).toBe(true);
    expect(titleGuessMatches('Ньютон Ісаак', 'Ісаак Ньютон', 'uk')).toBe(true);
    expect(titleGuessMatches('Ньютон', 'Ісаак Ньютон', 'uk')).toBe(false);
  });
});

describe('tokens', () => {
  it('keep every character, so the article renders as written', () => {
    const text = 'Я́блоко — сочный плод яблони, 7,5 см; state-of-the-art (Newton’s).';
    expect(tokenize(text, 'ru').map((t) => t.text).join('')).toBe(text);
  });

  it('split a hyphenated word into parts joined by visible hyphens (6)', () => {
    const parts = words('state-of-the-art', 'en');
    expect(parts.map((t) => t.text)).toEqual(['state', 'of', 'the', 'art']);
    expect(parts.map((t) => t.key === null)).toEqual([false, true, true, false]);
    expect(tokenize('state-of-the-art', 'en').filter((t) => t.kind === 'sep').map((t) => t.text)).toEqual(['-', '-', '-']);
  });

  it('open Newton’s with the word Newton', () => {
    const [newton, s] = words("Newton's", 'en');
    expect(newton.key).toBe(wordKey('Newton', 'en'));
    expect(s.key).toBeNull();
  });

  it('treat digits as separators, always shown', () => {
    expect(words('COVID-19 in 2020', 'en').map((t) => t.text)).toEqual(['COVID', 'in']);
  });
});

describe('the article (5)', () => {
  const para = (n: number, word = 'apple') => ({ text: Array.from({ length: n }, (_, i) => `${word}${String.fromCharCode(97 + (i % 26))}x`).join(' ') });

  it('counts groups across the title and the text', () => {
    const a = buildArticle('Apple', [{ text: 'The apple is a fruit. Apples grow on apple trees.' }], 'en');

    expect(a.counts.get(wordKey('apple', 'en')!)).toBe(4);
    expect(a.titleKeys).toEqual([wordKey('apple', 'en')]);
  });

  it('is cut after the last whole paragraph under the limit', () => {
    const a = buildArticle('T', [para(6), para(5), para(3)], 'en', 10);

    expect(a.blocks).toHaveLength(1);
    expect(a.contentWords).toBe(6);
  });

  it('keeps a first paragraph longer than the limit whole', () => {
    expect(buildArticle('T', [para(15)], 'en', 10).contentWords).toBe(15);
  });

  it('does not end on a heading', () => {
    const paragraphs: Paragraph[] = [para(6), { text: 'History', heading: true }, para(8)];
    const a = buildArticle('T', paragraphs, 'en', 10);

    expect(a.blocks.map((b) => b.heading)).toEqual([false]);
  });

  it('judges playability by content words, headings aside', () => {
    expect(countContentWords([{ text: 'Early life', heading: true }, { text: 'The apple is a fruit.' }], 'en')).toBe(2);
  });
});

describe('a word guess (3)', () => {
  const article = buildArticle('Isaac Newton', [
    { text: 'Isaac Newton was an English physicist. Physics owes him much; physics, physics and physics.' }
  ], 'en');

  it('costs 10 a miss and 2 a find, however often the word occurs', () => {
    expect([0, 1, 2, 7].map((n) => guessCost(n))).toEqual([10, 2, 2, 2]);
    expect([guessCost(0, 50), guessCost(1, 50)]).toEqual([10, 2]);
  });

  it('a tighter attempt limit makes each attempt dearer in proportion', () => {
    expect([guessCost(0, 10), guessCost(1, 10)]).toEqual([50, 10]);
    expect([guessCost(0, 25), guessCost(1, 25)]).toEqual([20, 4]);
    expect([guessCost(0, 3), guessCost(1, 3)]).toEqual([167, 33]);
    // Spending every attempt on misses weighs the same, whatever the limit.
    for (const limit of [1, 5, 10, 25, 50]) expect(Math.abs(limit * guessCost(0, limit) - 500)).toBeLessThanOrEqual(limit);
  });

  it('reports the occurrences and the cost', () => {
    expect(evaluateGuess(article, 'physics', new Set(), 'en')).toEqual({
      kind: 'word', key: wordKey('physics', 'en'), occurrences: 4, cost: 2
    });
    expect(evaluateGuess(article, 'gravity', new Set(), 'en')).toMatchObject({ kind: 'word', occurrences: 0, cost: 10 });
    expect(evaluateGuess(article, 'gravity', new Set(), 'en', 10)).toMatchObject({ cost: 50 });
  });

  it('a word already open is a free repeat, not an attempt', () => {
    const key = wordKey('physics', 'en')!;
    expect(evaluateGuess(article, 'physics', new Set([key]), 'en')).toEqual({ kind: 'repeat', key });
  });

  it('is not a guess when empty, several words, or always shown', () => {
    expect(evaluateGuess(article, '  ', new Set(), 'en')).toEqual({ kind: 'invalid', reason: 'empty' });
    expect(evaluateGuess(article, 'Isaac Newton', new Set(), 'en')).toEqual({ kind: 'invalid', reason: 'several' });
    expect(evaluateGuess(article, 'well-known', new Set(), 'en')).toEqual({ kind: 'invalid', reason: 'several' });
    expect(evaluateGuess(article, 'the', new Set(), 'en')).toEqual({ kind: 'invalid', reason: 'open' });
  });
});

describe('solving (2, 6)', () => {
  it('opening every group of the title solves the round', () => {
    const a = buildArticle('Theory of relativity', [{ text: 'A theory in physics.' }], 'en');
    const theory = wordKey('theory', 'en')!;

    expect(titleSolved(a, new Set([theory]))).toBe(false);
    expect(titleSolved(a, new Set([theory, wordKey('relativity', 'en')!]))).toBe(true);
  });

  it('a typed title matches regardless of case, stress and ё', () => {
    expect(titleGuessMatches('яблоко', 'Я́блоко', 'ru')).toBe(true);
    expect(titleGuessMatches('Еж', 'Ёж', 'ru')).toBe(true);
    expect(titleGuessMatches('isaac newton', 'Isaac Newton', 'en')).toBe(true);
  });

  it('with or without the qualifier in brackets, in any word order', () => {
    expect(titleGuessMatches('Меркурий', 'Меркурий (планета)', 'ru')).toBe(true);
    expect(titleGuessMatches('Меркурий (планета)', 'Меркурий (планета)', 'ru')).toBe(true);
    expect(titleGuessMatches('Исаак Ньютон', 'Ньютон, Исаак', 'ru')).toBe(true);
  });

  it('not a part of the title, and not another word', () => {
    expect(titleGuessMatches('Ньютон', 'Ньютон, Исаак', 'ru')).toBe(false);
    expect(titleGuessMatches('Apples', 'Apple', 'en')).toBe(false);
    expect(titleGuessMatches('', 'Apple', 'en')).toBe(false);
  });
});

describe('the score (3)', () => {
  it('the spec’s example: a fifth of the time, physics ×4, England ×2, gravity ×0, one wrong title → 836', () => {
    expect(roundScore({
      solved: true, elapsedMs: 12_000, durationMs: 60_000,
      wordPenalty: guessCost(4) + guessCost(2) + guessCost(0), wrongTitles: 1
    })).toBe(836);
  });

  it('time costs at most 500, however late', () => {
    expect(roundScore({ solved: true, elapsedMs: 999_000, durationMs: 60_000, wordPenalty: 0, wrongTitles: 0 })).toBe(500);
  });

  it('never falls below 10 once solved, and is 0 unsolved', () => {
    expect(roundScore({ solved: true, elapsedMs: 60_000, durationMs: 60_000, wordPenalty: 900, wrongTitles: 5 })).toBe(10);
    expect(roundScore({ solved: false, elapsedMs: 0, durationMs: 60_000, wordPenalty: 0, wrongTitles: 0 })).toBe(0);
  });
});

describe('the words open from the start (2)', () => {
  const article = buildArticle('Apple', [
    { text: 'Apple fruit tree orchard cider pie juice seed core peel blossom harvest variety cultivar orchard.' }
  ], 'en');
  const titleKey = wordKey('apple', 'en')!;
  const others = [...article.counts.keys()].filter((k) => k !== titleKey);

  it('nothing is open when all is hidden', () => {
    expect(initialReveal(article, 100, 'seed').size).toBe(0);
  });

  it('opens the share asked for, never a word of the title', () => {
    const open = initialReveal(article, 50, 'seed');

    expect(open.size).toBe(Math.round(others.length / 2));
    expect(open.has(titleKey)).toBe(false);
  });

  it('is the same for every player with the same seed, and differs between rounds', () => {
    expect([...initialReveal(article, 50, 'round-1')]).toEqual([...initialReveal(article, 50, 'round-1')]);
    expect([...initialReveal(article, 50, 'round-1')]).not.toEqual([...initialReveal(article, 50, 'round-2')]);
  });

  it('keeps the hidden share within 50–100%', () => {
    expect(initialReveal(article, 10, 's').size).toBe(Math.round(others.length / 2));
  });
});

describe('whose language each player reads (6)', () => {
  const round = {
    title: 'Ньютон, Исаак',
    revision: 1,
    versions: { en: { title: 'Isaac Newton', revision: 2 } }
  };

  it('each reads their own language when the host found the article there', () => {
    expect(readingVersion(round, { lang: 'ru', articles: 'own' }, 'en')).toEqual({ title: 'Isaac Newton', revision: 2, lang: 'en' });
    expect(readingVersion(round, { lang: 'ru', articles: 'own' }, 'ru')).toEqual({ title: 'Ньютон, Исаак', revision: 1, lang: 'ru' });
  });

  it('everyone reads the host’s language when the host keeps it, or when there is no other version', () => {
    const host = { title: 'Ньютон, Исаак', revision: 1, lang: 'ru' };
    expect(readingVersion(round, { lang: 'ru', articles: 'host' }, 'en')).toEqual(host);
    expect(readingVersion({ title: 'Ньютон, Исаак', revision: 1 }, { lang: 'ru', articles: 'own' }, 'en')).toEqual(host);
    expect(readingVersion(round, { lang: 'ru' }, 'en')).toEqual(host);
    expect(readingVersion(round, { lang: 'ru', articles: 'own' }, undefined)).toEqual(host);
  });

  it('asks for the other languages at the table, and only when each reads their own', () => {
    const table = [{ lang: 'ru' as const }, { lang: 'en' as const }, { lang: 'en' as const }, {}];
    expect(languagesNeeded({ lang: 'ru', articles: 'own' }, table)).toEqual(['en']);
    expect(languagesNeeded({ lang: 'ru', articles: 'host' }, table)).toEqual([]);
    expect(languagesNeeded({ lang: 'ru', articles: 'own' }, [{ lang: 'ru' }, {}])).toEqual([]);
  });
});
