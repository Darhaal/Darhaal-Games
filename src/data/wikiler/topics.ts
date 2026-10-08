import TOPIC_SOURCES from './topic-sources.json';

/**
 * Wikiler's topics — docs/wikiler-spec.md, section 5. `random` is all of
 * Wikipedia; every other topic draws from the level-4 vital articles, one
 * file per topic under public/wikiler/<topic>.json with each article's title
 * in every language, built by scripts/wikiler-pool.mjs from
 * topic-sources.json (which pages and sections feed which topic). A broad
 * topic ("People") holds all of its narrower ones.
 */

type Text = { ru: string; en: string; uk: string };

interface TopicDef {
  id: string;
  emoji: string;
  label: Text;
  /** The heading it sits under in the lobby's dropdown. */
  group: Text;
}

const G = {
  any: { ru: 'Любая', en: 'Any', uk: 'Будь-яка' },
  people: { ru: 'Люди', en: 'People', uk: 'Люди' },
  history: { ru: 'История и общество', en: 'History and society', uk: 'Історія й суспільство' },
  geography: { ru: 'География', en: 'Geography', uk: 'Географія' },
  culture: { ru: 'Культура', en: 'Culture', uk: 'Культура' },
  life: { ru: 'Жизнь и природа', en: 'Life and nature', uk: 'Життя й природа' },
  science: { ru: 'Наука и техника', en: 'Science and technology', uk: 'Наука й техніка' }
};

