import { BookOpenText, Bomb, CalendarRange, Clock, Disc3, EyeOff, Flag, Gauge, Grid, Hash, Images, Languages, Layers, ShieldAlert, Swords, type LucideIcon } from 'lucide-react';
import { SPYFALL_PACKS } from '@/data/spyfall/locations';
import { BOARD_FOR_MODE, PLAYERS_FOR_MODE, WALLS_FOR_MODE } from '@/lib/gameLogic/wallrush';
import { DEFAULT_SIZE, MIN_SIZE, MAX_SIZE, boxCount } from '@/lib/gameLogic/dots';
import { WIKILER_TOPICS, TOPICS, WIKILER_DIFFICULTIES, DIFFICULTIES } from '@/data/wikiler/topics';
import { HIDDEN_DEFAULT, HIDDEN_MAX, HIDDEN_MIN } from '@/lib/gameLogic/wikiler';
import { eraFits } from '@/lib/timler/eras';
import { CATEGORIES as SONG_CATEGORIES, SONGLER_CATEGORIES } from '@/data/songler/categories';
import type { TimlerEra, TimlerMedium } from '@/types/timler';
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
  /** Shown only when this holds — e.g. an attempt limit only in the limited mode. */
  showWhen?: (values: OptionValues) => boolean;
  /**
   * A fine-tuning most rooms leave alone: it goes under "Advanced settings",
   * folded away at the bottom of the create screen, so the screen shows what
   * every host sets.
   */
  advanced?: boolean;
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
    /**
     * Optional contents preview, shown once the choice is selected — or a
     * function of the other values, when what it holds depends on them.
     */
    preview?: Record<Locale, string[]> | ((values: OptionValues) => Record<Locale, string[]>);
    /**
     * Offered only when this holds — e.g. an era only for the media that have
     * pictures from it. A value that stops being offered falls back to the
     * option's default.
     */
    showWhen?: (values: OptionValues) => boolean;
    /**
     * Headcount this choice fixes, for a game whose registry entry names this
     * option in `playersFromOption`.
     */
    players?: number;
    /** Heading the choice sits under, in a `select` display. */
    group?: Record<Locale, string>;
  }>;
  previewLabel: Record<Locale, string>;
  /** `select` for a long list: a dropdown instead of a grid of buttons. */
  display?: 'grid' | 'select';
}

export type GameOption = SliderOption | ChoiceOption;

