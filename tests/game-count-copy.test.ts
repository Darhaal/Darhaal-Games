import { describe, it, expect } from 'vitest';
import { GAMES, GAME_IDS, type Locale } from '@/games/registry';
import { GAME_COUNT, GAME_COUNT_COPY, fitNames } from '@/content/gameCount';
import { HOME_CONTENT } from '@/content/games';

/**
 * The homepage spent three releases promising five games while the registry
 * listed eight. These tests are the reason it cannot happen a fourth time.
 */

const LOCALES: Locale[] = ['ru', 'en'];

/**
 * Whole-word match, done by hand.
 *
 * \b is ASCII-only in JavaScript, so it does not see the edges of a Cyrillic
 * word, and a substring check would accept "восемь" as a match for "семь" —
 * exactly the wrong number this is meant to catch. A regex literal keeps
 * \p{L} intact; inside a template literal the backslash is swallowed.
 */
const isLetter = (ch: string | undefined) => ch !== undefined && /\p{L}/u.test(ch);

const hasWord = (text: string, word: string): boolean => {
  const hay = text.toLowerCase();
  const needle = word.toLowerCase();

  for (let from = 0; ; from++) {
    const at = hay.indexOf(needle, from);
    if (at === -1) return false;
    if (!isLetter(hay[at - 1]) && !isLetter(hay[at + needle.length])) return true;
    from = at;
  }
};

const NUMERAL = {
  ru: ['ноль', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть',
       'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six',
       'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
};

describe('hasWord', () => {
  it('does not mistake "восемь" for "семь"', () => {
    expect(hasWord('Все восемь игр работают', 'восемь')).toBe(true);
    expect(hasWord('Все восемь игр работают', 'семь')).toBe(false);
    expect('Все восемь игр работают'.includes('семь')).toBe(true); // the trap
  });

  it('does not mistake "двенадцать" for "две"', () => {
    expect(hasWord('двенадцать игр', 'две')).toBe(false);
    expect(hasWord('две игры', 'две')).toBe(true);
  });

  it('matches at either end of the sentence', () => {
    expect(hasWord('Eight games', 'eight')).toBe(true);
    expect(hasWord('there are eight', 'eight')).toBe(true);
    expect(hasWord('eighty games', 'eight')).toBe(false);
  });
});

describe('the stated number of games', () => {
  it('matches the registry', () => {
    expect(GAME_COUNT).toBe(GAME_IDS.length);
  });

  for (const lang of LOCALES) {
    it(`states the right number in every ${lang} sentence`, () => {
      const expected = NUMERAL[lang][GAME_COUNT] ?? String(GAME_COUNT);

      for (const [key, sentence] of Object.entries(GAME_COUNT_COPY[lang])) {
        expect(hasWord(sentence, expected), `${lang}.${key}: ${sentence}`).toBe(true);
      }
    });

    it(`feeds the ${lang} homepage`, () => {
      expect(HOME_CONTENT[lang].heroLead).toBe(GAME_COUNT_COPY[lang].heroLead);
      expect(HOME_CONTENT[lang].gamesLead).toBe(GAME_COUNT_COPY[lang].gamesLead);
    });
  }
});

describe('the /games search snippet', () => {
  for (const lang of LOCALES) {
    it(`fits in a ${lang} search result`, () => {
      expect(GAME_COUNT_COPY[lang].hubDescription.length).toBeLessThanOrEqual(160);
    });

    it(`names every ${lang} game it has room for, and admits the rest`, () => {
      const text = GAME_COUNT_COPY[lang].hubDescription;
      const missing = GAMES.filter((g) => !text.includes(g.name[lang]));

      // Either everything fits, or the sentence ends by saying it does not.
      if (missing.length > 0) {
        expect(text).toContain(lang === 'ru' ? 'и другие' : 'and more');
      }
      expect(missing.length).toBeLessThan(GAMES.length);
    });
  }
});

describe('the "how many people" answer', () => {
  // Hand-written prose, because generating it produces sentences like
  // "Стены и Точки и квадраты". A test is the cheap way to keep a human
  // honest: add a game, this fails, someone rewrites the sentence.
  for (const lang of LOCALES) {
    it(`names every game in ${lang}`, () => {
      const answer = HOME_CONTENT[lang].faq
        .map((item) => item.a)
        .find((a) => /до двенадцати|up to twelve/.test(a));

      expect(answer, 'the player-count answer went missing').toBeTruthy();

      for (const game of GAMES) {
        expect(answer, `${game.id} is not mentioned`).toContain(game.name[lang]);
      }
    });
  }
});

describe('fitNames', () => {
  const head = 'Games: ';
  const tail = '. Play free.';

  it('keeps the whole list when it fits', () => {
    const out = fitNames(['A', 'B', 'C'], head, tail, ' and more', 100);
    expect(out).toBe('Games: A, B, C. Play free.');
  });

  it('drops the tail of the list and says so when it does not', () => {
    const names = Array.from({ length: 30 }, (_, i) => `Game${i}`);
    const out = fitNames(names, head, tail, ' and more', 60);

    expect(out.length).toBeLessThanOrEqual(60);
    expect(out).toContain('and more');
    expect(out.startsWith('Games: Game0, Game1')).toBe(true);
    expect(out.endsWith(tail)).toBe(true);
  });

  it('falls back to a single name rather than returning nothing', () => {
    const names = ['Something rather long', 'Another long one', 'A third'];
    const out = fitNames(names, head, tail, ' and more', 10);

    expect(out).toBe('Games: Something rather long and more. Play free.');
  });
});
