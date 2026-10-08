export const APP_VERSION = '2.15.1';

export type VersionType = 'major' | 'minor' | 'patch' | 'init';

type Text = { ru: string; en: string; uk: string };

export interface VersionLog {
  ver: string;
  /** Release day, YYYY-MM-DD. */
  date: string;
  type: VersionType;
  title?: Text;
  /** What the version brought. A patch that only fixes things leaves it out. */
  desc?: Text;
  /** What it fixed, one bug per line, the same lines in both languages. */
  fixes?: { ru: string[]; en: string[]; uk: string[] };
}

const MONTHS = {
  ru: {
    short: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    long: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  },
  en: {
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  },
  uk: {
    short: ['січ', 'лют', 'бер', 'кві', 'травня', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],
    long: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']
  }
} as const;

/**
 * A release day for reading: "30 сентября 2026", "30 Sep 2026". Spelled out
 * from the parts rather than through `Date`, which would read the ISO day as
 * UTC midnight and show the day before to anyone west of it — and rather
 * than `Intl`, whose Russian month forms differ between Node and browsers,
 * so the server and the page would disagree.
 */
export function formatReleaseDate(iso: string, lang: 'ru' | 'en' | 'uk', style: 'short' | 'long' = 'long'): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[lang][style][month - 1]} ${year}`;
}

/** A span of release days, saying the month and year once where they repeat: "26–28 сен 2026". */
export function formatReleaseRange(from: string, to: string, lang: 'ru' | 'en' | 'uk'): string {
  if (from === to) return formatReleaseDate(from, lang);
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const month = (m: number) => MONTHS[lang].short[m - 1];
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${month(m2)} ${y2}`;
  if (y1 === y2) return `${d1} ${month(m1)} — ${d2} ${month(m2)} ${y2}`;
  return `${formatReleaseDate(from, lang, 'short')} — ${formatReleaseDate(to, lang, 'short')}`;
}

/**
 * Versions from 2.0 on, newest first — the history the game itself shows.
 * The 1.x line lives in `versionLegacy.ts` and only the changelog page
 * (/changelog) loads it, so the app's bundle does not carry it.
 */
