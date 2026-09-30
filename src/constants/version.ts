export const APP_VERSION = '2.12.2';

export type VersionType = 'major' | 'minor' | 'patch' | 'init';

type Text = { ru: string; en: string };

export interface VersionLog {
  ver: string;
  /** Release day, YYYY-MM-DD. */
  date: string;
  type: VersionType;
  title?: Text;
  /** What the version brought. A patch that only fixes things leaves it out. */
  desc?: Text;
  /** What it fixed, one bug per line, the same lines in both languages. */
  fixes?: { ru: string[]; en: string[] };
}

const MONTHS = {
  ru: {
    short: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    long: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  },
  en: {
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  }
} as const;

/**
 * A release day for reading: "30 сентября 2026", "30 Sep 2026". Spelled out
 * from the parts rather than through `Date`, which would read the ISO day as
 * UTC midnight and show the day before to anyone west of it — and rather
 * than `Intl`, whose Russian month forms differ between Node and browsers,
 * so the server and the page would disagree.
 */
export function formatReleaseDate(iso: string, lang: 'ru' | 'en', style: 'short' | 'long' = 'long'): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[lang][style][month - 1]} ${year}`;
}

/** A span of release days, saying the month and year once where they repeat: "26–28 сен 2026". */
export function formatReleaseRange(from: string, to: string, lang: 'ru' | 'en'): string {
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
  /* ===================== 2.12.x ===================== */

  {
    ver: '2.12.2',
    date: '2026-09-30',
    type: 'patch',
    desc: {
      ru: 'История изменений переехала на свою страницу: все версии с датами, от запуска в январе 2026 года, — что появилось и что исправлено. В игре остаются версии начиная с 2.0 и ссылка на полную историю. Описания версий переписаны: исправления теперь идут отдельным списком.',
      en: 'The changelog has a page of its own: every version with its date, from the launch in January 2026 — what came and what was fixed. The game keeps the versions from 2.0 on and a link to the full history. The version notes are rewritten, with fixes in a list of their own.'
    }
  },

  {
    ver: '2.12.1',
    date: '2026-09-30',
    type: 'patch',
    desc: {
      ru: 'В Wikiler по умолчанию теперь скрыто 90% слов, а не все: несколько разбросанных слов открыты с самого начала, чтобы первым догадкам было за что зацепиться. Слов из названия среди них не бывает. Хост по-прежнему может выбрать от 50 до 100% в дополнительных настройках.',
      en: 'Wikiler now hides 90% of the words by default rather than all of them: a few scattered words are open from the start, so the first guesses have something to go on — never a word of the title. The host can still pick anything from 50 to 100% in the advanced settings.'
    }
  },

  {
    ver: '2.12.0',
    date: '2026-09-30',
    type: 'minor',
    title: { ru: 'Слово за словом', en: 'Word by Word' },
    desc: {
      ru: 'Новая, девятая игра — Wikiler. Вам дают статью Википедии, в которой скрыты значимые слова и всё название. Пишите слова — они открываются везде, где встречаются, вместе с формами, — и угадайте, что это за статья: открыв название по словам или рискнув ввести его целиком. Очки тают со временем и с промахами. От 1 до 20 игроков на одной статье, 1–20 раундов по 1–15 минут, случайная статья или одна из 34 тем. Статья у всех одна, но каждый читает её на языке своего интерфейса — или все на языке хоста. После раунда видна вся статья с её карточкой из Википедии. Свои достижения и статистика — отдельно в одиночку и с людьми. На экране создания редкие настройки теперь свёрнуты в «Дополнительно».',
      en: 'A new, ninth game — Wikiler. You get a Wikipedia article with its meaningful words hidden and the whole title. Type words — each opens everywhere it occurs, with its forms — and name the article: by opening its title word by word or by risking the whole title. Points melt away with time and misses. 1 to 20 players on one article, 1–20 rounds of 1–15 minutes, a random article or one of 34 topics. Everyone gets the same article, each reading it in their own interface language — or all in the host’s. After a round the whole article opens with its Wikipedia card. Achievements of its own, and statistics kept apart for solo and together. On the create screen the rarely changed settings now fold into “Advanced settings”.'
    }
  },

  /* ===================== 2.11.x ===================== */

  {
    ver: '2.11.1',
    date: '2026-09-28',
    type: 'patch',
    desc: {
      ru: 'Процент побед теперь считается только по матчам с соперниками: одиночный «Сапёр» и «Флагер» его больше не завышают и не рвут серию побед. Сами соло-матчи по-прежнему идут в число сыгранных и в достижения.',
      en: 'The win rate now counts only matches against other players: solo Minesweeper and Flager no longer inflate it or break a winning streak. Solo matches still count as matches played and towards achievements.'
    }
  },

  {
    ver: '2.11.0',
    date: '2026-09-26',
    type: 'minor',
    title: { ru: 'Каждый матч на счету', en: 'Every Match Counts' },
    desc: {
      ru: 'Появились достижения — 63 штуки: за матчи, победы, часы в играх, серии и дни подряд, и свои в каждой игре, от разминирования без единого флажка до трёх удачных блефов в «Перевороте». За игры и достижения начисляется опыт, у игрока есть уровень. Каждый законченный матч попадает в историю, из неё считаются рекорды: самая быстрая победа, лучший счёт. Страница «Прогресс» переделана: уровень, итоги, достижения, игры и история. Во «Флагер» можно играть до 20 человек.',
      en: 'Achievements are here — 63 of them: for matches, wins, hours played, streaks and days in a row, and each game’s own, from clearing a board without a single flag to three bluffs in one game of Coup. Matches and achievements earn experience, and every player has a level. Every finished match goes into a history, which keeps records such as the fastest win and the best score. The Progress page is rebuilt: level, totals, achievements, games and history. Flager takes up to 20 players.'
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
      ]
    }
  },

  /* ===================== 2.10.x ===================== */

  {
    ver: '2.10.0',
    date: '2026-09-25',
    type: 'minor',
    title: { ru: 'Один стол для всех игр', en: 'One Table for Every Game' },
    desc: {
      ru: 'Все восемь игр теперь устроены одинаково: доска слева, справа карточки — чей ход и сколько осталось, ваши действия, игроки. Итоги открываются в одном окне, которое можно убрать и посмотреть финальную доску. Новые игроки видят сайт на английском, пока не выберут язык. В «Сапёре» и «Морском бое» появились уведомления: кто подорвался, кто вышел, кто расставил флот, у кого вышло время. Во «Флагере» между раундами есть минута, потом следующий раунд начинается сам.',
      en: 'All eight games are now laid out the same way: the board on the left, and on the right cards for whose turn it is and how long is left, your moves, and the players. Results open in one dialog that can be put aside to look at the final board. New players see the site in English until they pick a language. Minesweeper and Battleship now have notices: who hit a mine, who left, whose fleet is ready, whose clock ran out. Flager gives you a minute between rounds, then the next one starts on its own.'
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
      ]
    }
  },

  /* ===================== 2.9.x ===================== */

  {
    ver: '2.9.0',
    date: '2026-09-24',
    type: 'minor',
    title: { ru: 'Wall Rush начисто', en: 'Wall Rush, Redrawn' },
    desc: {
      ru: 'Wall Rush в стиле остального сайта. Доска — белые клетки на сером, строгая, стены — ровные полосы мягкого цвета игрока. Рядом три карточки: чей ход и сколько времени осталось, ваши стены, игроки с той же фишкой, что на доске. После партии итоги можно убрать и посмотреть финальную позицию.',
      en: 'Wall Rush in the style of the rest of the site. The board is white squares on grey, square-cornered, and walls are plain bars in the owner’s softened colour. Beside it, three cards: whose turn and how much of it is left, your walls, and the players with the same piece they have on the board. After a match the result can be put aside to look at the final position.'
    }
  },

  /* ===================== 2.8.x ===================== */

  {
    ver: '2.8.0',
    date: '2026-09-24',
    type: 'minor',
    title: { ru: 'Клавиши, которые работают', en: 'Keys That Work' },
    desc: {
      ru: 'Поле Wall Rush стало цельной доской: квадратные плитки, стены заполняют желобок целиком и аккуратно смыкаются — в линию, углом и буквой Т, — а линии финиша перенесены в рамку. В «Сапёре» пробел ставит флаг или открывает соседей числа, колесо мыши масштабирует поле, стрелки двигают его. В Wall Rush пешкой можно ходить стрелками, а стену в руке поворачивать клавишей R или пробелом. Все сочетания описаны в правилах каждой игры.',
      en: 'The Wall Rush board is now one piece: square tiles, walls that fill their groove and meet cleanly — in line, at a corner and in a T — and finish lines moved into the rim. In Minesweeper Space flags a cell or chords a number, the mouse wheel zooms the board and the arrows move it. In Wall Rush the arrows move your pawn and R or Space turns the wall in your hand. Every shortcut is in each game’s rules.'
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
      ]
    }
  },

  /* ===================== 2.7.x ===================== */

  {
    ver: '2.7.0',
    date: '2026-09-24',
    type: 'minor',
    title: { ru: 'Разговор за столом', en: 'Talk at the Table' },
    desc: {
      ru: 'В каждой комнате всех восьми игр появился чат с тридцатью смайликами — в лобби, во время партии и на итогах. Его видят только те, кто сидит в комнате, и он удаляется вместе с ней. «Сыграть ещё» теперь помнит счёт серии: в лобби новой комнаты видно, кто сколько взял. В «Шпионе» победа шпиона стоит 5 очков, мирного — 1. В Wall Rush можно сдаться и остаться досматривать.',
      en: 'Every room in all eight games now has a chat with thirty emoji — in the lobby, during the match and on the results. Only the people seated in the room can read it, and it is deleted with the room. "Play again" now remembers the score of the series: the new room’s lobby shows who has taken how many. In Spyfall a spy’s win is worth 5 points and a local’s 1. In Wall Rush you can resign and stay to watch.'
    },
    fixes: {
      ru: ['Две стены Wall Rush в линию оставляли зазор, и сплошная преграда выглядела разорванной.'],
      en: ['Two Wall Rush walls in line left a gap, so a continuous barrier looked broken.']
    }
  },

  /* ===================== 2.6.x ===================== */

  {
    ver: '2.6.2',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'В статистике посещений появилось событие закрытия комнаты.',
      en: 'Visit statistics gain an event for a room being closed.'
    },
    fixes: {
      ru: ['Все события одного человека попадали в один бесконечный визит, поэтому повторные заходы не считались.'],
      en: ['Every event from one person landed in a single endless visit, so return visits were never counted.']
    }
  },

  {
    ver: '2.6.1',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'Теперь можно проверить, что сбор статистики действительно настроен и что Google принимает то, что мы отправляем, — раньше об этом нельзя было узнать снаружи никак.',
      en: 'It is now possible to check that collection really is configured and that Google accepts what we send — previously there was no way to tell from outside.'
    }
  },

  {
    ver: '2.6.0',
    date: '2026-09-22',
    type: 'minor',
    title: { ru: 'Аналитика без посредника', en: 'Analytics Without a Middleman' },
    desc: {
      ru: 'Статистика вернулась, устроенная иначе: Google Analytics больше не загружается в браузер вообще — ни скриптов, ни cookie, ни вашего IP-адреса. Страница сообщает событие нам, а передаём его мы, со своего сервера, и адрес страницы собираем сами. Ссылка на комнату туда попасть не может.',
      en: 'Statistics are back, arranged differently: Google Analytics no longer loads in the browser at all — no script, no cookie, and your IP address never reaches it. The page reports an event to us and we forward it from our server, assembling the page address ourselves. A room link cannot get through.'
    }
  },

  /* ===================== 2.5.x ===================== */

  {
    ver: '2.5.3',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'Сбор статистики отключён. Он передавал в Google адрес страницы вместе с идентификатором комнаты, а ссылка на приватную комнату — это и есть доступ к ней. Четыре попытки это обойти не сработали, поэтому сбор выключен до тех пор, пока безопасность не будет доказана.',
      en: 'Usage statistics are switched off. They were sending Google the page address together with the room identifier, and a private room’s link is its access. Four attempts to work around it failed, so collection is off until it can be shown to be safe.'
    }
  },

  {
    ver: '2.5.2',
    date: '2026-09-22',
    type: 'patch',
    fixes: {
      ru: ['Адрес комнаты всё ещё уходил в аналитику: две прошлые попытки не работали, потому что проверялись не все запросы. Теперь проверено от начала до конца на настоящей комнате.'],
      en: ['The room address was still reaching analytics: the two previous attempts did not work because not every request was checked. Now verified end to end on a real room.']
    }
  },

  {
    ver: '2.5.1',
    date: '2026-09-22',
    type: 'patch',
    fixes: {
      ru: ['Адрес комнаты всё ещё уходил в аналитику: способ его подменить из документации Google молча не работает. Заменён на проверенный.'],
      en: ['The room address was still reaching analytics: the documented way to override it silently does nothing. Replaced with one that was measured and works.']
    }
  },

  {
    ver: '2.5.0',
    date: '2026-09-22',
    type: 'minor',
    title: { ru: 'Стены втроём', en: 'Wall Rush for Three' },
    desc: {
      ru: 'В «Стенах» появился режим на троих: доска 11×11, трое с трёх сторон, по 8 стен, все бегут в золотую клетку в центре. И комната теперь закрывается, если её создатель ушёл, — с подтверждением, чтобы это не случилось случайно.',
      en: 'Wall Rush gains a three-player mode: an 11x11 board, three players on three sides, 8 walls each, everyone racing for the golden square in the middle. And a room now closes when the person who opened it leaves — with a confirmation, so it does not happen by accident.'
    }
  },

  /* ===================== 2.4.x ===================== */

  {
    ver: '2.4.1',
    date: '2026-09-22',
    type: 'patch',
    fixes: {
      ru: ['В аналитику уходил полный адрес страницы вместе с идентификатором комнаты: Google подставлял его сам, в обход очистки. Теперь очищенный адрес прикрепляется к каждому событию.'],
      en: ['The full page address, room identifier and all, still reached analytics: Google filled it in by itself, around the stripping. The cleaned address is now attached to every event.']
    }
  },

  {
    ver: '2.4.0',
    date: '2026-09-22',
    type: 'minor',
    title: { ru: 'Аналитика и приватность', en: 'Analytics and Privacy' },
    desc: {
      ru: 'Появилась страница политики конфиденциальности и аналитика посещений — она спрашивает разрешение и не загружается, пока вы не согласились. Ссылки на комнаты в неё не попадают: идентификатор комнаты вырезается из адреса, потому что ссылка на приватную комнату — это ключ от неё.',
      en: 'A privacy policy page, and usage analytics that asks permission and is not loaded until you agree. Room links stay out of it: the room identifier is stripped from the address, because a private room’s link is the key to it.'
    }
  },

  /* ===================== 2.3.x ===================== */

  {
    ver: '2.3.3',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'Мелкий текст по всему сайту стал крупнее на больших экранах: подписи, счётчики и пояснения, которые были рассчитаны на ноутбук и превращались в точки на большом мониторе. На телефоне и планшете размеры прежние — там компактность на месте.',
      en: 'Small text across the site grows on a large screen: the captions, counters and side notes that were drawn for a laptop and turned into specks on a big monitor. Phones and tablets keep the sizes they had, where the tight ones earn their keep.'
    }
  },

  {
    ver: '2.3.2',
    date: '2026-09-22',
    type: 'patch',
    desc: {
      ru: 'Первый ход больше не достаётся хозяину комнаты по умолчанию — он разыгрывается: в Морском бою, Перевороте, Стенах, Точках и Реверси. В «Точках и квадратах» последняя проведённая линия нарисована толще, закрытые квадраты закрашены заметнее, текст крупнее. Кнопка правил теперь подписана, а не просто знак вопроса.',
      en: 'The opening move is no longer the host’s by default — it is drawn for, in Battleship, Coup, Wall Rush, Dots & Boxes and Reversi. In Dots & Boxes the line just played is heavier, closed boxes are filled more clearly and the text is larger. The rules button is labelled rather than a bare question mark.'
    }
  },

  {
    ver: '2.3.1',
    date: '2026-09-21',
    type: 'patch',
    desc: {
      ru: 'Если хост ушёл, комнату принимает кто-то из оставшихся, а лобби, которое никто не открывал десять минут, закрывается само. Полные комнаты не показываются в списке — зайти в них всё равно нельзя. Ссылка на завершённую комнату ведёт в новую, если там нажали «Ещё раз». Гостевые аккаунты, которыми не пользовались 30 дней, удаляются.',
      en: 'If the host goes, one of the remaining players takes the room over, and a lobby nobody has had open for ten minutes closes itself. Full rooms are hidden — there is no way into them anyway. A link to a finished room now follows "play again" into its successor. Guest accounts unused for 30 days are removed.'
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
      ]
    }
  },

  {
    ver: '2.3.0',
    date: '2026-09-21',
    type: 'minor',
    title: { ru: 'Три новые игры', en: 'Three New Games' },
    desc: {
      ru: 'Стены, Точки и квадраты и Реверси — игр стало восемь. «Ещё раз» теперь открывает новую комнату с настройками родительской, во всех играх сразу.',
      en: 'Wall Rush, Dots & Boxes and Reversi bring the line-up to eight. "Play again" now opens a fresh room that inherits the old one’s settings, in every game.'
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
      ]
    }
  },

  /* ===================== 2.2.x ===================== */

  {
    ver: '2.2.0',
    date: '2026-09-02',
    type: 'minor',
    title: { ru: 'Большой Шпион', en: 'Spyfall Expanded' },
    desc: {
      ru: 'Шпион вырос с 30 локаций до 330: пятнадцать наборов по 22 локации, у каждой по 20 ролей. Новые наборы — природа, история, фантастика, спорт и еда. У карточек локаций появилось оформление, которое рисуется на месте и ничего не загружает.',
      en: 'Spyfall grew from 30 locations to 330: fifteen packs of 22, with 20 roles each. New packs for nature, history, sci-fi, sports and food. Location cards now have artwork that is drawn on the spot and downloads nothing.'
    },
    fixes: {
      ru: [
        'Картинки локаций «Шпиона» не загружались с самого появления наборов.',
        'Аватары запрашивались у стороннего сервиса вместе с идентификатором пользователя — теперь их рисует сам сайт.'
      ],
      en: [
        'Spyfall location images had never loaded since the packs were written.',
        'Avatars were fetched from a third party along with the user’s identifier; the site now draws them itself.'
      ]
    }
  },

  /* ===================== 2.1.x ===================== */

  {
    ver: '2.1.0',
    date: '2026-08-20',
    type: 'minor',
    title: { ru: 'Новый дом', en: 'New Home' },
    desc: {
      ru: 'Платформа переехала на games.okhten.com. Публичные страницы игр с правилами и описанием, ускоренная загрузка, обновлённая навигация и модульная архитектура интерфейса.',
      en: 'The platform has moved to games.okhten.com. Public game pages with rules and descriptions, faster loading, refreshed navigation and a modular UI architecture.'
    }
  },

  /* ===================== 2.0.x ===================== */

  {
    ver: '2.0.4',
    date: '2026-08-05',
    type: 'patch',
    desc: {
      ru: 'Стабильность при слабой сети: возвращение в комнату без потери места, понятные уведомления о разрыве связи.',
      en: 'Stability on weak connections: rejoin your room without losing your seat, with clear notifications when the connection drops.'
    }
  },

  {
    ver: '2.0.3',
    date: '2026-07-27',
    type: 'patch',
    desc: {
      ru: 'Мобильная версия: увеличены области нажатия, выверены жесты в Сапёре и Морском бою.',
      en: 'Mobile: larger tap targets and refined gestures in Minesweeper and Battleship.'
    },
    fixes: {
      ru: ['Вёрстка ломалась на узких экранах.'],
      en: ['The layout broke on narrow screens.']
    }
  },

  {
    ver: '2.0.2',
    date: '2026-07-18',
    type: 'patch',
    desc: {
      ru: 'Ускорена загрузка списка комнат и страницы статистики, снижен объём трафика при синхронизации матчей.',
      en: 'Faster room list and statistics page, with reduced traffic during match synchronization.'
    }
  },

  {
    ver: '2.0.1',
    date: '2026-07-11',
    type: 'patch',
    desc: {
      ru: 'Полировка: аккуратное подтверждение удаления аватара вместо системного окна, мелкие улучшения интерфейса.',
      en: 'Polish: a neat avatar-delete confirmation instead of the native dialog, and small UI refinements.'
    }
  },

  {
    ver: '2.0.0',
    date: '2026-07-09',
    type: 'major',
    title: { ru: 'Платформа 2.0', en: 'Platform 2.0' },
    desc: {
      ru: 'Крупное обновление платформы: усилена безопасность (серверная проверка паролей, защита от гонок записи), честная статистика во всех играх, вход по ссылке, восстановление пароля, звук, всплывающие уведомления, управление с клавиатуры (Esc/Enter/стрелки) и аккорд в Сапёре.',
      en: 'A major platform update: hardened security (server-side password checks, write-race protection), honest statistics in every game, join-by-link, password recovery, sound, toast notifications, keyboard controls (Esc/Enter/arrows) and the Minesweeper chord.'
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
      ]
    }
  }
];
