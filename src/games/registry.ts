/**
 * The single source of truth for "what games exist and what are they like".
 *
 * Before this module the same five facts were written out in six places —
 * the create screen, the lobby list, the achievements grid, the lobby header,
 * each game route and the SEO content module — and every one of them had its
 * own copy of the player counts and the display names. They had already
 * drifted: the lobby list said "Сапер" while the public page said "Сапёр".
 *
 * Deliberately server-safe: no React, no lucide-react, no `'use client'`
 * import anywhere in its graph. `src/content/games.ts` builds on it, and that
 * module feeds statically rendered pages — pulling an icon component in here
 * would drag the client bundle into them. Icons live in `./icons`, the create
 * screen's option controls in `./options`, and the starting states in
 * `./initialState`; each of those is imported only by the screens that need it.
 *
 * Adding a game: append an id to GAME_IDS, add one entry here, then follow the
 * checklist in docs/adding-a-game.md — the type errors walk you through the
 * rest.
 */

export type Locale = 'ru' | 'en';

/**
 * Every game the platform ships, in the order players see them.
 *
 * This is also the stored `game_state.gameType` and the `/game/<id>` route
 * segment, so renaming an id orphans existing lobbies and inbound links.
 */
export const GAME_IDS = [
  'spyfall', 'minesweeper', 'flager', 'battleship', 'coup', 'wallrush', 'dots', 'reversi'
] as const;

export type GameId = (typeof GAME_IDS)[number];

export interface GameDefinition {
  id: GameId;
  name: Record<Locale, string>;
  /** One line, used on the create card, the public card and as a subtitle. */
  tagline: Record<Locale, string>;
  players: { min: number; max: number };
  /** Typical match length, shown on the public pages and in JSON-LD. */
  playtimeMinutes: number;
  genre: Record<Locale, string>;
  /** Hex accent for the public cards and the generated OG image. */
  accent: string;
  /** Tailwind classes for the small game chip in the lobby list. */
  tint: string;
  /**
   * Whether a match can be played alone. Statistics are split into
   * solo/multiplayer for these and kept flat for the rest — see
   * `src/lib/playerStats.ts`.
   */
  hasSoloMode: boolean;
  /**
   * Label for the game's own counter on the statistics card, when it keeps
   * one beyond wins/losses/time.
   */
  extraStat?: Record<Locale, string>;
  /**
   * Key of a `choice` option that fixes the headcount, for games where the
   * mode decides it rather than the host. The create screen then hides the
   * player slider and takes the count from the chosen option instead — Wall
   * Rush is a duel or a four, never a three.
   */
  playersFromOption?: string;
}

