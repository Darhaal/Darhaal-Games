import { Bomb, Clock, Flag, Grid, Layers, Swords, type LucideIcon } from 'lucide-react';
import { SPYFALL_PACKS } from '@/data/spyfall/locations';
import { BOARD_FOR_MODE, PLAYERS_FOR_MODE, WALLS_FOR_MODE } from '@/lib/gameLogic/wallrush';
import { DEFAULT_SIZE, MIN_SIZE, MAX_SIZE, boxCount } from '@/lib/gameLogic/dots';
import { GAMES, type GameId, type Locale } from './registry';

/**
 * The per-game controls on the create screen, described as data rather than
 * written as JSX.
 *
 * Every game used to add its own `{selectedGame?.id === '...' && (...)}` block
 * to `app/create/page.tsx`, each with its own `useState` beside it, so the
 * screen grew by roughly forty lines per game and the defaults lived in three
 * places (the state initialiser, the reset effect and the insert). Now the
 * screen renders whatever this file declares and hands the collected values to
 * `createInitialState`.
 *
 * Imported only by the create screen — it pulls in lucide icons and the full
 * Spyfall pack data, neither of which belongs in the lobby list's bundle.
 */

export type OptionValue = number | string;
export type OptionValues = Record<string, OptionValue>;

interface OptionBase {
  /** Key the value is collected under and read back by `createInitialState`. */
  key: string;
  label: Record<Locale, string>;
  icon: LucideIcon;
}

export interface SliderOption extends OptionBase {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  default: number;
  /** Appended to the value in the badge, e.g. "мин". */
  unit?: Record<Locale, string>;
  /** Rendered as the value, when a raw number reads badly (e.g. "20 × 20"). */
  format?: (value: number, locale: Locale) => string;
  /** Small derived line under the control, e.g. the resulting mine count. */
  note?: (values: OptionValues, locale: Locale) => string;
}

export interface ChoiceOption extends OptionBase {
  kind: 'choice';
  default: string;
  choices: Array<{
    value: string;
    emoji?: string;
    label: Record<Locale, string>;
    /** Optional contents preview, shown once the choice is selected. */
    preview?: Record<Locale, string[]>;
    /**
     * Headcount this choice fixes, for a game whose registry entry names this
     * option in `playersFromOption`.
     */
    players?: number;
  }>;
  previewLabel: Record<Locale, string>;
}

export type GameOption = SliderOption | ChoiceOption;

