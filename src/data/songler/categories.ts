/**
 * Songler's categories — docs/songler-spec.md, section 6. The ids match the
 * pool builder (scripts/songler-pool.mjs), which says where each category's
 * songs come from; this file says what the lobby calls them.
 */

type Text = { ru: string; en: string };

const GROUPS = {
  general: { ru: 'Общее', en: 'General' },
  decades: { ru: 'Десятилетия', en: 'Decades' },
  genres: { ru: 'Жанры', en: 'Genres' },
  screen: { ru: 'Кино, игры, аниме', en: 'Screen' },
  special: { ru: 'Особое', en: 'Special' },
  local: { ru: 'Русское и украинское', en: 'Russian & Ukrainian' }
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
  all: { emoji: '🎲', label: { ru: 'Всё подряд', en: 'Everything' }, group: GROUPS.general },
  now: { emoji: '🔥', label: { ru: 'Хиты сейчас', en: 'Current hits' }, group: GROUPS.general },
  '1960s': { emoji: '🌼', label: { ru: '60-е', en: '1960s' }, group: GROUPS.decades },
  '1970s': { emoji: '🕺', label: { ru: '70-е', en: '1970s' }, group: GROUPS.decades },
  '1980s': { emoji: '📼', label: { ru: '80-е', en: '1980s' }, group: GROUPS.decades },
  '1990s': { emoji: '💿', label: { ru: '90-е', en: '1990s' }, group: GROUPS.decades },
  '2000s': { emoji: '📱', label: { ru: '2000-е', en: '2000s' }, group: GROUPS.decades },
  '2010s': { emoji: '🎧', label: { ru: '2010-е', en: '2010s' }, group: GROUPS.decades },
  '2020s': { emoji: '🚀', label: { ru: '2020-е', en: '2020s' }, group: GROUPS.decades },
  pop: { emoji: '🎤', label: { ru: 'Поп', en: 'Pop' }, group: GROUPS.genres },
  rock: { emoji: '🎸', label: { ru: 'Рок', en: 'Rock' }, group: GROUPS.genres },
  metal: { emoji: '🤘', label: { ru: 'Метал и хард-рок', en: 'Metal & hard rock' }, group: GROUPS.genres },
  punk: { emoji: '🧷', label: { ru: 'Панк', en: 'Punk' }, group: GROUPS.genres },
  alternative: { emoji: '🌀', label: { ru: 'Альтернатива и инди', en: 'Alternative & indie' }, group: GROUPS.genres },
  hiphop: { emoji: '🎙️', label: { ru: 'Хип-хоп', en: 'Hip-hop' }, group: GROUPS.genres },
  rnb: { emoji: '💜', label: { ru: 'R&B и соул', en: 'R&B & soul' }, group: GROUPS.genres },
  funk: { emoji: '🪩', label: { ru: 'Фанк и диско', en: 'Funk & disco' }, group: GROUPS.genres },
  dance: { emoji: '⚡', label: { ru: 'Электроника и дэнс', en: 'Electronic & dance' }, group: GROUPS.genres },
  latin: { emoji: '💃', label: { ru: 'Латино и реггетон', en: 'Latin & reggaeton' }, group: GROUPS.genres },
  kpop: { emoji: '💖', label: { ru: 'K-pop', en: 'K-pop' }, group: GROUPS.genres },
  country: { emoji: '🤠', label: { ru: 'Кантри', en: 'Country' }, group: GROUPS.genres },
  jazz: { emoji: '🎷', label: { ru: 'Джаз и блюз', en: 'Jazz & blues' }, group: GROUPS.genres },
  classical: { emoji: '🎻', label: { ru: 'Классика', en: 'Classical' }, group: GROUPS.genres },
  afro: { emoji: '🌍', label: { ru: 'Афробит', en: 'Afrobeats' }, group: GROUPS.genres },
  movies: { emoji: '🎬', label: { ru: 'Музыка из кино', en: 'Film music' }, group: GROUPS.screen },
  disney: { emoji: '🏰', label: { ru: 'Disney', en: 'Disney' }, group: GROUPS.screen },
  games: { emoji: '🎮', label: { ru: 'Музыка из игр', en: 'Game music' }, group: GROUPS.screen },
  anime: { emoji: '🌸', label: { ru: 'Аниме', en: 'Anime' }, group: GROUPS.screen },
  eurovision: { emoji: '🎆', label: { ru: 'Евровидение', en: 'Eurovision' }, group: GROUPS.special },
  christmas: { emoji: '🎄', label: { ru: 'Рождество', en: 'Christmas' }, group: GROUPS.special },
  summer: { emoji: '🏖️', label: { ru: 'Летние хиты', en: 'Summer hits' }, group: GROUPS.special },
  french: { emoji: '🥖', label: { ru: 'Французские песни', en: 'French songs' }, group: GROUPS.special },
  'ru-pop': { emoji: '⭐', label: { ru: 'Русская поп-музыка', en: 'Russian pop' }, group: GROUPS.local },
  'ru-rock': { emoji: '🔥', label: { ru: 'Русский рок', en: 'Russian rock' }, group: GROUPS.local },
  'ru-rap': { emoji: '🧢', label: { ru: 'Русский рэп', en: 'Russian rap' }, group: GROUPS.local },
  soviet: { emoji: '📻', label: { ru: 'Советская эстрада', en: 'Soviet pop' }, group: GROUPS.local },
  ukrainian: { emoji: '🌻', label: { ru: 'Украинская музыка', en: 'Ukrainian music' }, group: GROUPS.local }
};
