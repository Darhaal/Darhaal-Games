import {
  Anchor, Bomb, CalendarDays, Clock, Compass, Crosshair, Crown, Eye, EyeOff, Feather, Flag, Flame,
  Gamepad2, Ghost, Grid3x3, Hammer, Handshake, Hourglass, Layers, Link2, Map as MapIcon, Maximize2,
  Medal, Moon, Music, Rocket, Route, Scale, Search, Shield, ShieldCheck, Skull, Sparkles, Swords, Target,
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

export type Text = { ru: string; en: string; uk: string };
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
const matchesUk = (n: number) => `${n} ${pluralRu(n, ['матч', 'матчі', 'матчів'])}`;
const matchesEn = (n: number) => `${n} ${pluralEn(n, 'match', 'matches')}`;
const roundsRu = (n: number) => `${n} ${pluralRu(n, ['раунд', 'раунда', 'раундов'])}`;
const roundsUk = (n: number) => `${n} ${pluralRu(n, ['раунду', 'раундів', 'раундів'])}`;
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
    title: { ru: 'Завсегдатай', en: 'Regular', uk: 'Завсідник' },
    steps: [10, 100, 500],
    value: (p) => p.matches,
    describe: (n) => ({ ru: `Сыграйте ${matchesRu(n)}`, en: `Play ${matchesEn(n)}`, uk: `Зіграйте ${matchesUk(n)}` })
  },
  {
    kind: 'ladder', id: 'wins', group: 'general', icon: Trophy,
    title: { ru: 'Победитель', en: 'Winner', uk: 'Переможець' },
    steps: [10, 50, 250],
    value: (p) => p.wins,
    describe: (n) => ({ ru: `Выиграйте ${matchesRu(n)}`, en: `Win ${matchesEn(n)}`, uk: `Виграйте ${matchesUk(n)}` })
  },
  {
    kind: 'ladder', id: 'hours', group: 'general', icon: Clock,
    title: { ru: 'Время за игрой', en: 'Time at the Table', uk: 'Час за грою' },
    steps: [1, 10, 50],
    value: (p) => p.seconds / 3600,
    describe: (n) => ({
      ru: `Проведите в играх ${n} ${pluralRu(n, ['час', 'часа', 'часов'])}`,
      en: `Spend ${n} ${pluralEn(n, 'hour', 'hours')} in games`,
      uk: `Проведіть в іграх ${n} ${pluralRu(n, ['годину', 'години', 'годин'])}`
    })
  },
  {
    kind: 'ladder', id: 'streak', group: 'general', icon: Flame,
    title: { ru: 'Серия', en: 'On a Roll', uk: 'Серія' },
    steps: [3, 5, 10],
    value: (p) => p.streak.best,
    describe: (n) => ({ ru: `Выиграйте ${matchesRu(n)} подряд`, en: `Win ${matchesEn(n)} in a row`, uk: `Виграйте ${matchesUk(n)} поспіль` })
  },
  {
    kind: 'ladder', id: 'explorer', group: 'general', icon: Compass,
    title: { ru: 'Кругозор', en: 'Explorer', uk: 'Кругозір' },
    steps: [3, 5, GAMES.length],
    value: (p) => p.gamesPlayed,
    describe: (n) => n === GAMES.length
      ? { ru: 'Сыграйте во все игры', en: 'Play every game', uk: 'Зіграйте в усі ігри' }
      : { ru: `Сыграйте в ${n} ${pluralRu(n, ['разную игру', 'разные игры', 'разных игр'])}`, en: `Play ${n} different games`, uk: `Зіграйте в ${n} ${pluralRu(n, ['різну гру', 'різні гри', 'різних ігор'])}` }
  },
  {
    kind: 'ladder', id: 'versatile', group: 'general', icon: Layers,
    title: { ru: 'Универсал', en: 'Jack of All Trades', uk: 'Універсал' },
    steps: [3, 5, GAMES.length],
    value: (p) => Object.values(p.games).filter((g) => g.wins > 0).length,
    describe: (n) => n === GAMES.length
      ? { ru: 'Победите в каждой игре', en: 'Win at every game', uk: 'Переможіть у кожній грі' }
      : { ru: `Победите в ${n} ${pluralRu(n, ['разной игре', 'разных играх', 'разных играх'])}`, en: `Win at ${n} different games`, uk: `Переможіть у ${n} ${pluralRu(n, ['різній грі', 'різних іграх', 'різних іграх'])}` }
  },
  {
    kind: 'ladder', id: 'daily', group: 'general', icon: CalendarDays,
    title: { ru: 'Каждый день', en: 'Every Day', uk: 'Щодня' },
    steps: [3, 7, 30],
    value: longestDayRun,
    describe: (n) => ({
      ru: `Играйте ${n} ${pluralRu(n, ['день', 'дня', 'дней'])} подряд`,
      en: `Play ${n} days in a row`,
      uk: `Грайте ${n} ${pluralRu(n, ['день', 'дні', 'днів'])} поспіль`
    })
  },
  {
    kind: 'feat', id: 'night_owl', group: 'general', icon: Moon, tier: 'bronze',
    title: { ru: 'Полуночник', en: 'Night Owl', uk: 'Сова' },
    description: { ru: 'Сыграйте матч между полуночью и пятью утра', en: 'Finish a match between midnight and 5 am', uk: 'Зіграйте матч між північчю та п’ятою ранку' },
    reached: (p) => p.history.some((r) => new Date(r.playedAt).getHours() < 5)
  },
  {
    kind: 'feat', id: 'marathon', group: 'general', icon: Rocket, tier: 'silver',
    title: { ru: 'Марафон', en: 'Marathon', uk: 'Марафон' },
    description: { ru: 'Сыграйте 10 матчей за один день', en: 'Play 10 matches in one day', uk: 'Зіграйте 10 матчів за один день' },
    reached: (p) => busiestDay(p) >= 10
  },
  {
    kind: 'feat', id: 'comeback', group: 'general', icon: TrendingUp, tier: 'silver',
    title: { ru: 'Возвращение', en: 'Comeback', uk: 'Повернення' },
    description: { ru: 'Победите сразу после пяти поражений подряд', en: 'Win straight after five losses in a row', uk: 'Переможіть одразу після п’яти поразок поспіль' },
    reached: (p) => cameBack(p, 5)
  },
  {
    kind: 'feat', id: 'long_haul', group: 'general', icon: Hourglass, tier: 'bronze',
    title: { ru: 'Долгая партия', en: 'The Long Haul', uk: 'Довга партія' },
    description: { ru: 'Сыграйте один матч длиной от получаса', en: 'Play a single match of half an hour or more', uk: 'Зіграйте один матч тривалістю від пів години' },
    reached: (p) => p.history.some((r) => r.durationSeconds >= 1800)
  }
];