/** Reads a numeric option back, tolerating the string form a range input gives. */
export const num = (values: OptionValues, key: string, fallback = 0): number => {
  const raw = values[key];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

/** The choices of an option on offer for these values. */
export const offeredChoices = (option: ChoiceOption, values: OptionValues) =>
  option.choices.filter((choice) => choice.showWhen?.(values) ?? true);

/** A choice's preview for these values. */
export const choicePreview = (choice: ChoiceOption['choices'][number], values: OptionValues) =>
  typeof choice.preview === 'function' ? choice.preview(values) : choice.preview;

/**
 * The values with every choice that is no longer on offer put back to its
 * option's default — picking "Photos" drops a painting-only era.
 */
export function withOfferedChoices(options: readonly GameOption[], values: OptionValues): OptionValues {
  let out = values;
  for (const option of options) {
    if (option.kind !== 'choice' || !(option.key in out)) continue;
    if (!offeredChoices(option, out).some((c) => c.value === out[option.key])) out = { ...out, [option.key]: option.default };
  }
  return out;
}

/** Reads a string option back. */
export const str = (values: OptionValues, key: string, fallback = ''): string => {
  const raw = values[key];
  return typeof raw === 'string' ? raw : fallback;
};

/** Timler's medium as the create screen holds it. */
const timlerMedium = (values: OptionValues): TimlerMedium => {
  const m = str(values, 'medium', 'photos');
  return m === 'paintings' || m === 'both' ? m : 'photos';
};

type Lines = Record<Locale, string[]>;

/** A preview by medium: the photo lines, the painting lines, or both for "both". */
const byMedium = (photos: Lines | null, paintings: Lines | null) => (values: OptionValues): Lines => {
  const medium = timlerMedium(values);
  const parts = medium === 'photos' ? [photos] : medium === 'paintings' ? [paintings] : [photos, paintings];
  return {
    ru: parts.flatMap((p) => p?.ru ?? []),
    en: parts.flatMap((p) => p?.en ?? [])
  };
};

/** An era choice, offered for the media that have pictures from it. */
const timlerEra = (value: TimlerEra, emoji: string, label: Record<Locale, string>, preview: ChoiceOption['choices'][number]['preview']) => ({
  value,
  emoji,
  label,
  preview,
  showWhen: (values: OptionValues) => eraFits(value, timlerMedium(values))
});

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
  ],

  // docs/wikiler-spec.md, sections 2–6.
  wikiler: [
    {
      kind: 'choice',
      key: 'topic',
      label: { ru: 'Тема', en: 'Topic' },
      icon: BookOpenText,
      default: 'random',
      display: 'select',
      previewLabel: { ru: 'Откуда статьи', en: 'Where articles come from' },
      choices: WIKILER_TOPICS.map((topic) => ({
        value: topic,
        emoji: TOPICS[topic].emoji,
        label: TOPICS[topic].label,
        group: TOPICS[topic].group,
        preview: topic === 'random'
          ? { ru: ['Любая статья Википедии, достаточно длинная и читаемая'], en: ['Any Wikipedia article that is long enough and read'] }
          : { ru: ['Из статей первостепенной важности Википедии'], en: ['From Wikipedia’s vital articles'] }
      }))
    },
    {
      kind: 'choice',
      key: 'difficulty',
      label: { ru: 'Сложность', en: 'Difficulty' },
      icon: Gauge,
      default: 'any',
      previewLabel: { ru: 'Какие статьи', en: 'Which articles' },
      choices: WIKILER_DIFFICULTIES.map((level) => ({
        value: level,
        emoji: DIFFICULTIES[level].emoji,
        label: DIFFICULTIES[level].label,
        preview: {
          any: { ru: ['Все статьи темы вперемешку'], en: ['Every article of the topic, mixed'] },
          easy: { ru: ['Самая читаемая треть темы — то, что знают все'], en: ['The most read third of the topic — what everyone knows'] },
          medium: { ru: ['Средняя треть: известное, но не самое'], en: ['The middle third: known, but not the most'] },
          hard: { ru: ['Наименее читаемая треть темы — для знатоков'], en: ['The least read third of the topic — for experts'] }
        }[level]
      }))
    },
    {
      kind: 'slider',
      key: 'rounds',
      label: { ru: 'Раунды', en: 'Rounds' },
      icon: Layers,
      min: 1,
      max: 20,
      step: 1,
      default: 5
    },
    {
      kind: 'slider',
      key: 'roundMinutes',
      label: { ru: 'Время раунда', en: 'Round time' },
      icon: Clock,
      min: 1,
      max: 15,
      step: 1,
      default: 3,
      unit: minutes
    },
    {
      kind: 'choice',
      key: 'letters',
      label: { ru: 'Число букв', en: 'Letter count' },
      icon: Hash,
      default: 'shown',
      advanced: true,
      previewLabel: { ru: 'На скрытых словах', en: 'On hidden words' },
      choices: [
        {
          value: 'shown',
          emoji: '🔢',
          label: { ru: 'Видно', en: 'Shown' },
          preview: { ru: ['На каждой плашке — сколько в слове букв'], en: ['Each block shows how many letters the word has'] }
        },
        {
          value: 'hidden',
          emoji: '▭',
          label: { ru: 'По нажатию', en: 'On tap' },
          preview: { ru: ['Только длина плашки; число — если нажать'], en: ['Only the block’s length; the number when tapped'] }
        }
      ]
    },
    {
      kind: 'slider',
      key: 'hidden',
      label: { ru: 'Скрыто слов', en: 'Words hidden' },
      icon: EyeOff,
      advanced: true,
      min: HIDDEN_MIN,
      max: HIDDEN_MAX,
      step: 5,
      default: HIDDEN_DEFAULT,
      unit: { ru: '%', en: '%' }
    },
    {
      kind: 'choice',
      key: 'mode',
      label: { ru: 'Попытки', en: 'Attempts' },
      icon: Swords,
      default: 'unlimited',
      advanced: true,
      previewLabel: { ru: 'Как это играется', en: 'How it plays' },
      choices: [
        {
          value: 'unlimited',
          emoji: '♾️',
          label: { ru: 'Без ограничений', en: 'Unlimited' },
          preview: {
            ru: ['Пробуйте сколько угодно — держат только очки и время'],
            en: ['Guess as much as you like — only the score and the clock hold you back']
          }
        },
        {
          value: 'limited',
          emoji: '🎯',
          label: { ru: 'Ограниченные', en: 'Limited' },
          preview: {
            ru: ['Каждое слово и каждое название тратит попытку', 'Кончились — раунд не угадан'],
            en: ['Every word and every title spends an attempt', 'Run out and the round is lost']
          }
        }
      ]
    },
    {
      kind: 'slider',
      key: 'attempts',
      label: { ru: 'Попыток на раунд', en: 'Attempts per round' },
      icon: Swords,
      min: 1,
      max: 50,
      step: 1,
      default: 20,
      advanced: true,
      showWhen: (values) => values.mode === 'limited'
    },
    {
      kind: 'choice',
      key: 'articleLang',
      label: { ru: 'Язык статей', en: 'Article language' },
      icon: Languages,
      default: 'own',
      advanced: true,
      previewLabel: { ru: 'Как это играется', en: 'How it plays' },
      choices: [
        {
          value: 'own',
          emoji: '🌐',
          label: { ru: 'Свой у каждого', en: 'Each their own' },
          preview: {
            ru: ['Статья одна, но каждый читает её на языке своего интерфейса', 'Версии на разных языках написаны разными авторами и немного отличаются'],
            en: ['One article, each reading it in their own interface language', 'The language versions are written by different people and differ a little']
          }
        },
        {
          value: 'host',
          emoji: '📖',
          label: { ru: 'Как у хоста', en: 'The host’s' },
          preview: {
            ru: ['Все читают один и тот же текст на языке хоста — счёт полностью равный'],
            en: ['Everyone reads the same text in the host’s language — a perfectly even score']
          }
        }
      ]
    }
  ],

  // docs/timler-spec.md, sections 6 and 13.
  timler: [
    {
      kind: 'choice',
      key: 'medium',
      label: { ru: 'Что угадываем', en: 'What to date' },
      icon: Images,
      default: 'photos',
      previewLabel: { ru: 'Что попадётся', en: 'What comes up' },
      choices: [
        {
          value: 'photos',
          emoji: '📷',
          label: { ru: 'Фото', en: 'Photos' },
          preview: { ru: ['Фотографии с 1839 года до наших дней'], en: ['Photographs from 1839 to this year'] }
        },
        {
          value: 'paintings',
          emoji: '🖼️',
          label: { ru: 'Живопись', en: 'Paintings' },
          preview: {
            ru: ['Картины с XIV века по 1945 год', 'Возрождение, барокко, импрессионизм, авангард'],
            en: ['Paintings from the 14th century to 1945', 'Renaissance, Baroque, Impressionism, the avant-garde']
          }
        },
        {
          value: 'both',
          emoji: '🎨',
          label: { ru: 'Всё вместе', en: 'Both' },
          preview: { ru: ['Каждый раунд — фото или картина, поровну'], en: ['Each round a photo or a painting, half and half'] }
        }
      ]
    },
    {
      kind: 'choice',
      key: 'era',
      label: { ru: 'Эпоха', en: 'Era' },
      icon: CalendarRange,
      default: 'all',
      previewLabel: { ru: 'Что попадётся', en: 'What comes up' },
      choices: [
        timlerEra('all', '🕰️', { ru: 'Всё время', en: 'All time' }, (values) => ({
          photos: { ru: ['1839–сегодня: каждый раунд — из случайной эпохи'], en: ['1839 to today: each round from a random era'] },
          paintings: { ru: ['XIV век–1945: каждый раунд — из случайной эпохи'], en: ['The 14th century to 1945: each round from a random era'] },
          both: { ru: ['От XIV века до сегодня: каждый раунд — из случайной эпохи'], en: ['The 14th century to today: each round from a random era'] }
        })[timlerMedium(values)]),
        timlerEra('before1600', '🏰', { ru: 'До 1600', en: 'Before 1600' }, byMedium(null, {
          ru: ['Средневековье и Возрождение'], en: ['The Middle Ages and the Renaissance']
        })),
        timlerEra('1600-1799', '🎻', { ru: '1600–1799', en: '1600–1799' }, byMedium(null, {
          ru: ['Барокко, рококо, Просвещение'], en: ['Baroque, Rococo, the Enlightenment']
        })),
        timlerEra('1800-1899', '🎩', { ru: '1800–1899', en: '1800–1899' }, byMedium(
          { ru: ['Первые фотографии: дагеротипы, с 1839 года'], en: ['The first photographs: daguerreotypes, from 1839'] },
          { ru: ['Романтизм, реализм, импрессионизм'], en: ['Romanticism, Realism, Impressionism'] }
        )),
        timlerEra('1900-1945', '📻', { ru: '1900–1945', en: '1900–1945' }, byMedium(
          { ru: ['Начало века, две мировые войны'], en: ['The turn of the century and two world wars'] },
          { ru: ['Модерн и авангард'], en: ['Art Nouveau and the avant-garde'] }
        )),
        timlerEra('1946-2000', '📺', { ru: '1946–2000', en: '1946–2000' }, byMedium(
          { ru: ['Послевоенный мир, космос, конец века'], en: ['The post-war world, space, the end of the century'] },
          { ru: ['Только фото: картин этих лет на свободных лицензиях почти нет'], en: ['Photos only: hardly any paintings this recent are free to show'] }
        )),
        timlerEra('since2001', '📱', { ru: 'С 2001', en: 'Since 2001' }, byMedium(
          { ru: ['XXI век, вплоть до этого года'], en: ['The 21st century, up to this year'] },
          { ru: ['Только фото'], en: ['Photos only'] }
        ))
      ]
    },
    {
      kind: 'choice',
      key: 'difficulty',
      label: { ru: 'Сложность', en: 'Difficulty' },
      icon: Gauge,
      default: 'any',
      previewLabel: { ru: 'Что попадётся', en: 'What comes up' },
      choices: WIKILER_DIFFICULTIES.map((level) => ({
        value: level,
        emoji: DIFFICULTIES[level].emoji,
        label: DIFFICULTIES[level].label,
        preview: {
          any: { ru: ['Всё из эпохи вперемешку'], en: ['Everything from the era, mixed'] },
          easy: { ru: ['Самая известная треть: то, что видел каждый'], en: ['The best known third: what everyone has seen'] },
          medium: { ru: ['Средняя треть: известное, но не самое'], en: ['The middle third: known, but not the most'] },
          hard: { ru: ['Наименее известная треть — для знатоков'], en: ['The least known third — for experts'] }
        }[level]
      }))
    },
    {
      kind: 'slider',
      key: 'rounds',
      label: { ru: 'Раунды', en: 'Rounds' },
      icon: Layers,
      min: 1,
      max: 20,
      step: 1,
      default: 5
    },
    {
      kind: 'slider',
      key: 'roundSeconds',
      label: { ru: 'Время раунда', en: 'Round time' },
      icon: Clock,
      min: 15,
      max: 180,
      step: 15,
      default: 60,
      format: (value, locale) => value < 60
        ? `${value} ${seconds[locale]}`
        : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
    },
    {
      kind: 'choice',
      key: 'adult',
      label: { ru: 'Режим 18+', en: '18+ mode' },
      icon: ShieldAlert,
      default: 'off',
      advanced: true,
      previewLabel: { ru: 'Что попадётся', en: 'What comes up' },
      choices: [
        {
          value: 'off',
          emoji: '🙂',
          label: { ru: 'Выключен', en: 'Off' },
          preview: byMedium(
            { ru: ['Без войны, катастроф и обнажённой натуры'], en: ['No war, disasters or nudity'] },
            { ru: ['Без битв, смерти и обнажённой натуры'], en: ['No battles, death or nudes'] }
          )
        },
        {
          value: 'on',
          emoji: '🔞',
          label: { ru: 'Включён', en: 'On' },
          preview: byMedium(
            {
              ru: ['Добавляются бои, катастрофы, концлагеря, обнажённая натура в фотоискусстве', 'Тел погибших, казней и крови нет и здесь'],
              en: ['Adds battles, disasters, concentration camps, nudes in fine-art photography', 'No bodies, executions or blood even here']
            },
            {
              ru: ['В живописи — обнажённая натура, битвы, распятия, мученики, казни', 'Крови, пыток и отрубленных голов нет и здесь'],
              en: ['In paintings: nudes, battles, crucifixions, martyrs, executions', 'No blood, torture or severed heads even here']
            }
          )
        },
        {
          value: 'only',
          emoji: '🔥',
          label: { ru: 'Только 18+', en: '18+ only' },
          preview: byMedium(
            {
              ru: ['Только бои, катастрофы, концлагеря и обнажённая натура в фотоискусстве', 'Тел погибших, казней и крови нет и здесь'],
              en: ['Only battles, disasters, concentration camps and nudes in fine-art photography', 'No bodies, executions or blood even here']
            },
            {
              ru: ['Только обнажённая натура, битвы, распятия, мученики и казни', 'Крови, пыток и отрубленных голов нет и здесь'],
              en: ['Only nudes, battles, crucifixions, martyrs and executions', 'No blood, torture or severed heads even here']
            }
          )
        }
      ]
    }
  ],

  // docs/songler-spec.md, section 6.
  songler: [
    {
      kind: 'choice',
      key: 'category',
      label: { ru: 'Категория', en: 'Category' },
      icon: Disc3,
      default: 'all',
      display: 'select',
      previewLabel: { ru: 'Что попадётся', en: 'What comes up' },
      choices: SONGLER_CATEGORIES.map((id) => ({
        value: id,
        emoji: SONG_CATEGORIES[id].emoji,
        label: SONG_CATEGORIES[id].label,
        group: SONG_CATEGORIES[id].group,
        ...(id === 'all' ? { preview: { ru: ['Любая песня из всех категорий'], en: ['Any song from every category'] } } : {})
      }))
    },
    {
      kind: 'choice',
      key: 'difficulty',
      label: { ru: 'Сложность', en: 'Difficulty' },
      icon: Gauge,
      default: 'any',
      previewLabel: { ru: 'Что попадётся', en: 'What comes up' },
      choices: WIKILER_DIFFICULTIES.map((level) => ({
        value: level,
        emoji: DIFFICULTIES[level].emoji,
        label: DIFFICULTIES[level].label,
        preview: {
          any: { ru: ['Все песни категории вперемешку'], en: ['Every song of the category, mixed'] },
          easy: { ru: ['Самая популярная треть: то, что знают все'], en: ['The most played third: songs everyone knows'] },
          medium: { ru: ['Средняя треть: известное, но не самое'], en: ['The middle third: known, but not the most'] },
          hard: { ru: ['Наименее популярная треть — для меломанов'], en: ['The least played third — for music buffs'] }
        }[level]
      }))
    },
    {
      kind: 'slider',
      key: 'rounds',
      label: { ru: 'Раунды', en: 'Rounds' },
      icon: Layers,
      min: 1,
      max: 20,
      step: 1,
      default: 5
    },
    {
      kind: 'slider',
      key: 'roundSeconds',
      label: { ru: 'Время раунда', en: 'Round time' },
      icon: Clock,
      min: 15,
      max: 180,
      step: 15,
      default: 60,
      format: (value, locale) => value < 60
        ? `${value} ${seconds[locale]}`
        : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
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