const DEFS = [
  { id: 'random', emoji: '🎲', label: { ru: 'Случайная статья', en: 'Random article', uk: 'Випадкова стаття' }, group: G.any },

  { id: 'people', emoji: '👤', label: { ru: 'Все люди', en: 'All people', uk: 'Усі люди' }, group: G.people },
  { id: 'people_politicians', emoji: '👑', label: { ru: 'Политики и правители', en: 'Politicians and leaders', uk: 'Політики й правителі' }, group: G.people },
  { id: 'people_military', emoji: '⚔️', label: { ru: 'Полководцы и революционеры', en: 'Military and revolutionaries', uk: 'Полководці й революціонери' }, group: G.people },
  { id: 'people_scientists', emoji: '🔬', label: { ru: 'Учёные и изобретатели', en: 'Scientists and inventors', uk: 'Науковці й винахідники' }, group: G.people },
  { id: 'people_thinkers', emoji: '🧠', label: { ru: 'Философы и историки', en: 'Philosophers and historians', uk: 'Філософи й історики' }, group: G.people },
  { id: 'people_writers', emoji: '✍️', label: { ru: 'Писатели и журналисты', en: 'Writers and journalists', uk: 'Письменники й журналісти' }, group: G.people },
  { id: 'people_artists', emoji: '🎼', label: { ru: 'Художники и композиторы', en: 'Artists and composers', uk: 'Художники й композитори' }, group: G.people },
  { id: 'people_screen', emoji: '🎬', label: { ru: 'Кино, сцена и эстрада', en: 'Screen and stage', uk: 'Кіно, сцена й естрада' }, group: G.people },
  { id: 'people_sports', emoji: '🏅', label: { ru: 'Спортсмены', en: 'Sports figures', uk: 'Спортсмени' }, group: G.people },
  { id: 'people_explorers', emoji: '🧭', label: { ru: 'Путешественники и предприниматели', en: 'Explorers and businesspeople', uk: 'Мандрівники й підприємці' }, group: G.people },
  { id: 'people_religious', emoji: '🕊️', label: { ru: 'Религиозные деятели', en: 'Religious figures', uk: 'Релігійні діячі' }, group: G.people },

  { id: 'history', emoji: '🏛️', label: { ru: 'История', en: 'History', uk: 'Історія' }, group: G.history },
  { id: 'society', emoji: '👥', label: { ru: 'Общество', en: 'Society', uk: 'Суспільство' }, group: G.history },
  { id: 'politics', emoji: '📈', label: { ru: 'Политика и экономика', en: 'Politics and economics', uk: 'Політика й економіка' }, group: G.history },

  { id: 'geography', emoji: '🌍', label: { ru: 'Вся география', en: 'All geography', uk: 'Уся географія' }, group: G.geography },
  { id: 'countries', emoji: '🗺️', label: { ru: 'Страны', en: 'Countries', uk: 'Країни' }, group: G.geography },
  { id: 'cities', emoji: '🏙️', label: { ru: 'Города', en: 'Cities', uk: 'Міста' }, group: G.geography },
  { id: 'landforms', emoji: '⛰️', label: { ru: 'Горы, реки и моря', en: 'Mountains, rivers and seas', uk: 'Гори, річки й моря' }, group: G.geography },

  { id: 'arts', emoji: '🎨', label: { ru: 'Искусство', en: 'Arts', uk: 'Мистецтво' }, group: G.culture },
  { id: 'culture', emoji: '🎭', label: { ru: 'Культура и традиции', en: 'Culture and traditions', uk: 'Культура й традиції' }, group: G.culture },
  { id: 'philosophy', emoji: '📜', label: { ru: 'Философия и религия', en: 'Philosophy and religion', uk: 'Філософія й релігія' }, group: G.culture },

  { id: 'everyday', emoji: '🏠', label: { ru: 'Повседневная жизнь', en: 'Everyday life', uk: 'Повсякденне життя' }, group: G.life },
  { id: 'sports', emoji: '⚽', label: { ru: 'Спорт и игры', en: 'Sports and games', uk: 'Спорт та ігри' }, group: G.life },
  { id: 'biology', emoji: '🧬', label: { ru: 'Биология и медицина', en: 'Biology and health', uk: 'Біологія й медицина' }, group: G.life },
  { id: 'animals', emoji: '🦊', label: { ru: 'Животные', en: 'Animals', uk: 'Тварини' }, group: G.life },
  { id: 'plants', emoji: '🌿', label: { ru: 'Растения', en: 'Plants', uk: 'Рослини' }, group: G.life },
  { id: 'health', emoji: '🩺', label: { ru: 'Здоровье и медицина', en: 'Health and medicine', uk: 'Здоров’я й медицина' }, group: G.life },

  { id: 'physical', emoji: '🔭', label: { ru: 'Естественные науки', en: 'Physical sciences', uk: 'Природничі науки' }, group: G.science },
  { id: 'astronomy', emoji: '🪐', label: { ru: 'Астрономия', en: 'Astronomy', uk: 'Астрономія' }, group: G.science },
  { id: 'physics', emoji: '⚛️', label: { ru: 'Физика', en: 'Physics', uk: 'Фізика' }, group: G.science },
  { id: 'chemistry', emoji: '🧪', label: { ru: 'Химия', en: 'Chemistry', uk: 'Хімія' }, group: G.science },
  { id: 'earth', emoji: '🌋', label: { ru: 'Науки о Земле', en: 'Earth sciences', uk: 'Науки про Землю' }, group: G.science },
  { id: 'technology', emoji: '⚙️', label: { ru: 'Технологии', en: 'Technology', uk: 'Технології' }, group: G.science },
  { id: 'mathematics', emoji: '➗', label: { ru: 'Математика', en: 'Mathematics', uk: 'Математика' }, group: G.science }
] as const satisfies readonly TopicDef[];

export type WikilerTopic = (typeof DEFS)[number]['id'];

export const WIKILER_TOPICS: readonly WikilerTopic[] = DEFS.map((d) => d.id);

/** Topics that have a pool file — every one but `random`. */
export const POOL_TOPICS = WIKILER_TOPICS.filter((t) => t !== 'random') as Exclude<WikilerTopic, 'random'>[];

export const TOPICS: Record<WikilerTopic, TopicDef> = Object.fromEntries(DEFS.map((d) => [d.id, d])) as Record<WikilerTopic, TopicDef>;

/**
 * How well known the articles are (docs/wikiler-spec.md, section 5): a topic's
 * articles ranked by how much they are read in the round's language, in
 * thirds — the most read are easy, the least read hard. `any` takes them all.
 * The levels are shared with Timler (`src/data/difficulty.ts`).
 */
export {
  DIFFICULTY_LEVELS as WIKILER_DIFFICULTIES,
  DIFFICULTIES,
  type Difficulty as WikilerDifficulty
} from '@/data/difficulty';

/** Which vital-articles pages feed each topic — shared with the pool builder. */
export const TOPIC_PAGES: Record<Exclude<WikilerTopic, 'random'>, string[]> = TOPIC_SOURCES;