// --------------------------------------------------------------- per game --

/** Each game has a ladder of wins with its own name. */
const WIN_LADDER_TITLES: Record<GameId, Text> = {
  spyfall: { ru: 'Агент', en: 'Field Agent', uk: 'Агент' },
  minesweeper: { ru: 'Минёр', en: 'Bomb Squad', uk: 'Сапер' },
  flager: { ru: 'Вексиллолог', en: 'Vexillologist', uk: 'Вексилолог' },
  battleship: { ru: 'Адмирал', en: 'Admiral', uk: 'Адмірал' },
  coup: { ru: 'Кукловод', en: 'Puppet Master', uk: 'Ляльковод' },
  wallrush: { ru: 'Прорыв', en: 'Breakthrough', uk: 'Прорив' },
  dots: { ru: 'Квадратура', en: 'Squaring Up', uk: 'Квадратура' },
  reversi: { ru: 'Изнанка', en: 'Flip Side', uk: 'Навиворіт' },
  wikiler: { ru: 'Книжный червь', en: 'Bookworm', uk: 'Книжковий хробак' },
  timler: { ru: 'Хронист', en: 'Chronicler', uk: 'Хроніст' },
  songler: { ru: 'Диджей', en: 'DJ', uk: 'Діджей' }
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
    ? { ru: `Выиграйте первый матч в игре «${gameName(game).ru}»`, en: `Win your first match of ${gameName(game).en}`, uk: `Виграйте перший матч у грі «${gameName(game).uk}»` }
    : { ru: `Выиграйте ${matchesRu(n)} в игре «${gameName(game).ru}»`, en: `Win ${matchesEn(n)} of ${gameName(game).en}`, uk: `Виграйте ${matchesUk(n)} у грі «${gameName(game).uk}»` }
});

type FeatSpec = Omit<Feat, 'kind' | 'group'>;
const feats = (game: GameId, list: FeatSpec[]): Feat[] => list.map((f) => ({ ...f, kind: 'feat', group: game }));