export const VERSION_HISTORY: VersionLog[] = [
  /* ===================== 2.15.x ===================== */

  {
    ver: '2.15.1',
    date: '2026-10-08',
    type: 'patch',
    desc: {
      ru: 'Украинский язык и тёмная тема. Весь сайт теперь и на украинском: интерфейс, правила, все 330 локаций «Шпиона», страны во Флагере, достижения и публичные страницы под /uk. Тема — светлая, тёмная или как в системе, в настройках. Настройки переделаны: удаление аккаунта, гостевой прогресс можно сохранить — привязать почту или Google, смена почты, уведомления о ходе, когда вкладка свёрнута, выключатель чата и отдельная громкость музыки в Songler. Экран входа перерисован для телефонов.',
      en: 'Ukrainian and a dark theme. The whole site is now in Ukrainian too: the interface, the rules, all 330 Spyfall locations, the countries in Flager, achievements and the public pages under /uk. The theme is light, dark or the system\'s, in the settings. The settings are rebuilt: delete your account, keep a guest\'s progress by adding an email or Google, change your email, alerts for your turn while the tab is hidden, a switch for the room chat and a separate music volume for Songler. The sign-in screen is redrawn for phones.',
      uk: 'Українська мова й темна тема. Увесь сайт тепер і українською: інтерфейс, правила, усі 330 локацій «Шпигуна», країни у Флагері, досягнення й публічні сторінки під /uk. Тема — світла, темна або як у системі, у налаштуваннях. Налаштування перероблено: видалення акаунта, гостьовий прогрес можна зберегти — прив’язати пошту або Google, зміна пошти, сповіщення про хід, коли вкладку згорнуто, вимикач чату й окрема гучність музики в Songler. Екран входу перемальовано для телефонів.'
    },
    fixes: {
      ru: [
        'На телефоне карточка входа съезжала вбок, когда открывалась клавиатура.',
        'Окно настроек обрезалось на коротких экранах, а удалить загруженную аватарку на телефоне было нельзя.',
        'Можно было занять имя другого зарегистрированного игрока.',
        'Страницы игр: шаг Флагера описывал статью Википедии, у «Стен» не было режима на троих, а «Переворот» в русской версии требовал переворот с семи монет вместо десяти.'
      ],
      en: [
        'On a phone the sign-in card slid sideways when the keyboard opened.',
        'The settings were cut off on short screens, and an uploaded avatar could not be deleted on a phone.',
        'A registered player\'s name could be taken by someone else.',
        'Game pages: a Flager step described a Wikipedia article, Wall Rush lacked the three-player mode, and Russian Coup forced the coup at seven coins instead of ten.'
      ],
      uk: [
        'На телефоні картка входу з’їжджала вбік, коли відкривалася клавіатура.',
        'Вікно налаштувань обрізалося на коротких екранах, а видалити завантажену аватарку на телефоні було не можна.',
        'Можна було зайняти ім’я іншого зареєстрованого гравця.',
        'Сторінки ігор: крок Флагера описував статтю Вікіпедії, у «Стінах» не було режиму на трьох, а «Переворот» у російській версії вимагав переворот із семи монет замість десяти.'
      ]
    }
  },

  {
    ver: '2.15.0',
    date: '2026-10-07',
    type: 'minor',
    title: { ru: 'Угадай мелодию', en: 'Name That Tune', uk: 'Вгадай мелодію' },
    desc: {
      ru: 'Новая, одиннадцатая игра — Songler. Всем играет одна и та же песня — сначала полсекунды; не узнали или пропустили — отрывок растёт до 1, 2, 4, 8 и 15 секунд, всего шесть попыток. Песню выбираете из подсказок по названию или исполнителю. Чем раньше угадали, тем больше очков: 1000 с первой попытки и 100 с последней, плюс бонус за место, а время тает с первой секунды. Назвали другую песню того же исполнителя — 100 утешительных. После раунда — обложка, название, исполнитель, весь 30-секундный отрывок и ссылка на Deezer. 4 091 песня в 37 категориях: десятилетия с 60-х по 2020-е, жанры, кино, игры, аниме, Евровидение, а также русская поп-музыка, русский рок и рэп, советская эстрада и украинская музыка. От 1 до 20 игроков, свои достижения и статистика.',
      en: 'A new, eleventh game — Songler. Everyone hears the same song — half a second of it at first; a miss or a skip makes the snippet grow to 1, 2, 4, 8 and 15 seconds, six tries in all. Pick the song from suggestions by title or artist. The sooner you name it, the more it is worth: 1,000 on the first try and 100 on the last, plus a place bonus, with time melting from the first second. Another song by the right artist earns a 100-point consolation. After each round: the cover, title, artist, the whole 30-second preview and a link to Deezer. 4,091 songs in 37 categories: the decades from the 1960s to the 2020s, genres, film, games, anime, Eurovision, plus Russian pop, Russian rock and rap, Soviet pop and Ukrainian music. 1 to 20 players, achievements and statistics of its own.',
      uk: 'Нова, одинадцята гра — Songler. Усім грає та сама пісня — спершу пів секунди; не впізнали або пропустили — уривок росте до 1, 2, 4, 8 і 15 секунд, усього шість спроб. Пісню обираєте з підказок за назвою або виконавцем. Що раніше вгадали, то більше очок: 1000 з першої спроби і 100 з останньої, плюс бонус за місце, а час тане з першої секунди. Назвали іншу пісню того самого виконавця — 100 утішних. Після раунду — обкладинка, назва, виконавець, увесь 30-секундний уривок і посилання на Deezer. 4 091 пісня в 37 категоріях: десятиліття від 60-х до 2020-х, жанри, кіно, ігри, аніме, Євробачення, а також російська поп-музика, російський рок і реп, радянська естрада та українська музика. Від 1 до 20 гравців, свої досягнення й статистика.'
    },
    fixes: {
      ru: ['Страница «Шпиона» теперь перечисляет все 330 локаций по наборам, а русская версия сайта снова видна в поиске.'],
      en: ['The Spyfall page now lists all 330 locations by pack, and the Russian side of the site is back in search.'],
      uk: ['Сторінка «Шпигуна» тепер перелічує всі 330 локацій за наборами, а російська версія сайту знову видна в пошуку.']
    }
  },

  /* ===================== 2.14.x ===================== */

  {
    ver: '2.14.4',
    date: '2026-10-07',
    type: 'patch',
    desc: {
      ru: 'Сапёр на троих и четверых: каждое поле теперь целиком помещается в свою карточку, стоит по центру и обведено заметной рамкой, а ваше поле получает больше места — на телефоне почти всю высоту, на широком экране левую половину.',
      en: 'Minesweeper for three and four: every board now fits its card whole, centred and inside a clear frame, and yours gets most of the room — nearly the full height on a phone, the left half on a wide screen.',
      uk: 'Сапер на трьох і чотирьох: кожне поле тепер повністю вміщується у свою картку, стоїть по центру й обведене помітною рамкою, а ваше поле отримує більше місця — на телефоні майже всю висоту, на широкому екрані ліву половину.'
    },
    fixes: {
      ru: [
        'Комната, из которой все ушли, пропадает из списка за минуту-две, а не за 15 минут — в неё больше не попасть, чтобы тут же вылететь.',
        'Брошенный матч удаляется через полчаса, а не через неделю.'
      ],
      en: [
        'A room everyone has left drops out of the list in a minute or two, not fifteen — no more joining one only to be dropped.',
        'An abandoned match is cleared after half an hour, not a week.'
      ],
      uk: [
        'Кімната, з якої всі пішли, зникає зі списку за хвилину-дві, а не за 15 хвилин — у неї більше не потрапити, щоб одразу вилетіти.',
        'Покинутий матч видаляється через пів години, а не через тиждень.'
      ]
    }
  },

  {
    ver: '2.14.3',
    date: '2026-10-06',
    type: 'patch',
    desc: {
      ru: 'Timler: таблица игроков теперь всегда показывает счёт, как во Флагере, — и во время раунда, лучшие сверху, рядом с «думает…» или «ответил». На телефоне панель ответа свёрнута в одну строку — год и кнопка «Ответить», — чтобы картинка и таблица оставались на экране; по нажатию она раскрывается, а после ответа сворачивается сама.',
      en: 'Timler: the players card always shows the score, as Flager’s does — during the round too, best first, beside "thinking…" or "answered". On a phone the answer bar folds to one line — your year and an Answer button — so the picture and the table stay in view; a tap opens it, and it folds itself once you have answered.',
      uk: 'Timler: таблиця гравців тепер завжди показує рахунок, як у Флагері, — і під час раунду, найкращі вгорі, поруч із «думає…» або «відповів». На телефоні панель відповіді згорнута в один рядок — рік і кнопка «Відповісти», — щоб картинка й таблиця залишалися на екрані; після натискання вона розгортається, а після відповіді згортається сама.'
    }
  },

  {
    ver: '2.14.2',
    date: '2026-10-06',
    type: 'patch',
    desc: {
      ru: 'В Timler теперь можно угадывать и живопись. В настройках новый выбор «Что угадываем»: фото — как раньше и по умолчанию, живопись или всё вместе, и тогда каждый раунд — фото или картина поровну. 6 847 картин с XIV века по 1945 год, у каждой точно известен год: свои эпохи — до 1600, 1600–1799, XIX век и 1900–1945, а в лобби видны только эпохи, где есть картинки выбранного вида. После раунда — название, художник и статья. В режиме 18+ появился третий вариант — «Только 18+»: раунды только из того, что отмечено 18+. Эпоха фото XIX века теперь называется «1800–1899».',
      en: 'Timler dates paintings too. A new setting, "What to date": photos — as before and by default — paintings, or both, when each round is a photo or a painting, half and half. 6,847 paintings from the 14th century to 1945, each with its year known for certain, in eras of their own — before 1600, 1600–1799, the 19th century and 1900–1945; the lobby shows only the eras the chosen kind has. After each round: the title, the painter and the article. The 18+ mode gains a third choice, "18+ only": rounds from nothing but what is marked 18+. The 19th-century photo era is now called "1800–1899".',
      uk: 'У Timler тепер можна вгадувати й живопис. У налаштуваннях новий вибір «Що вгадуємо»: фото — як раніше й за замовчуванням, живопис або все разом, і тоді кожен раунд — фото або картина порівну. 6 847 картин з XIV століття до 1945 року, у кожної точно відомий рік: свої епохи — до 1600, 1600–1799, XIX століття і 1900–1945, а в лобі видно лише епохи, де є зображення обраного виду. Після раунду — назва, художник і стаття. У режимі 18+ з’явився третій варіант — «Лише 18+»: раунди лише з того, що позначено 18+. Епоха фото XIX століття тепер називається «1800–1899».'
    }
  },

  {
    ver: '2.14.1',
    date: '2026-10-05',
    type: 'patch',
    desc: {
      ru: 'Сайт по умолчанию на английском, как и само приложение: главная, страницы игр, политика и история изменений живут по коротким адресам, русские версии — под /ru, а старые адреса /en перенаправляют на новые. Пока в поиск попадает только английская версия. На главной теперь сказано, кто делает Darhaal Games — Артем Охтень, украинский разработчик с ником Darhaal, — а внизу каждой страницы ссылки на автора и на исходный код на GitHub.',
      en: 'The site is in English by default, like the app itself: the home page, the game pages, the privacy policy and the changelog live at the short addresses, the Russian versions under /ru, and the old /en addresses redirect to the new ones. Only the English version is offered to search engines for now. The home page now says who makes Darhaal Games — Artem Okhten, a Ukrainian developer whose handle is Darhaal — and every page links to the author and to the source on GitHub at the bottom.',
      uk: 'Сайт за замовчуванням англійською, як і сам застосунок: головна, сторінки ігор, політика й історія змін живуть за короткими адресами, російські версії — під /ru, а старі адреси /en перенаправляють на нові. Поки в пошук потрапляє лише англійська версія. На головній тепер сказано, хто робить Darhaal Games — Артем Охтень, український розробник із ніком Darhaal, — а внизу кожної сторінки посилання на автора й на вихідний код на GitHub.'
    }
  },

  {
    ver: '2.14.0',
    date: '2026-10-05',
    type: 'minor',
    title: { ru: 'Время покажет', en: 'Time Will Tell', uk: 'Час покаже' },
    desc: {
      ru: 'Новая, десятая игра — Timler. Всем показывают одну фотографию, а вы называете, когда она снята: год — обязательно, день и месяц — если знаете, это ставка: точная дата +300, промах до −100. Чем старше снимок, тем больше допуск: ошибка на 5 лет почти ничего не стоит у фото 1840-х и съедает почти все очки у фото последних лет. Трём самым точным — бонус за место, а время тает с первой секунды, так что кто ответил раньше, теряет меньше. После раунда ответы всех встают цветными пузырьками с аватарками на общую шкалу времени, а под фото — что это за событие, ссылка на статью и автор. От 1 до 20 игроков, эпохи от XIX века до наших дней, три уровня сложности и режим 18+ в дополнительных настройках. 7 543 фотографии из Викиданных и Wikimedia Commons, свои достижения и статистика — отдельно в одиночку и с людьми.',
      en: 'A new, tenth game — Timler. Everyone sees the same photograph and names when it was taken: the year is a must, the day and month if you know them — a bet, +300 for the exact date, down to −100 for a miss. The older the photo, the more room: five years off costs almost nothing on a photo from the 1840s and nearly everything on one from the last few years. The three most accurate get a place bonus, and time melts from the first second, so whoever answers first loses least. After each round everyone’s answers land as coloured avatar bubbles on one timeline, and under the photo you see what it shows, a link to the article and the author. 1 to 20 players, eras from the 19th century to today, three difficulties and an 18+ mode in the advanced settings. 7,543 photographs from Wikidata and Wikimedia Commons, achievements of its own, and statistics kept apart for solo and together.',
      uk: 'Нова, десята гра — Timler. Усім показують одну фотографію, а ви називаєте, коли її знято: рік — обов’язково, день і місяць — якщо знаєте, це ставка: точна дата +300, промах до −100. Що старіший знімок, то більший допуск: помилка на 5 років майже нічого не коштує у фото 1840-х і з’їдає майже всі очки у фото останніх років. Трьом найточнішим — бонус за місце, а час тане з першої секунди, тож хто відповів раніше, втрачає менше. Після раунду відповіді всіх стають кольоровими бульбашками з аватарками на спільну шкалу часу, а під фото — що це за подія, посилання на статтю й автор. Від 1 до 20 гравців, епохи від XIX століття до наших днів, три рівні складності й режим 18+ у додаткових налаштуваннях. 7 543 фотографії з Вікіданих і Wikimedia Commons, свої досягнення й статистика — окремо наодинці й з людьми.'
    }
  },

  /* ===================== 2.13.x ===================== */

  {
    ver: '2.13.0',
    date: '2026-10-02',
    type: 'minor',
    title: { ru: 'Легко, средне, сложно', en: 'Easy, Medium, Hard', uk: 'Легко, середньо, складно' },
    desc: {
      ru: 'В Wikiler у каждой темы теперь три уровня сложности. Статьи темы делятся на трети по тому, насколько их читают: самые известные — «Легко», наименее известные — «Сложно». «Все люди — легко» — самая знаменитая треть людей, «сложно» — те, кого знают знатоки. Сложность выбирается рядом с темой и видна в подписи раунда; «Любая» берёт всё вперемешку.',
      en: 'Every Wikiler topic now comes in three difficulties. A topic’s articles are cut in thirds by how much they are read: the best known are Easy, the least known Hard. "All people — easy" is the most famous third of them, "hard" the ones experts know. The difficulty is picked beside the topic and named in the round’s label; Any mixes them all.',
      uk: 'У Wikiler кожна тема тепер має три рівні складності. Статті теми діляться на третини за тим, наскільки їх читають: найвідоміші — «Легко», найменш відомі — «Складно». «Усі люди — легко» — найзнаменитіша третина людей, «складно» — ті, кого знають знавці. Складність обирається поруч із темою й видна в підписі раунду; «Будь-яка» бере все впереміш.'
    }
  },

  /* ===================== 2.12.x ===================== */

  {
    ver: '2.12.4',
    date: '2026-10-02',
    type: 'patch',
    desc: {
      ru: 'В Wikiler по умолчанию открыта четверть слов — скрыто 75%. Перевод названия на другие языки в скобке после него («др.-греч. Ἀριστοτέλης», «англ. Sir Isaac Newton») больше никогда не открывается в начале раунда — только если его ввести.',
      en: 'Wikiler opens a quarter of the words by default — 75% hidden. The title’s translations in the bracket after it ("Ancient Greek: Ἀριστοτέλης") never open at the start of a round any more — only when typed.',
      uk: 'У Wikiler за замовчуванням відкрита чверть слів — приховано 75%. Переклад назви іншими мовами в дужках після неї («давньогр. Ἀριστοτέλης», «англ. Sir Isaac Newton») більше ніколи не відкривається на початку раунду — лише якщо його ввести.'
    },
    fixes: {
      ru: ['На телефоне кнопка чата перекрывала кнопку отправки в Wikiler.'],
      en: ['On a phone the chat button covered Wikiler’s send button.'],
      uk: ['На телефоні кнопка чату перекривала кнопку надсилання у Wikiler.']
    }
  },

  {
    ver: '2.12.3',
    date: '2026-09-30',
    type: 'patch',
    desc: {
      ru: 'Wikiler: попытки стали дешевле — промах стоит 10 очков, найденное слово 2, сколько бы раз оно ни встречалось. Это при 50 попытках; с меньшим лимитом каждая попытка пропорционально дороже, при 10 попытках промах стоит 50, находка 10. Текст статьи больше не дёргается: серая плашка по ширине точно совпадает со словом, поэтому открытое слово встаёт на её место, не сдвигая строку, и плавно проявляется. Счёт тает ровно раз в секунду, вместе с часами.',
      en: 'Wikiler: attempts cost less — a miss is 10 points and a found word 2, however often it occurs. That is at 50 attempts; under a tighter limit each attempt is dearer in proportion, at 10 attempts a miss costs 50 and a find 10. The article text no longer jumps: a grey block is exactly as wide as its word, so an opened word takes its place without shifting the line, and fades in. The score melts once a second, with the clock.',
      uk: 'Wikiler: спроби стали дешевшими — промах коштує 10 очок, знайдене слово 2, скільки б разів воно не траплялося. Це за 50 спроб; з меншим лімітом кожна спроба пропорційно дорожча, за 10 спроб промах коштує 50, знахідка 10. Текст статті більше не смикається: сіра плашка за шириною точно збігається зі словом, тому відкрите слово стає на її місце, не зсуваючи рядок, і плавно проявляється. Рахунок тане рівно раз на секунду, разом із годинником.'
    }
  },

  {
    ver: '2.12.2',
    date: '2026-09-30',
    type: 'patch',
    desc: {
      ru: 'История изменений переехала на свою страницу: все версии с датами, от запуска в январе 2026 года, — что появилось и что исправлено. В игре остаются версии начиная с 2.0 и ссылка на полную историю. Описания версий переписаны: исправления теперь идут отдельным списком.',
      en: 'The changelog has a page of its own: every version with its date, from the launch in January 2026 — what came and what was fixed. The game keeps the versions from 2.0 on and a link to the full history. The version notes are rewritten, with fixes in a list of their own.',
      uk: 'Історія змін переїхала на свою сторінку: усі версії з датами, від запуску в січні 2026 року, — що з’явилося і що виправлено. У грі залишаються версії починаючи з 2.0 і посилання на повну історію. Описи версій переписано: виправлення тепер ідуть окремим списком.'
    }
  },

  {
    ver: '2.12.1',
    date: '2026-09-30',
    type: 'patch',
    desc: {
      ru: 'В Wikiler по умолчанию теперь скрыто 90% слов, а не все: несколько разбросанных слов открыты с самого начала, чтобы первым догадкам было за что зацепиться. Слов из названия среди них не бывает. Хост по-прежнему может выбрать от 50 до 100% в дополнительных настройках.',
      en: 'Wikiler now hides 90% of the words by default rather than all of them: a few scattered words are open from the start, so the first guesses have something to go on — never a word of the title. The host can still pick anything from 50 to 100% in the advanced settings.',
      uk: 'У Wikiler за замовчуванням тепер приховано 90% слів, а не всі: кілька розкиданих слів відкриті від самого початку, щоб першим здогадам було за що зачепитися. Слів із назви серед них не буває. Хост, як і раніше, може обрати від 50 до 100% у додаткових налаштуваннях.'
    }
  },

  {
    ver: '2.12.0',
    date: '2026-09-30',
    type: 'minor',
    title: { ru: 'Слово за словом', en: 'Word by Word', uk: 'Слово за словом' },
    desc: {
      ru: 'Новая, девятая игра — Wikiler. Вам дают статью Википедии, в которой скрыты значимые слова и всё название. Пишите слова — они открываются везде, где встречаются, вместе с формами, — и угадайте, что это за статья: открыв название по словам или рискнув ввести его целиком. Очки тают со временем и с промахами. От 1 до 20 игроков на одной статье, 1–20 раундов по 1–15 минут, случайная статья или одна из 34 тем. Статья у всех одна, но каждый читает её на языке своего интерфейса — или все на языке хоста. После раунда видна вся статья с её карточкой из Википедии. Свои достижения и статистика — отдельно в одиночку и с людьми. На экране создания редкие настройки теперь свёрнуты в «Дополнительно».',
      en: 'A new, ninth game — Wikiler. You get a Wikipedia article with its meaningful words hidden and the whole title. Type words — each opens everywhere it occurs, with its forms — and name the article: by opening its title word by word or by risking the whole title. Points melt away with time and misses. 1 to 20 players on one article, 1–20 rounds of 1–15 minutes, a random article or one of 34 topics. Everyone gets the same article, each reading it in their own interface language — or all in the host’s. After a round the whole article opens with its Wikipedia card. Achievements of its own, and statistics kept apart for solo and together. On the create screen the rarely changed settings now fold into “Advanced settings”.',
      uk: 'Нова, дев’ята гра — Wikiler. Вам дають статтю Вікіпедії, у якій приховано значущі слова й усю назву. Пишіть слова — вони відкриваються скрізь, де трапляються, разом із формами, — і вгадайте, що це за стаття: відкривши назву за словами або ризикнувши ввести її повністю. Очки тануть із часом і з промахами. Від 1 до 20 гравців на одній статті, 1–20 раундів по 1–15 хвилин, випадкова стаття або одна з 34 тем. Стаття в усіх одна, але кожен читає її мовою свого інтерфейсу — або всі мовою хоста. Після раунду видно всю статтю з її карткою з Вікіпедії. Свої досягнення й статистика — окремо наодинці й з людьми. На екрані створення рідкісні налаштування тепер згорнуто в «Додатково».'
    }
  },

  /* ===================== 2.11.x ===================== */

  {
    ver: '2.11.1',
    date: '2026-09-28',
    type: 'patch',
    desc: {
      ru: 'Процент побед теперь считается только по матчам с соперниками: одиночный «Сапёр» и «Флагер» его больше не завышают и не рвут серию побед. Сами соло-матчи по-прежнему идут в число сыгранных и в достижения.',
      en: 'The win rate now counts only matches against other players: solo Minesweeper and Flager no longer inflate it or break a winning streak. Solo matches still count as matches played and towards achievements.',
      uk: 'Відсоток перемог тепер рахується лише за матчами із суперниками: одиночний «Сапер» і «Флагер» його більше не завищують і не переривають серію перемог. Самі соло-матчі, як і раніше, ідуть у кількість зіграних і в досягнення.'
    }
  },

  {
    ver: '2.11.0',
    date: '2026-09-26',
    type: 'minor',
    title: { ru: 'Каждый матч на счету', en: 'Every Match Counts', uk: 'Кожен матч на рахунку' },
    desc: {
      ru: 'Появились достижения — 63 штуки: за матчи, победы, часы в играх, серии и дни подряд, и свои в каждой игре, от разминирования без единого флажка до трёх удачных блефов в «Перевороте». За игры и достижения начисляется опыт, у игрока есть уровень. Каждый законченный матч попадает в историю, из неё считаются рекорды: самая быстрая победа, лучший счёт. Страница «Прогресс» переделана: уровень, итоги, достижения, игры и история. Во «Флагер» можно играть до 20 человек.',
      en: 'Achievements are here — 63 of them: for matches, wins, hours played, streaks and days in a row, and each game’s own, from clearing a board without a single flag to three bluffs in one game of Coup. Matches and achievements earn experience, and every player has a level. Every finished match goes into a history, which keeps records such as the fastest win and the best score. The Progress page is rebuilt: level, totals, achievements, games and history. Flager takes up to 20 players.',
      uk: 'З’явилися досягнення — 63 штуки: за матчі, перемоги, години в іграх, серії й дні поспіль, і свої в кожній грі, від розмінування без жодного прапорця до трьох вдалих блефів у «Перевороті». За ігри й досягнення нараховується досвід, у гравця є рівень. Кожен завершений матч потрапляє в історію, з неї рахуються рекорди: найшвидша перемога, найкращий рахунок. Сторінку «Прогрес» перероблено: рівень, підсумки, досягнення, ігри й історія. У «Флагер» можна грати до 20 людей.'
    },
    fixes: {
      ru: [
        'Законченный матч засчитывался заново при каждой перезагрузке итогов — и каждый раз с большим временем.',
        'Уход из матча не считался поражением: оставшийся получал победу, ушедший — ничего.',
        '«Сапёр» не записывал результат тем, кто ещё открывал своё поле, когда кто-то победил.',
        '«Флагер» в одиночку засчитывал каждую игру как победу, а время считал как раунды × лимит раунда.',
        'Время матча округлялось вверх до минуты — теперь хранится в секундах.',
        'Из двух матчей, закончившихся одновременно, один мог потеряться.'
      ],
      en: [
        'A finished match was counted again on every reload of its results — with a longer time each time.',
        'Walking out of a match did not count as a loss: the player who stayed got the win, the one who left got nothing.',
        'Minesweeper recorded nothing for players still on their board when someone else won.',
        'Solo Flager counted every match as a win, and its time as rounds × the round limit.',
        'Match times were rounded up to a minute; they are kept in seconds now.',
        'Two matches finishing at once could lose one of them.'
      ],
      uk: [
        'Завершений матч зараховувався наново під час кожного перезавантаження підсумків — і щоразу з більшим часом.',
        'Вихід із матчу не вважався поразкою: той, хто залишився, отримував перемогу, а той, хто вийшов, — нічого.',
        '«Сапер» не записував результат тим, хто ще відкривав своє поле, коли хтось переміг.',
        '«Флагер» наодинці зараховував кожну гру як перемогу, а час рахував як раунди × ліміт раунду.',
        'Час матчу округлювався вгору до хвилини — тепер зберігається в секундах.',
        'Із двох матчів, що закінчилися одночасно, один міг загубитися.'
      ]
    }
  },

  /* ===================== 2.10.x ===================== */

  {
    ver: '2.10.0',
    date: '2026-09-25',
    type: 'minor',
    title: { ru: 'Один стол для всех игр', en: 'One Table for Every Game', uk: 'Один стіл для всіх ігор' },
    desc: {
      ru: 'Все восемь игр теперь устроены одинаково: доска слева, справа карточки — чей ход и сколько осталось, ваши действия, игроки. Итоги открываются в одном окне, которое можно убрать и посмотреть финальную доску. Новые игроки видят сайт на английском, пока не выберут язык. В «Сапёре» и «Морском бое» появились уведомления: кто подорвался, кто вышел, кто расставил флот, у кого вышло время. Во «Флагере» между раундами есть минута, потом следующий раунд начинается сам.',
      en: 'All eight games are now laid out the same way: the board on the left, and on the right cards for whose turn it is and how long is left, your moves, and the players. Results open in one dialog that can be put aside to look at the final board. New players see the site in English until they pick a language. Minesweeper and Battleship now have notices: who hit a mine, who left, whose fleet is ready, whose clock ran out. Flager gives you a minute between rounds, then the next one starts on its own.',
      uk: 'Усі вісім ігор тепер влаштовано однаково: дошка ліворуч, праворуч картки — чий хід і скільки залишилося, ваші дії, гравці. Підсумки відкриваються в одному вікні, яке можна прибрати й подивитися фінальну дошку. Нові гравці бачать сайт англійською, доки не оберуть мову. У «Сапері» й «Морському бою» з’явилися сповіщення: хто підірвався, хто вийшов, хто розставив флот, у кого вийшов час. У «Флагері» між раундами є хвилина, потім наступний раунд починається сам.'
    },
    fixes: {
      ru: [
        'Комната «Флагера» зависала между раундами, если уходил последний, кто ещё не нажал «Далее».',
        '«Переворот»: уход игрока посреди действия давал лишний ход или отменял уже доказанное действие.',
        'Ход, который не удалось сохранить, молча оставался на экране — теперь он откатывается с сообщением.',
        'История «Переворота» писалась только по-русски, а «(Вы)» и надписи о победе и выбывании не переводились.',
        '«Флагер» показывал континенты по-английски в русском интерфейсе.',
        '«Сапёр» сообщал «Победа» всем игрокам, когда выигрывал кто-то один.',
        'Картинки локаций «Шпиона» обрезались серыми полосами, а итоги «Морского боя» закрывали весь экран.'
      ],
      en: [
        'A Flager room froze between rounds when the last player not yet ready left.',
        'Coup: a player leaving mid-action handed out an extra turn or undid a claim already proved.',
        'A move that failed to save stayed on screen without a word; it is now taken back and reported.',
        'Coup’s history was written in Russian only, and “(You)” and the won and out stickers were not translated.',
        'Flager showed continents in English in the Russian interface.',
        'Minesweeper told every player “Victory” when any one of them won.',
        'Spyfall location art was letterboxed with grey bands, and Battleship’s result covered the whole screen.'
      ],
      uk: [
        'Кімната «Флагера» зависала між раундами, якщо виходив останній, хто ще не натиснув «Далі».',
        '«Переворот»: вихід гравця посеред дії давав зайвий хід або скасовував уже доведену дію.',
        'Хід, який не вдалося зберегти, мовчки залишався на екрані — тепер він відкочується з повідомленням.',
        'Історія «Перевороту» писалася лише російською, а «(Ви)» та написи про перемогу й вибування не перекладалися.',
        '«Флагер» показував континенти англійською в російському інтерфейсі.',
        '«Сапер» повідомляв «Перемога» всім гравцям, коли вигравав хтось один.',
        'Картинки локацій «Шпигуна» обрізалися сірими смугами, а підсумки «Морського бою» закривали весь екран.'
      ]
    }
  },

  /* ===================== 2.9.x ===================== */

  {
    ver: '2.9.0',
    date: '2026-09-24',
    type: 'minor',
    title: { ru: 'Wall Rush начисто', en: 'Wall Rush, Redrawn', uk: 'Wall Rush начисто' },
    desc: {
      ru: 'Wall Rush в стиле остального сайта. Доска — белые клетки на сером, строгая, стены — ровные полосы мягкого цвета игрока. Рядом три карточки: чей ход и сколько времени осталось, ваши стены, игроки с той же фишкой, что на доске. После партии итоги можно убрать и посмотреть финальную позицию.',
      en: 'Wall Rush in the style of the rest of the site. The board is white squares on grey, square-cornered, and walls are plain bars in the owner’s softened colour. Beside it, three cards: whose turn and how much of it is left, your walls, and the players with the same piece they have on the board. After a match the result can be put aside to look at the final position.',
      uk: 'Wall Rush у стилі решти сайту. Дошка — білі клітинки на сірому, строга, стіни — рівні смуги м’якого кольору гравця. Поруч три картки: чий хід і скільки часу залишилося, ваші стіни, гравці з тією самою фішкою, що на дошці. Після партії підсумки можна прибрати й подивитися фінальну позицію.'
    }
  },

  /* ===================== 2.8.x ===================== */

  {
    ver: '2.8.0',
    date: '2026-09-24',
    type: 'minor',
    title: { ru: 'Клавиши, которые работают', en: 'Keys That Work', uk: 'Клавіші, які працюють' },
    desc: {
      ru: 'Поле Wall Rush стало цельной доской: квадратные плитки, стены заполняют желобок целиком и аккуратно смыкаются — в линию, углом и буквой Т, — а линии финиша перенесены в рамку. В «Сапёре» пробел ставит флаг или открывает соседей числа, колесо мыши масштабирует поле, стрелки двигают его. В Wall Rush пешкой можно ходить стрелками, а стену в руке поворачивать клавишей R или пробелом. Все сочетания описаны в правилах каждой игры.',
      en: 'The Wall Rush board is now one piece: square tiles, walls that fill their groove and meet cleanly — in line, at a corner and in a T — and finish lines moved into the rim. In Minesweeper Space flags a cell or chords a number, the mouse wheel zooms the board and the arrows move it. In Wall Rush the arrows move your pawn and R or Space turns the wall in your hand. Every shortcut is in each game’s rules.',
      uk: 'Поле Wall Rush стало цілісною дошкою: квадратні плитки, стіни заповнюють жолобок повністю й акуратно змикаються — у лінію, кутом і літерою Т, — а лінії фінішу перенесено в рамку. У «Сапері» пробіл ставить прапорець або відкриває сусідів числа, коліщатко миші масштабує поле, стрілки рухають його. У Wall Rush пішаком можна ходити стрілками, а стіну в руці повертати клавішею R або пробілом. Усі комбінації описано в правилах кожної гри.'
    },
    fixes: {
      ru: [
        'Пробел в «Сапёре» ничего не делал.',
        'Набор текста в чате нажимал игровые клавиши: «wasd» двигали поле «Сапёра», пробел поворачивал корабль.',
        'Ctrl + колесо масштабировало всю страницу вместе с полем «Сапёра».',
        'Стены Wall Rush висели в желобках и вылезали за край поля.',
        'WASD не работали в русской раскладке.'
      ],
      en: [
        'Space did nothing in Minesweeper.',
        'Typing in the chat pressed game keys: “wasd” panned the Minesweeper board and a space turned a ship.',
        'Ctrl + wheel zoomed the whole page along with the Minesweeper board.',
        'Wall Rush walls floated in their grooves and hung off the board.',
        'WASD did not work on a Russian keyboard layout.'
      ],
      uk: [
        'Пробіл у «Сапері» нічого не робив.',
        'Набір тексту в чаті натискав ігрові клавіші: «wasd» рухали поле «Сапера», пробіл повертав корабель.',
        'Ctrl + коліщатко масштабувало всю сторінку разом із полем «Сапера».',
        'Стіни Wall Rush висіли в жолобках і вилазили за край поля.',
        'WASD не працювали в російській розкладці.'
      ]
    }
  },

  /* ===================== 2.7.x ===================== */

  {
    ver: '2.7.0',
    date: '2026-09-24',
    type: 'minor',
    title: { ru: 'Разговор за столом', en: 'Talk at the Table', uk: 'Розмова за столом' },
    desc: {
      ru: 'В каждой комнате всех восьми игр появился чат с тридцатью смайликами — в лобби, во время партии и на итогах. Его видят только те, кто сидит в комнате, и он удаляется вместе с ней. «Сыграть ещё» теперь помнит счёт серии: в лобби новой комнаты видно, кто сколько взял. В «Шпионе» победа шпиона стоит 5 очков, мирного — 1. В Wall Rush можно сдаться и остаться досматривать.',
      en: 'Every room in all eight games now has a chat with thirty emoji — in the lobby, during the match and on the results. Only the people seated in the room can read it, and it is deleted with the room. "Play again" now remembers the score of the series: the new room’s lobby shows who has taken how many. In Spyfall a spy’s win is worth 5 points and a local’s 1. In Wall Rush you can resign and stay to watch.',
      uk: 'У кожній кімнаті всіх восьми ігор з’явився чат із тридцятьма смайликами — у лобі, під час партії й на підсумках. Його бачать лише ті, хто сидить у кімнаті, і він видаляється разом із нею. «Зіграти ще» тепер пам’ятає рахунок серії: у лобі нової кімнати видно, хто скільки взяв. У «Шпигуні» перемога шпигуна коштує 5 очок, мирного — 1. У Wall Rush можна здатися й залишитися додивлятися.'
    },
    fixes: {
      ru: ['Две стены Wall Rush в линию оставляли зазор, и сплошная преграда выглядела разорванной.'],
      en: ['Two Wall Rush walls in line left a gap, so a continuous barrier looked broken.'],
      uk: ['Дві стіни Wall Rush у лінію залишали проміжок, і суцільна перешкода виглядала розірваною.']
    }
  },

  /* ===================== 2.6.x ===================== */

  {
    ver: '2.6.2',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'В статистике посещений появилось событие закрытия комнаты.',
      en: 'Visit statistics gain an event for a room being closed.',
      uk: 'У статистиці відвідувань з’явилася подія закриття кімнати.'
    },
    fixes: {
      ru: ['Все события одного человека попадали в один бесконечный визит, поэтому повторные заходы не считались.'],
      en: ['Every event from one person landed in a single endless visit, so return visits were never counted.'],
      uk: ['Усі події однієї людини потрапляли в один нескінченний візит, тому повторні заходи не рахувалися.']
    }
  },

  {
    ver: '2.6.1',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'Теперь можно проверить, что сбор статистики действительно настроен и что Google принимает то, что мы отправляем, — раньше об этом нельзя было узнать снаружи никак.',
      en: 'It is now possible to check that collection really is configured and that Google accepts what we send — previously there was no way to tell from outside.',
      uk: 'Тепер можна перевірити, що збір статистики справді налаштовано і що Google приймає те, що ми надсилаємо, — раніше про це не можна було дізнатися ззовні ніяк.'
    }
  },

  {
    ver: '2.6.0',
    date: '2026-09-22',
    type: 'minor',
    title: { ru: 'Аналитика без посредника', en: 'Analytics Without a Middleman', uk: 'Аналітика без посередника' },
    desc: {
      ru: 'Статистика вернулась, устроенная иначе: Google Analytics больше не загружается в браузер вообще — ни скриптов, ни cookie, ни вашего IP-адреса. Страница сообщает событие нам, а передаём его мы, со своего сервера, и адрес страницы собираем сами. Ссылка на комнату туда попасть не может.',
      en: 'Statistics are back, arranged differently: Google Analytics no longer loads in the browser at all — no script, no cookie, and your IP address never reaches it. The page reports an event to us and we forward it from our server, assembling the page address ourselves. A room link cannot get through.',
      uk: 'Статистика повернулася, влаштована інакше: Google Analytics більше не завантажується в браузер узагалі — ні скриптів, ні cookie, ні вашої IP-адреси. Сторінка повідомляє подію нам, а передаємо її ми, зі свого сервера, і адресу сторінки збираємо самі. Посилання на кімнату туди потрапити не може.'
    }
  },

  /* ===================== 2.5.x ===================== */

  {
    ver: '2.5.3',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'Сбор статистики отключён. Он передавал в Google адрес страницы вместе с идентификатором комнаты, а ссылка на приватную комнату — это и есть доступ к ней. Четыре попытки это обойти не сработали, поэтому сбор выключен до тех пор, пока безопасность не будет доказана.',
      en: 'Usage statistics are switched off. They were sending Google the page address together with the room identifier, and a private room’s link is its access. Four attempts to work around it failed, so collection is off until it can be shown to be safe.',
      uk: 'Збір статистики вимкнено. Він передавав у Google адресу сторінки разом з ідентифікатором кімнати, а посилання на приватну кімнату — це і є доступ до неї. Чотири спроби це обійти не спрацювали, тому збір вимкнено доти, доки безпеку не буде доведено.'
    }
  },

  {
    ver: '2.5.2',
    date: '2026-09-22',
    type: 'patch',
    fixes: {
      ru: ['Адрес комнаты всё ещё уходил в аналитику: две прошлые попытки не работали, потому что проверялись не все запросы. Теперь проверено от начала до конца на настоящей комнате.'],
      en: ['The room address was still reaching analytics: the two previous attempts did not work because not every request was checked. Now verified end to end on a real room.'],
      uk: ['Адреса кімнати все ще потрапляла в аналітику: дві попередні спроби не працювали, бо перевірялися не всі запити. Тепер перевірено від початку до кінця на справжній кімнаті.']
    }
  },

  {
    ver: '2.5.1',
    date: '2026-09-22',
    type: 'patch',
    fixes: {
      ru: ['Адрес комнаты всё ещё уходил в аналитику: способ его подменить из документации Google молча не работает. Заменён на проверенный.'],
      en: ['The room address was still reaching analytics: the documented way to override it silently does nothing. Replaced with one that was measured and works.'],
      uk: ['Адреса кімнати все ще потрапляла в аналітику: спосіб її підмінити з документації Google мовчки не працює. Замінено на перевірений.']
    }
  },

  {
    ver: '2.5.0',
    date: '2026-09-22',
    type: 'minor',
    title: { ru: 'Стены втроём', en: 'Wall Rush for Three', uk: 'Стіни втрьох' },
    desc: {
      ru: 'В «Стенах» появился режим на троих: доска 11×11, трое с трёх сторон, по 8 стен, все бегут в золотую клетку в центре. И комната теперь закрывается, если её создатель ушёл, — с подтверждением, чтобы это не случилось случайно.',
      en: 'Wall Rush gains a three-player mode: an 11x11 board, three players on three sides, 8 walls each, everyone racing for the golden square in the middle. And a room now closes when the person who opened it leaves — with a confirmation, so it does not happen by accident.',
      uk: 'У «Стінах» з’явився режим на трьох: дошка 11×11, троє з трьох боків, по 8 стін, усі біжать до золотої клітинки в центрі. І кімната тепер закривається, якщо її творець пішов, — із підтвердженням, щоб це не сталося випадково.'
    }
  },

  /* ===================== 2.4.x ===================== */

  {
    ver: '2.4.1',
    date: '2026-09-22',
    type: 'patch',
    fixes: {
      ru: ['В аналитику уходил полный адрес страницы вместе с идентификатором комнаты: Google подставлял его сам, в обход очистки. Теперь очищенный адрес прикрепляется к каждому событию.'],
      en: ['The full page address, room identifier and all, still reached analytics: Google filled it in by itself, around the stripping. The cleaned address is now attached to every event.'],
      uk: ['В аналітику потрапляла повна адреса сторінки разом з ідентифікатором кімнати: Google підставляв її сам, в обхід очищення. Тепер очищена адреса прикріплюється до кожної події.']
    }
  },

  {
    ver: '2.4.0',
    date: '2026-09-22',
    type: 'minor',
    title: { ru: 'Аналитика и приватность', en: 'Analytics and Privacy', uk: 'Аналітика й приватність' },
    desc: {
      ru: 'Появилась страница политики конфиденциальности и аналитика посещений — она спрашивает разрешение и не загружается, пока вы не согласились. Ссылки на комнаты в неё не попадают: идентификатор комнаты вырезается из адреса, потому что ссылка на приватную комнату — это ключ от неё.',
      en: 'A privacy policy page, and usage analytics that asks permission and is not loaded until you agree. Room links stay out of it: the room identifier is stripped from the address, because a private room’s link is the key to it.',
      uk: 'З’явилися сторінка політики конфіденційності й аналітика відвідувань — вона просить дозволу й не завантажується, доки ви не погодилися. Посилання на кімнати в неї не потрапляють: ідентифікатор кімнати вирізається з адреси, бо посилання на приватну кімнату — це ключ від неї.'
    }
  },

  /* ===================== 2.3.x ===================== */

  {
    ver: '2.3.3',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'Мелкий текст по всему сайту стал крупнее на больших экранах: подписи, счётчики и пояснения, которые были рассчитаны на ноутбук и превращались в точки на большом мониторе. На телефоне и планшете размеры прежние — там компактность на месте.',
      en: 'Small text across the site grows on a large screen: the captions, counters and side notes that were drawn for a laptop and turned into specks on a big monitor. Phones and tablets keep the sizes they had, where the tight ones earn their keep.',
      uk: 'Дрібний текст по всьому сайту став більшим на великих екранах: підписи, лічильники й пояснення, які були розраховані на ноутбук і перетворювалися на крапки на великому моніторі. На телефоні й планшеті розміри ті самі — там компактність доречна.'
    }
  },

  {
    ver: '2.3.2',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'Первый ход больше не достаётся хозяину комнаты по умолчанию — он разыгрывается: в Морском бою, Перевороте, Стенах, Точках и Реверси. В «Точках и квадратах» последняя проведённая линия нарисована толще, закрытые квадраты закрашены заметнее, текст крупнее. Кнопка правил теперь подписана, а не просто знак вопроса.',
      en: 'The opening move is no longer the host’s by default — it is drawn for, in Battleship, Coup, Wall Rush, Dots & Boxes and Reversi. In Dots & Boxes the line just played is heavier, closed boxes are filled more clearly and the text is larger. The rules button is labelled rather than a bare question mark.',
      uk: 'Перший хід більше не дістається господареві кімнати за замовчуванням — він розігрується: у Морському бою, Перевороті, Стінах, Точках і Реверсі. У «Точках і квадратах» останню проведену лінію намальовано товщою, закриті квадрати зафарбовано помітніше, текст більший. Кнопку правил тепер підписано, а не просто знак питання.'
    }
  },

  {
    ver: '2.3.1',
    date: '2026-09-21',
    type: 'patch',
    desc: {
      ru: 'Если хост ушёл, комнату принимает кто-то из оставшихся, а лобби, которое никто не открывал десять минут, закрывается само. Полные комнаты не показываются в списке — зайти в них всё равно нельзя. Ссылка на завершённую комнату ведёт в новую, если там нажали «Ещё раз». Гостевые аккаунты, которыми не пользовались 30 дней, удаляются.',
      en: 'If the host goes, one of the remaining players takes the room over, and a lobby nobody has had open for ten minutes closes itself. Full rooms are hidden — there is no way into them anyway. A link to a finished room now follows "play again" into its successor. Guest accounts unused for 30 days are removed.',
      uk: 'Якщо хост пішов, кімнату приймає хтось із тих, хто залишився, а лобі, яке ніхто не відкривав десять хвилин, закривається саме. Повні кімнати не показуються в списку — зайти в них однаково не можна. Посилання на завершену кімнату веде в нову, якщо там натиснули «Ще раз». Гостьові акаунти, якими не користувалися 30 днів, видаляються.'
    },
    fixes: {
      ru: [
        'Комната, из которой ушёл хост, зависала: убрать отключившихся и начать игру было некому.',
        'Счёт «Шпиона» обнулялся при «Ещё раз».',
        'Список комнат показывал лимит игроков как есть, например «2/99», и такая комната никогда не считалась полной.',
        'При регистрации аватар по-прежнему запрашивался у стороннего сервиса вместе с идентификатором пользователя.'
      ],
      en: [
        'A room whose host had gone froze: nobody could clear the missing players or start the game.',
        'The Spyfall score reset on "play again".',
        'The room list showed a player cap as written, such as "2/99", and such a room never read as full.',
        'Signing up still fetched the avatar from a third party along with the user’s identifier.'
      ],
      uk: [
        'Кімната, з якої пішов хост, зависала: прибрати відключених і почати гру було нікому.',
        'Рахунок «Шпигуна» обнулявся після «Ще раз».',
        'Список кімнат показував ліміт гравців як є, наприклад «2/99», і така кімната ніколи не вважалася повною.',
        'Під час реєстрації аватар, як і раніше, запитувався в стороннього сервісу разом з ідентифікатором користувача.'
      ]
    }
  },

  {
    ver: '2.3.0',
    date: '2026-09-21',
    type: 'minor',
    title: { ru: 'Три новые игры', en: 'Three New Games', uk: 'Три нові гри' },
    desc: {
      ru: 'Стены, Точки и квадраты и Реверси — игр стало восемь. «Ещё раз» теперь открывает новую комнату с настройками родительской, во всех играх сразу.',
      en: 'Wall Rush, Dots & Boxes and Reversi bring the line-up to eight. "Play again" now opens a fresh room that inherits the old one’s settings, in every game.',
      uk: 'Стіни, Точки й квадрати та Реверсі — ігор стало вісім. «Ще раз» тепер відкриває нову кімнату з налаштуваннями батьківської, в усіх іграх одразу.'
    },
    fixes: {
      ru: [
        '«Переворот» вообще не запускался, если в комнате был второй игрок.',
        'Одновременные действия съедали ход: голоса в «Шпионе», пасы и блоки в «Перевороте», «готов» во «Флагере», вход по ссылке.',
        'Отключившийся игрок замораживал комнату в «Шпионе», «Перевороте», «Морском бое», «Флагере» и «Сапёре».',
        'Главная страница обещала пять игр, хотя их было восемь.',
        'Числа по-русски склонялись неверно — теперь «1 квадрат», «2 квадрата», «5 квадратов».'
      ],
      en: [
        'Coup could not start at all once a second player was in the room.',
        'Simultaneous actions cost a move: Spyfall votes, Coup passes and blocks, Flager “ready” taps, joins through a link.',
        'A player who disconnected froze the room in Spyfall, Coup, Battleship, Flager and Minesweeper.',
        'The homepage promised five games while there were eight.',
        'Russian counts took the wrong forms; now “1 квадрат”, “2 квадрата”, “5 квадратов”.'
      ],
      uk: [
        '«Переворот» узагалі не запускався, якщо в кімнаті був другий гравець.',
        'Одночасні дії з’їдали хід: голоси в «Шпигуні», паси й блоки в «Перевороті», «готовий» у «Флагері», вхід за посиланням.',
        'Відключений гравець заморожував кімнату в «Шпигуні», «Перевороті», «Морському бою», «Флагері» й «Сапері».',
        'Головна сторінка обіцяла п’ять ігор, хоча їх було вісім.',
        'Числа російською відмінювалися неправильно — тепер «1 квадрат», «2 квадрата», «5 квадратов».'
      ]
    }
  },

  /* ===================== 2.2.x ===================== */

  {
    ver: '2.2.0',
    date: '2026-09-02',
    type: 'minor',
    title: { ru: 'Большой Шпион', en: 'Spyfall Expanded', uk: 'Великий Шпигун' },
    desc: {
      ru: 'Шпион вырос с 30 локаций до 330: пятнадцать наборов по 22 локации, у каждой по 20 ролей. Новые наборы — природа, история, фантастика, спорт и еда. У карточек локаций появилось оформление, которое рисуется на месте и ничего не загружает.',
      en: 'Spyfall grew from 30 locations to 330: fifteen packs of 22, with 20 roles each. New packs for nature, history, sci-fi, sports and food. Location cards now have artwork that is drawn on the spot and downloads nothing.',
      uk: 'Шпигун виріс із 30 локацій до 330: п’ятнадцять наборів по 22 локації, у кожної по 20 ролей. Нові набори — природа, історія, фантастика, спорт і їжа. Картки локацій отримали оформлення, яке малюється на місці й нічого не завантажує.'
    },
    fixes: {
      ru: [
        'Картинки локаций «Шпиона» не загружались с самого появления наборов.',
        'Аватары запрашивались у стороннего сервиса вместе с идентификатором пользователя — теперь их рисует сам сайт.'
      ],
      en: [
        'Spyfall location images had never loaded since the packs were written.',
        'Avatars were fetched from a third party along with the user’s identifier; the site now draws them itself.'
      ],
      uk: [
        'Картинки локацій «Шпигуна» не завантажувалися від самої появи наборів.',
        'Аватари запитувалися в стороннього сервісу разом з ідентифікатором користувача — тепер їх малює сам сайт.'
      ]
    }
  },

  /* ===================== 2.1.x ===================== */

  {
    ver: '2.1.0',
    date: '2026-08-20',
    type: 'minor',
    title: { ru: 'Новый дом', en: 'New Home', uk: 'Новий дім' },
    desc: {
      ru: 'Платформа переехала на games.okhten.com. Публичные страницы игр с правилами и описанием, ускоренная загрузка, обновлённая навигация и модульная архитектура интерфейса.',
      en: 'The platform has moved to games.okhten.com. Public game pages with rules and descriptions, faster loading, refreshed navigation and a modular UI architecture.',
      uk: 'Платформа переїхала на games.okhten.com. Публічні сторінки ігор із правилами й описом, пришвидшене завантаження, оновлена навігація й модульна архітектура інтерфейсу.'
    }
  },

  /* ===================== 2.0.x ===================== */

  {
    ver: '2.0.4',
    date: '2026-08-05',
    type: 'patch',
    desc: {
      ru: 'Стабильность при слабой сети: возвращение в комнату без потери места, понятные уведомления о разрыве связи.',
      en: 'Stability on weak connections: rejoin your room without losing your seat, with clear notifications when the connection drops.',
      uk: 'Стабільність за слабкої мережі: повернення в кімнату без втрати місця, зрозумілі сповіщення про розрив зв’язку.'
    }
  },

  {
    ver: '2.0.3',
    date: '2026-07-27',
    type: 'patch',
    desc: {
      ru: 'Мобильная версия: увеличены области нажатия, выверены жесты в Сапёре и Морском бою.',
      en: 'Mobile: larger tap targets and refined gestures in Minesweeper and Battleship.',
      uk: 'Мобільна версія: збільшено області натискання, вивірено жести в Сапері й Морському бою.'
    },
    fixes: {
      ru: ['Вёрстка ломалась на узких экранах.'],
      en: ['The layout broke on narrow screens.'],
      uk: ['Верстка ламалася на вузьких екранах.']
    }
  },

  {
    ver: '2.0.2',
    date: '2026-07-18',
    type: 'patch',
    desc: {
      ru: 'Ускорена загрузка списка комнат и страницы статистики, снижен объём трафика при синхронизации матчей.',
      en: 'Faster room list and statistics page, with reduced traffic during match synchronization.',
      uk: 'Пришвидшено завантаження списку кімнат і сторінки статистики, зменшено обсяг трафіку під час синхронізації матчів.'
    }
  },

  {
    ver: '2.0.1',
    date: '2026-07-11',
    type: 'patch',
    desc: {
      ru: 'Полировка: аккуратное подтверждение удаления аватара вместо системного окна, мелкие улучшения интерфейса.',
      en: 'Polish: a neat avatar-delete confirmation instead of the native dialog, and small UI refinements.',
      uk: 'Полірування: акуратне підтвердження видалення аватара замість системного вікна, дрібні покращення інтерфейсу.'
    }
  },

  {
    ver: '2.0.0',
    date: '2026-07-09',
    type: 'major',
    title: { ru: 'Платформа 2.0', en: 'Platform 2.0', uk: 'Платформа 2.0' },
    desc: {
      ru: 'Крупное обновление платформы: усилена безопасность (серверная проверка паролей, защита от гонок записи), честная статистика во всех играх, вход по ссылке, восстановление пароля, звук, всплывающие уведомления, управление с клавиатуры (Esc/Enter/стрелки) и аккорд в Сапёре.',
      en: 'A major platform update: hardened security (server-side password checks, write-race protection), honest statistics in every game, join-by-link, password recovery, sound, toast notifications, keyboard controls (Esc/Enter/arrows) and the Minesweeper chord.',
      uk: 'Велике оновлення платформи: посилено безпеку (серверна перевірка паролів, захист від гонок запису), чесна статистика в усіх іграх, вхід за посиланням, відновлення пароля, звук, спливні сповіщення, керування з клавіатури (Esc/Enter/стрілки) і акорд у Сапері.'
    },
    fixes: {
      ru: [
        'Вход по email не работал.',
        'Выход из лобби «Морского боя» до начала засчитывался как победа.',
        '«Сапёр» не записывал поражения, а партия, где подорвались все, не заканчивалась.',
        'Клики по клеткам «Сапёра» иногда терялись.',
        'Выход игрока в «Перевороте» ломал порядок ходов.',
        'Таймеры на экранах разных игроков спорили друг с другом, а в «Шпионе» таймер голосования накладывался на другой.',
        'Коды комнат могли совпадать.',
        'Панель настроек обрезалась на второстепенных страницах, а фоновая текстура не загружалась.'
      ],
      en: [
        'Signing in by email did not work.',
        'Leaving a Battleship lobby before the start counted as a win.',
        'Minesweeper did not record losses, and a game where everyone hit a mine never finished.',
        'Clicks on Minesweeper cells were sometimes lost.',
        'A player leaving Coup corrupted the turn order.',
        'Timers on different players’ screens raced each other, and Spyfall’s vote timer overlapped another.',
        'Room codes could collide.',
        'The settings panel was clipped on secondary pages, and the background texture failed to load.'
      ],
      uk: [
        'Вхід через email не працював.',
        'Вихід із лобі «Морського бою» до початку зараховувався як перемога.',
        '«Сапер» не записував поразок, а партія, де підірвалися всі, не закінчувалася.',
        'Кліки по клітинках «Сапера» іноді губилися.',
        'Вихід гравця в «Перевороті» ламав порядок ходів.',
        'Таймери на екранах різних гравців сперечалися один з одним, а в «Шпигуні» таймер голосування накладався на інший.',
        'Коди кімнат могли збігатися.',
        'Панель налаштувань обрізалася на другорядних сторінках, а фонова текстура не завантажувалася.'
      ]
    }
  }
];
