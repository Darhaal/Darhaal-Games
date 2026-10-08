import { pluralEn, pluralRu } from '@/lib/plural';
import { INTL_LOCALE } from '@/lib/locale';

/** Every word on the progress page, in both languages. */
export const STRINGS = {
  ru: {
    title: 'Прогресс',
    subtitle: 'Статистика и достижения',
    back: 'Назад',
    level: 'Уровень',
    xp: 'опыта',
    toNext: (n: number, level: number) => `${n} до ${level} уровня`,
    registered: 'С нами с',
    guest: 'Гость',
    guestNote: 'Гостевой аккаунт удаляется через 30 дней без игр — вместе с прогрессом',
    matches: 'Матчи',
    wins: 'Победы',
    losses: 'Поражения',
    winRate: 'побед',
    vsOthers: (rate: number) => `${rate}% побед с соперниками`,
    soloOnly: 'только соло',
    unrated: 'нет данных',
    beforeHistory: 'Сыграно до истории матчей',
    time: 'В играх',
    streak: 'Лучшая серия',
    streakNow: (n: number) => (n > 0 ? `сейчас ${n}` : 'пока нет'),
    tabs: { achievements: 'Достижения', games: 'Игры', history: 'История' },
    all: 'Все',
    general: 'Общие',
    reached: 'Получено',
    notYet: 'Ещё не получено',
    complete: 'Все ступени',
    progressOf: (value: string, target: number) => `${value} из ${target}`,
    noMatches: 'Ещё не играли',
    fastestWin: 'Быстрая победа',
    solo: 'Соло',
    together: 'С друзьями',
    lastPlayed: 'Последняя',
    historyEmpty: 'Здесь будут ваши матчи',
    historyEmptyNote: 'История ведётся с версии 2.11 — сыграйте, и матч появится здесь.',
    earlier: (n: number) => `И ещё ${n} ${pluralRu(n, ['матч', 'матча', 'матчей'])} до того, как появилась история — они учтены в итогах и достижениях.`,
    win: 'Победа',
    loss: 'Поражение',
    left: 'вышел',
    soloChip: 'соло',
    showMore: 'Показать ещё',
    loadError: 'Не удалось загрузить прогресс',
    retry: 'Повторить'
  },
  en: {
    title: 'Progress',
    subtitle: 'Statistics and achievements',
    back: 'Back',
    level: 'Level',
    xp: 'XP',
    toNext: (n: number, level: number) => `${n} XP to level ${level}`,
    registered: 'Playing since',
    guest: 'Guest',
    guestNote: 'A guest account is deleted after 30 days without a match — progress with it',
    matches: 'Matches',
    wins: 'Wins',
    losses: 'Losses',
    winRate: 'won',
    vsOthers: (rate: number) => `${rate}% won against others`,
    soloOnly: 'solo only',
    unrated: 'no data',
    beforeHistory: 'Played before match history',
    time: 'Time played',
    streak: 'Best streak',
    streakNow: (n: number) => (n > 0 ? `${n} right now` : 'none yet'),
    tabs: { achievements: 'Achievements', games: 'Games', history: 'History' },
    all: 'All',
    general: 'General',
    reached: 'Unlocked',
    notYet: 'Not yet',
    complete: 'Every step',
    progressOf: (value: string, target: number) => `${value} of ${target}`,
    noMatches: 'Not played yet',
    fastestWin: 'Fastest win',
    solo: 'Solo',
    together: 'Together',
    lastPlayed: 'Last played',
    historyEmpty: 'Your matches will be here',
    historyEmptyNote: 'History is kept from version 2.11 — play a match and it shows up here.',
    earlier: (n: number) => `Plus ${n} ${pluralEn(n, 'match', 'matches')} from before history was kept — counted in the totals and achievements.`,
    win: 'Win',
    loss: 'Loss',
    left: 'left',
    soloChip: 'solo',
    showMore: 'Show more',
    loadError: 'Could not load your progress',
    retry: 'Try again'
  },
  uk: {
    title: 'Прогрес',
    subtitle: 'Статистика й досягнення',
    back: 'Назад',
    level: 'Рівень',
    xp: 'досвіду',
    toNext: (n: number, level: number) => `${n} до ${level} рівня`,
    registered: 'З нами з',
    guest: 'Гість',
    guestNote: 'Гостьовий акаунт видаляється через 30 днів без ігор — разом із прогресом',
    matches: 'Матчі',
    wins: 'Перемоги',
    losses: 'Поразки',
    winRate: 'перемог',
    vsOthers: (rate: number) => `${rate}% перемог із суперниками`,
    soloOnly: 'лише соло',
    unrated: 'немає даних',
    beforeHistory: 'Зіграно до історії матчів',
    time: 'В іграх',
    streak: 'Найкраща серія',
    streakNow: (n: number) => (n > 0 ? `зараз ${n}` : 'поки немає'),
    tabs: { achievements: 'Досягнення', games: 'Ігри', history: 'Історія' },
    all: 'Усі',
    general: 'Загальні',
    reached: 'Отримано',
    notYet: 'Ще не отримано',
    complete: 'Усі щаблі',
    progressOf: (value: string, target: number) => `${value} з ${target}`,
    noMatches: 'Ще не грали',
    fastestWin: 'Найшвидша перемога',
    solo: 'Соло',
    together: 'З друзями',
    lastPlayed: 'Остання',
    historyEmpty: 'Тут будуть ваші матчі',
    historyEmptyNote: 'Історія ведеться з версії 2.11 — зіграйте, і матч з’явиться тут.',
    earlier: (n: number) => `І ще ${n} ${pluralRu(n, ['матч', 'матчі', 'матчів'])} до того, як з’явилася історія, — вони враховані в підсумках і досягненнях.`,
    win: 'Перемога',
    loss: 'Поразка',
    left: 'вийшов',
    soloChip: 'соло',
    showMore: 'Показати ще',
    loadError: 'Не вдалося завантажити прогрес',
    retry: 'Повторити'
  }
} as const;

export type ProgressStrings = (typeof STRINGS)['ru' | 'en' | 'uk'];

/** 3 h 25 m, 12 m, 45 s. */
export function formatDuration(seconds: number, lang: 'ru' | 'en' | 'uk'): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const u = { ru: { h: 'ч', m: 'мин', s: 'с' }, en: { h: 'h', m: 'm', s: 's' }, uk: { h: 'год', m: 'хв', s: 'с' } }[lang];
  if (h > 0) return m > 0 ? `${h} ${u.h} ${m} ${u.m}` : `${h} ${u.h}`;
  if (m > 0) return `${m} ${u.m}`;
  return `${s} ${u.s}`;
}

/** A match's own length: 4:05, 1:02:10. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function formatDate(iso: string, lang: 'ru' | 'en' | 'uk', withTime = false): string {
  return new Date(iso).toLocaleString(INTL_LOCALE[lang], {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : { year: 'numeric' })
  });
}