const FEATS: Record<GameId, Feat[]> = {
  spyfall: feats('spyfall', [
    {
      id: 'spyfall.disguise', icon: Eye, tier: 'silver',
      title: { ru: 'Мастер маскировки', en: 'Master of Disguise', uk: 'Майстер маскування' },
      description: { ru: 'Победите шпионом, назвав локацию', en: 'Win as the spy by naming the location', uk: 'Переможіть шпигуном, назвавши локацію' },
      reached: (p) => any(p, 'spyfall', (r) => won(r) && r.details.spy === true && r.details.reason === 'guessed_loc')
    },
    {
      id: 'spyfall.shadow', icon: EyeOff, tier: 'silver',
      title: { ru: 'Тень', en: 'In Plain Sight', uk: 'Тінь' },
      description: { ru: 'Продержитесь шпионом до конца раунда', en: 'Last the whole round as the spy', uk: 'Протримайтеся шпигуном до кінця раунду' },
      reached: (p) => any(p, 'spyfall', (r) => won(r) && r.details.spy === true && r.details.reason === 'time')
    },
    {
      id: 'spyfall.deep_cover', icon: Ghost, tier: 'gold',
      title: { ru: 'Глубокое прикрытие', en: 'Deep Cover', uk: 'Глибоке прикриття' },
      description: { ru: 'Выиграйте пять раундов шпионом', en: 'Win five rounds as the spy', uk: 'Виграйте п’ять раундів шпигуном' },
      reached: (p) => count(p, 'spyfall', (r) => won(r) && r.details.spy === true) >= 5
    },
    {
      id: 'spyfall.catcher', icon: Target, tier: 'silver',
      title: { ru: 'Разоблачитель', en: 'Spycatcher', uk: 'Викривач' },
      description: { ru: 'Поймайте шпиона своим обвинением', en: 'Catch the spy with your own accusation', uk: 'Спіймайте шпигуна своїм звинуваченням' },
      reached: (p) => any(p, 'spyfall', (r) => r.details.caughtSpy === true)
    },
    {
      id: 'spyfall.vigilant', icon: ShieldCheck, tier: 'silver',
      title: { ru: 'Бдительный гражданин', en: 'Vigilant', uk: 'Пильний громадянин' },
      description: { ru: 'Выиграйте десять раундов мирным жителем', en: 'Win ten rounds as a local', uk: 'Виграйте десять раундів мирним мешканцем' },
      reached: (p) => count(p, 'spyfall', (r) => won(r) && r.details.spy === false) >= 10
    },
    {
      id: 'spyfall.witch_hunt', icon: Flame, tier: 'bronze',
      title: { ru: 'Охота на ведьм', en: 'Witch Hunt', uk: 'Полювання на відьом' },
      description: { ru: 'Обвините невиновного — и добейтесь приговора', en: 'Accuse an innocent — and get them convicted', uk: 'Звинуватьте невинного — і доможіться вироку' },
      reached: (p) => any(p, 'spyfall', (r) => r.details.wrongAccusation === true)
    }
  ]),

  minesweeper: feats('minesweeper', [
    {
      id: 'minesweeper.lightning', icon: Zap, tier: 'gold',
      title: { ru: 'Молния', en: 'Lightning', uk: 'Блискавка' },
      description: { ru: 'Разминируйте поле от 16×16 быстрее трёх минут', en: 'Clear a board of 16×16 or more in under three minutes', uk: 'Розмінуйте поле від 16×16 швидше ніж за три хвилини' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && num(r, 'size') >= 16 && r.durationSeconds < 180)
    },
    {
      id: 'minesweeper.no_flags', icon: Flag, tier: 'gold',
      title: { ru: 'Без страховки', en: 'No Safety Net', uk: 'Без страховки' },
      description: { ru: 'Откройте всё поле от 16×16, не поставив ни одного флажка', en: 'Clear a board of 16×16 or more without planting a single flag', uk: 'Відкрийте все поле від 16×16, не поставивши жодного прапорця' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && num(r, 'size') >= 16 && num(r, 'flags') === 0)
    },
    {
      id: 'minesweeper.pinpoint', icon: Crosshair, tier: 'silver',
      title: { ru: 'Точный расчёт', en: 'Pinpoint', uk: 'Точний розрахунок' },
      description: { ru: 'Победите, отметив флажками все мины раньше, чем открыв поле', en: 'Win by flagging every mine before opening every cell', uk: 'Переможіть, позначивши прапорцями всі міни раніше, ніж відкривши поле' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && r.details.byFlags === true)
    },
    {
      id: 'minesweeper.minefield', icon: Bomb, tier: 'silver',
      title: { ru: 'Минное поле', en: 'Minefield', uk: 'Мінне поле' },
      description: { ru: 'Победите на поле, где мины занимают четверть клеток и больше', en: 'Win on a board where a quarter of the cells or more are mines', uk: 'Переможіть на полі, де міни займають чверть клітинок і більше' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && num(r, 'mines') >= 0.25 * num(r, 'size') ** 2)
    },
    {
      id: 'minesweeper.giant', icon: Maximize2, tier: 'gold',
      title: { ru: 'Великан', en: 'Giant Board', uk: 'Велетень' },
      description: { ru: 'Разминируйте поле 40×40 или больше', en: 'Clear a board of 40×40 or more', uk: 'Розмінуйте поле 40×40 або більше' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && num(r, 'size') >= 40)
    },
    {
      id: 'minesweeper.race', icon: Timer, tier: 'silver',
      title: { ru: 'Первым на финише', en: 'First Past the Post', uk: 'Першим на фініші' },
      description: { ru: 'Выиграйте гонку против других игроков', en: 'Win a race against other players', uk: 'Виграйте перегони проти інших гравців' },
      reached: (p) => any(p, 'minesweeper', (r) => won(r) && r.mode === 'multi')
    },
    {
      id: 'minesweeper.so_close', icon: Skull, tier: 'bronze',
      title: { ru: 'Так близко', en: 'So Close', uk: 'Так близько' },
      description: { ru: 'Подорвитесь, когда до победы оставалась одна клетка', en: 'Hit a mine with one safe cell left to open', uk: 'Підірвіться, коли до перемоги залишалася одна клітинка' },
      reached: (p) => any(p, 'minesweeper', (r) => !won(r) && num(r, 'safeLeft') === 1)
    }
  ]),

  flager: feats('flager', [
    {
      id: 'flager.first_sight', icon: Sparkles, tier: 'bronze',
      title: { ru: 'С первого взгляда', en: 'At First Sight', uk: 'З першого погляду' },
      description: { ru: 'Угадайте флаг с первой попытки', en: 'Name a flag on the first guess', uk: 'Вгадайте прапор з першої спроби' },
      reached: (p) => any(p, 'flager', (r) => num(r, 'firstTry') >= 1)
    },
    {
      id: 'flager.atlas', icon: MapIcon, tier: 'silver',
      title: { ru: 'Ходячий атлас', en: 'Walking Atlas', uk: 'Ходячий атлас' },
      description: { ru: `Угадайте все флаги в матче из ${roundsRu(5)} и больше`, en: `Name every flag in a match of ${roundsEn(5)} or more`, uk: `Вгадайте всі прапори в матчі з ${roundsUk(5)} і більше` },
      reached: (p) => any(p, 'flager', (r) => num(r, 'rounds') >= 5 && num(r, 'guessed') === num(r, 'rounds'))
    },
    {
      id: 'flager.photographic', icon: Medal, tier: 'gold',
      title: { ru: 'Фотографическая память', en: 'Photographic Memory', uk: 'Фотографічна пам’ять' },
      description: { ru: `В матче из ${roundsRu(5)} и больше угадайте каждый флаг с первой попытки`, en: `In a match of ${roundsEn(5)} or more, name every flag on the first guess`, uk: `У матчі з ${roundsUk(5)} і більше вгадайте кожен прапор з першої спроби` },
      reached: (p) => any(p, 'flager', (r) => num(r, 'rounds') >= 5 && num(r, 'firstTry') === num(r, 'rounds'))
    },
    {
      id: 'flager.quick_draw', icon: Zap, tier: 'silver',
      title: { ru: 'Скорострел', en: 'Quick Draw', uk: 'Скорострільник' },
      description: { ru: 'Угадайте флаг за три секунды', en: 'Name a flag within three seconds', uk: 'Вгадайте прапор за три секунди' },
      reached: (p) => any(p, 'flager', (r) => num(r, 'fastest') <= 3)
    },
    {
      id: 'flager.last_chance', icon: Hourglass, tier: 'bronze',
      title: { ru: 'В последний момент', en: 'Last Chance', uk: 'В останню мить' },
      description: { ru: 'Угадайте флаг с десятой, последней попытки', en: 'Name a flag on the tenth and last guess', uk: 'Вгадайте прапор з десятої, останньої спроби' },
      reached: (p) => any(p, 'flager', (r) => num(r, 'lastChance') >= 1)
    },
    {
      id: 'flager.high_score', icon: TrendingUp, tier: 'silver',
      title: { ru: 'Четыре тысячи', en: 'High Scorer', uk: 'Чотири тисячі' },
      description: { ru: 'Наберите 4000 очков в одном матче', en: 'Score 4,000 points in one match', uk: 'Наберіть 4000 очок за один матч' },
      reached: (p) => any(p, 'flager', (r) => (r.score ?? 0) >= 4000)
    },
    {
      id: 'flager.top_of_class', icon: Users, tier: 'silver',
      title: { ru: 'Лучший в компании', en: 'Top of the Class', uk: 'Найкращий у компанії' },
      description: { ru: 'Победите в матче, где играли четверо и больше', en: 'Win a match of four players or more', uk: 'Переможіть у матчі, де грали четверо й більше' },
      reached: (p) => any(p, 'flager', (r) => won(r) && num(r, 'players') >= 4)
    }
  ]),

  battleship: feats('battleship', [
    {
      id: 'battleship.unsinkable', icon: Shield, tier: 'gold',
      title: { ru: 'Непотопляемый', en: 'Unsinkable', uk: 'Непотоплюваний' },
      description: { ru: 'Победите, не потеряв ни одного корабля', en: 'Win without losing a single ship', uk: 'Переможіть, не втративши жодного корабля' },
      reached: (p) => any(p, 'battleship', (r) => won(r) && num(r, 'shipsLost') === 0)
    },
    {
      id: 'battleship.marksman', icon: Crosshair, tier: 'gold',
      title: { ru: 'Меткий глаз', en: 'Marksman', uk: 'Влучне око' },
      description: { ru: 'Потопите весь флот, сделав не больше 40 выстрелов', en: 'Sink the whole fleet in 40 shots or fewer', uk: 'Потопіть увесь флот, зробивши не більше 40 пострілів' },
      reached: (p) => any(p, 'battleship', (r) => won(r) && num(r, 'shots') <= 40)
    },
    {
      id: 'battleship.by_a_thread', icon: Anchor, tier: 'silver',
      title: { ru: 'На волоске', en: 'By a Thread', uk: 'На волосинці' },
      description: { ru: 'Победите, когда на плаву остался один корабль', en: 'Win with a single ship left afloat', uk: 'Переможіть, коли на плаву залишився один корабель' },
      reached: (p) => any(p, 'battleship', (r) => won(r) && num(r, 'shipsLost') === 9)
    },
    {
      id: 'battleship.blitz', icon: Rocket, tier: 'silver',
      title: { ru: 'Блицкриг', en: 'Blitz', uk: 'Бліцкриг' },
      description: { ru: 'Выиграйте бой быстрее пяти минут', en: 'Win a battle in under five minutes', uk: 'Виграйте бій швидше ніж за п’ять хвилин' },
      reached: (p) => any(p, 'battleship', (r) => won(r) && r.durationSeconds < 300)
    }
  ]),

  coup: feats('coup', [
    {
      id: 'coup.untouchable', icon: Shield, tier: 'gold',
      title: { ru: 'Неприкасаемый', en: 'Untouchable', uk: 'Недоторканний' },
      description: { ru: 'Победите, не потеряв ни одной карты', en: 'Win without losing a card', uk: 'Переможіть, не втративши жодної карти' },
      reached: (p) => any(p, 'coup', (r) => won(r) && num(r, 'cardsLost') === 0)
    },
    {
      id: 'coup.last_breath', icon: Hourglass, tier: 'silver',
      title: { ru: 'На последнем издыхании', en: 'Last Breath', uk: 'На останньому подиху' },
      description: { ru: 'Победите с одной оставшейся картой', en: 'Win with a single card left', uk: 'Переможіть з однією картою, що залишилася' },
      reached: (p) => any(p, 'coup', (r) => won(r) && num(r, 'cardsLost') === 1)
    },
    {
      id: 'coup.poker_face', icon: Wand2, tier: 'bronze',
      title: { ru: 'Покерфейс', en: 'Poker Face', uk: 'Покерфейс' },
      description: { ru: 'Проведите блеф: действие или блок без нужной карты, и никто не проверил', en: 'Pull off a bluff: an action or block without the card, and nobody called it', uk: 'Проведіть блеф: дія або блок без потрібної карти, і ніхто не перевірив' },
      reached: (p) => any(p, 'coup', (r) => num(r, 'bluffs') >= 1)
    },
    {
      id: 'coup.master_bluffer', icon: Sparkles, tier: 'gold',
      title: { ru: 'Мастер блефа', en: 'Master Bluffer', uk: 'Майстер блефу' },
      description: { ru: 'Победите, проведя за матч три удачных блефа', en: 'Win a match with three bluffs that went through', uk: 'Переможіть, провівши за матч три вдалі блефи' },
      reached: (p) => any(p, 'coup', (r) => won(r) && num(r, 'bluffs') >= 3)
    },
    {
      id: 'coup.lie_detector', icon: Search, tier: 'silver',
      title: { ru: 'Детектор лжи', en: 'Lie Detector', uk: 'Детектор брехні' },
      description: { ru: 'Поймайте на блефе двоих за один матч', en: 'Catch two bluffs with challenges in one match', uk: 'Спіймайте на блефі двох за один матч' },
      reached: (p) => any(p, 'coup', (r) => num(r, 'challengesWon') >= 2)
    },
    {
      id: 'coup.coup_detat', icon: Swords, tier: 'bronze',
      title: { ru: 'Государственный переворот', en: 'Coup d’État', uk: 'Державний переворот' },
      description: { ru: 'Устройте переворот', en: 'Launch a coup', uk: 'Влаштуйте переворот' },
      reached: (p) => any(p, 'coup', (r) => num(r, 'coups') >= 1)
    }
  ]),

  wallrush: feats('wallrush', [
    {
      id: 'wallrush.light', icon: Feather, tier: 'gold',
      title: { ru: 'Налегке', en: 'Travelling Light', uk: 'Налегці' },
      description: { ru: 'Победите, не поставив ни одной стены', en: 'Win without placing a wall', uk: 'Переможіть, не поставивши жодної стіни' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && num(r, 'wallsUsed') === 0)
    },
    {
      id: 'wallrush.straight', icon: Route, tier: 'gold',
      title: { ru: 'Кратчайший путь', en: 'Straight Line', uk: 'Найкоротший шлях' },
      description: { ru: 'Дойдите до цели за минимальное число ходов пешкой', en: 'Reach your goal in the fewest pawn moves possible', uk: 'Дійдіть до мети за мінімальну кількість ходів пішаком' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && num(r, 'moves') <= num(r, 'shortest'))
    },
    {
      id: 'wallrush.builder', icon: Hammer, tier: 'bronze',
      title: { ru: 'Прораб', en: 'Master Builder', uk: 'Виконроб' },
      description: { ru: 'Поставьте за матч все свои стены', en: 'Place every wall you have in one match', uk: 'Поставте за матч усі свої стіни' },
      reached: (p) => any(p, 'wallrush', (r) => num(r, 'wallsTotal') > 0 && num(r, 'wallsUsed') === num(r, 'wallsTotal'))
    },
    {
      id: 'wallrush.odd_one_in', icon: Scale, tier: 'silver',
      title: { ru: 'Третий не лишний', en: 'Odd One In', uk: 'Третій не зайвий' },
      description: { ru: 'Победите в игре втроём', en: 'Win a three-player match', uk: 'Переможіть у грі втрьох' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && r.details.mode === 'trio')
    },
    {
      id: 'wallrush.shoulder', icon: Handshake, tier: 'silver',
      title: { ru: 'Плечом к плечу', en: 'Shoulder to Shoulder', uk: 'Пліч-о-пліч' },
      description: { ru: 'Победите в командной игре', en: 'Win a team match', uk: 'Переможіть у командній грі' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && r.details.mode === 'teams')
    },
    {
      id: 'wallrush.crowd', icon: Users, tier: 'silver',
      title: { ru: 'Сквозь толпу', en: 'Through the Crowd', uk: 'Крізь натовп' },
      description: { ru: 'Победите вчетвером, каждый за себя', en: 'Win a four-player free-for-all', uk: 'Переможіть учотирьох, кожен за себе' },
      reached: (p) => any(p, 'wallrush', (r) => won(r) && r.details.mode === 'ffa')
    }
  ]),

  dots: feats('dots', [
    {
      id: 'dots.landslide', icon: Grid3x3, tier: 'gold',
      title: { ru: 'Разгром', en: 'Landslide', uk: 'Розгром' },
      description: { ru: 'Закройте три четверти квадратов на поле', en: 'Close three quarters of the boxes on the board', uk: 'Закрийте три чверті квадратів на полі' },
      reached: (p) => any(p, 'dots', (r) => num(r, 'boxesTotal') > 0 && (r.score ?? 0) >= num(r, 'boxesTotal') * 0.75)
    },
    {
      id: 'dots.chain', icon: Link2, tier: 'silver',
      title: { ru: 'Цепная реакция', en: 'Chain Reaction', uk: 'Ланцюгова реакція' },
      description: { ru: 'Закройте пять квадратов за один ход', en: 'Close five boxes in a single turn', uk: 'Закрийте п’ять квадратів за один хід' },
      reached: (p) => any(p, 'dots', (r) => num(r, 'bestChain') >= 5)
    },
    {
      id: 'dots.big_board', icon: Maximize2, tier: 'bronze',
      title: { ru: 'Большое поле', en: 'Big Board', uk: 'Велике поле' },
      description: { ru: 'Победите на поле 8×8', en: 'Win on an 8×8 board', uk: 'Переможіть на полі 8×8' },
      reached: (p) => any(p, 'dots', (r) => won(r) && num(r, 'size') >= 8)
    },
    {
      id: 'dots.dead_heat', icon: Scale, tier: 'bronze',
      title: { ru: 'Боевая ничья', en: 'Dead Heat', uk: 'Бойова нічия' },
      description: { ru: 'Закончите матч вровень с лидером', en: 'Finish level with the leader', uk: 'Закінчіть матч нарівні з лідером' },
      reached: (p) => any(p, 'dots', (r) => r.details.draw === true)
    }
  ]),

  reversi: feats('reversi', [
    {
      id: 'reversi.wipeout', icon: Crosshair, tier: 'gold',
      title: { ru: 'Полный захват', en: 'Wipeout', uk: 'Повне захоплення' },
      description: { ru: 'Победите, заняв 48 клеток и больше', en: 'Win holding 48 squares or more', uk: 'Переможіть, зайнявши 48 клітинок і більше' },
      reached: (p) => any(p, 'reversi', (r) => won(r) && (r.score ?? 0) >= 48)
    },
    {
      id: 'reversi.annihilation', icon: Skull, tier: 'gold',
      title: { ru: 'Истребление', en: 'Annihilation', uk: 'Винищення' },
      description: { ru: 'Оставьте соперника без единой фишки', en: 'Leave your rival without a single disc', uk: 'Залиште суперника без жодної фішки' },
      reached: (p) => any(p, 'reversi', (r) => won(r) && num(r, 'opponentDiscs') === 0)
    },
    {
      id: 'reversi.corners', icon: Target, tier: 'silver',
      title: { ru: 'Хозяин углов', en: 'Four Corners', uk: 'Господар кутів' },
      description: { ru: 'Победите, заняв все четыре угла', en: 'Win holding all four corners', uk: 'Переможіть, зайнявши всі чотири кути' },
      reached: (p) => any(p, 'reversi', (r) => won(r) && num(r, 'corners') === 4)
    },
    {
      id: 'reversi.photo_finish', icon: Undo2, tier: 'bronze',
      title: { ru: 'Фотофиниш', en: 'Photo Finish', uk: 'Фотофініш' },
      description: { ru: 'Победите с перевесом в одну-две фишки', en: 'Win by one or two discs', uk: 'Переможіть з перевагою в одну-дві фішки' },
      reached: (p) => any(p, 'reversi', (r) => won(r) && num(r, 'margin') >= 1 && num(r, 'margin') <= 2)
    }
  ]),

  // Reads the details the Wikiler hook records — docs/wikiler-spec.md, section 9.
  wikiler: feats('wikiler', [
    {
      id: 'wikiler.half_word', icon: Zap, tier: 'gold',
      title: { ru: 'С полуслова', en: 'In a Word', uk: 'З півслова' },
      description: { ru: 'Назовите статью за 5 попыток или меньше', en: 'Name the article in 5 attempts or fewer', uk: 'Назвіть статтю за 5 спроб або менше' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'quickTitle') <= 5)
    },
    {
      id: 'wikiler.thousand', icon: Crown, tier: 'gold',
      title: { ru: 'Тысячник', en: 'Near a Thousand', uk: 'Тисячник' },
      description: { ru: 'Угадайте раунд на 950 очков и больше', en: 'Solve a round for 950 points or more', uk: 'Вгадайте раунд на 950 очок і більше' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'bestRound') >= 950)
    },
    {
      id: 'wikiler.clean', icon: Target, tier: 'silver',
      title: { ru: 'Без промаха', en: 'Clean Sheet', uk: 'Без промаху' },
      description: { ru: 'Угадайте раунд без единого промаха', en: 'Solve a round without a single miss', uk: 'Вгадайте раунд без жодного промаху' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'cleanRounds') >= 1)
    },
    {
      id: 'wikiler.erudite', icon: Medal, tier: 'silver',
      title: { ru: 'Эрудит', en: 'Polymath', uk: 'Ерудит' },
      description: { ru: 'Угадайте все раунды матча из пяти и больше', en: 'Solve every round of a match of five or more', uk: 'Вгадайте всі раунди матчу з п’яти й більше' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'rounds') >= 5 && num(r, 'solved') === num(r, 'rounds'))
    },
    {
      id: 'wikiler.lightning', icon: Timer, tier: 'silver',
      title: { ru: 'Молниеносно', en: 'Lightning Guess', uk: 'Блискавично' },
      description: { ru: 'Угадайте статью за 30 секунд', en: 'Solve an article within 30 seconds', uk: 'Вгадайте статтю за 30 секунд' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'fastestSolve') <= 30)
    },
    {
      id: 'wikiler.last_try', icon: Hourglass, tier: 'bronze',
      title: { ru: 'На последней попытке', en: 'Last Attempt', uk: 'На останній спробі' },
      description: { ru: 'Угадайте статью на последней разрешённой попытке', en: 'Solve an article on the last attempt allowed', uk: 'Вгадайте статтю на останній дозволеній спробі' },
      reached: (p) => any(p, 'wikiler', (r) => num(r, 'lastTry') >= 1)
    }
  ]),

  // Reads the details the Timler hook records — docs/timler-spec.md, section 9.
  timler: feats('timler', [
    {
      id: 'timler.bullseye', icon: Target, tier: 'silver',
      title: { ru: 'В яблочко', en: 'Bullseye', uk: 'У яблучко' },
      description: { ru: 'Угадайте год точно', en: 'Name the exact year', uk: 'Вгадайте рік точно' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'exactYears') >= 1)
    },
    {
      id: 'timler.same_day', icon: CalendarDays, tier: 'gold',
      title: { ru: 'День в день', en: 'To the Day', uk: 'День у день' },
      description: { ru: 'Угадайте дату точно — день, месяц и год', en: 'Name the exact date — day, month and year', uk: 'Вгадайте дату точно — день, місяць і рік' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'exactDates') >= 1)
    },
    {
      id: 'timler.time_machine', icon: Rocket, tier: 'gold',
      title: { ru: 'Машина времени', en: 'Time Machine', uk: 'Машина часу' },
      description: { ru: 'Сыграйте матч из 5 раундов и больше, ни разу не ошибившись больше чем на 2 года', en: 'Play a match of 5 rounds or more without ever being more than 2 years off', uk: 'Зіграйте матч із 5 раундів і більше, жодного разу не помилившись більше ніж на 2 роки' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'rounds') >= 5 && num(r, 'worstError') <= 2)
    },
    {
      id: 'timler.almost', icon: Hourglass, tier: 'bronze',
      title: { ru: 'Почти', en: 'So Close', uk: 'Майже' },
      description: { ru: 'Ошибитесь ровно на один год', en: 'Be exactly one year off', uk: 'Помиліться рівно на один рік' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'oneOff') >= 1)
    },
    {
      id: 'timler.antique', icon: Feather, tier: 'silver',
      title: { ru: 'Старина', en: 'Antiquarian', uk: 'Старовина' },
      description: { ru: 'Угадайте точный год фото или картины до 1900 года', en: 'Name the exact year of a photo or painting from before 1900', uk: 'Вгадайте точний рік фото або картини до 1900 року' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'oldExact') >= 1)
    },
    {
      id: 'timler.lightning', icon: Zap, tier: 'silver',
      title: { ru: 'Молния', en: 'Lightning', uk: 'Блискавка' },
      description: { ru: 'Угадайте год точно за 5 секунд', en: 'Name the exact year within 5 seconds', uk: 'Вгадайте рік точно за 5 секунд' },
      reached: (p) => any(p, 'timler', (r) => num(r, 'fastExact') <= 5)
    }
  ]),

  // Reads the details the Songler hook records — docs/songler-spec.md, section 9.
  songler: feats('songler', [
    {
      id: 'songler.first_note', icon: Music, tier: 'gold',
      title: { ru: 'С первой ноты', en: 'First Note', uk: 'З першої ноти' },
      description: { ru: 'Угадайте песню по первой половине секунды', en: 'Name a song from its first half second', uk: 'Вгадайте пісню за першою половиною секунди' },
      reached: (p) => any(p, 'songler', (r) => num(r, 'firstNote') >= 1)
    },
    {
      id: 'songler.perfect_pitch', icon: Sparkles, tier: 'gold',
      title: { ru: 'Абсолютный слух', en: 'Perfect Pitch', uk: 'Абсолютний слух' },
      description: { ru: 'Сыграйте матч из 5 раундов и больше, угадывая каждую песню не дольше чем со второй попытки', en: 'Play a match of 5 rounds or more naming every song within two tries', uk: 'Зіграйте матч із 5 раундів і більше, вгадуючи кожну пісню не пізніше ніж з другої спроби' },
      reached: (p) => any(p, 'songler', (r) => num(r, 'rounds') >= 5 && num(r, 'worstTry') <= 1)
    },
    {
      id: 'songler.clean_sweep', icon: Trophy, tier: 'silver',
      title: { ru: 'Ни одной мимо', en: 'Clean Sweep', uk: 'Жодної повз' },
      description: { ru: 'Угадайте все песни матча из 5 раундов и больше', en: 'Name every song of a match of 5 rounds or more', uk: 'Вгадайте всі пісні матчу з 5 раундів і більше' },
      reached: (p) => any(p, 'songler', (r) => num(r, 'rounds') >= 5 && num(r, 'solved') === num(r, 'rounds'))
    },
    {
      id: 'songler.last_chance', icon: Hourglass, tier: 'bronze',
      title: { ru: 'В последний момент', en: 'Last Chance', uk: 'В останню мить' },
      description: { ru: 'Угадайте песню с последней попытки', en: 'Name a song on the last try', uk: 'Вгадайте пісню з останньої спроби' },
      reached: (p) => any(p, 'songler', (r) => num(r, 'lastChance') >= 1)
    },
    {
      id: 'songler.lightning', icon: Zap, tier: 'silver',
      title: { ru: 'Молния', en: 'Lightning', uk: 'Блискавка' },
      description: { ru: 'Угадайте песню за 5 секунд', en: 'Name a song within 5 seconds', uk: 'Вгадайте пісню за 5 секунд' },
      reached: (p) => any(p, 'songler', (r) => num(r, 'fastest') <= 5)
    },
    {
      id: 'songler.deep_cut', icon: Search, tier: 'gold',
      title: { ru: 'Знаток', en: 'Deep Cut', uk: 'Знавець' },
      description: { ru: 'На сложности «Сложно» угадайте песню по первой половине секунды', en: 'On Hard, name a song from its first half second', uk: 'На складності «Складно» вгадайте пісню за першою половиною секунди' },
      reached: (p) => any(p, 'songler', (r) => r.details.difficulty === 'hard' && num(r, 'firstNote') >= 1)
    }
  ])
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  ...GENERAL,
  ...GAMES.flatMap((g) => [winLadder(g.id), ...FEATS[g.id]])
];

/** The order groups appear in: general first, then the games as the registry lists them. */
export const GROUPS: readonly AchievementGroup[] = ['general', ...GAMES.map((g) => g.id)];