export const GAMES: readonly GameDefinition[] = [
  {
    id: 'spyfall',
    name: { ru: 'Шпион', en: 'Spyfall' },
    tagline: {
      ru: 'Вычислите шпиона в своих рядах или не выдайте себя.',
      en: 'Find the spy among you or blend in without being caught.'
    },
    players: { min: 3, max: 12 },
    playtimeMinutes: 10,
    genre: { ru: 'Социальная дедукция', en: 'Social deduction' },
    accent: '#7c3aed',
    tint: 'bg-purple-50 text-purple-600',
    hasSoloMode: false
  },
  {
    id: 'minesweeper',
    name: { ru: 'Сапёр', en: 'Minesweeper' },
    tagline: {
      ru: 'Скоростное разминирование. Кто быстрее очистит поле?',
      en: 'Speed defusal. Who clears the grid first?'
    },
    players: { min: 1, max: 4 },
    playtimeMinutes: 10,
    genre: { ru: 'Головоломка', en: 'Puzzle' },
    accent: '#dc2626',
    tint: 'bg-red-50 text-red-600',
    hasSoloMode: true,
    extraStat: { ru: 'Мин найдено', en: 'Mines found' }
  },
  {
    id: 'flager',
    name: { ru: 'Флагер', en: 'Flager' },
    tagline: {
      ru: 'Географическая викторина. Угадай флаг по пикселям.',
      en: 'Geography quiz. Guess the flag pixel by pixel.'
    },
    players: { min: 1, max: 4 },
    playtimeMinutes: 10,
    genre: { ru: 'Викторина', en: 'Quiz' },
    accent: '#0891b2',
    tint: 'bg-blue-50 text-blue-600',
    hasSoloMode: true,
    extraStat: { ru: 'Флагов угадано', en: 'Flags guessed' }
  },
  {
    id: 'battleship',
    name: { ru: 'Морской бой', en: 'Battleship' },
    tagline: {
      ru: 'Классическая тактика. Потопи флот противника.',
      en: 'Classic tactics. Sink the enemy fleet.'
    },
    players: { min: 2, max: 2 },
    playtimeMinutes: 15,
    genre: { ru: 'Стратегия', en: 'Strategy' },
    accent: '#1d4ed8',
    tint: 'bg-sky-50 text-sky-600',
    hasSoloMode: false
  },
  {
    id: 'coup',
    name: { ru: 'Переворот', en: 'Coup' },
    tagline: {
      ru: 'Блеф, интриги и влияние. Останься последним.',
      en: 'Bluff, intrigue, influence. Be the last one standing.'
    },
    players: { min: 2, max: 6 },
    playtimeMinutes: 15,
    genre: { ru: 'Карточная игра', en: 'Card game' },
    accent: '#b45309',
    tint: 'bg-orange-50 text-orange-600',
    hasSoloMode: false
  },
  {
    id: 'wallrush',
    name: { ru: 'Стены', en: 'Wall Rush' },
    tagline: {
      ru: 'Добегите до другого края — или поставьте стену и отправьте соперника в обход.',
      en: 'Race to the far side — or drop a wall and send your rival the long way around.'
    },
    players: { min: 2, max: 4 },
    playtimeMinutes: 10,
    genre: { ru: 'Абстрактная стратегия', en: 'Abstract strategy' },
    accent: '#15803d',
    tint: 'bg-emerald-50 text-emerald-600',
    hasSoloMode: false,
    playersFromOption: 'mode'
  },
  {
    id: 'dots',
    name: { ru: 'Точки и квадраты', en: 'Dots & Boxes' },
    tagline: {
      ru: 'Чертите линии между точками и закрывайте квадраты. Закрыл — ходишь снова.',
      en: 'Draw a line between two dots and close a box. Close one and you go again.'
    },
    players: { min: 2, max: 4 },
    playtimeMinutes: 10,
    genre: { ru: 'Абстрактная стратегия', en: 'Abstract strategy' },
    accent: '#0d9488',
    tint: 'bg-teal-50 text-teal-600',
    hasSoloMode: false
  },
  {
    id: 'reversi',
    name: { ru: 'Реверси', en: 'Reversi' },
    tagline: {
      ru: 'Зажмите чужие фишки между двумя своими — и они перевернутся.',
      en: 'Trap a line of your rival between two of yours and the discs turn over.'
    },
    players: { min: 2, max: 2 },
    playtimeMinutes: 15,
    genre: { ru: 'Абстрактная стратегия', en: 'Abstract strategy' },
    accent: '#334155',
    tint: 'bg-slate-100 text-slate-600',
    hasSoloMode: false
  }
];

const BY_ID = new Map<string, GameDefinition>(GAMES.map((g) => [g.id, g]));

/** True for a string that names a game the platform actually ships. */
export function isGameId(value: string | undefined | null): value is GameId {
  return !!value && BY_ID.has(value);
}

/**
 * Definition for a stored `gameType`, or `undefined` when the value is not one
 * of ours. Callers must handle that case rather than substituting a default:
 * the lobby list used to fall back to Coup, so a row written by a newer
 * version would have shown up wearing the wrong name and icon.
 */
export function getGame(id: string | undefined | null): GameDefinition | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/**
 * Definition for a game this code names literally. Throws rather than
 * returning undefined: a miss here is a typo in our own source, not bad data.
 */
export function requireGame(id: GameId): GameDefinition {
  const game = BY_ID.get(id);
  if (!game) throw new Error(`Unknown game id: ${id}`);
  return game;
}

/**
 * How many players a specific room seats.
 *
 * The host picks this when creating the room, so the stored value wins; the
 * game's maximum is only the fallback for a room that never recorded one.
 * Four of the five game screens used to pass the game maximum straight to the
 * lobby, so a Coup room created for three showed "1/6" and let six people in
 * through the invite link.
 */
export function roomCapacity(game: GameDefinition, storedMax?: number): number {
  if (typeof storedMax !== 'number' || !Number.isFinite(storedMax)) return game.players.max;
  return Math.min(Math.max(storedMax, game.players.min), game.players.max);
}

/** "3–12", or just "2" when the game takes an exact number of players. */
export function playerRange(game: GameDefinition): string {
  return game.players.min === game.players.max
    ? `${game.players.min}`
    : `${game.players.min}–${game.players.max}`;
}
