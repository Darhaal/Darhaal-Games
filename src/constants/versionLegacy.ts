import type { VersionLog } from './version';

/**
 * The 1.x line, January to June 2026 — shown on the changelog page only
 * (/changelog), so the game's own bundle does not carry it. Newest first,
 * continuing where `VERSION_HISTORY` ends.
 */
export const LEGACY_HISTORY: VersionLog[] = [
  /* ===================== 1.9.x ===================== */

  {
    ver: '1.9.3',
    date: '2026-06-22',
    type: 'patch',
    desc: { ru: 'Выверены тексты правил и подсказок.', en: 'The rules and hints were revised.', uk: 'Вивірено тексти правил і підказок.' },
    fixes: { ru: ['Опечатки в русских правилах и подсказках.'], en: ['Typos in the Russian rules and hints.'], uk: ['Друкарські помилки в російських правилах і підказках.'] }
  },
  {
    ver: '1.9.2',
    date: '2026-06-10',
    type: 'patch',
    desc: { ru: 'Длинные описания свёрстаны аккуратнее.', en: 'Long descriptions are laid out more neatly.', uk: 'Довгі описи зверстано акуратніше.' },
    fixes: { ru: ['Окно правил не закрывалось на телефонах.'], en: ['The rules dialog would not close on phones.'], uk: ['Вікно правил не закривалося на телефонах.'] }
  },
  {
    ver: '1.9.1',
    date: '2026-06-01',
    type: 'patch',
    desc: {
      ru: 'Правила открываются прямо из лобби, для новичков добавлены короткие подсказки.',
      en: 'Rules open straight from the lobby, with short hints added for newcomers.',
      uk: 'Правила відкриваються просто з лобі, для новачків додано короткі підказки.'
    }
  },
  {
    ver: '1.9.0',
    date: '2026-05-14',
    type: 'minor',
    title: { ru: 'Правила', en: 'Rules', uk: 'Правила' },
    desc: {
      ru: 'Встроенные правила во всех играх: одно окно с целью партии, порядком хода и условиями победы на русском и английском.',
      en: 'Built-in rules for every game: one dialog with the goal, the turn order and the win conditions, in Russian and English.',
      uk: 'Вбудовані правила в усіх іграх: одне вікно з метою партії, порядком ходу й умовами перемоги російською та англійською.'
    }
  },

  /* ===================== 1.8.x ===================== */

  {
    ver: '1.8.4',
    date: '2026-05-06',
    type: 'patch',
    desc: { ru: 'Сбалансированы редкие локации «Шпиона».', en: 'Spyfall’s rare locations rebalanced.', uk: 'Збалансовано рідкісні локації «Шпигуна».' },
    fixes: { ru: ['В наборах локаций встречались повторы.'], en: ['Locations repeated within a pack.'], uk: ['У наборах локацій траплялися повтори.'] }
  },
  {
    ver: '1.8.3',
    date: '2026-04-28',
    type: 'patch',
    fixes: { ru: ['Набор локаций сбивался при повторном старте раунда.'], en: ['The location pack was lost when a round was restarted.'], uk: ['Набір локацій збивався під час повторного старту раунду.'] }
  },
  {
    ver: '1.8.2',
    date: '2026-04-20',
    type: 'patch',
    desc: {
      ru: 'Карточки ролей стали читаться легче, иконки локаций обновлены.',
      en: 'Role cards read more easily, and the location icons are refreshed.',
      uk: 'Картки ролей стали читатися легше, іконки локацій оновлено.'
    }
  },
  {
    ver: '1.8.1',
    date: '2026-04-13',
    type: 'patch',
    fixes: { ru: ['Ошибки «Шпиона» и сбои голосования.'], en: ['Spyfall bugs and voting glitches.'], uk: ['Помилки «Шпигуна» й збої голосування.'] }
  },
  {
    ver: '1.8.0',
    date: '2026-04-08',
    type: 'minor',
    title: { ru: 'Тематические наборы', en: 'Theme Packs', uk: 'Тематичні набори' },
    desc: {
      ru: 'Новые наборы локаций для «Шпиона»: школа, университет, офис, хоррор, игры, США, СССР и расширенные общие наборы.',
      en: 'New location packs for Spyfall: school, university, office, horror, gaming, the USA, the USSR, and extended general packs.',
      uk: 'Нові набори локацій для «Шпигуна»: школа, університет, офіс, хорор, ігри, США, СРСР і розширені загальні набори.'
    }
  },

  /* ===================== 1.7.x ===================== */

  {
    ver: '1.7.5',
    date: '2026-03-31',
    type: 'patch',
    fixes: { ru: ['Комната иногда оставалась в списке после выхода всех игроков.'], en: ['A room sometimes stayed in the list after every player had left.'], uk: ['Кімната іноді залишалася в списку після виходу всіх гравців.'] }
  },
  {
    ver: '1.7.4',
    date: '2026-03-25',
    type: 'patch',
    desc: { ru: 'Список комнат обновляется быстрее.', en: 'The room list updates faster.', uk: 'Список кімнат оновлюється швидше.' },
    fixes: { ru: ['Счётчик игроков в комнате показывал неверное число.'], en: ['The room’s player counter showed the wrong number.'], uk: ['Лічильник гравців у кімнаті показував неправильне число.'] }
  },
  {
    ver: '1.7.3',
    date: '2026-03-20',
    type: 'patch',
    fixes: { ru: ['Копирование кода комнаты работало не во всех браузерах.'], en: ['Copying the room code did not work in every browser.'], uk: ['Копіювання коду кімнати працювало не в усіх браузерах.'] }
  },
  {
    ver: '1.7.2',
    date: '2026-03-17',
    type: 'patch',
    fixes: { ru: ['Права хоста не передавались, когда создатель комнаты уходил.'], en: ['The host role was not handed on when the room’s creator left.'], uk: ['Права хоста не передавалися, коли творець кімнати виходив.'] }
  },
  {
    ver: '1.7.1',
    date: '2026-03-14',
    type: 'patch',
    fixes: { ru: ['Ошибки приватных комнат и фильтров списка.'], en: ['Bugs in private rooms and the list filters.'], uk: ['Помилки приватних кімнат і фільтрів списку.'] }
  },
  {
    ver: '1.7.0',
    date: '2026-03-12',
    type: 'minor',
    title: { ru: 'Лобби', en: 'Lobby', uk: 'Лобі' },
    desc: {
      ru: 'Переработанное лобби: приватные комнаты с паролем, короткие коды приглашения, фильтры по играм и автоматическое исключение отключившихся — с временем на переподключение.',
      en: 'A reworked lobby: private rooms with a password, short invite codes, per-game filters, and automatic removal of disconnected players after a grace period to reconnect.',
      uk: 'Перероблене лобі: приватні кімнати з паролем, короткі коди запрошення, фільтри за іграми й автоматичне виключення відключених — із часом на перепідключення.'
    }
  },

  /* ===================== 1.6.x ===================== */

  {
    ver: '1.6.4',
    date: '2026-03-06',
    type: 'patch',
    fixes: { ru: ['Средняя длительность матча считалась неверно.'], en: ['The average match duration was calculated wrongly.'], uk: ['Середня тривалість матчу рахувалася неправильно.'] }
  },
  {
    ver: '1.6.3',
    date: '2026-03-01',
    type: 'patch',
    desc: {
      ru: 'Аватары: ограничение размера файла и понятная ошибка при загрузке.',
      en: 'Avatars: a file size limit and a clear error message on upload.',
      uk: 'Аватари: обмеження розміру файлу й зрозуміла помилка під час завантаження.'
    }
  },
  {
    ver: '1.6.2',
    date: '2026-02-25',
    type: 'patch',
    fixes: { ru: ['У новых игроков не отображалась статистика.'], en: ['Statistics did not show for new players.'], uk: ['У нових гравців не відображалася статистика.'] }
  },
  {
    ver: '1.6.1',
    date: '2026-02-22',
    type: 'patch',
    fixes: { ru: ['Ошибки профиля и настроек.'], en: ['Bugs in the profile and settings.'], uk: ['Помилки профілю й налаштувань.'] }
  },
  {
    ver: '1.6.0',
    date: '2026-02-20',
    type: 'minor',
    title: { ru: 'Профиль', en: 'Profile', uk: 'Профіль' },
    desc: {
      ru: 'Личный профиль и достижения: страница статистики по каждой игре, загрузка своих аватаров и сгенерированные аватары для новых аккаунтов.',
      en: 'A personal profile and achievements: a statistics page for each game, custom avatar uploads, and generated avatars for new accounts.',
      uk: 'Особистий профіль і досягнення: сторінка статистики для кожної гри, завантаження своїх аватарів і згенеровані аватари для нових акаунтів.'
    }
  },

  /* ===================== 1.5.x ===================== */

  {
    ver: '1.5.4',
    date: '2026-02-08',
    type: 'patch',
    desc: {
      ru: 'Новые карточки и наборы для «Шпиона», лобби работает быстрее.',
      en: 'More cards and packs for Spyfall, and a faster lobby.',
      uk: 'Нові картки й набори для «Шпигуна», лобі працює швидше.'
    },
    fixes: { ru: ['Мелкие ошибки.'], en: ['Minor bugs.'], uk: ['Дрібні помилки.'] }
  },
  {
    ver: '1.5.3',
    date: '2026-02-07',
    type: 'patch',
    desc: {
      ru: 'Переработаны настройки и система достижений, игра стала стабильнее и быстрее.',
      en: 'Settings and the achievement system reworked; the game is steadier and faster.',
      uk: 'Перероблено налаштування й систему досягнень, гра стала стабільнішою та швидшою.'
    },
    fixes: { ru: ['Мелкие ошибки.'], en: ['Minor bugs.'], uk: ['Дрібні помилки.'] }
  },
  {
    ver: '1.5.2',
    date: '2026-02-06',
    type: 'patch',
    desc: {
      ru: 'Правила игр переработаны и упрощены, тексты читаются легче, дизайн аккуратнее.',
      en: 'The game rules reworked and simplified, easier to read and tidier to look at.',
      uk: 'Правила ігор перероблено й спрощено, тексти читаються легше, дизайн акуратніший.'
    },
    fixes: { ru: ['Мелкие ошибки.'], en: ['Minor bugs.'], uk: ['Дрібні помилки.'] }
  },
  {
    ver: '1.5.1',
    date: '2026-02-06',
    type: 'patch',
    desc: {
      ru: 'Матчи стабильнее, состояние игры синхронизируется надёжнее.',
      en: 'Steadier matches and more reliable state synchronization.',
      uk: 'Матчі стабільніші, стан гри синхронізується надійніше.'
    },
    fixes: { ru: ['Ошибки «Шпиона» и редкие вылеты.'], en: ['Spyfall bugs and rare crashes.'], uk: ['Помилки «Шпигуна» й рідкісні вильоти.'] }
  },
  {
    ver: '1.5.0',
    date: '2026-02-05',
    type: 'minor',
    title: { ru: 'Шпион', en: 'Spyfall', uk: 'Шпигун' },
    desc: {
      ru: 'Добавлен «Шпион». Обновлён внешний вид интерфейса и первое знакомство для новых игроков.',
      en: 'Spyfall arrives. The interface gets a fresh look, and new players a better first visit.',
      uk: 'Додано «Шпигуна». Оновлено зовнішній вигляд інтерфейсу й перше знайомство для нових гравців.'
    },
    fixes: { ru: ['Мелкие ошибки.'], en: ['Minor bugs.'], uk: ['Дрібні помилки.'] }
  },

  /* ===================== 1.4.x ===================== */

  {
    ver: '1.4.5',
    date: '2026-02-03',
    type: 'patch',
    desc: { ru: 'Интерфейс отзывчивее, клики обрабатываются надёжнее.', en: 'A more responsive interface and more reliable clicks.', uk: 'Інтерфейс чуйніший, кліки обробляються надійніше.' },
    fixes: { ru: ['Мелкие ошибки.'], en: ['Minor bugs.'], uk: ['Дрібні помилки.'] }
  },
  {
    ver: '1.4.4',
    date: '2026-02-03',
    type: 'patch',
    desc: { ru: 'Лобби и таймеры работают стабильнее.', en: 'Steadier lobbies and timers.', uk: 'Лобі й таймери працюють стабільніше.' },
    fixes: { ru: ['Ошибки мультиплеера.'], en: ['Multiplayer bugs.'], uk: ['Помилки мультиплеєра.'] }
  },
  {
    ver: '1.4.3',
    date: '2026-02-03',
    type: 'patch',
    desc: { ru: 'В «Сапёр» удобнее играть, анимации легче.', en: 'Minesweeper is easier to play, with lighter animations.', uk: 'У «Сапера» зручніше грати, анімації легші.' }
  },
  {
    ver: '1.4.2',
    date: '2026-02-03',
    type: 'patch',
    fixes: { ru: ['Ошибки генерации поля и логики флагов в «Сапёре».'], en: ['Minesweeper board generation and flag logic bugs.'], uk: ['Помилки генерації поля й логіки прапорців у «Сапері».'] }
  },
  {
    ver: '1.4.1',
    date: '2026-02-03',
    type: 'patch',
    desc: { ru: 'Оптимизированы производительность и работа с сетью.', en: 'Performance and networking optimized.', uk: 'Оптимізовано продуктивність і роботу з мережею.' }
  },
  {
    ver: '1.4.0',
    date: '2026-02-03',
    type: 'minor',
    title: { ru: 'Сапёр', en: 'Minesweeper', uk: 'Сапер' },
    desc: {
      ru: 'Добавлен «Сапёр»: мультиплеер, флаги, масштабирование поля.',
      en: 'Minesweeper arrives: multiplayer, flags and board zoom.',
      uk: 'Додано «Сапера»: мультиплеєр, прапорці, масштабування поля.'
    }
  },

  /* ===================== 1.3.x ===================== */

  {
    ver: '1.3.5',
    date: '2026-02-02',
    type: 'patch',
    fixes: { ru: ['Ошибки перевода и неверные вопросы во «Флагере».'], en: ['Translation mistakes and wrong questions in Flager.'], uk: ['Помилки перекладу й неправильні запитання у «Флагері».'] }
  },
  {
    ver: '1.3.4',
    date: '2026-02-02',
    type: 'patch',
    desc: { ru: 'Интерфейс викторины и анимации стали плавнее.', en: 'A smoother quiz interface and animations.', uk: 'Інтерфейс вікторини й анімації стали плавнішими.' }
  },
  {
    ver: '1.3.3',
    date: '2026-02-02',
    type: 'patch',
    desc: {
      ru: 'Сравнение флагов по пикселям работает быстрее, загрузка ускорена.',
      en: 'Pixel-by-pixel flag matching runs faster, and loading is quicker.',
      uk: 'Порівняння прапорів за пікселями працює швидше, завантаження пришвидшено.'
    }
  },
  {
    ver: '1.3.2',
    date: '2026-02-01',
    type: 'patch',
    fixes: { ru: ['Редкие ошибки подсчёта результатов.'], en: ['Rare scoring errors.'], uk: ['Рідкісні помилки підрахунку результатів.'] }
  },
  {
    ver: '1.3.1',
    date: '2026-02-01',
    type: 'patch',
    desc: { ru: 'Игра стала стабильнее.', en: 'A steadier game.', uk: 'Гра стала стабільнішою.' },
    fixes: { ru: ['Мелкие ошибки.'], en: ['Minor bugs.'], uk: ['Дрібні помилки.'] }
  },
  {
    ver: '1.3.0',
    date: '2026-02-01',
    type: 'minor',
    title: { ru: 'Флагер', en: 'Flager', uk: 'Флагер' },
    desc: {
      ru: 'Добавлен «Флагер» — викторина по флагам: догадка сравнивается с загаданным флагом по пикселям.',
      en: 'Flager arrives — a flag quiz where each guess is compared with the hidden flag pixel by pixel.',
      uk: 'Додано «Флагер» — вікторину за прапорами: здогадка порівнюється із загаданим прапором за пікселями.'
    }
  },

  /* ===================== 1.2.x ===================== */

  {
    ver: '1.2.5',
    date: '2026-01-31',
    type: 'patch',
    desc: {
      ru: 'Оптимизированы перетаскивание кораблей и сетевая синхронизация.',
      en: 'Ship dragging and network synchronization optimized.',
      uk: 'Оптимізовано перетягування кораблів і мережеву синхронізацію.'
    }
  },
  {
    ver: '1.2.4',
    date: '2026-01-31',
    type: 'patch',
    desc: { ru: 'Интерфейс отзывчивее.', en: 'A more responsive interface.', uk: 'Інтерфейс чуйніший.' },
    fixes: { ru: ['Визуальные ошибки.'], en: ['Visual glitches.'], uk: ['Візуальні помилки.'] }
  },
  {
    ver: '1.2.3',
    date: '2026-01-31',
    type: 'patch',
    fixes: { ru: ['Ошибки расстановки кораблей.'], en: ['Ship placement bugs.'], uk: ['Помилки розставлення кораблів.'] }
  },
  {
    ver: '1.2.2',
    date: '2026-01-30',
    type: 'patch',
    desc: { ru: 'Матчи и таймеры работают стабильнее.', en: 'Steadier matches and timers.', uk: 'Матчі й таймери працюють стабільніше.' }
  },
  {
    ver: '1.2.1',
    date: '2026-01-30',
    type: 'patch',
    desc: { ru: 'Улучшения интерфейса.', en: 'Interface improvements.', uk: 'Покращення інтерфейсу.' },
    fixes: { ru: ['Мелкие ошибки.'], en: ['Minor bugs.'], uk: ['Дрібні помилки.'] }
  },
  {
    ver: '1.2.0',
    date: '2026-01-30',
    type: 'minor',
    title: { ru: 'Морской бой', en: 'Battleship', uk: 'Морський бій' },
    desc: { ru: 'Добавлен «Морской бой» в реальном времени.', en: 'Real-time Battleship arrives.', uk: 'Додано «Морський бій» у реальному часі.' }
  },

  /* ===================== 1.1.x ===================== */

  {
    ver: '1.1.5',
    date: '2026-01-29',
    type: 'patch',
    desc: { ru: 'Баланс ролей «Переворота».', en: 'Coup’s roles rebalanced.', uk: 'Баланс ролей «Перевороту».' },
    fixes: { ru: ['Ошибки логики карт.'], en: ['Card logic bugs.'], uk: ['Помилки логіки карт.'] }
  },
  {
    ver: '1.1.4',
    date: '2026-01-29',
    type: 'patch',
    fixes: { ru: ['Игроки расходились в состоянии партии.'], en: ['Players fell out of sync with the match.'], uk: ['Гравці розходилися в стані партії.'] }
  },
  {
    ver: '1.1.3',
    date: '2026-01-29',
    type: 'patch',
    desc: { ru: 'Интерфейс и матчи стали стабильнее.', en: 'A steadier interface and matches.', uk: 'Інтерфейс і матчі стали стабільнішими.' }
  },
  {
    ver: '1.1.2',
    date: '2026-01-28',
    type: 'patch',
    fixes: { ru: ['Ошибки завершения раундов.'], en: ['Rounds did not always end properly.'], uk: ['Помилки завершення раундів.'] }
  },
  {
    ver: '1.1.1',
    date: '2026-01-28',
    type: 'patch',
    desc: { ru: 'Оптимизация.', en: 'Optimizations.', uk: 'Оптимізація.' },
    fixes: { ru: ['Мелкие ошибки.'], en: ['Minor bugs.'], uk: ['Дрібні помилки.'] }
  },
  {
    ver: '1.1.0',
    date: '2026-01-28',
    type: 'minor',
    title: { ru: 'Переворот', en: 'Coup', uk: 'Переворот' },
    desc: { ru: 'Добавлена карточная игра «Переворот».', en: 'The card game Coup arrives.', uk: 'Додано карткову гру «Переворот».' }
  },

  /* ===================== 1.0.x ===================== */

  {
    ver: '1.0.2',
    date: '2026-01-27',
    type: 'patch',
    desc: { ru: 'Русский и английский языки, настройки звука.', en: 'Russian and English, and sound settings.', uk: 'Російська та англійська мови, налаштування звуку.' }
  },
  {
    ver: '1.0.1',
    date: '2026-01-27',
    type: 'patch',
    fixes: { ru: ['Ошибки входа и лобби.'], en: ['Sign-in and lobby bugs.'], uk: ['Помилки входу й лобі.'] }
  },
  {
    ver: '1.0.0',
    date: '2026-01-27',
    type: 'init',
    title: { ru: 'Запуск', en: 'Launch', uk: 'Запуск' },
    desc: {
      ru: 'Первый релиз платформы: аккаунты, профили и лобби.',
      en: 'The platform’s first release: accounts, profiles and lobbies.',
      uk: 'Перший реліз платформи: акаунти, профілі й лобі.'
    }
  }
];
