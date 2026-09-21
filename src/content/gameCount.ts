import { GAMES, GAME_IDS, type Locale } from '@/games/registry';
import { pluralRu } from '@/lib/plural';

/**
 * The sentences that state how many games the site has.
 *
 * These were written out by hand once and then went stale three games in a
 * row — the homepage was still promising five while the registry listed
 * eight. The number now comes from the registry, and each sentence carries
 * all three Russian forms because the adjectives and the relative pronoun
 * decline with the numeral, not just the noun.
 */

const RU_NUMERALS = [
  'ноль', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть',
  'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать'
];

const EN_NUMERALS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'
];

export const GAME_COUNT = GAME_IDS.length;

const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

/** Spelled out while we have a word for it; past that, the digits will do. */
const word = (words: string[], n: number) => words[n] ?? String(n);
const numeral = (words: string[], n: number) => capitalize(word(words, n));

/** Google stops printing the snippet somewhere around here. */
const SNIPPET_LIMIT = 160;

const MORE: Record<Locale, string> = { ru: ' и другие', en: ' and more' };

/**
 * The search snippet: every game named, as long as they fit.
 *
 * No trailing "и"/"and" in the list on purpose — it ends "Точки и квадраты,
 * Реверси", and an "и" there would read as a single title. Once the catalogue
 * outgrows the snippet the list drops its tail and admits it with "и другие",
 * so adding a game shortens the sentence instead of breaking the build.
 */
export function fitNames(
  names: readonly string[],
  head: string,
  tail: string,
  more: string,
  limit = SNIPPET_LIMIT
): string {
  for (let take = names.length; take > 1; take--) {
    const list = names.slice(0, take).join(', ') + (take < names.length ? more : '');
    const text = head + list + tail;
    if (text.length <= limit) return text;
  }

  // One name plus an admission is the shortest honest form; if even that
  // overruns, the surrounding sentence is the thing that needs shortening.
  return head + names[0] + more + tail;
}

const snippet = (lang: Locale, head: string, tail: string): string =>
  fitNames(GAMES.map((g) => g.name[lang]), head, tail, MORE[lang]);

const ru = (n: number) => {
  const count = numeral(RU_NUMERALS, n);

  return {
    heroLead:
      `${count} ${pluralRu(n, [
        'настольная и логическая игра',
        'настольные и логические игры',
        'настольных и логических игр'
      ])} для компании. Создайте комнату, отправьте ссылку — и играйте. ` +
      'Ничего скачивать не нужно, регистрация не обязательна.',

    gamesLead:
      `${count} ${pluralRu(n, ['игра', 'игры', 'игр'])}: от разговорной дедукции ` +
      'на всю компанию до дуэли на двоих и логики в одиночку.',

    hubLead:
      `${count} ${pluralRu(n, [
        'игра, в которую',
        'игры, в которые',
        'игр, в которые'
      ])} можно играть прямо в браузере — вдвоём или большой компанией. ` +
      'Создайте комнату, отправьте друзьям ссылку и начинайте: ничего ' +
      'устанавливать не нужно, регистрация не обязательна.',

    // The /games snippet Google prints. Kept short on purpose — see the
    // length assertion in tests/game-count-copy.test.ts.
    hubIntro:
      `${pluralRu(n, [
        'Единственная игра работает',
        `Все ${word(RU_NUMERALS, n)} игры работают`,
        `Все ${word(RU_NUMERALS, n)} игр работают`
      ])} по одному принципу: хост создаёт комнату, остальные заходят по ` +
      'ссылке или коду. Различаются они тем, сколько нужно людей, сколько ' +
      'длится партия и что именно от вас требуется — внимательно слушать, ' +
      'быстро считать или блефовать с непроницаемым лицом.',

    hubDescription: snippet(
      'ru',
      `${count} ${pluralRu(n, ['игра', 'игры', 'игр'])} для компании прямо в браузере: `,
      '. Создайте комнату и играйте бесплатно.'
    )
  };
};

const en = (n: number) => {
  const count = numeral(EN_NUMERALS, n);
  const games = n === 1 ? 'game' : 'games';

  return {
    heroLead:
      `${count} board and logic ${games} for a group. Create a room, share ` +
      'the link, play. Nothing to download, no account required.',

    gamesLead:
      `${count} ${games}, from group-wide conversational deduction to a ` +
      'two-player duel and solo logic.',

    hubLead:
      `${count} ${games} you can play straight in the browser — one on one ` +
      'or with a full group. Create a room, send your friends the link and ' +
      'start: nothing to install, no account required.',

    hubIntro:
      `${n === 1 ? 'The only game works' : `All ${word(EN_NUMERALS, n)} games work`} ` +
      'the same way: the host creates a room, everyone else joins by link or ' +
      'code. What differs is how many people you need, how long a match runs, ' +
      'and what it asks of you — listening closely, counting quickly, or ' +
      'bluffing with a straight face.',

    hubDescription: snippet(
      'en',
      `${count} ${games} for your group, right in the browser: `,
      '. Create a room and play free.'
    )
  };
};

export const GAME_COUNT_COPY: Record<Locale, ReturnType<typeof ru>> = {
  ru: ru(GAME_COUNT),
  en: en(GAME_COUNT)
};
