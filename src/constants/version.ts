export const APP_VERSION = '2.5.1';

export type VersionType = 'major' | 'minor' | 'patch' | 'init';

export interface VersionLog {
  ver: string;
  date: string;
  type: VersionType;
  title?: { ru: string; en: string };
  desc: { ru: string; en: string };
}

export const VERSION_HISTORY: VersionLog[] = [
  /* ===================== 2.5.x ===================== */

  {
    ver: '2.5.1',
    date: '22 SEP 2026',
    type: 'patch',
    desc: {
      ru: 'Адрес комнаты всё-таки уходил в аналитику: способ его подменить, описанный в документации Google, молча не работает. Заменён на тот, который проверен и работает.',
      en: 'The room address was still reaching analytics: the documented way to override it silently does nothing. Replaced with the one that was measured and works.'
    }
  },

  {
    ver: '2.5.0',
    date: '22 SEP 2026',
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
    date: '22 SEP 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлено: в аналитику всё-таки уходил полный адрес страницы вместе с идентификатором комнаты. Вырезание работало, но Google подставлял адрес сам, помимо него. Теперь очищенный адрес прикрепляется к каждому событию.',
      en: 'Fixed: the full page address, room identifier and all, was still reaching analytics. The stripping worked, but Google filled the address in by itself alongside it. The cleaned address is now attached to every event.'
    }
  },

  {
    ver: '2.4.0',
    date: '22 SEP 2026',
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
    date: '22 SEP 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкий текст по всему сайту стал крупнее на больших экранах: подписи, счётчики и пояснения, которые были рассчитаны на ноутбук и превращались в точки на большом мониторе. На телефоне и планшете размеры прежние — там компактность на месте.',
      en: 'Small text across the site grows on a large screen: the captions, counters and side notes that were drawn for a laptop and turned into specks on a big monitor. Phones and tablets keep the sizes they had, where the tight ones earn their keep.'
    }
  },

  {
    ver: '2.3.2',
    date: '22 SEP 2026',
    type: 'patch',
    desc: {
      ru: 'Первый ход больше не достаётся хозяину комнаты по умолчанию — он разыгрывается: в Морском бою, Перевороте, Стенах, Точках и Реверси. В «Точках и квадратах» последняя проведённая линия нарисована толще, закрытые квадраты закрашены заметнее, текст крупнее. Кнопка правил теперь подписана, а не просто знак вопроса.',
      en: 'The opening move is no longer the host’s by default — it is drawn for, in Battleship, Coup, Wall Rush, Dots & Boxes and Reversi. In Dots & Boxes the line just played is heavier, closed boxes are filled more clearly and the text is larger. The rules button is labelled rather than a bare question mark.'
    }
  },

  {
    ver: '2.3.1',
    date: '21 SEP 2026',
    type: 'patch',
    desc: {
      ru: 'Комната, в которой никого не осталось, больше не висит в списке: если хост ушёл, комнату принимает кто-то из оставшихся, а пустое лобби закрывается само. Полные комнаты не показываются в списке — зайти в них всё равно нельзя. Ссылка на завершённую комнату ведёт в новую, если там нажали «Ещё раз», и счёт «Шпиона» больше не обнуляется между партиями.',
      en: 'A room with nobody left in it no longer sits in the list: if the host goes, one of the remaining players takes it over, and an empty lobby closes itself. Full rooms are hidden — there is no way into them anyway. A link to a finished room now follows "play again" into its successor, and the Spyfall score survives between games.'
    }
  },

  {
    ver: '2.3.0',
    date: '21 SEP 2026',
    type: 'minor',
    title: { ru: 'Три новые игры', en: 'Three New Games' },
    desc: {
      ru: 'Стены, Точки и квадраты и Реверси — игр стало восемь. «Ещё раз» теперь открывает новую комнату с настройками родительской, во всех играх сразу. Переворот, который вообще не запускался, починен; отключившийся игрок больше не морозит комнату, а одновременные действия не съедают ход.',
      en: 'Wall Rush, Dots & Boxes and Reversi bring the line-up to eight. "Play again" now opens a fresh room that inherits the old one’s settings, in every game. Coup, which could never start at all, is fixed; a player who disconnects no longer freezes the room, and simultaneous actions no longer cost a move.'
    }
  },

  /* ===================== 2.2.x ===================== */

  {
    ver: '2.2.0',
    date: '2 SEP 2026',
    type: 'minor',
    title: { ru: 'Большой Шпион', en: 'Spyfall Expanded' },
    desc: {
      ru: 'Шпион вырос с 30 локаций до 330: пятнадцать наборов по 22 локации, у каждой по 20 ролей. Новые наборы — природа, история, фантастика, спорт и еда. У карточек локаций появилось оформление, которое рисуется на месте и ничего не загружает.',
      en: 'Spyfall grew from 30 locations to 330: fifteen packs of 22, with 20 roles each. New packs for nature, history, sci-fi, sports and food. Location cards now have artwork that is drawn on the spot and downloads nothing.'
    }
  },

  /* ===================== 2.1.x ===================== */

  {
    ver: '2.1.0',
    date: '20 AUG 2026',
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
    date: '5 AUG 2026',
    type: 'patch',
    desc: {
      ru: 'Стабильность при слабой сети: возвращение в комнату без потери места, понятные уведомления о разрыве связи.',
      en: 'Stability on weak connections: rejoin your room without losing your seat, with clear notifications when the connection drops.'
    }
  },

  {
    ver: '2.0.3',
    date: '27 JUL 2026',
    type: 'patch',
    desc: {
      ru: 'Мобильная версия: увеличены области нажатия, исправлена вёрстка на узких экранах, выверены жесты в Сапёре и Морском бою.',
      en: 'Mobile: larger tap targets, fixed layout on narrow screens, and refined gestures in Minesweeper and Battleship.'
    }
  },

  {
    ver: '2.0.2',
    date: '18 JUL 2026',
    type: 'patch',
    desc: {
      ru: 'Ускорена загрузка списка комнат и страницы статистики, снижен объём трафика при синхронизации матчей.',
      en: 'Faster room list and statistics page, with reduced traffic during match synchronization.'
    }
  },

  {
    ver: '2.0.1',
    date: '11 JUL 2026',
    type: 'patch',
    desc: {
      ru: 'Полировка: аккуратное подтверждение удаления аватара вместо системного окна, мелкие улучшения интерфейса.',
      en: 'Polish: a neat avatar-delete confirmation instead of the native dialog, and small UI refinements.'
    }
  },

  {
    ver: '2.0.0',
    date: '9 JUL 2026',
    type: 'major',
    title: { ru: 'Платформа 2.0', en: 'Platform 2.0' },
    desc: {
      ru: 'Крупное обновление платформы: усилена безопасность (серверная проверка паролей, защита от гонок записи), честная статистика во всех играх, вход по ссылке, восстановление пароля, звук, всплывающие уведомления, управление с клавиатуры (Esc/Enter/стрелки), аккорд в Сапёре и множество исправлений.',
      en: 'A major platform update: hardened security (server-side password checks, write-race protection), honest statistics in every game, join-by-link, password recovery, sound, toast notifications, keyboard controls (Esc/Enter/arrows), Minesweeper chord, and a large batch of fixes.'
    }
  },

  /* ===================== 1.9.x ===================== */

  {
    ver: '1.9.3',
    date: '22 JUN 2026',
    type: 'patch',
    desc: {
      ru: 'Правки текстов правил и подсказок, исправлены опечатки в русской локализации.',
      en: 'Rule and hint copy fixes, with typos corrected in the Russian localization.'
    }
  },

  {
    ver: '1.9.2',
    date: '10 JUN 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлено закрытие окна правил на мобильных, улучшена вёрстка длинных описаний.',
      en: 'Fixed closing the rules dialog on mobile and improved the layout of long descriptions.'
    }
  },

  {
    ver: '1.9.1',
    date: '1 JUN 2026',
    type: 'patch',
    desc: {
      ru: 'Правила открываются прямо из лобби, добавлены краткие подсказки для новичков.',
      en: 'Rules open straight from the lobby, with short hints added for newcomers.'
    }
  },

  {
    ver: '1.9.0',
    date: '14 MAY 2026',
    type: 'minor',
    title: { ru: 'Правила', en: 'Rules' },
    desc: {
      ru: 'Встроенные правила во всех играх: единое окно с целью партии, порядком хода и условиями победы на русском и английском.',
      en: 'Built-in rules for every game: a single dialog covering the goal, turn order and win conditions in Russian and English.'
    }
  },

  /* ===================== 1.8.x ===================== */

  {
    ver: '1.8.4',
    date: '6 MAY 2026',
    type: 'patch',
    desc: {
      ru: 'Сбалансированы редкие локации, убраны повторы внутри паков.',
      en: 'Rare locations rebalanced and duplicate entries removed from the packs.'
    }
  },

  {
    ver: '1.8.3',
    date: '28 APR 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлен выбор пака при повторном старте раунда.',
      en: 'Fixed pack selection when a round is restarted.'
    }
  },

  {
    ver: '1.8.2',
    date: '20 APR 2026',
    type: 'patch',
    desc: {
      ru: 'Улучшена читаемость карточек ролей, обновлены иконки локаций.',
      en: 'Improved role card readability and refreshed the location icons.'
    }
  },

  {
    ver: '1.8.1',
    date: '13 APR 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкие багфиксы «Шпиона» и стабильность голосования.',
      en: 'Minor Spy Mode fixes and voting stability.'
    }
  },

  {
    ver: '1.8.0',
    date: '8 APR 2026',
    type: 'minor',
    title: { ru: 'Тематические паки', en: 'Theme Packs' },
    desc: {
      ru: 'Новые наборы локаций для «Шпиона»: школа, университет, офис, хоррор, игры, США, СССР и расширенные общие паки.',
      en: 'New location sets for Spy Mode: school, university, office, horror, gaming, USA, USSR and extended general packs.'
    }
  },

  /* ===================== 1.7.x ===================== */

  {
    ver: '1.7.5',
    date: '31 MAR 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлены редкие случаи, когда комната оставалась в списке после выхода всех игроков.',
      en: 'Fixed rare cases where a room stayed in the list after every player had left.'
    }
  },

  {
    ver: '1.7.4',
    date: '25 MAR 2026',
    type: 'patch',
    desc: {
      ru: 'Ускорено обновление списка комнат, исправлен счётчик игроков.',
      en: 'Faster room list updates and a corrected player counter.'
    }
  },

  {
    ver: '1.7.3',
    date: '20 MAR 2026',
    type: 'patch',
    desc: {
      ru: 'Копирование кода комнаты работает во всех браузерах.',
      en: 'Copying the room code now works in every browser.'
    }
  },

  {
    ver: '1.7.2',
    date: '17 MAR 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлена передача прав хоста при выходе создателя комнаты.',
      en: 'Fixed host transfer when the room creator leaves.'
    }
  },

  {
    ver: '1.7.1',
    date: '14 MAR 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкие багфиксы приватных комнат и фильтров списка.',
      en: 'Minor private room and list filter fixes.'
    }
  },

  {
    ver: '1.7.0',
    date: '12 MAR 2026',
    type: 'minor',
    title: { ru: 'Лобби', en: 'Lobby' },
    desc: {
      ru: 'Переработанное лобби: приватные комнаты с паролем, короткие коды приглашения, фильтры по играм и автоматическое исключение отключившихся с окном на переподключение.',
      en: 'A reworked lobby: private rooms with a password, short invite codes, per-game filters, and automatic removal of disconnected players with a reconnect grace period.'
    }
  },

  /* ===================== 1.6.x ===================== */

  {
    ver: '1.6.4',
    date: '6 MAR 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлен подсчёт средней длительности матчей.',
      en: 'Fixed the average match duration calculation.'
    }
  },

  {
    ver: '1.6.3',
    date: '1 MAR 2026',
    type: 'patch',
    desc: {
      ru: 'Аватарки: ограничение размера файла и понятная ошибка при загрузке.',
      en: 'Avatars: a file size limit and a clear error message on upload.'
    }
  },

  {
    ver: '1.6.2',
    date: '25 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлено отображение статистики у новых игроков.',
      en: 'Fixed statistics display for new players.'
    }
  },

  {
    ver: '1.6.1',
    date: '22 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкие багфиксы профиля и настроек.',
      en: 'Minor profile and settings fixes.'
    }
  },

  {
    ver: '1.6.0',
    date: '20 FEB 2026',
    type: 'minor',
    title: { ru: 'Профиль', en: 'Profile' },
    desc: {
      ru: 'Личный профиль и достижения: страница статистики по каждой игре, загрузка своих аватарок и генерируемые аватары для новых аккаунтов.',
      en: 'Personal profile and achievements: a per-game statistics page, custom avatar uploads, and generated avatars for new accounts.'
    }
  },

  /* ===================== 1.5.x ===================== */

  {
    ver: '1.5.4',
    date: '8 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлены ошибки, улучшена работа лобби, добавлены новые карточки и паки для режима «Шпион».',
      en: 'Bug fixes, improved lobby performance, and additional cards and packs for Spy Mode.'
    }
  },

  {
    ver: '1.5.3',
    date: '7 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Переработаны настройки и система достижений, мелкие багфиксы и общее улучшение стабильности и производительности.',
      en: 'Reworked settings and achievements system, minor bug fixes, and overall stability and performance improvements.'
    }
  },

  {
    ver: '1.5.2',
    date: '6 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкие багфиксы, переработаны и упрощены правила игр, улучшена читаемость и дизайн.',
      en: 'Minor bug fixes, reworked and simplified game rules, improved readability and design.'
    }
  },

  {
    ver: '1.5.1',
    date: '6 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлены баги Spyfall, устранены редкие вылеты, улучшена стабильность матчей и синхронизация состояний.',
      en: 'Fixed Spyfall bugs, resolved rare crashes, and improved match stability and state synchronization.'
    }
  },

  {
    ver: '1.5.0',
    date: '5 FEB 2026',
    type: 'minor',
    title: { ru: 'Spy Mode', en: 'Spy Mode' },
    desc: {
      ru: 'Добавлен режим «Шпион», обновлён визуальный стиль интерфейса, улучшен первый опыт для новых игроков и исправлены ошибки.',
      en: 'Added Spy Mode, refreshed the UI visual style, improved new player onboarding, and fixed bugs.'
    }
  },

  /* ===================== 1.4.x ===================== */

  {
    ver: '1.4.5',
    date: '3 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкие багфиксы, улучшена отзывчивость UI и обработка кликов.',
      en: 'Minor bug fixes, improved UI responsiveness and click handling.'
    }
  },
  {
    ver: '1.4.4',
    date: '3 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Фиксы мультиплеера, стабильность лобби и таймеров.',
      en: 'Multiplayer fixes, improved lobby and timer stability.'
    }
  },
  {
    ver: '1.4.3',
    date: '3 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Улучшения UX в Сапере, оптимизация анимаций.',
      en: 'UX improvements for Minesweeper, animation optimizations.'
    }
  },
  {
    ver: '1.4.2',
    date: '3 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлены ошибки генерации поля и логики флагов.',
      en: 'Fixed board generation issues and flag logic.'
    }
  },
  {
    ver: '1.4.1',
    date: '3 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Оптимизация производительности и сетевого взаимодействия.',
      en: 'Performance and networking optimizations.'
    }
  },
  {
    ver: '1.4.0',
    date: '3 FEB 2026',
    type: 'minor',
    title: { ru: 'Minesweeper', en: 'Minesweeper' },
    desc: {
      ru: 'Добавлен Сапер: мультиплеер, флаги, масштабирование поля.',
      en: 'Added Minesweeper: multiplayer, flags and board zoom.'
    }
  },

  /* ===================== 1.3.x ===================== */

  {
    ver: '1.3.5',
    date: '2 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Фиксы локализации и корректности вопросов.',
      en: 'Localization fixes and question correctness.'
    }
  },
  {
    ver: '1.3.4',
    date: '2 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Улучшения UI викторины и плавности анимаций.',
      en: 'Quiz UI and animation smoothness improvements.'
    }
  },
  {
    ver: '1.3.3',
    date: '2 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Оптимизация Pixel Match и ускорение загрузки.',
      en: 'Pixel Match optimizations and faster loading.'
    }
  },
  {
    ver: '1.3.2',
    date: '1 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлены редкие ошибки подсчёта результатов.',
      en: 'Fixed rare score calculation issues.'
    }
  },
  {
    ver: '1.3.1',
    date: '1 FEB 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкие багфиксы и улучшения стабильности.',
      en: 'Minor bug fixes and stability improvements.'
    }
  },
  {
    ver: '1.3.0',
    date: '1 FEB 2026',
    type: 'minor',
    title: { ru: 'Flager', en: 'Flager' },
    desc: {
      ru: 'Добавлена викторина флагов с механикой Pixel Match.',
      en: 'Added flag quiz with Pixel Match mechanic.'
    }
  },

  /* ===================== 1.2.x ===================== */

  {
    ver: '1.2.5',
    date: '31 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Оптимизация Drag&Drop и сетевой синхронизации.',
      en: 'Drag&Drop and network sync optimizations.'
    }
  },
  {
    ver: '1.2.4',
    date: '31 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Фиксы визуальных багов и улучшение отклика.',
      en: 'Visual bug fixes and improved responsiveness.'
    }
  },
  {
    ver: '1.2.3',
    date: '31 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлены ошибки размещения кораблей.',
      en: 'Fixed ship placement issues.'
    }
  },
  {
    ver: '1.2.2',
    date: '30 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Стабилизация матчей и таймеров.',
      en: 'Match and timer stabilization.'
    }
  },
  {
    ver: '1.2.1',
    date: '30 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкие багфиксы и улучшения UI.',
      en: 'Minor bug fixes and UI improvements.'
    }
  },
  {
    ver: '1.2.0',
    date: '30 JAN 2026',
    type: 'minor',
    title: { ru: 'Battleship', en: 'Battleship' },
    desc: {
      ru: 'Добавлен Морской бой в реальном времени.',
      en: 'Added real-time Battleship.'
    }
  },

  /* ===================== 1.1.x ===================== */

  {
    ver: '1.1.5',
    date: '29 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Баланс ролей и исправление логики карт.',
      en: 'Role balance and card logic fixes.'
    }
  },
  {
    ver: '1.1.4',
    date: '29 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Фиксы сетевых рассинхронов.',
      en: 'Network desync fixes.'
    }
  },
  {
    ver: '1.1.3',
    date: '29 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Улучшения UI и стабильности матчей.',
      en: 'UI and match stability improvements.'
    }
  },
  {
    ver: '1.1.2',
    date: '28 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Исправлены ошибки завершения раундов.',
      en: 'Fixed round ending issues.'
    }
  },
  {
    ver: '1.1.1',
    date: '28 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Мелкие багфиксы и оптимизация.',
      en: 'Minor bug fixes and optimizations.'
    }
  },
  {
    ver: '1.1.0',
    date: '28 JAN 2026',
    type: 'minor',
    title: { ru: 'Coup', en: 'Coup' },
    desc: {
      ru: 'Добавлена карточная игра Coup.',
      en: 'Added the card game Coup.'
    }
  },

  /* ===================== 1.0.x ===================== */

  {
    ver: '1.0.2',
    date: '27 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Добавлены RU/EN локализации и настройки звука.',
      en: 'Added RU/EN localization and audio settings.'
    }
  },
  {
    ver: '1.0.1',
    date: '27 JAN 2026',
    type: 'patch',
    desc: {
      ru: 'Фиксы авторизации и лобби.',
      en: 'Authentication and lobby fixes.'
    }
  },
  {
    ver: '1.0.0',
    date: '27 JAN 2026',
    type: 'init',
    title: { ru: 'Launch', en: 'Launch' },
    desc: {
      ru: 'Первый релиз платформы: аккаунты, профили и лобби.',
      en: 'Initial platform release: accounts, profiles and lobbies.'
    }
  }
];
