import {
  Anchor, Bomb, CalendarDays, Clock, Compass, Crosshair, Crown, Eye, EyeOff, Feather, Flag, Flame,
  Gamepad2, Ghost, Grid3x3, Hammer, Handshake, Hourglass, Layers, Link2, Map as MapIcon, Maximize2,
  Medal, Moon, Rocket, Route, Scale, Search, Shield, ShieldCheck, Skull, Sparkles, Swords, Target,
  Timer, Trophy, TrendingUp, Undo2, Users, Wand2, Zap, type LucideIcon
} from 'lucide-react';
import { GAMES, requireGame, type GameId } from '@/games/registry';
import { pluralEn, pluralRu } from '@/lib/plural';
import type { MatchRow, Progress } from './progress';

/**
 * Every achievement, defined once.
 *
 * Two kinds:
 * - a **ladder** counts something and has three steps — bronze, silver, gold;
 * - a **feat** is one thing done once, at a fixed tier.
 *
 * Both are pure functions of `Progress`, so reaching one never depends on
 * when the page happened to be open. The database only remembers when each
 * was first reached (`achievement_unlocks`), to date it and toast it once.
 *
 * Feats read the `details` each game records with a match (see the `record`
 * function in each game's hook). Per-game achievements are keyed by `GameId`:
 * a new game fails the type check here until it has its own.
 *
 * Ids are stored in the database — rename the text freely, never the id.
 */

export type Tier = 'bronze' | 'silver' | 'gold';
export const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold'];

export type Text = { ru: string; en: string };
export type AchievementGroup = 'general' | GameId;

interface Base {
  /** Stable: stored in the database. Lowercase, dots and underscores. */
  id: string;
  group: AchievementGroup;
  icon: LucideIcon;
  title: Text;
}

export interface Ladder extends Base {
  kind: 'ladder';
  steps: readonly [number, number, number];
  value: (p: Progress) => number;
  describe: (target: number) => Text;
}

export interface Feat extends Base {
  kind: 'feat';
  tier: Tier;
  description: Text;
  reached: (p: Progress) => boolean;
}

export type Achievement = Ladder | Feat;

// ---------------------------------------------------------------- helpers --

const matchesRu = (n: number) => `${n} ${pluralRu(n, ['матч', 'матча', 'матчей'])}`;
const matchesEn = (n: number) => `${n} ${pluralEn(n, 'match', 'matches')}`;
const roundsRu = (n: number) => `${n} ${pluralRu(n, ['раунд', 'раунда', 'раундов'])}`;
const roundsEn = (n: number) => `${n} ${pluralEn(n, 'round', 'rounds')}`;
const gameName = (id: GameId) => requireGame(id).name;

/** Any match in history of this game that satisfies the test. */
const any = (p: Progress, game: GameId, test: (row: MatchRow) => boolean) =>
  p.history.some((row) => row.game === game && test(row));

const count = (p: Progress, game: GameId, test: (row: MatchRow) => boolean) =>
  p.history.filter((row) => row.game === game && test(row)).length;

const num = (row: MatchRow, key: string) => {
  const v = row.details[key];
  return typeof v === 'number' ? v : NaN;
};

const won = (row: MatchRow) => row.result === 'win';

