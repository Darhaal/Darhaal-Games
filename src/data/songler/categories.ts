/**
 * Songler's categories — docs/songler-spec.md, section 6. The ids match the
 * pool builder (scripts/songler-pool.mjs), which says where each category's
 * songs come from; this file says what the lobby calls them.
 */

type Text = { ru: string; en: string; uk: string };

const GROUPS = {
  general: { ru: 'Общее', en: 'General', uk: 'Загальне' },
  decades: { ru: 'Десятилетия', en: 'Decades', uk: 'Десятиліття' },
  genres: { ru: 'Жанры', en: 'Genres', uk: 'Жанри' },
  screen: { ru: 'Кино, игры, аниме', en: 'Screen', uk: 'Кіно, ігри, аніме' },
  special: { ru: 'Особое', en: 'Special', uk: 'Особливе' },
  local: { ru: 'Русское и украинское', en: 'Russian & Ukrainian', uk: 'Російське й українське' }
} satisfies Record<string, Text>;

export const SONGLER_CATEGORIES = [
  'all', 'now',
  '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s',
  'pop', 'rock', 'metal', 'punk', 'alternative', 'hiphop', 'rnb', 'funk', 'dance', 'latin', 'kpop', 'country', 'jazz', 'classical', 'afro',
  'movies', 'disney', 'games', 'anime',
  'eurovision', 'christmas', 'summer', 'french',
  'ru-pop', 'ru-rock', 'ru-rap', 'soviet', 'ukrainian'
] as const;
export type SonglerCategory = (typeof SONGLER_CATEGORIES)[number];

export const CATEGORIES: Record<SonglerCategory, { emoji: string; label: Text; group: Text }> = {
  all: { emoji: '🎲', label: { ru: 'Всё подряд', en: 'Everything', uk: 'Усе поспіль' }, group: GROUPS.general },
  now: { emoji: '🔥', label: { ru: 'Хиты сейчас', en: 'Current hits', uk: 'Хіти зараз' }, group: GROUPS.general },
  '1960s': { emoji: '🌼', label: { ru: '60-е', en: '1960s', uk: '60-ті' }, group: GROUPS.decades },
  '1970s': { emoji: '🕺', label: { ru: '70-е', en: '1970s', uk: '70-ті' }, group: GROUPS.decades },
  '1980s': { emoji: '📼', label: { ru: '80-е', en: '1980s', uk: '80-ті' }, group: GROUPS.decades },
  '1990s': { emoji: '💿', label: { ru: '90-е', en: '1990s', uk: '90-ті' }, group: GROUPS.decades },
  '2000s': { emoji: '📱', label: { ru: '2000-е', en: '2000s', uk: '2000-ні' }, group: GROUPS.decades },
  '2010s': { emoji: '🎧', label: { ru: '2010-е', en: '2010s', uk: '2010-ті' }, group: GROUPS.decades },
  '2020s': { emoji: '🚀', label: { ru: '2020-е', en: '2020s', uk: '2020-ті' }, group: GROUPS.decades },
  pop: { emoji: '🎤', label: { ru: 'Поп', en: 'Pop', uk: 'Поп' }, group: GROUPS.genres },
  rock: { emoji: '🎸', label: { ru: 'Рок', en: 'Rock', uk: 'Рок' }, group: GROUPS.genres },
  metal: { emoji: '🤘', label: { ru: 'Метал и хард-рок', en: 'Metal & hard rock', uk: 'Метал і хард-рок' }, group: GROUPS.genres },
  punk: { emoji: '🧷', label: { ru: 'Панк', en: 'Punk', uk: 'Панк' }, group: GROUPS.genres },
  alternative: { emoji: '🌀', label: { ru: 'Альтернатива и инди', en: 'Alternative & indie', uk: 'Альтернатива й інді' }, group: GROUPS.genres },
  hiphop: { emoji: '🎙️', label: { ru: 'Хип-хоп', en: 'Hip-hop', uk: 'Хіп-хоп' }, group: GROUPS.genres },
  rnb: { emoji: '💜', label: { ru: 'R&B и соул', en: 'R&B & soul', uk: 'R&B і соул' }, group: GROUPS.genres },
  funk: { emoji: '🪩', label: { ru: 'Фанк и диско', en: 'Funk & disco', uk: 'Фанк і диско' }, group: GROUPS.genres },
  dance: { emoji: '⚡', label: { ru: 'Электроника и дэнс', en: 'Electronic & dance', uk: 'Електроніка й денс' }, group: GROUPS.genres },
  latin: { emoji: '💃', label: { ru: 'Латино и реггетон', en: 'Latin & reggaeton', uk: 'Латино й реґетон' }, group: GROUPS.genres },
  kpop: { emoji: '💖', label: { ru: 'K-pop', en: 'K-pop', uk: 'K-pop' }, group: GROUPS.genres },
  country: { emoji: '🤠', label: { ru: 'Кантри', en: 'Country', uk: 'Кантрі' }, group: GROUPS.genres },
  jazz: { emoji: '🎷', label: { ru: 'Джаз и блюз', en: 'Jazz & blues', uk: 'Джаз і блюз' }, group: GROUPS.genres },
  classical: { emoji: '🎻', label: { ru: 'Классика', en: 'Classical', uk: 'Класика' }, group: GROUPS.genres },
  afro: { emoji: '🌍', label: { ru: 'Афробит', en: 'Afrobeats', uk: 'Афробіт' }, group: GROUPS.genres },
  movies: { emoji: '🎬', label: { ru: 'Музыка из кино', en: 'Film music', uk: 'Музика з кіно' }, group: GROUPS.screen },
  disney: { emoji: '🏰', label: { ru: 'Disney', en: 'Disney', uk: 'Disney' }, group: GROUPS.screen },
  games: { emoji: '🎮', label: { ru: 'Музыка из игр', en: 'Game music', uk: 'Музика з ігор' }, group: GROUPS.screen },
  anime: { emoji: '🌸', label: { ru: 'Аниме', en: 'Anime', uk: 'Аніме' }, group: GROUPS.screen },
  eurovision: { emoji: '🎆', label: { ru: 'Евровидение', en: 'Eurovision', uk: 'Євробачення' }, group: GROUPS.special },
  christmas: { emoji: '🎄', label: { ru: 'Рождество', en: 'Christmas', uk: 'Різдво' }, group: GROUPS.special },
  summer: { emoji: '🏖️', label: { ru: 'Летние хиты', en: 'Summer hits', uk: 'Літні хіти' }, group: GROUPS.special },
  french: { emoji: '🥖', label: { ru: 'Французские песни', en: 'French songs', uk: 'Французькі пісні' }, group: GROUPS.special },
  'ru-pop': { emoji: '⭐', label: { ru: 'Русская поп-музыка', en: 'Russian pop', uk: 'Російська поп-музика' }, group: GROUPS.local },
  'ru-rock': { emoji: '🔥', label: { ru: 'Русский рок', en: 'Russian rock', uk: 'Російський рок' }, group: GROUPS.local },
  'ru-rap': { emoji: '🧢', label: { ru: 'Русский рэп', en: 'Russian rap', uk: 'Російський реп' }, group: GROUPS.local },
  soviet: { emoji: '📻', label: { ru: 'Советская эстрада', en: 'Soviet pop', uk: 'Радянська естрада' }, group: GROUPS.local },
  ukrainian: { emoji: '🌻', label: { ru: 'Украинская музыка', en: 'Ukrainian music', uk: 'Українська музика' }, group: GROUPS.local }
};