/** Reads a numeric option back, tolerating the string form a range input gives. */
export const num = (values: OptionValues, key: string, fallback = 0): number => {
  const raw = values[key];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

/** Reads a string option back. */
export const str = (values: OptionValues, key: string, fallback = ''): string => {
  const raw = values[key];
  return typeof raw === 'string' ? raw : fallback;
};

const minutes = { ru: 'мин', en: 'm' };
const seconds = { ru: 'сек', en: 's' };

export const GAME_OPTIONS: Record<GameId, GameOption[]> = {
  spyfall: [
    {
      kind: 'slider',
      key: 'roundMinutes',
      label: { ru: 'Время хода', en: 'Turn Time' },
      icon: Clock,
      min: 3,
      max: 15,
      step: 1,
      default: 8,
      unit: minutes
    },
    {
      kind: 'choice',
      key: 'packId',
      label: { ru: 'Набор локаций', en: 'Location Pack' },
      icon: Layers,
      default: SPYFALL_PACKS[0].id,
      previewLabel: { ru: 'Локации в наборе', en: 'Locations in pack' },
      choices: SPYFALL_PACKS.map((pack) => ({
        value: pack.id,
        emoji: pack.emoji,
        label: pack.name,
        preview: {
          ru: pack.locations.map((l) => l.name.ru),
          en: pack.locations.map((l) => l.name.en)
        }
      }))
    }
  ],

  minesweeper: [
    {
      kind: 'slider',
      key: 'size',
      label: { ru: 'Размер поля', en: 'Grid Size' },
      icon: Grid,
      min: 10,
      max: 100,
      step: 1,
      default: 20,
      format: (value) => `${value} × ${value}`
    },
    {
      kind: 'slider',
      key: 'mineDensity',
      label: { ru: 'Плотность мин', en: 'Mine Density' },
      icon: Bomb,
      min: 10,
      max: 40,
      step: 1,
      default: 15,
      format: (value) => `${value}%`,
      note: (values, locale) => {
        const cells = num(values, 'size', 20) ** 2;
        const mines = Math.floor(cells * (num(values, 'mineDensity', 15) / 100));
        return locale === 'ru'
          ? `Клеток: ${cells} · Всего мин: ${mines}`
          : `Cells: ${cells} · Total mines: ${mines}`;
      }
    },
    {
      kind: 'slider',
      key: 'timeLimitMinutes',
      label: { ru: 'Лимит времени', en: 'Time Limit' },
      icon: Clock,
      min: 1,
      max: 180,
      step: 1,
      default: 20,
      unit: minutes
    }
  ],

  flager: [
    {
      kind: 'slider',
      key: 'rounds',
      label: { ru: 'Раунды', en: 'Rounds' },
      icon: Flag,
      min: 1,
      max: 20,
      step: 1,
      default: 5
    },
    {
      kind: 'slider',
      key: 'roundSeconds',
      label: { ru: 'Время хода', en: 'Turn Time' },
      icon: Clock,
      min: 15,
      max: 300,
      step: 15,
      default: 60,
      unit: seconds
    }
  ],

  battleship: [],
  coup: [],

  dots: [
    {
      kind: 'slider',
      key: 'size',
      label: { ru: 'Размер поля', en: 'Grid Size' },
      icon: Grid,
      min: MIN_SIZE,
      max: MAX_SIZE,
      step: 1,
      default: DEFAULT_SIZE,
      format: (value) => `${value} × ${value}`,
      note: (values, locale) => {
        const size = num(values, 'size', DEFAULT_SIZE);
        return locale === 'ru'
          ? `Квадратов: ${boxCount(size)}`
          : `Boxes: ${boxCount(size)}`;
      }
    },
    {
      kind: 'slider',
      key: 'turnSeconds',
      label: { ru: 'Время хода', en: 'Turn Time' },
      icon: Clock,
      min: 10,
      max: 60,
      step: 5,
      default: 30,
      unit: seconds
    }
  ],

  reversi: [
    {
      kind: 'slider',
      key: 'turnSeconds',
      label: { ru: 'Время хода', en: 'Turn Time' },
      icon: Clock,
      min: 15,
      max: 120,
      step: 15,
      default: 45,
      unit: seconds
    }
  ],

  wallrush: [
    {
      kind: 'choice',
      key: 'mode',
      label: { ru: 'Режим', en: 'Mode' },
      icon: Swords,
      default: 'duel',
      previewLabel: { ru: 'Как это играется', en: 'How it plays' },
      choices: [
        {
          value: 'duel',
          emoji: '⚔️',
          label: { ru: '1 на 1', en: '1v1' },
          players: PLAYERS_FOR_MODE.duel,
          preview: {
            ru: [
              'Двое друг напротив друга',
              `По ${WALLS_FOR_MODE.duel} стен на каждого`,
              'Дошёл до края — победил'
            ],
            en: [
              'Two players, face to face',
              `${WALLS_FOR_MODE.duel} walls each`,
              'First to the far side wins'
            ]
          }
        },
        {
          value: 'trio',
          emoji: '🔺',
          label: { ru: 'Трое', en: 'Three-way' },
          players: PLAYERS_FOR_MODE.trio,
          preview: {
            ru: [
              'Трое с трёх сторон, каждый сам за себя',
              `По ${WALLS_FOR_MODE.trio} стен на каждого`,
              'Бегут в центр — кто первый, тот и выиграл'
            ],
            en: [
              'Three players, three sides, everyone for themselves',
              `${WALLS_FOR_MODE.trio} walls each`,
              'All racing for the middle; first one there wins'
            ]
          }
        },
        {
          value: 'teams',
          emoji: '🤝',
          label: { ru: '2 на 2', en: '2v2' },
          players: PLAYERS_FOR_MODE.teams,
          preview: {
            ru: [
              'Четверо, партнёры напротив друг друга',
              `По ${WALLS_FOR_MODE.teams} стен на каждого`,
              'Дошёл один — выиграла пара'
            ],
            en: [
              'Four players, partners facing each other',
              `${WALLS_FOR_MODE.teams} walls each`,
              'Either partner home wins it for both'
            ]
          }
        },
        {
          value: 'ffa',
          emoji: '🎯',
          label: { ru: 'Вчетвером', en: 'Four at a table' },
          players: PLAYERS_FOR_MODE.ffa,
          preview: {
            ru: [
              'Четверо, по одному с каждой стороны',
              `Поле ${BOARD_FOR_MODE.ffa}×${BOARD_FOR_MODE.ffa}, по ${WALLS_FOR_MODE.ffa} стен`,
              'Все бегут в золотую клетку в центре',
              'Побеждает один, трое проигрывают'
            ],
            en: [
              'Four players, one on each side',
              `${BOARD_FOR_MODE.ffa}x${BOARD_FOR_MODE.ffa} board, ${WALLS_FOR_MODE.ffa} walls each`,
              'Everyone races for the golden centre square',
              'One winner, three losers'
            ]
          }
        }
      ]
    },
    {
      kind: 'slider',
      key: 'turnSeconds',
      label: { ru: 'Время хода', en: 'Turn Time' },
      icon: Clock,
      min: 15,
      max: 120,
      step: 15,
      default: 45,
      unit: seconds
    }
  ]
};

/** The headcount a mode-driven game is fixed to, given the chosen options. */
export function playersFromOptions(id: GameId, values: OptionValues): number | undefined {
  const key = GAMES.find((g) => g.id === id)?.playersFromOption;
  if (!key) return undefined;

  const option = GAME_OPTIONS[id].find((o) => o.key === key);
  if (!option || option.kind !== 'choice') return undefined;

  return option.choices.find((c) => c.value === values[key])?.players;
}

/** The defaults for a game, ready to seed the create screen's form state. */
export function defaultOptionValues(id: GameId): OptionValues {
  return Object.fromEntries(GAME_OPTIONS[id].map((o) => [o.key, o.default]));
}