/** The player's own calendar day of a match — achievements about days are theirs, not UTC's. */
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The longest run of consecutive days with at least one match. */
function longestDayRun(p: Progress): number {
  const days = [...new Set(p.history.map((r) => localDay(r.playedAt)))].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of days) {
    const t = Date.parse(`${day}T12:00:00`);
    run = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

/** The most matches finished on one day. */
function busiestDay(p: Progress): number {
  const perDay = new Map<string, number>();
  for (const r of p.history) perDay.set(localDay(r.playedAt), (perDay.get(localDay(r.playedAt)) ?? 0) + 1);
  return Math.max(0, ...perDay.values());
}

/** A win straight after at least `losses` defeats in a row. */
function cameBack(p: Progress, losses: number): boolean {
  let run = 0;
  for (let i = p.history.length - 1; i >= 0; i--) {
    if (p.history[i].result === 'win') {
      if (run >= losses) return true;
      run = 0;
    } else {
      run++;
    }
  }
  return false;
}

// ---------------------------------------------------------------- general --

const GENERAL: Achievement[] = [
  {
    kind: 'ladder', id: 'matches', group: 'general', icon: Gamepad2,
    title: { ru: 'Завсегдатай', en: 'Regular' },
    steps: [10, 100, 500],
    value: (p) => p.matches,
    describe: (n) => ({ ru: `Сыграйте ${matchesRu(n)}`, en: `Play ${matchesEn(n)}` })
  },
  {
    kind: 'ladder', id: 'wins', group: 'general', icon: Trophy,
    title: { ru: 'Победитель', en: 'Winner' },
    steps: [10, 50, 250],
    value: (p) => p.wins,
    describe: (n) => ({ ru: `Выиграйте ${matchesRu(n)}`, en: `Win ${matchesEn(n)}` })
  },
  {
    kind: 'ladder', id: 'hours', group: 'general', icon: Clock,
    title: { ru: 'Время за игрой', en: 'Time at the Table' },
    steps: [1, 10, 50],
    value: (p) => p.seconds / 3600,
    describe: (n) => ({
      ru: `Проведите в играх ${n} ${pluralRu(n, ['час', 'часа', 'часов'])}`,
      en: `Spend ${n} ${pluralEn(n, 'hour', 'hours')} in games`
    })
  },
  {
    kind: 'ladder', id: 'streak', group: 'general', icon: Flame,
    title: { ru: 'Серия', en: 'On a Roll' },
    steps: [3, 5, 10],
    value: (p) => p.streak.best,
    describe: (n) => ({ ru: `Выиграйте ${matchesRu(n)} подряд`, en: `Win ${matchesEn(n)} in a row` })
  },
  {
    kind: 'ladder', id: 'explorer', group: 'general', icon: Compass,
    title: { ru: 'Кругозор', en: 'Explorer' },
    steps: [3, 5, GAMES.length],
    value: (p) => p.gamesPlayed,
    describe: (n) => n === GAMES.length
      ? { ru: 'Сыграйте во все игры', en: 'Play every game' }
      : { ru: `Сыграйте в ${n} ${pluralRu(n, ['разную игру', 'разные игры', 'разных игр'])}`, en: `Play ${n} different games` }
  },
  {
    kind: 'ladder', id: 'versatile', group: 'general', icon: Layers,
    title: { ru: 'Универсал', en: 'Jack of All Trades' },
    steps: [3, 5, GAMES.length],
    value: (p) => Object.values(p.games).filter((g) => g.wins > 0).length,
    describe: (n) => n === GAMES.length
      ? { ru: 'Победите в каждой игре', en: 'Win at every game' }
      : { ru: `Победите в ${n} ${pluralRu(n, ['разной игре', 'разных играх', 'разных играх'])}`, en: `Win at ${n} different games` }
  },
  {
    kind: 'ladder', id: 'daily', group: 'general', icon: CalendarDays,
    title: { ru: 'Каждый день', en: 'Every Day' },
    steps: [3, 7, 30],
    value: longestDayRun,
    describe: (n) => ({
      ru: `Играйте ${n} ${pluralRu(n, ['день', 'дня', 'дней'])} подряд`,
      en: `Play ${n} days in a row`
    })
  },
  {
    kind: 'feat', id: 'night_owl', group: 'general', icon: Moon, tier: 'bronze',
    title: { ru: 'Полуночник', en: 'Night Owl' },
    description: { ru: 'Сыграйте матч между полуночью и пятью утра', en: 'Finish a match between midnight and 5 am' },
    reached: (p) => p.history.some((r) => new Date(r.playedAt).getHours() < 5)
  },
  {
    kind: 'feat', id: 'marathon', group: 'general', icon: Rocket, tier: 'silver',
    title: { ru: 'Марафон', en: 'Marathon' },
    description: { ru: 'Сыграйте 10 матчей за один день', en: 'Play 10 matches in one day' },
    reached: (p) => busiestDay(p) >= 10
  },
  {
    kind: 'feat', id: 'comeback', group: 'general', icon: TrendingUp, tier: 'silver',
    title: { ru: 'Возвращение', en: 'Comeback' },
    description: { ru: 'Победите сразу после пяти поражений подряд', en: 'Win straight after five losses in a row' },
    reached: (p) => cameBack(p, 5)
  },
  {
    kind: 'feat', id: 'long_haul', group: 'general', icon: Hourglass, tier: 'bronze',
    title: { ru: 'Долгая партия', en: 'The Long Haul' },
    description: { ru: 'Сыграйте один матч длиной от получаса', en: 'Play a single match of half an hour or more' },
    reached: (p) => p.history.some((r) => r.durationSeconds >= 1800)
  }
];

// --------------------------------------------------------------- per game --

/** Each game has a ladder of wins with its own name. */
const WIN_LADDER_TITLES: Record<GameId, Text> = {
  spyfall: { ru: 'Агент', en: 'Field Agent' },
  minesweeper: { ru: 'Минёр', en: 'Bomb Squad' },
  flager: { ru: 'Вексиллолог', en: 'Vexillologist' },
  battleship: { ru: 'Адмирал', en: 'Admiral' },
  coup: { ru: 'Кукловод', en: 'Puppet Master' },
  wallrush: { ru: 'Прорыв', en: 'Breakthrough' },
  dots: { ru: 'Квадратура', en: 'Squaring Up' },
  reversi: { ru: 'Изнанка', en: 'Flip Side' },
  wikiler: { ru: 'Книжный червь', en: 'Bookworm' },
  timler: { ru: 'Хронист', en: 'Chronicler' }
};

const winLadder = (game: GameId): Ladder => ({
  kind: 'ladder',
  id: `${game}.wins`,
  group: game,
  icon: Crown,
  title: WIN_LADDER_TITLES[game],
  steps: [1, 10, 50],
  value: (p) => p.games[game].wins,
  describe: (n) => n === 1
    ? { ru: `Выиграйте первый матч в игре «${gameName(game).ru}»`, en: `Win your first match of ${gameName(game).en}` }
    : { ru: `Выиграйте ${matchesRu(n)} в игре «${gameName(game).ru}»`, en: `Win ${matchesEn(n)} of ${gameName(game).en}` }
});

type FeatSpec = Omit<Feat, 'kind' | 'group'>;
const feats = (game: GameId, list: FeatSpec[]): Feat[] => list.map((f) => ({ ...f, kind: 'feat', group: game }));

const FEATS: Record<GameId, Feat[]> = {
  spyfall: feats('spyfall', [
    {
      id: 'spyfall.disguise', icon: Eye, tier: 'silver',
      title: { ru: 'Мастер маскировки', en: 'Master of Disguise' },
      description: { ru: 'Победите шпионом, назвав локацию', en: 'Win as the spy by naming the location' },
      reached: (p) => any(p, 'spyfall', (r) => won(r) && r.details.spy === true && r.details.reason === 'guessed_loc')
    },
    {
      id: 'spyfall.shadow', icon: EyeOff, tier: 'silver',
      title: { ru: 'Тень', en: 'In Plain Sight' },
      description: { ru: 'Продержитесь шпионом до конца раунда', en: 'Last the whole round as the spy' },
      reached: (p) => any(p, 'spyfall', (r) => won(r) && r.details.spy === true && r.details.reason === 'time')
    },
    {
      id: 'spyfall.deep_cover', icon: Ghost, tier: 'gold',
      title: { ru: 'Глубокое прикрытие', en: 'Deep Cover' },
      description: { ru: 'Выиграйте пять раундов шпионом', en: 'Win five rounds as the spy' },
      reached: (p) => count(p, 'spyfall', (r) => won(r) && r.details.spy === true) >= 5
    },
    {
      id: 'spyfall.catcher', icon: Target, tier: 'silver',
      title: { ru: 'Разоблачитель', en: 'Spycatcher' },
      description: { ru: 'Поймайте шпиона своим обвинением', en: 'Catch the spy with your own accusation' },
      reached: (p) => any(p, 'spyfall', (r) => r.details.caughtSpy === true)
    },
    {
      id: 'spyfall.vigilant', icon: ShieldCheck, tier: 'silver',
      title: { ru: 'Бдительный гражданин', en: 'Vigilant' },
      description: { ru: 'Выиграйте десять раундов мирным жителем', en: 'Win ten rounds as a local' },
      reached: (p) => count(p, 'spyfall', (r) => won(r) && r.details.spy === false) >= 10
    },
    {
      id: 'spyfall.witch_hunt', icon: Flame, tier: 'bronze',
      title: { ru: 'Охота на ведьм', en: 'Witch Hunt' },
      description: { ru: 'Обвините невиновного — и добейтесь приговора', en: 'Accuse an innocent — and get them convicted' },
      reached: (p) => any(p, 'spyfall', (r) => r.details.wrongAccusation === true)
    }
  ]),

  minesweeper: feats('minesweeper', [
    {
      id: 'minesweeper.lightning', icon: Zap, tier: 'gold',
      title: { ru: 'Молния', en: 'Lightning' },
      description: { ru: 'Разминируйте поле от 16×16 быстрее трёх минут', en: 'Clear a board of 16×16 or more in under three minutes' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && num(r, 'size') >= 16 && r.durationSeconds < 180)
    },
    {
      id: 'minesweeper.no_flags', icon: Flag, tier: 'gold',
      title: { ru: 'Без страховки', en: 'No Safety Net' },
      description: { ru: 'Откройте всё поле от 16×16, не поставив ни одного флажка', en: 'Clear a board of 16×16 or more without planting a single flag' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && num(r, 'size') >= 16 && num(r, 'flags') === 0)
    },
    {
      id: 'minesweeper.pinpoint', icon: Crosshair, tier: 'silver',
      title: { ru: 'Точный расчёт', en: 'Pinpoint' },
      description: { ru: 'Победите, отметив флажками все мины раньше, чем открыв поле', en: 'Win by flagging every mine before opening every cell' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && r.details.byFlags === true)
    },
    {
      id: 'minesweeper.minefield', icon: Bomb, tier: 'silver',
      title: { ru: 'Минное поле', en: 'Minefield' },
      description: { ru: 'Победите на поле, где мины занимают четверть клеток и больше', en: 'Win on a board where a quarter of the cells or more are mines' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && num(r, 'mines') >= 0.25 * num(r, 'size') ** 2)
    },
    {
      id: 'minesweeper.giant', icon: Maximize2, tier: 'gold',
      title: { ru: 'Великан', en: 'Giant Board' },
      description: { ru: 'Разминируйте поле 40×40 или больше', en: 'Clear a board of 40×40 or more' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && num(r, 'size') >= 40)
    },
    {
      id: 'minesweeper.race', icon: Timer, tier: 'silver',
      title: { ru: 'Первым на финише', en: 'First Past the Post' },
      description: { ru: 'Выиграйте гонку против других игроков', en: 'Win a race against other players' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && r.mode === 'multi')
    },
    {
      id: 'minesweeper.so_close', icon: Skull, tier: 'bronze',
      title: { ru: 'Так близко', en: 'So Close' },
      description: { ru: 'Подорвитесь, когда до победы оставалась одна клетка', en: 'Hit a mine with one safe cell left to open' },
      reached: (p) => any(p, 'minesweeper', (r) => !won(r) && num(r, 'safeLeft') === 1)
    }
  ]),

  flager: feats('flager', [
    {
      id: 'flager.first_sight', icon: Sparkles, tier: 'bronze',
      title: { ru: 'С первого взгляда', en: 'At First Sight' },
      description: { ru: 'Угадайте флаг с первой попытки', en: 'Name a flag on the first guess' },
      reached: (p) => any(p, 'flager', (r) => num(r, 'firstTry') >= 1)
    },
    {
      id: 'flager.atlas', icon: MapIcon, tier: 'silver',
      title: { ru: 'Ходячий атлас', en: 'Walking Atlas' },
      description: { ru: `Угадайте все флаги в матче из ${roundsRu(5)} и больше`, en: `Name every flag in a match of ${roundsEn(5)} or more` },
      reached: (p) => any(p, 'flager', (r) => num(r, 'rounds') >= 5 && num(r, 'guessed') === num(r, 'rounds'))
    },
    {
      id: 'flager.photographic', icon: Medal, tier: 'gold',
      title: { ru: 'Фотографическая память', en: 'Photographic Memory' },
      description: { ru: `В матче из ${roundsRu(5)} и больше угадайте каждый флаг с первой попытки`, en: `In a match of ${roundsEn(5)} or more, name every flag on the first guess` },
      reached: (p) => any(p, 'flager', (r) => num(r, 'rounds') >= 5 && num(r, 'firstTry') === num(r, 'rounds'))
    },
    {
      id: 'flager.quick_draw', icon: Zap, tier: 'silver',
      title: { ru: 'Скорострел', en: 'Quick Draw' },
      description: { ru: 'Угадайте флаг за три секунды', en: 'Name a flag within three seconds' },
      reached: (p) => any(p, 'flager', (r) => num(r, 'fastest') <= 3)
    },
    {
      id: 'flager.last_chance', icon: Hourglass, tier: 'bronze',
      title: { ru: 'В последний момент', en: 'Last Chance' },
      description: { ru: 'Угадайте флаг с десятой, последней попытки', en: 'Name a flag on the tenth and last guess' },
      reached: (p) => any(p, 'flager', (r) => num(r, 'lastChance') >= 1)
    },
    {
      id: 'flager.high_score', icon: TrendingUp, tier: 'silver',
      title: { ru: 'Четыре тысячи', en: 'High Scorer' },
      description: { ru: 'Наберите 4000 очков в одном матче', en: 'Score 4,000 points in one match' },
      reached: (p) => any(p, 'flager', (r) => (r.score ?? 0) >= 4000)
    },
    {
      id: 'flager.top_of_class', icon: Users, tier: 'silver',
      title: { ru: 'Лучший в компании', en: 'Top of the Class' },
      description: { ru: 'Победите в матче, где играли четверо и больше', en: 'Win a match of four players or more' },
      reached: (p) => any(p, 'flager', (r) => won(r) && num(r, 'players') >= 4)
    }
  ]),

  battleship: feats('battleship', [
    {
      id: 'battleship.unsinkable', icon: Shield, tier: 'gold',
      title: { ru: 'Непотопляемый', en: 'Unsinkable' },
      description: { ru: 'Победите, не потеряв ни одного корабля', en: 'Win without losing a single ship' },
      reached: (p) => any(p, 'battleship', (r) => won(r) && num(r, 'shipsLost') === 0)
    },
    {
      id: 'battleship.marksman', icon: Crosshair, tier: 'gold',
      title: { ru: 'Меткий глаз', en: 'Marksman' },
      description: { ru: 'Потопите весь флот, сделав не больше 40 выстрелов', en: 'Sink the whole fleet in 40 shots or fewer' },
      reached: (p) => any(p, 'battleship', (r) => won(r) && num(r, 'shots') <= 40)
    },
    {
      id: 'battleship.by_a_thread', icon: Anchor, tier: 'silver',
      title: { ru: 'На волоске', en: 'By a Thread' },
      description: { ru: 'Победите, когда на плаву остался один корабль', en: 'Win with a single ship left afloat' },
      reached: (p) => any(p, 'battleship', (r) => won(r) && num(r, 'shipsLost') === 9)
    },
    {
      id: 'battleship.blitz', icon: Rocket, tier: 'silver',
      title: { ru: 'Блицкриг', en: 'Blitz' },
      description: { ru: 'Выиграйте бой быстрее пяти минут', en: 'Win a battle in under five minutes' },
      reached: (p) => any(p, 'battleship', (r) => won(r) && r.durationSeconds < 300)
    }
  ]),

  coup: feats('coup', [
    {
      id: 'coup.untouchable', icon: Shield, tier: 'gold',
      title: { ru: 'Неприкасаемый', en: 'Untouchable' },
      description: { ru: 'Победите, не потеряв ни одной карты', en: 'Win without losing a card' },
      reached: (p) => any(p, 'coup', (r) => won(r) && num(r, 'cardsLost') === 0)
    },
    {
      id: 'coup.last_breath', icon: Hourglass, tier: 'silver',
      title: { ru: 'На последнем издыхании', en: 'Last Breath' },
      description: { ru: 'Победите с одной оставшейся картой', en: 'Win with a single card left' },
      reached: (p) => any(p, 'coup', (r) => won(r) && num(r, 'cardsLost') === 1)
    },
    {
      id: 'coup.poker_face', icon: Wand2, tier: 'bronze',
      title: { ru: 'Покерфейс', en: 'Poker Face' },
      description: { ru: 'Проведите блеф: действие или блок без нужной карты, и никто не проверил', en: 'Pull off a bluff: an action or block without the card, and nobody called it' },
      reached: (p) => any(p, 'coup', (r) => num(r, 'bluffs') >= 1)
    },
    {
      id: 'coup.master_bluffer', icon: Sparkles, tier: 'gold',
      title: { ru: 'Мастер блефа', en: 'Master Bluffer' },
      description: { ru: 'Победите, проведя за матч три удачных блефа', en: 'Win a match with three bluffs that went through' },
      reached: (p) => any(p, 'coup', (r) => won(r) && num(r, 'bluffs') >= 3)
    },
    {
      id: 'coup.lie_detector', icon: Search, tier: 'silver',
      title: { ru: 'Детектор лжи', en: 'Lie Detector' },
      description: { ru: 'Поймайте на блефе двоих за один матч', en: 'Catch two bluffs with challenges in one match' },
      reached: (p) => any(p, 'coup', (r) => num(r, 'challengesWon') >= 2)
    },
    {
      id: 'coup.coup_detat', icon: Swords, tier: 'bronze',
      title: { ru: 'Государственный переворот', en: 'Coup d’État' },
      description: { ru: 'Устройте переворот', en: 'Launch a coup' },
      reached: (p) => any(p, 'coup', (r) => num(r, 'coups') >= 1)
    }
  ]),

  wallrush: feats('wallrush', [
    {
      id: 'wallrush.light', icon: Feather, tier: 'gold',
      title: { ru: 'Налегке', en: 'Travelling Light' },
      description: { ru: 'Победите, не поставив ни одной стены', en: 'Win without placing a wall' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && num(r, 'wallsUsed') === 0)
    },
    {
      id: 'wallrush.straight', icon: Route, tier: 'gold',
      title: { ru: 'Кратчайший путь', en: 'Straight Line' },
      description: { ru: 'Дойдите до цели за минимальное число ходов пешкой', en: 'Reach your goal in the fewest pawn moves possible' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && num(r, 'moves') <= num(r, 'shortest'))
    },
    {
      id: 'wallrush.builder', icon: Hammer, tier: 'bronze',
      title: { ru: 'Прораб', en: 'Master Builder' },
      description: { ru: 'Поставьте за матч все свои стены', en: 'Place every wall you have in one match' },
      reached: (p) => any(p, 'wallrush', (r) => num(r, 'wallsTotal') > 0 && num(r, 'wallsUsed') === num(r, 'wallsTotal'))
    },
    {
      id: 'wallrush.odd_one_in', icon: Scale, tier: 'silver',
      title: { ru: 'Третий не лишний', en: 'Odd One In' },
      description: { ru: 'Победите в игре втроём', en: 'Win a three-player match' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && r.details.mode === 'trio')
    },
    {
      id: 'wallrush.shoulder', icon: Handshake, tier: 'silver',
      title: { ru: 'Плечом к плечу', en: 'Shoulder to Shoulder' },
      description: { ru: 'Победите в командной игре', en: 'Win a team match' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && r.details.mode === 'teams')
    },
    {
      id: 'wallrush.crowd', icon: Users, tier: 'silver',
      title: { ru: 'Сквозь толпу', en: 'Through the Crowd' },
      description: { ru: 'Победите вчетвером, каждый за себя', en: 'Win a four-player free-for-all' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && r.details.mode === 'ffa')
    }
  ]),

  dots: feats('dots', [
    {
      id: 'dots.landslide', icon: Grid3x3, tier: 'gold',
      title: { ru: 'Разгром', en: 'Landslide' },
      description: { ru: 'Закройте три четверти квадратов на поле', en: 'Close three quarters of the boxes on the board' },
      reached: (p) => any(p, 'dots', (r) => num(r, 'boxesTotal') > 0 && (r.score ?? 0) >= num(r, 'boxesTotal') * 0.75)
    },
    {
      id: 'dots.chain', icon: Link2, tier: 'silver',
      title: { ru: 'Цепная реакция', en: 'Chain Reaction' },
      description: { ru: 'Закройте пять квадратов за один ход', en: 'Close five boxes in a single turn' },
      reached: (p) => any(p, 'dots', (r) => num(r, 'bestChain') >= 5)
    },
    {
      id: 'dots.big_board', icon: Maximize2, tier: 'bronze',
      title: { ru: 'Большое поле', en: 'Big Board' },
      description: { ru: 'Победите на поле 8×8', en: 'Win on an 8×8 board' },
      reached: (p) => any(p, 'dots', (r) => won(r) && num(r, 'size') >= 8)
    },
    {
      id: 'dots.dead_heat', icon: Scale, tier: 'bronze',
      title: { ru: 'Боевая ничья', en: 'Dead Heat' },
      description: { ru: 'Закончите матч вровень с лидером', en: 'Finish level with the leader' },
      reached: (p) => any(p, 'dots', (r) => r.details.draw === true)
    }
  ]),

  reversi: feats('reversi', [
    {
      id: 'reversi.wipeout', icon: Crosshair, tier: 'gold',
      title: { ru: 'Полный захват', en: 'Wipeout' },
      description: { ru: 'Победите, заняв 48 клеток и больше', en: 'Win holding 48 squares or more' },
      reached: (p) => any(p, 'reversi', (r) => won(r) && (r.score ?? 0) >= 48)
    },
    {
      id: 'reversi.annihilation', icon: Skull, tier: 'gold',
      title: { ru: 'Истребление', en: 'Annihilation' },
      description: { ru: 'Оставьте соперника без единой фишки', en: 'Leave your rival without a single disc' },
      reached: (p) => any(p, 'reversi', (r) => won(r) && num(r, 'opponentDiscs') === 0)
    },
    {
      id: 'reversi.corners', icon: Target, tier: 'silver',
      title: { ru: 'Хозяин углов', en: 'Four Corners' },
      description: { ru: 'Победите, заняв все четыре угла', en: 'Win holding all four corners' },
      reached: (p) => any(p, 'reversi', (r) => won(r) && num(r, 'corners') === 4)
    },
    {
      id: 'reversi.photo_finish', icon: Undo2, tier: 'bronze',
      title: { ru: 'Фотофиниш', en: 'Photo Finish' },
      description: { ru: 'Победите с перевесом в одну-две фишки', en: 'Win by one or two discs' },
      reached: (p) => any(p, 'reversi', (r) => won(r) && num(r, 'margin') >= 1 && num(r, 'margin') <= 2)
    }
  ]),

  // Reads the details the Wikiler hook records — docs/wikiler-spec.md, section 9.
  wikiler: feats('wikiler', [
    {
      id: 'wikiler.half_word', icon: Zap, tier: 'gold',
      title: { ru: 'С полуслова', en: 'In a Word' },
      description: { ru: 'Назовите статью за 5 попыток или меньше', en: 'Name the article in 5 attempts or fewer' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'quickTitle') <= 5)
    },
    {
      id: 'wikiler.thousand', icon: Crown, tier: 'gold',
      title: { ru: 'Тысячник', en: 'Near a Thousand' },
      description: { ru: 'Угадайте раунд на 950 очков и больше', en: 'Solve a round for 950 points or more' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'bestRound') >= 950)
    },
    {
      id: 'wikiler.clean', icon: Target, tier: 'silver',
      title: { ru: 'Без промаха', en: 'Clean Sheet' },
      description: { ru: 'Угадайте раунд без единого промаха', en: 'Solve a round without a single miss' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'cleanRounds') >= 1)
    },
    {
      id: 'wikiler.erudite', icon: Medal, tier: 'silver',
      title: { ru: 'Эрудит', en: 'Polymath' },
      description: { ru: 'Угадайте все раунды матча из пяти и больше', en: 'Solve every round of a match of five or more' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'rounds') >= 5 && num(r, 'solved') === num(r, 'rounds'))
    },
    {
      id: 'wikiler.lightning', icon: Timer, tier: 'silver',
      title: { ru: 'Молниеносно', en: 'Lightning Guess' },
      description: { ru: 'Угадайте статью за 30 секунд', en: 'Solve an article within 30 seconds' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'fastestSolve') <= 30)
    },
    {
      id: 'wikiler.last_try', icon: Hourglass, tier: 'bronze',
      title: { ru: 'На последней попытке', en: 'Last Attempt' },
      description: { ru: 'Угадайте статью на последней разрешённой попытке', en: 'Solve an article on the last attempt allowed' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'lastTry') >= 1)
    }
  ]),

  // Reads the details the Timler hook records — docs/timler-spec.md, section 9.
  timler: feats('timler', [
    {
      id: 'timler.bullseye', icon: Target, tier: 'silver',
      title: { ru: 'В яблочко', en: 'Bullseye' },
      description: { ru: 'Угадайте год точно', en: 'Name the exact year' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'exactYears') >= 1)
    },
    {
      id: 'timler.same_day', icon: CalendarDays, tier: 'gold',
      title: { ru: 'День в день', en: 'To the Day' },
      description: { ru: 'Угадайте дату точно — день, месяц и год', en: 'Name the exact date — day, month and year' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'exactDates') >= 1)
    },
    {
      id: 'timler.time_machine', icon: Rocket, tier: 'gold',
      title: { ru: 'Машина времени', en: 'Time Machine' },
      description: { ru: 'Сыграйте матч из 5 раундов и больше, ни разу не ошибившись больше чем на 2 года', en: 'Play a match of 5 rounds or more without ever being more than 2 years off' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'rounds') >= 5 && num(r, 'worstError') <= 2)
    },
    {
      id: 'timler.almost', icon: Hourglass, tier: 'bronze',
      title: { ru: 'Почти', en: 'So Close' },
      description: { ru: 'Ошибитесь ровно на один год', en: 'Be exactly one year off' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'oneOff') >= 1)
    },
    {
      id: 'timler.antique', icon: Feather, tier: 'silver',
      title: { ru: 'Старина', en: 'Antiquarian' },
      description: { ru: 'Угадайте точный год фото или картины до 1900 года', en: 'Name the exact year of a photo or painting from before 1900' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'oldExact') >= 1)
    },
    {
      id: 'timler.lightning', icon: Zap, tier: 'silver',
      title: { ru: 'Молния', en: 'Lightning' },
      description: { ru: 'Угадайте год точно за 5 секунд', en: 'Name the exact year within 5 seconds' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'fastExact') <= 5)
    }
  ])
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  ...GENERAL,
  ...GAMES.flatMap((g) => [winLadder(g.id), ...FEATS[g.id]])
];

/** The order groups appear in: general first, then the games as the registry lists them. */
export const GROUPS: readonly AchievementGroup[] = ['general', ...GAMES.map((g) => g.id)];
