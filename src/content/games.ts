/**
 * Public, crawlable game content — the single source of truth for the SEO layer.
 *
 * Deliberately server-safe: no React, no lucide-react, no client components.
 * `src/constants/rules.ts` cannot be reused here because it imports icon
 * components and a `'use client'` module, which would drag the whole client
 * graph into these static pages.
 *
 * Consumed by /games, /games/[slug], their /en counterparts, sitemap.ts and
 * the JSON-LD builders in src/lib/seo.ts.
 */

import { requireGame, type GameId } from '@/games/registry';

export type { Locale } from '@/games/registry';
import type { Locale } from '@/games/registry';
import { GAME_COUNT_COPY } from './gameCount';

/**
 * Facts the app and the public pages must agree on — player counts, accent,
 * genre, playtime — read from the registry instead of restated here. They had
 * already drifted: this file said "Сапёр" while the lobby list said "Сапер".
 */
const gameFacts = (id: GameId) => {
  const g = requireGame(id);
  return {
    slug: g.id,
    players: g.players,
    playtimeMinutes: g.playtimeMinutes,
    genre: g.genre,
    accent: g.accent
  };
};

/** The display name and one-liner, likewise owned by the registry. */
const localeFacts = (id: GameId, locale: Locale) => {
  const g = requireGame(id);
  return { name: g.name[locale], tagline: g.tagline[locale] };
};

export interface GameFaq {
  q: string;
  a: string;
}

export interface GameContentLocale {
  /** Display name */
  name: string;
  /** One-line hook, used on cards and as the page subtitle */
  tagline: string;
  /** <title> for the detail page (brand suffix appended by the template) */
  metaTitle: string;
  /** <meta name="description"> — aim for 140-160 characters */
  metaDescription: string;
  /** Opening prose paragraphs */
  intro: string[];
  /** Ordered "how to play" steps — also emitted as HowTo JSON-LD */
  howToPlay: string[];
  /** Bullet highlights */
  features: string[];
  /** Tactical advice — the substance players actually search for */
  strategy: string[];
  /** Common mistakes, phrased as things to stop doing */
  mistakes: string[];
  /** Emitted as FAQPage JSON-LD */
  faq: GameFaq[];
}

export interface GameContent {
  slug: string;
  players: { min: number; max: number };
  /** Typical match length in minutes, used for the "duration" facts row */
  playtimeMinutes: number;
  genre: Record<Locale, string>;
  /** Tailwind-friendly accent used by the public cards */
  accent: string;
  locales: Record<Locale, GameContentLocale>;
}

export const GAMES_CONTENT: GameContent[] = [
  {
    ...gameFacts('spyfall'),
    locales: {
      ru: {
        ...localeFacts('spyfall', 'ru'),
        metaTitle: 'Шпион — играть онлайн с друзьями бесплатно',
        metaDescription:
          'Онлайн-игра «Шпион» на 3–12 игроков: все знают локацию, кроме одного. Задавайте вопросы, ищите чужака и голосуйте. Бесплатно, без установки.',
        intro: [
          'Шпион — это разговорная игра на дедукцию и блеф. В начале раунда все участники получают одну и ту же локацию и личную роль внутри неё. Все, кроме одного: шпион не знает, где оказалась компания, и должен это выяснить, не привлекая к себе внимания.',
          'Игроки по очереди задают друг другу вопросы. Вопрос должен быть достаточно конкретным, чтобы поймать шпиона на незнании, но достаточно расплывчатым, чтобы не выдать локацию самому шпиону. Именно это противоречие и делает партию напряжённой.',
          'Побеждает либо команда, если она вычислит и осудит шпиона голосованием, либо шпион — если продержится до конца таймера или сумеет верно назвать локацию.'
        ],
        howToPlay: [
          'Создайте комнату и отправьте друзьям ссылку или шестизначный код.',
          'Выберите тематический набор: школа, универ, офис, хоррор, игры, природа, история, фантастика, спорт, еда и другие.',
          'После старта откройте свою карточку: вы увидите локацию и роль — либо надпись, что вы шпион.',
          'По очереди задавайте вопросы другим игрокам и внимательно слушайте ответы.',
          'Заподозрив кого-то, вынесите обвинение — остальные проголосуют за или против.',
          'Осудите шпиона до конца таймера, чтобы победить. Шпион побеждает, если угадает локацию или дотянет до нуля.'
        ],
        features: [
          'От 3 до 12 игроков в одной комнате',
          '15 тематических наборов, 330 локаций',
          'Настраиваемая длительность раунда',
          'Голосование с подсчётом голосов в реальном времени',
          'Статистика побед за мирных и за шпиона'
        ],
        strategy: [
          'Задавайте вопросы, на которые нельзя ответить односложно. «Тебе тут нравится?» не выдаёт ничего — а «что ты слышишь вокруг себя?» заставляет назвать деталь.',
          'Не начинайте с самых очевидных признаков локации. Если первый же вопрос звучит как «ты в халате?», шпион получает больницу почти даром.',
          'Следите, кому адресуют вопросы. Шпион редко спрашивает первым и охотно перекидывает внимание на других.',
          'Играя за шпиона, отвечайте общими словами и переспрашивайте. Фраза «а ты сам как думаешь?» выигрывает время и звучит естественно.',
          'Обвинение — ресурс, а не эмоция. Ошиблись всей компанией — шпион спокойно досиживает до конца таймера.',
        ],
        mistakes: [
          'Спешат с голосованием на первой же заминке. Человек может просто задуматься, а группа уже потратила попытку.',
          'Называют локацию вслух, чтобы «проверить» соседа. Это подарок шпиону — он только этого и ждал.',
          'Мирные отвечают слишком подробно и фактически описывают локацию вслух.',
        ],
        faq: [
          {
            q: 'Сколько человек нужно для игры в Шпиона?',
            a: 'Минимум трое. Комфортнее всего играть компанией от пяти до восьми человек, максимум — двенадцать.'
          },
          {
            q: 'Нужно ли что-то устанавливать?',
            a: 'Нет. Игра работает прямо в браузере на компьютере и телефоне, установка не требуется.'
          },
          {
            q: 'Можно ли играть бесплатно?',
            a: 'Да, все игры на платформе бесплатны. Для быстрой партии достаточно гостевого входа.'
          },
          {
            q: 'Что делать шпиону, если он угадал локацию?',
            a: 'Шпион может назвать локацию и досрочно закончить раунд в свою пользу. Ошибка означает поражение, поэтому спешить не стоит.'
          }
        ]
      },
      en: {
        ...localeFacts('spyfall', 'en'),
        metaTitle: 'Spyfall — play online with friends for free',
        metaDescription:
          'Play Spyfall online with 3–12 players: everyone knows the location except one. Ask questions, expose the outsider, vote. Free, no download.',
        intro: [
          'Spyfall is a conversation game built on deduction and bluffing. At the start of a round every player receives the same location and a personal role within it. Everyone except one: the spy has no idea where the group is and has to work it out without drawing attention.',
          'Players take turns questioning each other. A good question is specific enough to catch someone who does not know the location, yet vague enough not to hand that location to the spy. That tension is what makes each round tense.',
          'The group wins by identifying and convicting the spy through a vote. The spy wins by surviving until the timer runs out, or by correctly naming the location.'
        ],
        howToPlay: [
          'Create a room and share the link or the six-character code with your friends.',
          'Pick a themed pack: school, university, office, horror, gaming, nature, history, sci-fi, sports, food and more.',
          'Once the round starts, open your card to see the location and your role — or the note that you are the spy.',
          'Take turns asking other players questions and listen closely to the answers.',
          'When you suspect someone, call them out and let the table vote.',
          'Convict the spy before time runs out to win. The spy wins by guessing the location or surviving the timer.'
        ],
        features: [
          'Three to twelve players per room',
          '15 themed packs, 330 locations',
          'Adjustable round length',
          'Live vote tallying',
          'Separate win statistics for civilians and the spy'
        ],
        strategy: [
          'Ask questions that cannot be answered in one word. "Do you like it here?" reveals nothing; "what can you hear around you?" forces a concrete detail.',
          'Do not open with the most obvious feature of the location. If your first question is "are you wearing a gown?", you have handed the spy a hospital.',
          'Watch who people question. A spy rarely asks first and is happy to redirect attention elsewhere.',
          'As the spy, answer in generalities and ask back. "What do you reckon?" buys time and sounds natural.',
          'An accusation is a resource, not a reaction. Convict the wrong person and the spy simply runs out the clock.',
        ],
        mistakes: [
          'Voting at the first hesitation. Someone may just be thinking, and the group has already spent its attempt.',
          'Naming the location out loud to test someone. That is exactly what the spy was waiting for.',
          'Civilians answering so precisely that they describe the location for everyone, spy included.',
        ],
        faq: [
          {
            q: 'How many players do you need for Spyfall?',
            a: 'Three at minimum. The game is at its best with five to eight players, and supports up to twelve.'
          },
          {
            q: 'Do I need to install anything?',
            a: 'No. The game runs directly in the browser on desktop and mobile, with nothing to install.'
          },
          {
            q: 'Is it free to play?',
            a: 'Yes, every game on the platform is free. Guest sign-in is enough for a quick match.'
          },
          {
            q: 'What happens if the spy guesses the location?',
            a: 'The spy can name the location to end the round early and win it. Guessing wrong loses the round, so timing matters.'
          }
        ]
      },
      uk: {
        ...localeFacts('spyfall', 'uk'),
        metaTitle: 'Шпигун — грати онлайн із друзями безкоштовно',
        metaDescription:
          'Онлайн-гра «Шпигун» на 3–12 гравців: усі знають локацію, крім одного. Ставте запитання, шукайте чужинця й голосуйте. Безкоштовно, без встановлення.',
        intro: [
          'Шпигун — це розмовна гра на дедукцію й блеф. На початку раунду всі учасники отримують ту саму локацію й особисту роль у ній. Усі, крім одного: шпигун не знає, де опинилася компанія, і має це з’ясувати, не привертаючи до себе уваги.',
          'Гравці по черзі ставлять одне одному запитання. Запитання має бути досить конкретним, щоб спіймати шпигуна на незнанні, але досить розмитим, щоб не видати локацію самому шпигунові. Саме ця суперечність і робить партію напруженою.',
          'Перемагає або команда, якщо вона обчислить і засудить шпигуна голосуванням, або шпигун — якщо протримається до кінця таймера чи зуміє правильно назвати локацію.'
        ],
        howToPlay: [
          'Створіть кімнату й надішліть друзям посилання або шестизначний код.',
          'Оберіть тематичний набір: школа, універ, офіс, горор, ігри, природа, історія, фантастика, спорт, їжа та інші.',
          'Після старту відкрийте свою картку: ви побачите локацію й роль — або напис, що ви шпигун.',
          'По черзі ставте запитання іншим гравцям і уважно слухайте відповіді.',
          'Запідозривши когось, висуньте звинувачення — решта проголосує за чи проти.',
          'Засудіть шпигуна до кінця таймера, щоб перемогти. Шпигун перемагає, якщо вгадає локацію або дотягне до нуля.'
        ],
        features: [
          'Від 3 до 12 гравців в одній кімнаті',
          '15 тематичних наборів, 330 локацій',
          'Налаштовувана тривалість раунду',
          'Голосування з підрахунком голосів у реальному часі',
          'Статистика перемог за мирних і за шпигуна'
        ],
        strategy: [
          'Ставте запитання, на які не можна відповісти односкладово. «Тобі тут подобається?» не видає нічого — а «що ти чуєш навколо себе?» змушує назвати деталь.',
          'Не починайте з найочевидніших ознак локації. Якщо перше ж запитання звучить як «ти в халаті?», шпигун отримує лікарню майже задарма.',
          'Стежте, кому адресують запитання. Шпигун рідко питає першим і охоче перекидає увагу на інших.',
          'Граючи за шпигуна, відповідайте загальними словами й перепитуйте. Фраза «а ти сам як думаєш?» виграє час і звучить природно.',
          'Звинувачення — ресурс, а не емоція. Помилилися всією компанією — шпигун спокійно досиджує до кінця таймера.',
        ],
        mistakes: [
          'Поспішають із голосуванням на першій же заминці. Людина може просто замислитися, а група вже витратила спробу.',
          'Називають локацію вголос, щоб «перевірити» сусіда. Це подарунок шпигунові — він тільки цього й чекав.',
          'Мирні відповідають надто детально й фактично описують локацію вголос.',
        ],
        faq: [
          {
            q: 'Скільки людей потрібно для гри в Шпигуна?',
            a: 'Мінімум троє. Найкомфортніше грати компанією від п’яти до восьми людей, максимум — дванадцять.'
          },
          {
            q: 'Чи треба щось встановлювати?',
            a: 'Ні. Гра працює просто в браузері на комп’ютері й телефоні, встановлення не потрібне.'
          },
          {
            q: 'Чи можна грати безкоштовно?',
            a: 'Так, усі ігри на платформі безкоштовні. Для швидкої партії досить гостьового входу.'
          },
          {
            q: 'Що робити шпигунові, якщо він вгадав локацію?',
            a: 'Шпигун може назвати локацію й достроково завершити раунд на свою користь. Помилка означає поразку, тож поспішати не варто.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('minesweeper'),
    locales: {
      ru: {
        ...localeFacts('minesweeper', 'ru'),
        metaTitle: 'Сапёр онлайн — соло и на скорость',
        metaDescription:
          'Классический Сапёр в браузере: одиночная игра и гонка до четырёх игроков на одинаковых полях. Аккорд, флаги, зум, настраиваемая сложность.',
        intro: [
          'Сапёр — логическая головоломка, в которой нужно вскрыть все безопасные клетки поля, не подорвавшись на мине. Цифра в открытой клетке показывает, сколько мин находится в восьми соседних клетках, и вся игра строится на выводах из этих подсказок.',
          'Здесь к классике добавлен мультиплеер: до четырёх игроков получают одинаковые поля и разминируют их одновременно. Побеждает тот, кто первым закончит — или последний выживший, если остальные подорвались.',
          'Первый клик всегда безопасен: поле генерируется после него, поэтому проиграть на первом же ходу невозможно.'
        ],
        howToPlay: [
          'Выберите размер поля и количество мин или возьмите готовый уровень сложности.',
          'Левый клик открывает клетку, правый клик или пробел под курсором — ставит флаг на подозрительной мине.',
          'Читайте цифры: число показывает, сколько мин граничит с этой клеткой.',
          'Левый клик по открытой цифре делает аккорд — открывает соседние клетки, если рядом уже стоит нужное число флагов.',
          'Масштабируйте поле колесом мыши или с клавиатуры, если играете на большой сетке.',
          'Откройте все безопасные клетки, чтобы выиграть партию.'
        ],
        features: [
          'Одиночная игра и мультиплеер до четырёх человек',
          'Одинаковые поля для всех участников гонки',
          'Аккорд по левому клику и удобный зум',
          'Первый клик гарантированно безопасен',
          'Поля до 100×100 без потери отзывчивости',
          'Отдельная статистика для соло и мультиплеера'
        ],
        strategy: [
          'Начинайте с углов и краёв: там у клеток меньше соседей, и цифры дают более однозначные выводы.',
          'Работайте не с отдельной клеткой, а с парой соседних цифр. Разница между ними часто указывает мину точнее, чем каждая по отдельности.',
          'Ставьте флаги сразу, как уверены. Аккорд по цифре экономит десятки кликов, но работает только по выставленным флагам.',
          'Если позиция не решается логикой, ищите другой участок поля вместо угадывания — почти всегда где-то есть однозначный ход.',
          'В гонке важна не идеальность, а темп: открытая пустая область даёт больше информации, чем аккуратно обставленный флагами угол.',
        ],
        mistakes: [
          'Ставят флаги на всё подозрительное. Лишний флаг ломает аккорд и приводит к взрыву на ровном месте.',
          'Угадывают в середине поля, когда с краю оставался очевидный ход.',
          'Забывают, что первый клик безопасен, и тратят время на «удачное» начало.',
        ],
        faq: [
          {
            q: 'Можно ли играть в Сапёра одному?',
            a: 'Да. Одиночный режим доступен без соперников, результат записывается в личную статистику.'
          },
          {
            q: 'Что такое аккорд?',
            a: 'Если рядом с открытой цифрой уже стоит столько флагов, сколько она показывает, клик по ней открывает все оставшиеся соседние клетки разом.'
          },
          {
            q: 'Можно ли проиграть на первом ходу?',
            a: 'Нет. Мины расставляются после первого клика, поэтому он всегда безопасен.'
          },
          {
            q: 'Играют ли все на одном поле?',
            a: 'В мультиплеере у каждого своё поле, но сгенерированы они одинаково — это честная гонка на скорость.'
          }
        ]
      },
      en: {
        ...localeFacts('minesweeper', 'en'),
        metaTitle: 'Minesweeper online — solo or race',
        metaDescription:
          'Classic Minesweeper in your browser: solo play plus a race for up to four players on identical grids. Chord, flags, zoom and custom difficulty.',
        intro: [
          'Minesweeper is a logic puzzle about uncovering every safe cell without detonating a mine. A revealed number tells you how many mines sit in the eight neighbouring cells, and the entire game is built on reasoning from those clues.',
          'This version adds multiplayer: up to four players get identically generated grids and clear them at the same time. The first to finish wins — or the last one standing, if everyone else detonates.',
          'The first click is always safe. The board is generated after it, so losing on move one is impossible.'
        ],
        howToPlay: [
          'Pick a grid size and mine count, or start from a difficulty preset.',
          'Left click reveals a cell; a right click, or Space over it, plants a flag on a suspected mine.',
          'Read the numbers: each one counts the mines touching that cell.',
          'Left click a revealed number to chord — it opens the remaining neighbours once the flag count matches.',
          'Zoom with the scroll wheel or the keyboard when playing on a large grid.',
          'Reveal every safe cell to win the round.'
        ],
        features: [
          'Solo play and multiplayer for up to four',
          'Identical grids for every racer',
          'Left-click chord and smooth zoom',
          'Guaranteed safe first click',
          'Grids up to 100×100 with no loss of responsiveness',
          'Separate solo and multiplayer statistics'
        ],
        strategy: [
          'Start from corners and edges: those cells have fewer neighbours, so the numbers resolve more definitively.',
          'Read pairs of adjacent numbers rather than single cells. The difference between them often pins a mine that neither one does alone.',
          'Flag as soon as you are certain. Chording saves dozens of clicks, but only works off flags you have actually placed.',
          'When a position will not resolve logically, move to another part of the grid instead of guessing — there is almost always a certain move somewhere.',
          'In a race, tempo beats perfection: opening an empty region yields more information than meticulously flagging one corner.',
        ],
        mistakes: [
          'Flagging everything that looks suspicious. A stray flag breaks chording and detonates a cell you had already solved.',
          'Guessing in the middle while an obvious move was still sitting on the edge.',
          'Forgetting the first click is always safe and hunting for a lucky opening.',
        ],
        faq: [
          {
            q: 'Can I play Minesweeper alone?',
            a: 'Yes. Solo mode needs no opponents and still records your result in your personal statistics.'
          },
          {
            q: 'What is chording?',
            a: 'When a revealed number already has that many flags around it, clicking it opens all remaining neighbouring cells at once.'
          },
          {
            q: 'Can I lose on the first click?',
            a: 'No. Mines are placed after your first click, so it is always safe.'
          },
          {
            q: 'Does everyone play on the same board?',
            a: 'In multiplayer each player has their own grid, generated identically — a fair race on equal terms.'
          }
        ]
      },
      uk: {
        ...localeFacts('minesweeper', 'uk'),
        metaTitle: 'Сапер онлайн — соло й на швидкість',
        metaDescription:
          'Класичний Сапер у браузері: одиночна гра й перегони до чотирьох гравців на однакових полях. Акорд, прапорці, зум, налаштовувана складність.',
        intro: [
          'Сапер — логічна головоломка, у якій треба розкрити всі безпечні клітинки поля, не підірвавшись на міні. Цифра у відкритій клітинці показує, скільки мін у восьми сусідніх клітинках, і вся гра будується на висновках із цих підказок.',
          'Тут до класики додано мультиплеєр: до чотирьох гравців отримують однакові поля й розміновують їх одночасно. Перемагає той, хто першим закінчить, — або останній, хто вижив, якщо решта підірвалася.',
          'Перший клік завжди безпечний: поле генерується після нього, тому програти на першому ж ході неможливо.'
        ],
        howToPlay: [
          'Оберіть розмір поля й кількість мін або візьміть готовий рівень складності.',
          'Лівий клік відкриває клітинку, правий клік або пробіл під курсором — ставить прапорець на підозрілій міні.',
          'Читайте цифри: число показує, скільки мін межує з цією клітинкою.',
          'Лівий клік по відкритій цифрі робить акорд — відкриває сусідні клітинки, якщо поруч уже стоїть потрібна кількість прапорців.',
          'Масштабуйте поле коліщатком миші або з клавіатури, якщо граєте на великій сітці.',
          'Відкрийте всі безпечні клітинки, щоб виграти партію.'
        ],
        features: [
          'Одиночна гра й мультиплеєр до чотирьох людей',
          'Однакові поля для всіх учасників перегонів',
          'Акорд лівим кліком і зручний зум',
          'Перший клік гарантовано безпечний',
          'Поля до 100×100 без втрати чуйності',
          'Окрема статистика для соло й мультиплеєра'
        ],
        strategy: [
          'Починайте з кутів і країв: там у клітинок менше сусідів, і цифри дають однозначніші висновки.',
          'Працюйте не з окремою клітинкою, а з парою сусідніх цифр. Різниця між ними часто вказує міну точніше, ніж кожна окремо.',
          'Ставте прапорці одразу, щойно впевнені. Акорд по цифрі заощаджує десятки кліків, але працює лише з виставленими прапорцями.',
          'Якщо позиція не розв’язується логікою, шукайте іншу ділянку поля замість вгадування — майже завжди десь є однозначний хід.',
          'У перегонах важлива не ідеальність, а темп: відкрита порожня область дає більше інформації, ніж акуратно обставлений прапорцями кут.',
        ],
        mistakes: [
          'Ставлять прапорці на все підозріле. Зайвий прапорець ламає акорд і призводить до вибуху на рівному місці.',
          'Вгадують посеред поля, коли з краю залишався очевидний хід.',
          'Забувають, що перший клік безпечний, і витрачають час на «вдалий» початок.',
        ],
        faq: [
          {
            q: 'Чи можна грати в Сапера самому?',
            a: 'Так. Одиночний режим доступний без суперників, результат записується в особисту статистику.'
          },
          {
            q: 'Що таке акорд?',
            a: 'Якщо біля відкритої цифри вже стоїть стільки прапорців, скільки вона показує, клік по ній відкриває всі решту сусідніх клітинок разом.'
          },
          {
            q: 'Чи можна програти на першому ході?',
            a: 'Ні. Міни розставляються після першого кліку, тому він завжди безпечний.'
          },
          {
            q: 'Чи всі грають на одному полі?',
            a: 'У мультиплеєрі в кожного своє поле, але згенеровані вони однаково — це чесні перегони на швидкість.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('flager'),
    locales: {
      ru: {
        ...localeFacts('flager', 'ru'),
        metaTitle: 'Флагер — викторина «угадай флаг»',
        metaDescription:
          'Географическая викторина на флаги с механикой Pixel Match: флаг проявляется постепенно, чем раньше ответишь — тем больше очков. Соло и до 20 игроков.',
        intro: [
          'Флагер — викторина на знание флагов стран мира. Флаг не показывают целиком: он проявляется пиксель за пикселем, и чем раньше вы его узнаете, тем больше очков получите за раунд.',
          'Механика Pixel Match превращает обычный тест в гонку интуиции. Опытный игрок ловит страну по паре характерных цветовых пятен, новичок дожидается узнаваемого силуэта — и оба остаются в игре.',
          'Играть можно в одиночку, тренируя географию, или компанией до двадцати человек: все получают одну и ту же цепочку флагов, а очки суммируются по раундам.'
        ],
        howToPlay: [
          'Выберите количество раундов и длительность каждого из них.',
          'Смотрите, как флаг постепенно проявляется из пикселей.',
          'Начните вводить название страны — подсказки появятся сразу под полем.',
          'Выбирайте подсказку стрелками и Tab или введите ответ целиком.',
          'Отвечайте как можно раньше: скорость напрямую влияет на количество очков.',
          'После раунда видно правильный ответ и счёт всех игроков, а после всех раундов — итоговая таблица.'
        ],
        features: [
          'Более двухсот стран и территорий',
          'Механика постепенного проявления Pixel Match',
          'Автодополнение с управлением с клавиатуры',
          'Соло-тренировка и мультиплеер до двадцати игроков',
          'Настраиваемое число раундов и таймер',
          'История ответов и точность в статистике'
        ],
        strategy: [
          'Смотрите на цвета раньше, чем на рисунок. Сочетание полос сужает круг до нескольких стран задолго до того, как флаг проявится.',
          'Учите флаги группами: скандинавские кресты, панарабские и панафриканские цвета, британские кантоны. Внутри группы отличие обычно в одной детали.',
          'Начинайте вводить ответ, как только появилась догадка — подсказки отфильтруют похожие названия быстрее, чем вы вспомните точное написание.',
          'Не тяните до полного проявления: очки убывают со временем, и уверенный ответ на середине выгоднее идеального в конце.',
          'Ошибка стоит попытки, но не очков. Если вариантов два — лучше проверить оба, чем ждать.',
        ],
        mistakes: [
          'Ждут «стопроцентной» картинки и теряют больше очков, чем стоила бы ошибка.',
          'Путают похожие пары — Чад и Румыния, Индонезия и Монако, Нидерланды и Люксембург. Их стоит выучить отдельно.',
          'Печатают название целиком вместо того, чтобы выбрать из подсказок.',
        ],
        faq: [
          {
            q: 'Как начисляются очки?',
            a: 'Чем меньше пикселей открылось к моменту верного ответа, тем больше очков за раунд. За ошибку очки не снимаются, но время идёт.'
          },
          {
            q: 'Сколько стран в игре?',
            a: 'В базе более двухсот стран и территорий, включая редко встречающиеся флаги.'
          },
          {
            q: 'Можно ли тренироваться в одиночку?',
            a: 'Да, соло-режим доступен всегда и ведёт отдельную статистику точности.'
          },
          {
            q: 'Нужно ли писать название без ошибок?',
            a: 'Достаточно начать вводить название и выбрать нужный вариант из подсказок — опечатки не помешают.'
          }
        ]
      },
      en: {
        ...localeFacts('flager', 'en'),
        metaTitle: 'Flager — guess the country flag quiz online',
        metaDescription:
          'A flag quiz with a Pixel Match twist: the flag resolves gradually and answering earlier scores higher. Play solo or with up to twenty players.',
        intro: [
          'Flager is a quiz about the flags of the world. The flag is never shown outright — it resolves pixel by pixel, and the sooner you recognise it, the more points the round is worth.',
          'The Pixel Match mechanic turns a plain test into a race of intuition. Experienced players catch a country from a couple of characteristic colour patches, newcomers wait for a recognisable shape, and both stay in the game.',
          'Play solo to drill your geography, or with up to twenty people: everyone gets the same chain of flags and points accumulate across rounds.'
        ],
        howToPlay: [
          'Choose how many rounds to play and how long each one lasts.',
          'Watch the flag emerge gradually from the pixels.',
          'Start typing a country name — suggestions appear right below the field.',
          'Pick a suggestion with the arrow keys and Tab, or type the full answer.',
          'Answer as early as you can: speed feeds directly into your score.',
          'After each round the answer is shown with everyone\'s score, and after the last one, the final table.'
        ],
        features: [
          'Over two hundred countries and territories',
          'Gradual Pixel Match reveal',
          'Autocomplete with full keyboard control',
          'Solo practice and multiplayer for up to twenty',
          'Configurable round count and timer',
          'Answer history and accuracy tracking'
        ],
        strategy: [
          'Read the colours before the shapes. A stripe combination narrows the field to a handful of countries long before the flag resolves.',
          'Learn flags in families: Nordic crosses, pan-Arab and pan-African palettes, British cantons. Within a family the difference is usually one detail.',
          'Start typing the moment you have a guess — the suggestions filter lookalike names faster than you can recall the exact spelling.',
          'Do not wait for a full reveal: points decay with time, and a confident answer halfway through beats a perfect one at the end.',
          'A wrong guess costs an attempt, not points. With two candidates, test both rather than stalling.',
        ],
        mistakes: [
          'Waiting for a certain image and losing more points than a wrong guess would have cost.',
          'Confusing the classic lookalikes — Chad and Romania, Indonesia and Monaco, the Netherlands and Luxembourg. Learn those pairs deliberately.',
          'Typing the full name instead of picking from the suggestions.',
        ],
        faq: [
          {
            q: 'How is scoring calculated?',
            a: 'The fewer pixels revealed when you answer correctly, the more the round is worth. A wrong guess costs no points, but the clock keeps running.'
          },
          {
            q: 'How many countries are included?',
            a: 'More than two hundred countries and territories, including plenty of rarely seen flags.'
          },
          {
            q: 'Can I practise on my own?',
            a: 'Yes, solo mode is always available and keeps its own accuracy statistics.'
          },
          {
            q: 'Do I have to spell the name perfectly?',
            a: 'No. Start typing and pick the right option from the suggestions — typos will not block you.'
          }
        ]
      },
      uk: {
        ...localeFacts('flager', 'uk'),
        metaTitle: 'Флагер — вікторина «вгадай прапор»',
        metaDescription:
          'Географічна вікторина на прапори з механікою Pixel Match: прапор проявляється поступово, що раніше відповіси — то більше очок. Соло й до 20 гравців.',
        intro: [
          'Флагер — вікторина на знання прапорів країн світу. Прапор не показують повністю: він проявляється піксель за пікселем, і що раніше ви його впізнаєте, то більше очок отримаєте за раунд.',
          'Механіка Pixel Match перетворює звичайний тест на перегони інтуїції. Досвідчений гравець ловить країну за парою характерних кольорових плям, новачок чекає на впізнаваний силует — і обидва залишаються в грі.',
          'Грати можна самому, тренуючи географію, або компанією до двадцяти людей: усі отримують той самий ланцюжок прапорів, а очки підсумовуються за раундами.'
        ],
        howToPlay: [
          'Оберіть кількість раундів і тривалість кожного з них.',
          'Дивіться, як прапор поступово проявляється з пікселів.',
          'Почніть вводити назву країни — підказки з’являться одразу під полем.',
          'Обирайте підказку стрілками й Tab або введіть відповідь повністю.',
          'Відповідайте якомога раніше: швидкість безпосередньо впливає на кількість очок.',
          'Після раунду видно правильну відповідь і рахунок усіх гравців, а після всіх раундів — підсумкову таблицю.'
        ],
        features: [
          'Понад двісті країн і територій',
          'Механіка поступового проявлення Pixel Match',
          'Автодоповнення з керуванням із клавіатури',
          'Соло-тренування й мультиплеєр до двадцяти гравців',
          'Налаштовувана кількість раундів і таймер',
          'Історія відповідей і точність у статистиці'
        ],
        strategy: [
          'Дивіться на кольори раніше, ніж на малюнок. Поєднання смуг звужує коло до кількох країн задовго до того, як прапор проявиться.',
          'Вчіть прапори групами: скандинавські хрести, панарабські й панафриканські кольори, британські кантони. Усередині групи відмінність зазвичай в одній деталі.',
          'Починайте вводити відповідь, щойно з’явилася здогадка, — підказки відфільтрують схожі назви швидше, ніж ви згадаєте точне написання.',
          'Не чекайте повного проявлення: очки зменшуються з часом, і впевнена відповідь посередині вигідніша за ідеальну наприкінці.',
          'Помилка коштує спроби, але не очок. Якщо варіантів два — краще перевірити обидва, ніж чекати.',
        ],
        mistakes: [
          'Чекають на «стовідсоткову» картинку й втрачають більше очок, ніж коштувала б помилка.',
          'Плутають схожі пари — Чад і Румунію, Індонезію й Монако, Нідерланди й Люксембург. Їх варто вивчити окремо.',
          'Друкують назву повністю замість того, щоб обрати з підказок.',
        ],
        faq: [
          {
            q: 'Як нараховуються очки?',
            a: 'Що менше пікселів відкрилося на момент правильної відповіді, то більше очок за раунд. За помилку очки не знімаються, але час іде.'
          },
          {
            q: 'Скільки країн у грі?',
            a: 'У базі понад двісті країн і територій, зокрема рідкісні прапори.'
          },
          {
            q: 'Чи можна тренуватися самому?',
            a: 'Так, соло-режим доступний завжди й веде окрему статистику точності.'
          },
          {
            q: 'Чи треба писати назву без помилок?',
            a: 'Досить почати вводити назву й обрати потрібний варіант із підказок — одруківки не завадять.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('battleship'),
    locales: {
      ru: {
        ...localeFacts('battleship', 'ru'),
        metaTitle: 'Морской бой онлайн — игра на двоих',
        metaDescription:
          'Морской бой на двоих в браузере: расстановка флота перетаскиванием, автоматическая расстановка, дополнительный ход за попадание и таймер на выстрел.',
        intro: [
          'Морской бой — дуэльная игра на дедукцию и удачу, знакомая почти каждому по школьным тетрадям. Два игрока расставляют флот на своих полях и по очереди обстреливают поле соперника, пытаясь первым потопить все десять кораблей.',
          'Флот состоит из линкора на четыре палубы, двух крейсеров, трёх эсминцев и четырёх подлодок. Корабли не могут соприкасаться даже углами, поэтому грамотная расстановка — это уже половина партии.',
          'Попадание даёт право на дополнительный выстрел, так что удачная серия способна решить исход поединка за один ход. На каждый выстрел отводится минута.'
        ],
        howToPlay: [
          'Создайте комнату и отправьте сопернику ссылку — второй игрок присоединится по ней.',
          'Расставьте флот: перетащите корабли с верфи или нажмите «Авто» для случайной расстановки.',
          'Поворачивайте корабль клавишей R, пробелом или правым кликом по полю.',
          'Соблюдайте зазор: между кораблями нужна минимум одна пустая клетка.',
          'Подтвердите готовность и стреляйте по полю соперника, выбирая клетку.',
          'За попадание получаете дополнительный ход, за промах ход переходит сопернику.',
          'Потопите все десять кораблей противника, чтобы выиграть.'
        ],
        features: [
          'Дуэль один на один по прямой ссылке',
          'Расстановка перетаскиванием и кнопка автоматической расстановки',
          'Проверка правил расстановки в реальном времени',
          'Дополнительный ход за попадание',
          'Автоматическая пометка клеток вокруг потопленного корабля',
          'Таймер на ход и журнал боя'
        ],
        strategy: [
          'Не жмите корабли к краям. Край кажется безопасным, но опытный соперник обстреливает периметр в первую очередь.',
          'Разносите крупные корабли. Линкор и крейсер рядом превращают одно попадание в цепочку находок.',
          'Ищите по диагонали с шагом в две клетки — такая сетка гарантированно задевает любой корабль от двух палуб.',
          'Попали — добивайте вдоль оси. Сначала проверьте две клетки по горизонтали, и только потом по вертикали.',
          'Помните про ореол: после потопления соседние клетки автоматически пусты, и обстреливать их бессмысленно.',
        ],
        mistakes: [
          'Ставят весь флот в одной половине поля — после первых попаданий остальное вычисляется почти без промахов.',
          'Стреляют подряд по строкам. Половина выстрелов уходит в клетки, где корабль поместиться не мог.',
          'Забывают про дополнительный ход за попадание и останавливаются, не добив корабль.',
        ],
        faq: [
          {
            q: 'Сколько кораблей в флоте?',
            a: 'Десять: один линкор на четыре клетки, два крейсера по три, три эсминца по две и четыре однопалубные подлодки.'
          },
          {
            q: 'Могут ли корабли стоять вплотную?',
            a: 'Нет. Между кораблями должна быть хотя бы одна свободная клетка, касание углами тоже запрещено.'
          },
          {
            q: 'Что происходит при попадании?',
            a: 'Попадание даёт дополнительный выстрел. Ход переходит сопернику только после промаха.'
          },
          {
            q: 'Как пригласить друга?',
            a: 'Скопируйте ссылку на комнату или продиктуйте шестизначный код — присоединиться можно и тем, и другим способом.'
          }
        ]
      },
      en: {
        ...localeFacts('battleship', 'en'),
        metaTitle: 'Battleship online — two players',
        metaDescription:
          'Two-player Battleship in your browser: drag-and-drop fleet placement, auto-arrange, an extra turn for every hit, and a timer on each shot.',
        intro: [
          'Battleship is a duel of deduction and luck that most people first met in the back of a school notebook. Two players lay out a fleet on their own grid and take turns shelling the opponent, racing to sink all ten ships first.',
          'The fleet is one four-cell battleship, two cruisers, three destroyers and four submarines. Ships may not touch, not even at the corners, so a smart layout is already half the match.',
          'A hit earns another shot, which means a good streak can decide the duel in a single turn. Each shot is on a one-minute clock.'
        ],
        howToPlay: [
          'Create a room and send your opponent the link — they join straight through it.',
          'Lay out your fleet: drag ships from the dock or hit Auto for a random arrangement.',
          'Rotate a ship with R, Space, or a right click on the board.',
          'Mind the spacing: every ship needs at least one empty cell around it.',
          'Confirm you are ready, then pick a cell to fire on the opponent grid.',
          'A hit grants an extra turn; a miss passes the turn to your opponent.',
          'Sink all ten enemy ships to win.'
        ],
        features: [
          'One-on-one duel over a direct link',
          'Drag-and-drop placement plus an auto-arrange button',
          'Live validation of placement rules',
          'Extra turn on every hit',
          'Cells around a sunken ship marked automatically',
          'Per-turn timer and a full battle log'
        ],
        strategy: [
          'Keep ships off the edges. The rim feels safe, but an experienced opponent sweeps the perimeter first.',
          'Spread the big ships out. A battleship next to a cruiser turns one hit into a chain of discoveries.',
          'Search on a diagonal with a two-cell step — that lattice is guaranteed to touch any ship of two decks or more.',
          'On a hit, finish along the axis. Probe the two horizontal neighbours first, then the vertical ones.',
          'Remember the halo: once a ship sinks, the surrounding cells are known to be empty and are not worth a shot.',
        ],
        mistakes: [
          'Placing the whole fleet in one half of the board — after the first hits the rest follows almost without misses.',
          'Firing row by row. Half those shots land where a ship could never have fitted.',
          'Forgetting a hit grants another shot, and stopping before the ship is finished.',
        ],
        faq: [
          {
            q: 'How many ships are in the fleet?',
            a: 'Ten: one four-cell battleship, two three-cell cruisers, three two-cell destroyers and four single-cell submarines.'
          },
          {
            q: 'Can ships be placed next to each other?',
            a: 'No. Every ship needs at least one free cell around it, and touching at the corners is not allowed either.'
          },
          {
            q: 'What happens when I hit a ship?',
            a: 'A hit gives you another shot. The turn only passes to your opponent when you miss.'
          },
          {
            q: 'How do I invite a friend?',
            a: 'Copy the room link or read out the six-character code — either one lets them join.'
          }
        ]
      },
      uk: {
        ...localeFacts('battleship', 'uk'),
        metaTitle: 'Морський бій онлайн — гра на двох',
        metaDescription:
          'Морський бій на двох у браузері: розставлення флоту перетягуванням, автоматичне розставлення, додатковий хід за влучання й таймер на постріл.',
        intro: [
          'Морський бій — дуельна гра на дедукцію й удачу, знайома майже кожному зі шкільних зошитів. Двоє гравців розставляють флот на своїх полях і по черзі обстрілюють поле суперника, намагаючись першими потопити всі десять кораблів.',
          'Флот складається з лінкора на чотири палуби, двох крейсерів, трьох есмінців і чотирьох підводних човнів. Кораблі не можуть торкатися навіть кутами, тому грамотне розставлення — це вже половина партії.',
          'Влучання дає право на додатковий постріл, тож вдала серія здатна вирішити двобій за один хід. На кожен постріл відведено хвилину.'
        ],
        howToPlay: [
          'Створіть кімнату й надішліть суперникові посилання — другий гравець приєднається за ним.',
          'Розставте флот: перетягніть кораблі з верфі або натисніть «Авто» для випадкового розставлення.',
          'Повертайте корабель клавішею R, пробілом або правим кліком по полю.',
          'Дотримуйтеся проміжку: між кораблями потрібна щонайменше одна порожня клітинка.',
          'Підтвердьте готовність і стріляйте по полю суперника, обираючи клітинку.',
          'За влучання отримуєте додатковий хід, за промах хід переходить до суперника.',
          'Потопіть усі десять кораблів суперника, щоб виграти.'
        ],
        features: [
          'Дуель один на один за прямим посиланням',
          'Розставлення перетягуванням і кнопка автоматичного розставлення',
          'Перевірка правил розставлення в реальному часі',
          'Додатковий хід за влучання',
          'Автоматична позначка клітинок навколо потопленого корабля',
          'Таймер на хід і журнал бою'
        ],
        strategy: [
          'Не тисніть кораблі до країв. Край здається безпечним, але досвідчений суперник обстрілює периметр насамперед.',
          'Розносьте великі кораблі. Лінкор і крейсер поруч перетворюють одне влучання на ланцюжок знахідок.',
          'Шукайте по діагоналі з кроком у дві клітинки — така сітка гарантовано зачіпає будь-який корабель від двох палуб.',
          'Влучили — добивайте вздовж осі. Спершу перевірте дві клітинки по горизонталі, і лише потім по вертикалі.',
          'Пам’ятайте про ореол: після потоплення сусідні клітинки автоматично порожні, і обстрілювати їх немає сенсу.',
        ],
        mistakes: [
          'Ставлять увесь флот в одній половині поля — після перших влучань решта обчислюється майже без промахів.',
          'Стріляють поспіль по рядках. Половина пострілів іде в клітинки, де корабель поміститися не міг.',
          'Забувають про додатковий хід за влучання й зупиняються, не добивши корабель.',
        ],
        faq: [
          {
            q: 'Скільки кораблів у флоті?',
            a: 'Десять: один лінкор на чотири клітинки, два крейсери по три, три есмінці по дві й чотири однопалубні підводні човни.'
          },
          {
            q: 'Чи можуть кораблі стояти впритул?',
            a: 'Ні. Між кораблями має бути хоча б одна вільна клітинка, дотик кутами теж заборонено.'
          },
          {
            q: 'Що відбувається при влучанні?',
            a: 'Влучання дає додатковий постріл. Хід переходить до суперника лише після промаху.'
          },
          {
            q: 'Як запросити друга?',
            a: 'Скопіюйте посилання на кімнату або продиктуйте шестизначний код — приєднатися можна і так, і так.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('coup'),
    locales: {
      ru: {
        ...localeFacts('coup', 'ru'),
        metaTitle: 'Переворот (Coup) — игра на блеф',
        metaDescription:
          'Карточная игра «Переворот» на 2–6 игроков: пять ролей, блеф, блокировки и разоблачения. Лишите соперников влияния и останьтесь последним.',
        intro: [
          'Переворот — быстрая карточная игра о блефе и дедукции. Каждый игрок возглавляет влиятельную семью в коррумпированном городе-государстве и стремится лишить влияния всех остальных.',
          'Влияние — это две закрытые карты ролей. Заявить можно любую роль, даже ту, которой у вас нет: соперники вправе усомниться, и тогда лжец теряет карту. Но ошибочное обвинение стоит карты обвинителю.',
          'В колоде пять ролей: Герцог, Ассасин, Капитан, Посол и Графиня. Каждая даёт своё действие или блокировку, а вся партия строится на том, во что поверят остальные.'
        ],
        howToPlay: [
          'Соберите от двух до шести игроков в комнате.',
          'Каждый получает две закрытые карты ролей и две монеты.',
          'В свой ход выберите действие: доход, иностранная помощь, налог, кража, убийство, обмен или переворот.',
          'Заявляя роль, вы можете блефовать — карта на руках необязательна.',
          'Сомневаетесь в сопернике? Разоблачите его: лжец теряет карту, но ошибка стоит карты вам.',
          'Накопив десять монет, вы обязаны совершить переворот — его нельзя заблокировать.',
          'Потеряв обе карты, игрок выбывает. Последний оставшийся побеждает.'
        ],
        features: [
          'От двух до шести игроков',
          'Пять ролей с уникальными действиями и блокировками',
          'Полная цепочка заявок, блоков и разоблачений',
          'Таймер хода и журнал всех действий',
          'Вход в комнату по прямой ссылке'
        ],
        strategy: [
          'Считайте заявленные роли. В колоде по три карты каждой — четвёртый «Герцог» за столом всегда блеф.',
          'Следите за монетами соперников. Семь монет означают неизбежный переворот, и к этому моменту нужно решить, кого он ударит.',
          'Блефуйте ролью, которую никто ещё не заявлял. Чем реже роль звучала, тем дешевле в неё поверят.',
          'Разоблачение — обоюдная ставка. Обвиняйте, когда карта соперника вам нужна, а не когда просто кажется.',
          'Графиню выгодно держать в тайне. Заявленная вслух, она защищает один раз, необъявленная — сдерживает саму мысль об убийстве.',
        ],
        mistakes: [
          'Копят монеты до десяти, не замечая, что стали главной мишенью стола.',
          'Разоблачают наугад в начале партии, теряя карту там, где информации ещё нет.',
          'Заявляют одну и ту же роль весь матч — она перестаёт быть блефом и становится приметой.',
        ],
        faq: [
          {
            q: 'Можно ли блефовать в Перевороте?',
            a: 'Не просто можно — на этом держится вся игра. Заявить разрешено любую роль, риск лишь в том, что вас разоблачат.'
          },
          {
            q: 'Что происходит при разоблачении?',
            a: 'Если игрок блефовал, он теряет карту влияния. Если роль у него действительно была, карту теряет тот, кто обвинял.'
          },
          {
            q: 'Что делает каждая роль?',
            a: 'Герцог берёт налог и блокирует помощь, Ассасин убивает за три монеты, Капитан крадёт монеты, Посол меняет карты, Графиня блокирует убийство.'
          },
          {
            q: 'Когда переворот обязателен?',
            a: 'Как только у вас накопилось десять монет и больше — в этот ход вы обязаны совершить переворот.'
          }
        ]
      },
      en: {
        ...localeFacts('coup', 'en'),
        metaTitle: 'Coup — the bluffing card game online',
        metaDescription:
          'Play Coup online with 2–6 players: five roles, bluffing, blocks and challenges. Strip your rivals of influence and be the last one standing.',
        intro: [
          'Coup is a fast card game of bluffing and deduction. Each player heads an influential family in a corrupt city-state and works to strip everyone else of their influence.',
          'Influence is two face-down role cards. You may claim any role, including one you do not hold — but rivals can challenge you, and a caught liar loses a card. A wrong challenge costs the challenger a card instead.',
          'The deck holds five roles: Duke, Assassin, Captain, Ambassador and Contessa. Each grants an action or a block, and the whole match turns on what the table is willing to believe.'
        ],
        howToPlay: [
          'Gather two to six players in a room.',
          'Everyone starts with two face-down role cards and two coins.',
          'On your turn pick an action: income, foreign aid, tax, steal, assassinate, exchange or coup.',
          'When you claim a role you may be bluffing — you do not need the card in hand.',
          'Doubt an opponent? Challenge them: a liar loses a card, but a wrong call costs you one.',
          'Once you hold ten coins you must launch a coup, and a coup cannot be blocked.',
          'Lose both cards and you are out. The last player standing wins.'
        ],
        features: [
          'Two to six players',
          'Five roles with distinct actions and blocks',
          'Full claim, block and challenge chains',
          'Turn timer and a complete action log',
          'Join a room straight from a link'
        ],
        strategy: [
          'Count the claimed roles. There are three of each in the deck, so a fourth Duke at the table is always a bluff.',
          'Watch the coins. Seven means a coup is coming, and by then you should know who it lands on.',
          'Bluff a role nobody has claimed yet. The rarer it has been at the table, the cheaper it is to be believed.',
          'A challenge is a two-way bet. Call when you need that card gone, not when something merely feels off.',
          'Keep the Contessa quiet. Announced, she blocks one assassination; unannounced, she discourages the thought entirely.',
        ],
        mistakes: [
          'Hoarding coins to ten without noticing you became the obvious target.',
          'Challenging blindly early on and losing a card before any information exists.',
          'Claiming the same role all match — it stops being a bluff and becomes a tell.',
        ],
        faq: [
          {
            q: 'Can you bluff in Coup?',
            a: 'Bluffing is the whole game. You may claim any role at all — the only risk is being challenged.'
          },
          {
            q: 'What happens on a challenge?',
            a: 'If the player was bluffing, they lose an influence card. If they genuinely held the role, the challenger loses one instead.'
          },
          {
            q: 'What does each role do?',
            a: 'Duke takes tax and blocks foreign aid, Assassin kills for three coins, Captain steals coins, Ambassador exchanges cards, Contessa blocks assassination.'
          },
          {
            q: 'When is a coup mandatory?',
            a: 'The moment you hold ten coins or more, you must launch a coup on that turn.'
          }
        ]
      },
      uk: {
        ...localeFacts('coup', 'uk'),
        metaTitle: 'Переворот (Coup) — гра на блеф',
        metaDescription:
          'Карткова гра «Переворот» на 2–6 гравців: п’ять ролей, блеф, блокування й викриття. Позбавте суперників впливу й залиштеся останнім.',
        intro: [
          'Переворот — швидка карткова гра про блеф і дедукцію. Кожен гравець очолює впливову родину в корумпованому місті-державі й прагне позбавити впливу всіх інших.',
          'Вплив — це дві закриті карти ролей. Заявити можна будь-яку роль, навіть ту, якої у вас немає: суперники мають право засумніватися, і тоді брехун втрачає карту. Але хибне звинувачення коштує карти обвинувачеві.',
          'У колоді п’ять ролей: Герцог, Асасин, Капітан, Посол і Графиня. Кожна дає свою дію або блокування, а вся партія будується на тому, у що повірять інші.'
        ],
        howToPlay: [
          'Зберіть від двох до шести гравців у кімнаті.',
          'Кожен отримує дві закриті карти ролей і дві монети.',
          'У свій хід оберіть дію: дохід, іноземна допомога, податок, крадіжка, убивство, обмін або переворот.',
          'Заявляючи роль, ви можете блефувати — карта на руках не обов’язкова.',
          'Сумніваєтеся в суперникові? Викрийте його: брехун втрачає карту, але помилка коштує карти вам.',
          'Накопичивши десять монет, ви мусите здійснити переворот — його не можна заблокувати.',
          'Втративши обидві карти, гравець вибуває. Останній, хто залишився, перемагає.'
        ],
        features: [
          'Від двох до шести гравців',
          'П’ять ролей з унікальними діями й блокуваннями',
          'Повний ланцюжок заявок, блоків і викриттів',
          'Таймер ходу й журнал усіх дій',
          'Вхід у кімнату за прямим посиланням'
        ],
        strategy: [
          'Рахуйте заявлені ролі. У колоді по три карти кожної — четвертий «Герцог» за столом завжди блеф.',
          'Стежте за монетами суперників. Сім монет означають неминучий переворот, і до цього моменту треба вирішити, кого він ударить.',
          'Блефуйте роллю, яку ще ніхто не заявляв. Що рідше роль звучала, то дешевше в неї повірять.',
          'Викриття — обопільна ставка. Звинувачуйте, коли карта суперника вам потрібна, а не коли просто здається.',
          'Графиню вигідно тримати в таємниці. Заявлена вголос, вона захищає один раз, неоголошена — стримує саму думку про вбивство.',
        ],
        mistakes: [
          'Збирають монети до десяти, не помічаючи, що стали головною мішенню столу.',
          'Викривають навмання на початку партії, втрачаючи карту там, де інформації ще немає.',
          'Заявляють ту саму роль увесь матч — вона перестає бути блефом і стає прикметою.',
        ],
        faq: [
          {
            q: 'Чи можна блефувати в Перевороті?',
            a: 'Не просто можна — на цьому тримається вся гра. Заявити дозволено будь-яку роль, ризик лише в тому, що вас викриють.'
          },
          {
            q: 'Що відбувається при викритті?',
            a: 'Якщо гравець блефував, він втрачає карту впливу. Якщо роль у нього справді була, карту втрачає той, хто звинувачував.'
          },
          {
            q: 'Що робить кожна роль?',
            a: 'Герцог бере податок і блокує допомогу, Асасин убиває за три монети, Капітан краде монети, Посол міняє карти, Графиня блокує вбивство.'
          },
          {
            q: 'Коли переворот обов’язковий?',
            a: 'Щойно у вас накопичилося десять монет і більше — цього ходу ви мусите здійснити переворот.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('wallrush'),
    locales: {
      ru: {
        ...localeFacts('wallrush', 'ru'),
        metaTitle: 'Стены (Wall Rush) — играть онлайн',
        metaDescription:
          'Wall Rush онлайн на 2–4 игроков: добегите пешкой до цели раньше соперника или стройте стены и отправляйте его в обход. Дуэль и пара на поле 9×9, втроём и вчетвером — 11×11 и гонка в центр.',
        intro: [
          'Wall Rush — абстрактная стратегия, в которой каждый ход требует выбора между двумя делами: шагнуть вперёд самому или помешать сопернику. В дуэли и в паре доска 9×9: пешка стоит посередине одного края, дойти нужно до противоположного.',
          'Второе дело — стены. Стена длиной в две клетки встаёт в промежуток между рядами и заставляет соперника идти в обход. Стен конечное число, и каждая поставленная стена — это ход, который вы не потратили на собственное движение.',
          'Вчетвером расклад другой: поле 11×11, по игроку с каждой стороны и одна общая цель — золотая клетка в самом центре. Побеждает тот, кто дошёл до неё первым, остальные трое проигрывают.',
          'Запереть соперника наглухо нельзя ни в одном режиме: правила запрещают ставить стену, после которой у кого-то не останется ни одного пути к цели. Поэтому игра никогда не превращается в строительство тюрьмы — только в спор о том, чей маршрут длиннее.'
        ],
        howToPlay: [
          'Создайте комнату, выберите режим и отправьте друзьям ссылку или шестизначный код.',
          'Пешки встают посередине своих краёв. Вдвоём и в паре цель — любая клетка противоположного края; вчетвером — золотая клетка в центре поля.',
          'За ход сделайте ровно одно: шагните на соседнюю клетку (нажатием или стрелкой) или перетащите стену из лотка на доску — R или пробел повернут её прямо в руке.',
          'Стоите вплотную к чужой пешке — перепрыгните её; если за ней стена или край, обойдите сбоку.',
          'Следите за остатком стен: когда они кончатся, останется только бежать.',
          'Первый, кто дошёл до цели, побеждает. В режиме 2 на 2 хватит, чтобы дошёл любой из пары.'
        ],
        features: [
          'Четыре режима: 1 на 1, втроём, 2 на 2 и вчетвером каждый за себя',
          'Поле 9×9 в дуэли и в паре, 11×11 втроём и вчетвером',
          'По 10 стен в дуэли, по 8 втроём, по 5 в паре, по 7 вчетвером',
          'Недопустимые стены подсвечиваются заранее — правило пути проверяется на каждый ход',
          'Таймер хода, настраиваемый при создании комнаты',
          'Счёт серии сохраняется между переигровками'
        ],
        strategy: [
          'Считайте разницу, а не ущерб. Стена, удлиняющая чужой путь на два шага, стоит вам одного собственного хода — значит вы в плюсе лишь на один шаг.',
          'Берегите стены на концовку. В эндшпиле один барьер решает партию, а тот же барьер на втором ходу почти ничего не меняет.',
          'Не стройте против того, кто и так отстаёт. Стены — ресурс против лидера, а не способ добить последнего.',
          'Вчетвером стена работает на всех сразу: удлинив путь одному, вы часто помогаете двум другим не меньше, чем себе. Стройте то, что удлиняет чужой маршрут в центр, не удлиняя ваш.',
          'Играя в паре, разводите цели с партнёром. Две стены против одного и того же соперника часто дают эффект одной.'
        ],
        mistakes: [
          'Тратят стены в первые же ходы, чтобы «обозначить намерения». К середине партии отвечать становится нечем.',
          'Строят стену, которая удлиняет чужой путь на один шаг. Это ровно размен ход в ход — вы ничего не выиграли.',
          'Забывают про прыжок и обходят чужую пешку по длинной дуге, теряя два-три хода на ровном месте.',
          'Вчетвером воюют с ближайшим соседом, пока игрок напротив спокойно доходит до центра.'
        ],
        faq: [
          {
            q: 'Сколько человек нужно для игры?',
            a: 'От двух до четырёх. 1 на 1 — ровно двое, втроём — трое, каждый за себя, а 2 на 2 и «вчетвером» — ровно четверо.'
          },
          {
            q: 'Можно ли полностью перекрыть сопернику дорогу?',
            a: 'Нет. Правила запрещают ставить стену, после которой у кого-то не останется пути к своему краю, и игра сама не даст поставить такую стену. Стены только удлиняют маршрут.'
          },
          {
            q: 'Чем 2 на 2 отличается от игры вчетвером каждый за себя?',
            a: 'Целями и полем. В паре играют на 9×9, партнёры стоят напротив друг друга, каждый бежит к своему краю, и победа засчитывается паре, как только дошёл любой из двоих. Вчетвером поле 11×11 и цель у всех одна — центр, победитель только один.'
          },
          {
            q: 'Сколько стен в каждом режиме?',
            a: 'По 10 в дуэли, по 8 втроём, по 5 у каждого в паре и по 7 вчетвером. Сорок стен на одном поле превратили бы его в лабиринт, где движение почти останавливается, поэтому с ростом числа игроков запас на каждого урезают.'
          },
          {
            q: 'Нужно ли что-то устанавливать?',
            a: 'Нет. Игра работает прямо в браузере на компьютере и телефоне, регистрация не обязательна.'
          }
        ]
      },
      en: {
        ...localeFacts('wallrush', 'en'),
        metaTitle: 'Wall Rush — play online with friends, free',
        metaDescription:
          'Wall Rush online for 2–4 players: race your pawn home before your rival or drop walls to send them the long way around. A 9x9 duel and team game, or four at an 11x11 table racing for the centre.',
        intro: [
          'Wall Rush is an abstract strategy game where every turn forces a choice between two jobs: move yourself forward, or get in someone else\'s way. The board is 9x9, your pawn starts in the middle of one edge, and you have to reach the opposite one.',
          'The second job is walls. A wall is two squares long, sits in the gap between rows, and sends a rival the long way around. You have a finite number of them, and every wall you place is a turn you did not spend moving.',
          'Four at a table changes the shape of it: an 11x11 board, one player on each side, and a single shared target — the golden square in the very centre. First one there wins, and the other three lose.',
          'Sealing someone in is not allowed: no wall may leave a player without a route to their edge. So the game never collapses into building a prison — only into an argument about whose journey is longer.'
        ],
        howToPlay: [
          'Create a room, pick a mode, and send friends the link or the six-character code.',
          'Pawns start in the middle of their own edges. In a duel or a team game the target is any square on the opposite edge; four at a table it is the golden centre square.',
          'On your turn do exactly one thing: step to an adjacent square (tap it, or use the arrow keys), or drag a wall from the tray onto the board — R or Space turns it while you hold it.',
          'Face to face with another pawn, hop over it; if a wall or the edge is behind it, step around the side.',
          'Watch your wall count — once they are gone, all you can do is run.',
          'First pawn home wins. In 2v2 either partner getting there wins it for both.'
        ],
        features: [
          'Four modes: 1v1, three-way, 2v2 and four at a table',
          '9x9 board for the duel and the team game, 11x11 for three or four',
          '10 walls each in a duel, 8 each for three, 5 each in a team game, 7 each in a four',
          'Illegal walls are greyed out — the route rule is checked before you can place one',
          'Turn timer, configurable when the room is created',
          'Series score carried across rematches'
        ],
        strategy: [
          'Count the difference, not the damage. A wall that adds two steps to a rival costs you one turn of your own, so you are only one step ahead.',
          'Save walls for the endgame. One barrier late decides a match; the same barrier on turn two changes almost nothing.',
          'Do not spend walls on whoever is already behind. Walls are a tool against the leader.',
          'With four players a wall works on everybody at once: lengthening one rival\'s route often helps the other two as much as it helps you. Look for walls that lengthen their way to the centre without lengthening yours.',
          'Partnered up, split your targets. Two walls aimed at the same rival often achieve what one would.'
        ],
        mistakes: [
          'Spending walls in the opening to "make a statement", then having nothing left to answer with.',
          'Placing a wall that adds a single step. That is an even trade, turn for turn, and gains nothing.',
          'Forgetting the jump and walking the long way around a pawn, losing two or three turns for no reason.',
          'In a four, fighting the nearest neighbour while the player opposite quietly walks into the centre.'
        ],
        faq: [
          {
            q: 'How many players do I need?',
            a: 'Two to four. 1v1 is for exactly two, the three-way race for three, and 2v2 and free-for-all for exactly four.'
          },
          {
            q: 'Can I block a rival completely?',
            a: 'No. No wall may leave anyone without a route to their edge, and the board will not let you place one that does. Walls only lengthen the journey.'
          },
          {
            q: 'How is 2v2 different from four at a table?',
            a: 'The goals and the board. A team game is 9x9 with partners opposite, each running for their own edge, and the pair wins the moment either of them gets home. Four at a table is 11x11 with one shared target in the centre, and exactly one winner.'
          },
          {
            q: 'How many walls does each mode give?',
            a: '10 in a duel, 8 each for three, 5 each in a team game and 7 each at a four-player table. Forty walls on one board would turn it into a maze where movement nearly stops, so the allowance per player shrinks as the table grows.'
          },
          {
            q: 'Do I need to install anything?',
            a: 'No. It runs in the browser on desktop and mobile, and an account is optional.'
          }
        ]
      },
      uk: {
        ...localeFacts('wallrush', 'uk'),
        metaTitle: 'Стіни (Wall Rush) — грати онлайн',
        metaDescription:
          'Wall Rush онлайн на 2–4 гравців: добіжіть пішаком до мети раніше за суперника або будуйте стіни й відправляйте його в обхід. Дуель і пара на полі 9×9, утрьох і вчотирьох — 11×11 і перегони до центру.',
        intro: [
          'Wall Rush — абстрактна стратегія, у якій кожен хід вимагає вибору між двома справами: ступити вперед самому або завадити суперникові. У дуелі й у парі дошка 9×9: пішак стоїть посередині одного краю, дійти треба до протилежного.',
          'Друга справа — стіни. Стіна завдовжки дві клітинки стає в проміжок між рядами й змушує суперника йти в обхід. Стін обмежена кількість, і кожна поставлена стіна — це хід, який ви не витратили на власний рух.',
          'Учотирьох розклад інший: поле 11×11, по гравцю з кожного боку й одна спільна мета — золота клітинка в самому центрі. Перемагає той, хто дійшов до неї першим, решта троє програють.',
          'Замкнути суперника наглухо не можна в жодному режимі: правила забороняють ставити стіну, після якої в когось не залишиться жодного шляху до мети. Тому гра ніколи не перетворюється на будівництво в’язниці — лише на суперечку про те, чий маршрут довший.'
        ],
        howToPlay: [
          'Створіть кімнату, оберіть режим і надішліть друзям посилання або шестизначний код.',
          'Пішаки стають посередині своїх країв. Удвох і в парі мета — будь-яка клітинка протилежного краю; учотирьох — золота клітинка в центрі поля.',
          'За хід зробіть рівно одне: ступіть на сусідню клітинку (натисканням або стрілкою) або перетягніть стіну з лотка на дошку — R або пробіл повернуть її просто в руці.',
          'Стоїте впритул до чужого пішака — перестрибніть його; якщо за ним стіна або край, обійдіть збоку.',
          'Стежте за залишком стін: коли вони скінчаться, залишиться тільки бігти.',
          'Перший, хто дійшов до мети, перемагає. У режимі 2 на 2 досить, щоб дійшов будь-хто з пари.'
        ],
        features: [
          'Чотири режими: 1 на 1, утрьох, 2 на 2 й учотирьох кожен за себе',
          'Поле 9×9 у дуелі й у парі, 11×11 утрьох і вчотирьох',
          'По 10 стін у дуелі, по 8 утрьох, по 5 у парі, по 7 учотирьох',
          'Неприпустимі стіни підсвічуються заздалегідь — правило шляху перевіряється щоходу',
          'Таймер ходу, який налаштовують під час створення кімнати',
          'Рахунок серії зберігається між перегравами'
        ],
        strategy: [
          'Рахуйте різницю, а не шкоду. Стіна, що подовжує чужий шлях на два кроки, коштує вам одного власного ходу — отже, ви в плюсі лише на один крок.',
          'Бережіть стіни на кінцівку. В ендшпілі один бар’єр вирішує партію, а той самий бар’єр на другому ході майже нічого не змінює.',
          'Не будуйте проти того, хто й так відстає. Стіни — ресурс проти лідера, а не спосіб добити останнього.',
          'Учотирьох стіна працює на всіх одразу: подовживши шлях одному, ви часто допомагаєте двом іншим не менше, ніж собі. Будуйте те, що подовжує чужий маршрут до центру, не подовжуючи ваш.',
          'Граючи в парі, розводьте цілі з партнером. Дві стіни проти того самого суперника часто дають ефект однієї.'
        ],
        mistakes: [
          'Витрачають стіни в перші ж ходи, щоб «позначити наміри». До середини партії відповідати стає нічим.',
          'Будують стіну, яка подовжує чужий шлях на один крок. Це рівно розмін хід у хід — ви нічого не виграли.',
          'Забувають про стрибок і обходять чужого пішака довгою дугою, втрачаючи два-три ходи на рівному місці.',
          'Учотирьох воюють із найближчим сусідом, поки гравець навпроти спокійно доходить до центру.'
        ],
        faq: [
          {
            q: 'Скільки людей потрібно для гри?',
            a: 'Від двох до чотирьох. 1 на 1 — рівно двоє, утрьох — троє, кожен за себе, а 2 на 2 й «учотирьох» — рівно четверо.'
          },
          {
            q: 'Чи можна повністю перекрити суперникові дорогу?',
            a: 'Ні. Правила забороняють ставити стіну, після якої в когось не залишиться шляху до свого краю, і гра сама не дасть поставити таку стіну. Стіни лише подовжують маршрут.'
          },
          {
            q: 'Чим 2 на 2 відрізняється від гри вчотирьох кожен за себе?',
            a: 'Цілями й полем. У парі грають на 9×9, партнери стоять одне навпроти одного, кожен біжить до свого краю, і перемога зараховується парі, щойно дійшов будь-хто з двох. Учотирьох поле 11×11 і мета в усіх одна — центр, переможець лише один.'
          },
          {
            q: 'Скільки стін у кожному режимі?',
            a: 'По 10 у дуелі, по 8 утрьох, по 5 у кожного в парі й по 7 учотирьох. Сорок стін на одному полі перетворили б його на лабіринт, де рух майже зупиняється, тому зі зростанням кількості гравців запас для кожного скорочують.'
          },
          {
            q: 'Чи треба щось встановлювати?',
            a: 'Ні. Гра працює просто в браузері на комп’ютері й телефоні, реєстрація не обов’язкова.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('dots'),
    locales: {
      ru: {
        ...localeFacts('dots', 'ru'),
        metaTitle: 'Точки и квадраты — играть онлайн',
        metaDescription:
          'Онлайн-игра «Точки и квадраты» на 2–4 игроков: проводите линии между точками, закрывайте квадраты и ходите снова. Бесплатно, без установки.',
        intro: [
          'Точки и квадраты — игра, которая выглядит как детская забава и оказывается расчётом. Поле — сетка точек. За ход проводится одна линия между двумя соседними точками, и всё; правил больше нет.',
          'Замкнули квадрат — он ваш, и вы ходите ещё раз. Поэтому одна удачная линия может обернуться цепочкой из десятка квадратов подряд, а одна неосторожная — подарить такую же цепочку сопернику.',
          'Из этого вырастает вся игра: большую часть партии обе стороны ходят там, где до квадрата далеко, и настоящая борьба идёт за то, у кого раньше кончатся безопасные ходы.'
        ],
        howToPlay: [
          'Создайте комнату, выберите размер поля и отправьте друзьям ссылку или шестизначный код.',
          'За ход проведите одну линию между двумя соседними точками — по горизонтали или по вертикали.',
          'Замкнули квадрат — он окрашивается в ваш цвет, и вы ходите снова.',
          'Одна линия может закрыть сразу два квадрата, и оба достанутся вам.',
          'Не спешите ставить третью сторону квадрата: следующий ход соперника заберёт его.',
          'Партия заканчивается, когда проведены все линии. Побеждает тот, у кого больше квадратов.'
        ],
        features: [
          'От 2 до 4 игроков в одной комнате',
          'Размер поля от 3×3 до 8×8 квадратов',
          'Линии и квадраты окрашены в цвет того, кто их занял',
          'Таймер хода, настраиваемый при создании комнаты',
          'Полная информация: подсматривать нечего, всё на доске'
        ],
        strategy: [
          'Считайте безопасные ходы, а не квадраты. Побеждает тот, у кого останется ход, когда у соперника их не будет.',
          'Отдавать цепочку рано или поздно придётся — отдавайте короткую, длинные берегите к концу.',
          'Двойной крест: закройте длинную цепочку не полностью, оставив два последних квадрата. Соперник вынужден будет открыть следующую.',
          'Считайте чётность. В партии на нечётном поле безопасные ходы кончаются иначе, чем на чётном, и это решает, кто откроет первым.',
          'Вчетвером цепочка достаётся тому, чья очередь до неё дошла: следите не только за своими линиями, но и за тем, кому вы подводите ход.'
        ],
        mistakes: [
          'Хватают первый попавшийся квадрат, отдавая за него цепочку втрое длиннее.',
          'Ставят третью сторону квадрата просто потому, что «надо куда-то сходить».',
          'Забывают, что закрытый квадрат даёт ещё один ход, и считают партию по очереди ходов, а не по цепочкам.',
          'Дожимают цепочку до последнего квадрата вместо того, чтобы оставить два и передать инициативу.'
        ],
        faq: [
          {
            q: 'Сколько человек нужно для игры?',
            a: 'От двух до четырёх. Вдвоём игра более расчётливая, вчетвером — живее, потому что цепочки достаются тому, кто вовремя оказался у доски.'
          },
          {
            q: 'Можно ли ходить по диагонали?',
            a: 'Нет. Линия соединяет только две соседние точки по горизонтали или по вертикали.'
          },
          {
            q: 'Что будет, если одна линия закроет два квадрата?',
            a: 'Оба станут вашими, и вы всё равно ходите снова. Это самый выгодный ход в игре.'
          },
          {
            q: 'Бывает ли ничья?',
            a: 'Да, если квадратов поровну. На поле с нечётным числом квадратов ничья невозможна вдвоём.'
          },
          {
            q: 'Нужно ли что-то устанавливать?',
            a: 'Нет. Игра работает прямо в браузере на компьютере и телефоне, регистрация не обязательна.'
          }
        ]
      },
      en: {
        ...localeFacts('dots', 'en'),
        metaTitle: 'Dots & Boxes — play online free',
        metaDescription:
          'Dots & Boxes online for 2–4 players: draw lines between dots, close boxes and go again. Free, no download, no account needed.',
        intro: [
          'Dots & Boxes looks like something from the back of a school notebook and turns out to be arithmetic. The board is a grid of dots, and a turn is one line between two neighbours. That is the entire rulebook.',
          'Close a box and it is yours — and you go again. So one good line can run into a chain of a dozen boxes, and one careless line hands the same chain to your rival.',
          'Everything else grows from that. For most of the match both sides play where no box is nearly finished, and the real contest is over who runs out of safe moves first.'
        ],
        howToPlay: [
          'Create a room, pick a board size, and send friends the link or the six-character code.',
          'On your turn draw one line between two neighbouring dots, across or down.',
          'Close a box and it takes your colour — and you go again.',
          'One line can close two boxes at once, and both are yours.',
          'Think before drawing a third side of a box: your rival takes it on their next turn.',
          'The match ends when every line is drawn. Most boxes wins.'
        ],
        features: [
          'Two to four players in one room',
          'Board from 3x3 up to 8x8 boxes',
          'Lines and boxes take the colour of whoever claimed them',
          'Turn timer, configurable when the room is created',
          'Perfect information: nothing to peek at, it is all on the board'
        ],
        strategy: [
          'Count safe moves, not boxes. The winner is whoever still has a move when the other has none.',
          'You will have to give a chain away eventually — give away a short one and save the long chains for the end.',
          'The double cross: close a long chain but leave its last two boxes, and your rival must open the next one.',
          'Watch the parity. Safe moves run out differently on an odd board than an even one, and that decides who opens first.',
          'With four players a chain falls to whoever reaches it on their turn, so watch whose turn you are setting up.'
        ],
        mistakes: [
          'Grabbing the first box on offer and paying for it with a chain three times longer.',
          'Drawing a third side of a box simply because a move had to be made somewhere.',
          'Forgetting that closing a box grants another turn, and counting the match in turns rather than chains.',
          'Taking a chain down to its last box instead of leaving two and handing back the initiative.'
        ],
        faq: [
          {
            q: 'How many players do I need?',
            a: 'Two to four. Two makes a calculating game; four is livelier, because a chain falls to whoever happens to reach it.'
          },
          {
            q: 'Can I draw diagonally?',
            a: 'No. A line joins two neighbouring dots across or down, never corner to corner.'
          },
          {
            q: 'What if one line closes two boxes?',
            a: 'Both are yours and you still go again. It is the best move in the game.'
          },
          {
            q: 'Can a match be drawn?',
            a: 'Yes, on level boxes. A board with an odd number of boxes cannot be drawn between two players.'
          },
          {
            q: 'Do I need to install anything?',
            a: 'No. It runs in the browser on desktop and mobile, and an account is optional.'
          }
        ]
      },
      uk: {
        ...localeFacts('dots', 'uk'),
        metaTitle: 'Точки й квадрати — грати онлайн',
        metaDescription:
          'Онлайн-гра «Точки й квадрати» на 2–4 гравців: проводьте лінії між точками, закривайте квадрати й ходіть знову. Безкоштовно, без встановлення.',
        intro: [
          'Точки й квадрати — гра, яка виглядає як дитяча забава, а виявляється розрахунком. Поле — сітка точок. За хід проводиться одна лінія між двома сусідніми точками, і все; правил більше немає.',
          'Замкнули квадрат — він ваш, і ви ходите ще раз. Тому одна вдала лінія може обернутися ланцюжком із десятка квадратів поспіль, а одна необережна — подарувати такий самий ланцюжок суперникові.',
          'Із цього виростає вся гра: більшу частину партії обидві сторони ходять там, де до квадрата далеко, і справжня боротьба йде за те, у кого раніше скінчаться безпечні ходи.'
        ],
        howToPlay: [
          'Створіть кімнату, оберіть розмір поля й надішліть друзям посилання або шестизначний код.',
          'За хід проведіть одну лінію між двома сусідніми точками — по горизонталі або по вертикалі.',
          'Замкнули квадрат — він фарбується у ваш колір, і ви ходите знову.',
          'Одна лінія може закрити одразу два квадрати, і обидва дістануться вам.',
          'Не поспішайте ставити третю сторону квадрата: наступний хід суперника забере його.',
          'Партія закінчується, коли проведено всі лінії. Перемагає той, у кого більше квадратів.'
        ],
        features: [
          'Від 2 до 4 гравців в одній кімнаті',
          'Розмір поля від 3×3 до 8×8 квадратів',
          'Лінії й квадрати забарвлені в колір того, хто їх зайняв',
          'Таймер ходу, який налаштовують під час створення кімнати',
          'Повна інформація: підглядати нема чого, усе на дошці'
        ],
        strategy: [
          'Рахуйте безпечні ходи, а не квадрати. Перемагає той, у кого залишиться хід, коли в суперника їх не буде.',
          'Віддавати ланцюжок рано чи пізно доведеться — віддавайте короткий, довгі бережіть на кінець.',
          'Подвійний хрест: закрийте довгий ланцюжок не повністю, залишивши два останні квадрати. Суперник змушений буде відкрити наступний.',
          'Рахуйте парність. У партії на непарному полі безпечні ходи закінчуються інакше, ніж на парному, і це вирішує, хто відкриє першим.',
          'Учотирьох ланцюжок дістається тому, чия черга до нього дійшла: стежте не лише за своїми лініями, а й за тим, кому ви підводите хід.'
        ],
        mistakes: [
          'Хапають перший-ліпший квадрат, віддаючи за нього ланцюжок утричі довший.',
          'Ставлять третю сторону квадрата просто тому, що «треба кудись сходити».',
          'Забувають, що закритий квадрат дає ще один хід, і рахують партію за чергою ходів, а не за ланцюжками.',
          'Дотискають ланцюжок до останнього квадрата замість того, щоб залишити два й передати ініціативу.'
        ],
        faq: [
          {
            q: 'Скільки людей потрібно для гри?',
            a: 'Від двох до чотирьох. Удвох гра розважливіша, учотирьох — жвавіша, бо ланцюжки дістаються тому, хто вчасно опинився біля дошки.'
          },
          {
            q: 'Чи можна ходити по діагоналі?',
            a: 'Ні. Лінія з’єднує лише дві сусідні точки по горизонталі або по вертикалі.'
          },
          {
            q: 'Що буде, якщо одна лінія закриє два квадрати?',
            a: 'Обидва стануть вашими, і ви однаково ходите знову. Це найвигідніший хід у грі.'
          },
          {
            q: 'Чи буває нічия?',
            a: 'Так, якщо квадратів порівну. На полі з непарною кількістю квадратів нічия вдвох неможлива.'
          },
          {
            q: 'Чи треба щось встановлювати?',
            a: 'Ні. Гра працює просто в браузері на комп’ютері й телефоні, реєстрація не обов’язкова.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('reversi'),
    locales: {
      ru: {
        ...localeFacts('reversi', 'ru'),
        metaTitle: 'Реверси — играть онлайн с другом бесплатно',
        metaDescription:
          'Реверси онлайн на двоих: зажимайте чужие фишки между своими, переворачивайте их и берите углы. Правило одно, партия на четверть часа.',
        intro: [
          'Реверси — игра 1883 года с одним-единственным правилом: поставьте фишку так, чтобы линия чужих оказалась зажата между ней и одной из ваших, и вся эта линия перевернётся.',
          'Линии считаются по горизонтали, вертикали и диагонали, и один ход может перевернуть сразу несколько. Поэтому доска меняется не по фишке за раз, а целыми полосами, и позиция в середине партии почти ничего не говорит о том, чем всё кончится.',
          'Ход разрешён, только если он что-то переворачивает. Из этого следует неочевидное: иногда ходить просто некуда, и очередь переходит обратно.'
        ],
        howToPlay: [
          'Создайте комнату и отправьте другу ссылку или шестизначный код.',
          'В центре доски уже стоят четыре фишки — по две каждого цвета, наискосок.',
          'Первым ходит тёмный. Доступные клетки подсвечены вашим цветом.',
          'Поставьте фишку так, чтобы зажать линию чужих между ней и своей — линия перевернётся.',
          'Если ходить некуда, очередь переходит автоматически.',
          'Партия кончается, когда ходов нет ни у кого. Побеждает тот, у кого больше фишек.'
        ],
        features: [
          'Классическая доска 8×8 и классическая расстановка',
          'Доступные ходы подсвечиваются — правило видно, а не угадывается',
          'Автоматический пропуск хода, когда ставить некуда',
          'Таймер хода, настраиваемый при создании комнаты',
          'Полная информация: подсматривать нечего, всё на доске'
        ],
        strategy: [
          'Углы перевернуть невозможно ничем. Один угол стоит дороже десятка фишек в центре.',
          'Не занимайте клетки рядом с углом раньше времени — именно они открывают сопернику дорогу в сам угол.',
          'В середине партии выгодно иметь меньше фишек: меньше того, что можно зажать, и больше мест, куда вы ещё можете пойти.',
          'Считайте не фишки, а ходы. Партия выигрывается тем, что сопернику становится некуда ставить.',
          'Края доски надёжнее центра: фишку на краю можно перевернуть только вдоль этого края.'
        ],
        mistakes: [
          'Радуются большому перевесу в середине партии — он переворачивается одним ходом в угол.',
          'Жадно переворачивают как можно больше фишек каждым ходом, отдавая взамен свободу манёвра.',
          'Занимают клетку по диагонали от угла и отдают угол следующим же ходом.',
          'Считают, что доска обязана заполниться до конца: партия часто кончается раньше.'
        ],
        faq: [
          {
            q: 'Сколько человек нужно для игры?',
            a: 'Двое: у каждого свой цвет. Вариантов на большее число игроков у этой игры нет.'
          },
          {
            q: 'Почему не всякая свободная клетка доступна?',
            a: 'Ход разрешён, только если он переворачивает хотя бы одну фишку. Линия, упирающаяся в край доски или разорванная пустой клеткой, не зажимает ничего.'
          },
          {
            q: 'Что будет, если мне некуда ходить?',
            a: 'Ход перейдёт автоматически. Если ходов нет ни у кого — партия закончена, даже если на доске остались пустые клетки.'
          },
          {
            q: 'Чем Реверси отличается от игры с похожим названием?',
            a: 'Это она и есть: механика придумана в 1883 году и свободна. Более известное название — зарегистрированная торговая марка, поэтому игра называется своим изначальным именем.'
          },
          {
            q: 'Нужно ли что-то устанавливать?',
            a: 'Нет. Игра работает прямо в браузере на компьютере и телефоне, регистрация не обязательна.'
          }
        ]
      },
      en: {
        ...localeFacts('reversi', 'en'),
        metaTitle: 'Reversi — play online with a friend, free',
        metaDescription:
          'Reversi online for two: trap your rival between two of your discs, turn the line over and take the corners. One rule, about fifteen minutes.',
        intro: [
          'Reversi dates from 1883 and has one rule: place a disc so that a line of your rival sits between it and one of yours, and that whole line turns over.',
          'Lines run across, down and diagonally, and a single move can turn several at once. The board changes in stripes rather than one disc at a time, which is why a position in the middlegame says almost nothing about how it ends.',
          'A move is legal only if it turns something over. That has a consequence people rarely expect: sometimes there is nowhere to play at all, and the turn simply goes back.'
        ],
        howToPlay: [
          'Create a room and send a friend the link or the six-character code.',
          'Four discs start in the middle, two of each colour, set on a diagonal.',
          'Dark opens. The squares you may play are highlighted in your colour.',
          'Place a disc so it traps a line of your rival between it and one of yours — the line turns over.',
          'If you have nowhere to play, the turn passes automatically.',
          'The match ends when neither colour can play. Most discs wins.'
        ],
        features: [
          'The classic 8x8 board and the classic opening position',
          'Legal moves are highlighted, so the rule is visible rather than guessed',
          'Turns pass automatically when there is nowhere to play',
          'Turn timer, configurable when the room is created',
          'Perfect information: nothing to peek at, it is all on the board'
        ],
        strategy: [
          'Corners can never be turned over. One corner is worth more than a dozen discs in the middle.',
          'Do not take the squares beside a corner early — they are what lets your rival reach the corner itself.',
          'Holding fewer discs in the middlegame is usually good: less to be trapped, and more places you can still play.',
          'Count moves, not discs. The match is won by leaving your rival with nowhere to go.',
          'Edges are safer than the middle: a disc on an edge can only be turned along that edge.'
        ],
        mistakes: [
          'Celebrating a big lead in the middlegame, which one move into a corner can undo.',
          'Turning over as many discs as possible every move, and paying for it in freedom to manoeuvre.',
          'Taking the square diagonally beside a corner and handing over the corner next turn.',
          'Assuming the board has to fill up. Matches often end with squares to spare.'
        ],
        faq: [
          {
            q: 'How many players do I need?',
            a: 'Two, one colour each. The game has no variant for more.'
          },
          {
            q: 'Why can I not play on every empty square?',
            a: 'A move is legal only if it turns at least one disc over. A run that reaches the edge of the board, or that has a gap in it, traps nothing.'
          },
          {
            q: 'What happens if I have nowhere to play?',
            a: 'Your turn passes automatically. If neither colour can play, the match is over — even with empty squares left.'
          },
          {
            q: 'How does this differ from the game with the similar name?',
            a: 'It is the same game. The mechanic is from 1883 and free to use; the better-known title is a registered trademark, so this one goes by its original name.'
          },
          {
            q: 'Do I need to install anything?',
            a: 'No. It runs in the browser on desktop and mobile, and an account is optional.'
          }
        ]
      },
      uk: {
        ...localeFacts('reversi', 'uk'),
        metaTitle: 'Реверсі — грати онлайн із другом безкоштовно',
        metaDescription:
          'Реверсі онлайн на двох: затискайте чужі фішки між своїми, перевертайте їх і беріть кути. Правило одне, партія на чверть години.',
        intro: [
          'Реверсі — гра 1883 року з одним-єдиним правилом: поставте фішку так, щоб лінія чужих опинилася затиснутою між нею й однією з ваших, і вся ця лінія перевернеться.',
          'Лінії рахуються по горизонталі, вертикалі й діагоналі, і один хід може перевернути одразу кілька. Тому дошка змінюється не по фішці за раз, а цілими смугами, і позиція посеред партії майже нічого не каже про те, чим усе скінчиться.',
          'Хід дозволено, лише якщо він щось перевертає. З цього випливає неочевидне: іноді ходити просто нікуди, і черга переходить назад.'
        ],
        howToPlay: [
          'Створіть кімнату й надішліть другові посилання або шестизначний код.',
          'У центрі дошки вже стоять чотири фішки — по дві кожного кольору, навскіс.',
          'Першим ходить темний. Доступні клітинки підсвічено вашим кольором.',
          'Поставте фішку так, щоб затиснути лінію чужих між нею й своєю, — лінія перевернеться.',
          'Якщо ходити нікуди, черга переходить автоматично.',
          'Партія закінчується, коли ходів немає ні в кого. Перемагає той, у кого більше фішок.'
        ],
        features: [
          'Класична дошка 8×8 і класичне розставлення',
          'Доступні ходи підсвічуються — правило видно, а не вгадується',
          'Автоматичний пропуск ходу, коли ставити нікуди',
          'Таймер ходу, який налаштовують під час створення кімнати',
          'Повна інформація: підглядати нема чого, усе на дошці'
        ],
        strategy: [
          'Кути перевернути неможливо нічим. Один кут вартує більше за десяток фішок у центрі.',
          'Не займайте клітинки біля кута завчасно — саме вони відкривають суперникові дорогу в сам кут.',
          'Посеред партії вигідно мати менше фішок: менше того, що можна затиснути, і більше місць, куди ви ще можете піти.',
          'Рахуйте не фішки, а ходи. Партія виграється тим, що суперникові стає нікуди ставити.',
          'Краї дошки надійніші за центр: фішку на краю можна перевернути лише вздовж цього краю.'
        ],
        mistakes: [
          'Радіють великій перевазі посеред партії — вона перевертається одним ходом у кут.',
          'Жадібно перевертають якомога більше фішок кожним ходом, віддаючи натомість свободу маневру.',
          'Займають клітинку по діагоналі від кута й віддають кут наступним же ходом.',
          'Вважають, що дошка мусить заповнитися до кінця: партія часто закінчується раніше.'
        ],
        faq: [
          {
            q: 'Скільки людей потрібно для гри?',
            a: 'Двоє: у кожного свій колір. Варіантів на більшу кількість гравців у цієї гри немає.'
          },
          {
            q: 'Чому не кожна вільна клітинка доступна?',
            a: 'Хід дозволено, лише якщо він перевертає хоча б одну фішку. Лінія, що впирається в край дошки або розірвана порожньою клітинкою, нічого не затискає.'
          },
          {
            q: 'Що буде, якщо мені нікуди ходити?',
            a: 'Хід перейде автоматично. Якщо ходів немає ні в кого — партію завершено, навіть якщо на дошці залишилися порожні клітинки.'
          },
          {
            q: 'Чим Реверсі відрізняється від гри зі схожою назвою?',
            a: 'Це вона і є: механіку придумано 1883 року, і вона вільна. Відоміша назва — зареєстрована торговельна марка, тому гра називається своїм первісним ім’ям.'
          },
          {
            q: 'Чи треба щось встановлювати?',
            a: 'Ні. Гра працює просто в браузері на комп’ютері й телефоні, реєстрація не обов’язкова.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('wikiler'),
    locales: {
      ru: {
        ...localeFacts('wikiler', 'ru'),
        metaTitle: 'Wikiler — угадай статью Википедии по словам',
        metaDescription:
          'Словесная викторина по статьям Википедии: большинство слов скрыто, вы открываете их по одному и угадываете название. Соло и до 20 игроков.',
        intro: [
          'Wikiler — игра по статьям Википедии. Вам показывают статью, в которой скрыта большая часть значимых слов и всё название. Вы пишете слова — и они открываются везде, где встречаются в тексте.',
          'Задача — узнать статью. Можно открывать слова, пока не проявится название, а можно рискнуть раньше и ввести его целиком: чем меньше попыток и времени ушло, тем больше очков.',
          'Играть можно одному или компанией до двадцати человек: у всех одна и та же статья, каждый угадывает сам, а очки складываются по раундам.'
        ],
        howToPlay: [
          'Выберите тему — случайную статью или одну из 34 тем, — сложность, число раундов и время. Остальное — в дополнительных настройках.',
          'Пишите слова: совпавшие откроются в статье вместе с грамматическими формами, и будет видно, сколько раз они встретились.',
          'Служебные слова, числа и знаки видны сразу — по ним читается строение текста.',
          'Когда догадались, переключитесь на вкладку «Статья» и введите название.',
          'Неверное название стоит 50 очков, промах словом — 10, а найденное слово — 2, поэтому угадывайте с умом.',
          'После всех раундов сравните итоговые очки с соперниками.'
        ],
        features: [
          'Настоящие статьи Википедии: каждый читает свою на русском или английском',
          'Случайная статья или одна из 34 тем: люди, история, география, наука… — легко, средне или сложно',
          'Грамматические формы слова открываются вместе',
          'Соло и мультиплеер до двадцати игроков',
          'Режимы без ограничений и с лимитом попыток',
          'Настраиваемые раунды, время, доля скрытых слов и подсказка с числом букв'
        ],
        strategy: [
          'Начинайте с частых слов общей темы: «год», «город», «страна», «вид». Они дёшевы и быстро подсказывают, о чём статья.',
          'Смотрите на форму текста: даты и числа, длина абзацев и заголовки разделов выдают тип статьи — биография, город, животное.',
          'Первое предложение — главное. В нём название обычно повторяется и определяется одной фразой.',
          'Рискуйте названием, когда вариантов два-три: 50 очков штрафа меньше, чем минута раздумий.',
        ],
        mistakes: [
          'Угадывают редкие слова — промах стоит впятеро дороже, чем найденное слово.',
          'Ждут, пока проявится всё название, и теряют очки на времени.',
          'Вводят название во вкладке «Слово» — она принимает по одному слову.',
        ],
        faq: [
          {
            q: 'Откуда берутся статьи?',
            a: 'Прямо из Википедии: браузер загружает их с ru.wikipedia.org или en.wikipedia.org — каждому на языке его интерфейса, или всем на языке хоста, если он так выбрал. Тексты статей написаны авторами Википедии и распространяются по лицензии CC BY-SA 4.0 — после каждого раунда видна ссылка на статью и список её авторов.'
          },
          {
            q: 'Как считаются очки?',
            a: 'В начале раунда 1000 очков. Время раунда целиком стоит 500, промах словом — 10, найденное слово — 2 (при лимите попыток меньше 50 — пропорционально дороже), неверное название — 50. Угаданный раунд приносит не меньше 10 очков.'
          },
          {
            q: 'Почему вместе со словом открылись другие?',
            a: 'Открываются грамматические формы слова: «работа» откроет и «работы», и «работой». Формы определяются автоматически, поэтому иногда вместе открываются и родственные слова.'
          },
          {
            q: 'Это игра Википедии?',
            a: 'Нет. Wikiler использует открытые статьи Википедии, но не связан с Википедией и фондом Викимедиа.'
          }
        ]
      },
      en: {
        ...localeFacts('wikiler', 'en'),
        metaTitle: 'Wikiler — guess the Wikipedia article',
        metaDescription:
          'A word quiz on Wikipedia articles: most words are hidden, you open them one by one and name the article. Solo or up to 20 players.',
        intro: [
          'Wikiler is a game played on Wikipedia articles. You get an article with most of its meaningful words hidden and the whole title. Type a word and it opens everywhere it appears in the text.',
          'The goal is to name the article. Open words until the title shows through — or take the risk earlier and type the title outright: the fewer attempts and the less time it took, the more points.',
          'Play alone or with up to twenty people: everyone gets the same article, each guesses on their own, and points add up across rounds.'
        ],
        howToPlay: [
          'Choose a topic — a random article or one of 34 topics — the difficulty, the number of rounds and the time. The rest is in the advanced settings.',
          'Type words: the ones that match open in the article along with their grammatical forms, and you see how many times they occur.',
          'Function words, numbers and punctuation are shown from the start, so you can read the shape of the text.',
          'When you know it, switch to the Article tab and type the title.',
          'A wrong title costs 50 points, a missed word 10 and a found one 2, so guess wisely.',
          'After the final round, compare your total with everyone else.'
        ],
        features: [
          'Real Wikipedia articles: each player reads theirs in English or Russian',
          'A random article or one of 34 topics: people, history, geography, science… — easy, medium or hard',
          'Grammatical forms of a word open together',
          'Solo and multiplayer for up to twenty',
          'Unlimited or limited attempts',
          'Configurable rounds, time, share of hidden words and a letter-count hint'
        ],
        strategy: [
          'Open with common words of the general field: "year", "city", "country", "species". They are cheap and quickly tell you what the article is about.',
          'Read the shape of the text: dates and numbers, paragraph lengths and section headings give away the kind of article — a biography, a city, an animal.',
          'The first sentence matters most. It usually repeats the title and defines it in one phrase.',
          'Risk the title when you are down to two or three candidates: a 50-point penalty is less than a minute of hesitation.',
        ],
        mistakes: [
          'Guessing rare words — a miss costs five times what a found word does.',
          'Waiting for the whole title to appear and losing points to the clock.',
          'Typing the title in the Word tab, which takes one word at a time.',
        ],
        faq: [
          {
            q: 'Where do the articles come from?',
            a: 'Straight from Wikipedia: your browser loads them from en.wikipedia.org or ru.wikipedia.org — each player in their interface language, or everyone in the host’s if the host chose so. The articles are written by Wikipedia’s authors and available under CC BY-SA 4.0 — after each round you get a link to the article and its list of authors.'
          },
          {
            q: 'How is the score calculated?',
            a: 'A round starts at 1,000 points. The whole round costs 500 over time, a missed word 10 and a found one 2 (dearer in proportion under an attempt limit below 50), a wrong title 50. A solved round is worth at least 10.'
          },
          {
            q: 'Why did other words open with mine?',
            a: 'Grammatical forms open together: "work" also opens "works" and "worked". The forms are found automatically, so occasionally related words open too.'
          },
          {
            q: 'Is this a Wikipedia game?',
            a: 'No. Wikiler uses Wikipedia’s open articles but is not affiliated with Wikipedia or the Wikimedia Foundation.'
          }
        ]
      },
      uk: {
        ...localeFacts('wikiler', 'uk'),
        metaTitle: 'Wikiler — вгадай статтю Вікіпедії за словами',
        metaDescription:
          'Словесна вікторина за статтями Вікіпедії: більшість слів приховано, ви відкриваєте їх по одному й вгадуєте назву. Соло й до 20 гравців.',
        intro: [
          'Wikiler — гра за статтями Вікіпедії. Вам показують статтю, у якій приховано більшу частину значущих слів і всю назву. Ви пишете слова — і вони відкриваються скрізь, де трапляються в тексті.',
          'Завдання — впізнати статтю. Можна відкривати слова, доки не проявиться назва, а можна ризикнути раніше й ввести її повністю: що менше спроб і часу пішло, то більше очок.',
          'Грати можна самому або компанією до двадцяти людей: у всіх та сама стаття, кожен вгадує сам, а очки складаються за раундами.'
        ],
        howToPlay: [
          'Оберіть тему — випадкову статтю або одну з 34 тем, — складність, кількість раундів і час. Решта — у додаткових налаштуваннях.',
          'Пишіть слова: ті, що збіглися, відкриються в статті разом із граматичними формами, і буде видно, скільки разів вони трапилися.',
          'Службові слова, числа й знаки видно одразу — за ними читається будова тексту.',
          'Коли здогадалися, перемкніться на вкладку «Стаття» й введіть назву.',
          'Неправильна назва коштує 50 очок, промах словом — 10, а знайдене слово — 2, тому вгадуйте з розумом.',
          'Після всіх раундів порівняйте підсумкові очки із суперниками.'
        ],
        features: [
          'Справжні статті Вікіпедії: кожен читає свою англійською або російською',
          'Випадкова стаття або одна з 34 тем: люди, історія, географія, наука… — легко, середньо чи складно',
          'Граматичні форми слова відкриваються разом',
          'Соло й мультиплеєр до двадцяти гравців',
          'Режими без обмежень і з лімітом спроб',
          'Налаштовувані раунди, час, частка прихованих слів і підказка з кількістю літер'
        ],
        strategy: [
          'Починайте з частих слів загальної теми: «рік», «місто», «країна», «вид». Вони дешеві й швидко підказують, про що стаття.',
          'Дивіться на форму тексту: дати й числа, довжина абзаців і заголовки розділів видають тип статті — біографія, місто, тварина.',
          'Перше речення — головне. У ньому назва зазвичай повторюється й визначається однією фразою.',
          'Ризикуйте назвою, коли варіантів два-три: 50 очок штрафу — менше, ніж хвилина роздумів.',
        ],
        mistakes: [
          'Вгадують рідкісні слова — промах коштує вп’ятеро дорожче, ніж знайдене слово.',
          'Чекають, доки проявиться вся назва, і втрачають очки на часі.',
          'Вводять назву у вкладці «Слово» — вона приймає по одному слову.',
        ],
        faq: [
          {
            q: 'Звідки беруться статті?',
            a: 'Просто з Вікіпедії: браузер завантажує їх з ru.wikipedia.org або en.wikipedia.org — кожному мовою його інтерфейсу (з українським інтерфейсом — англійською), або всім мовою хоста, якщо він так обрав. Тексти статей написали автори Вікіпедії, і вони поширюються за ліцензією CC BY-SA 4.0 — після кожного раунду видно посилання на статтю й список її авторів.'
          },
          {
            q: 'Як рахуються очки?',
            a: 'На початку раунду 1000 очок. Час раунду повністю коштує 500, промах словом — 10, знайдене слово — 2 (якщо ліміт спроб менший за 50 — пропорційно дорожче), неправильна назва — 50. Вгаданий раунд приносить щонайменше 10 очок.'
          },
          {
            q: 'Чому разом зі словом відкрилися інші?',
            a: 'Відкриваються граматичні форми слова: «робота» відкриє і «роботи», і «роботою». Форми визначаються автоматично, тому іноді разом відкриваються й споріднені слова.'
          },
          {
            q: 'Це гра Вікіпедії?',
            a: 'Ні. Wikiler використовує відкриті статті Вікіпедії, але не пов’язаний із Вікіпедією та фондом Вікімедіа.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('timler'),
    locales: {
      ru: {
        ...localeFacts('timler', 'ru'),
        metaTitle: 'Timler — угадай год фотографии онлайн',
        metaDescription:
          'Историческая викторина по фотографиям и живописи: угадайте, когда снят кадр или написана картина. Соло и компанией до 20 игроков.',
        intro: [
          'Timler — викторина по старым и новым фотографиям. Всем показывают один и тот же снимок, а вы называете, когда он сделан: год — обязательно, день и месяц — если знаете.',
          'Фотографии — от первых дагеротипов 1840-х до событий этого года: улицы, люди, техника, события. Чем ближе ответ к настоящей дате, тем больше очков.',
          'Есть и режим живописи: картины от Возрождения до авангарда, по эпохам — отдельно или вперемешку с фото.',
          'Играть можно одному или компанией до двадцати человек. После каждого раунда ответы всех встают на общую шкалу времени — сразу видно, кто был ближе.'
        ],
        howToPlay: [
          'Выберите, что угадываете — фото, живопись или всё вместе, — эпоху (или всё время), сложность, число раундов и время на раунд.',
          'Рассмотрите фото: одежда, машины, вывески, качество снимка — всё подсказывает время.',
          'Выберите год ползунком, кнопками или впишите его. Если уверены — добавьте день и месяц.',
          'Нажмите «Ответить». Раунд кончается, когда ответили все или вышло время.',
          'После раунда — шкала с ответами всех, правильная дата и рассказ о снимке.',
          'После всех раундов сравните итоговые очки с соперниками.'
        ],
        features: [
          'Настоящие исторические фотографии из открытых архивов',
          'Год или точная дата — каждый решает сам',
          'Шкала с ответами всех игроков после раунда',
          'Соло и мультиплеер до двадцати игроков',
          'Эпохи от XIX века до наших дней и три уровня сложности',
          'Режим живописи: картины с XIV века по 1945 год',
          'Режим 18+ — по желанию, в дополнительных настройках'
        ],
        strategy: [
          'Смотрите на технику: модели машин, телефоны, самолёты дают десятилетие точнее всего.',
          'Цвет и качество снимка — подсказка: ранние фото коричневые и размытые, цвет массово появляется после 1950-х.',
          'Одежда и причёски меняются быстро — шляпы, длина юбок, ширина брюк.',
          'Добавляйте день, только если узнали событие: дата — это ставка, наугад она в среднем отнимает очки.',
          'В живописи смотрите на манеру: плоские золотые фоны — до Возрождения, резкий свет из темноты — барокко, мазки пятнами — импрессионизм.'
        ],
        mistakes: [
          'Тянут до последней секунды — очки за время тают с самой первой.',
          'Ставят дату наугад: промах на месяц уже в минусе.',
          'Забывают нажать «Ответить» — без ответа раунд приносит ноль.'
        ],
        faq: [
          {
            q: 'Откуда берутся фотографии?',
            a: 'Из Wikimedia Commons и Викиданных: туда передали снимки музеи, библиотеки и архивы — Библиотека Конгресса США, Национальный архив Нидерландов, Федеральный архив Германии и другие. Фото загружаются прямо с сайтов Wikimedia; после раунда видны автор, лицензия и ссылка на файл.'
          },
          {
            q: 'Можно ли угадывать картины?',
            a: 'Да. В настройках выберите «Живопись» или «Всё вместе» — по умолчанию в игре только фото. У картин свои эпохи: до 1600, 1600–1799, 1800–1899 и 1900–1945. В пуле только картины, у которых точно известен год, без «около» и «между».'
          },
          {
            q: 'Как считаются очки?',
            a: 'За точный год — 1000. Допуск растёт с возрастом снимка: промах на 5 лет у фото XIX века почти ничего не стоит, а у фото последних лет — почти все очки. Если указать день и месяц, можно получить до +300 за точную дату или до −100 за промах. Трём самым точным — +100, +60 и +30 за место, а время с первой секунды снимает до 200: кто ответил раньше, теряет меньше.'
          },
          {
            q: 'Что такое режим 18+?',
            a: 'Без него в игре нет войны, катастроф и обнажённой натуры. Режим 18+ включается в дополнительных настройках и добавляет такие снимки и картины, а «Только 18+» оставляет только их. Тел погибших и казней на фото, крови и пыток нет и там.'
          },
          {
            q: 'Это игра Wikimedia?',
            a: 'Нет. Timler использует открытые фотографии и изображения картин из Wikimedia Commons, но не связан с фондом Викимедиа.'
          }
        ]
      },
      en: {
        ...localeFacts('timler', 'en'),
        metaTitle: 'Timler — guess the year of the photo',
        metaDescription:
          'A history quiz played on photographs and paintings: guess when each was taken or painted. Solo or with up to 20 players.',
        intro: [
          'Timler is a quiz played on photographs old and new. Everyone sees the same picture and says when it was taken: the year is a must, the day and month if you know them.',
          'The photos run from the first daguerreotypes of the 1840s to this year’s news: streets, people, machines, events. The closer to the real date, the more points.',
          'There is a paintings mode too: from the Renaissance to the avant-garde, by era — on their own or mixed with photos.',
          'Play alone or with up to twenty people. After each round everyone’s answers land on one timeline, so you see at once who was closest.'
        ],
        howToPlay: [
          'Pick what to date — photos, paintings or both — an era (or all time), a difficulty, the number of rounds and the time per round.',
          'Study the photo: clothes, cars, signs, the look of the print — all of it tells the time.',
          'Pick the year with the slider, the buttons, or type it in. If you are sure, add the day and month.',
          'Press Answer. A round ends when everyone has answered or time is up.',
          'After the round: a timeline of everyone’s answers, the right date and the story of the photo.',
          'After the final round, compare your total with everyone else.'
        ],
        features: [
          'Real historical photographs from open archives',
          'The year or the exact date — each player decides',
          'A timeline of every answer after the round',
          'Solo and multiplayer for up to twenty',
          'Eras from the 19th century to today and three difficulties',
          'A paintings mode: canvases from the 14th century to 1945',
          'An optional 18+ mode in the advanced settings'
        ],
        strategy: [
          'Look at the machines: car models, phones and planes give the decade most precisely.',
          'Colour and quality are clues: early photos are brown and soft, colour becomes common after the 1950s.',
          'Clothes and hair change fast — hats, hemlines, the width of trousers.',
          'Add the day only if you recognise the event: the date is a bet, and a random one costs points on average.',
          'In paintings, read the manner: flat gold backgrounds come before the Renaissance, hard light out of darkness is Baroque, dabs of colour are Impressionism.'
        ],
        mistakes: [
          'Waiting until the last second — time costs points from the very first.',
          'Guessing a date at random: a month off is already a minus.',
          'Forgetting to press Answer — a round without one scores zero.'
        ],
        faq: [
          {
            q: 'Where do the photos come from?',
            a: 'From Wikimedia Commons and Wikidata, where museums, libraries and archives have given their pictures — the Library of Congress, the National Archives of the Netherlands, the German Federal Archives and others. They load straight from Wikimedia’s sites; after each round you see the author, the licence and a link to the file.'
          },
          {
            q: 'Can I date paintings?',
            a: 'Yes. Pick Paintings or Both in the settings — by default the game shows photos only. Paintings have their own eras: before 1600, 1600–1799, 1800–1899 and 1900–1945. The pool holds only paintings whose year is known for certain, not "circa" or "between".'
          },
          {
            q: 'How is the score calculated?',
            a: 'The exact year is worth 1,000. The older the photo, the more room: five years off costs next to nothing on a 19th-century photo and nearly all the points on one from the last few years. Add the day and month for up to +300 for the exact date, or down to −100 for a miss. The three most accurate get +100, +60 and +30 for their place, and time costs up to 200 from the first second: whoever answers first loses least.'
          },
          {
            q: 'What is the 18+ mode?',
            a: 'Without it the game has no war, disasters or nudity. The 18+ mode, in the advanced settings, adds such photos and paintings, and "18+ only" keeps nothing else. Even there, no bodies or executions in photos, and no blood or torture.'
          },
          {
            q: 'Is this a Wikimedia game?',
            a: 'No. Timler uses the open photographs and painting images of Wikimedia Commons but is not affiliated with the Wikimedia Foundation.'
          }
        ]
      },
      uk: {
        ...localeFacts('timler', 'uk'),
        metaTitle: 'Timler — вгадай рік фотографії онлайн',
        metaDescription:
          'Історична вікторина за фотографіями й живописом: вгадайте, коли знято кадр або написано картину. Соло й компанією до 20 гравців.',
        intro: [
          'Timler — вікторина за старими й новими фотографіями. Усім показують той самий знімок, а ви називаєте, коли його зроблено: рік — обов’язково, день і місяць — якщо знаєте.',
          'Фотографії — від перших дагеротипів 1840-х до подій цього року: вулиці, люди, техніка, події. Що ближча відповідь до справжньої дати, то більше очок.',
          'Є й режим живопису: картини від Відродження до авангарду, за епохами — окремо або впереміш із фото.',
          'Грати можна самому або компанією до двадцяти людей. Після кожного раунду відповіді всіх стають на спільну шкалу часу — одразу видно, хто був ближче.'
        ],
        howToPlay: [
          'Оберіть, що вгадуєте, — фото, живопис або все разом, — епоху (або весь час), складність, кількість раундів і час на раунд.',
          'Роздивіться фото: одяг, машини, вивіски, якість знімка — усе підказує час.',
          'Оберіть рік повзунком, кнопками або впишіть його. Якщо впевнені — додайте день і місяць.',
          'Натисніть «Відповісти». Раунд закінчується, коли відповіли всі або вийшов час.',
          'Після раунду — шкала з відповідями всіх, правильна дата й розповідь про знімок.',
          'Після всіх раундів порівняйте підсумкові очки із суперниками.'
        ],
        features: [
          'Справжні історичні фотографії з відкритих архівів',
          'Рік або точна дата — кожен вирішує сам',
          'Шкала з відповідями всіх гравців після раунду',
          'Соло й мультиплеєр до двадцяти гравців',
          'Епохи від XIX століття до наших днів і три рівні складності',
          'Режим живопису: картини з XIV століття до 1945 року',
          'Режим 18+ — за бажанням, у додаткових налаштуваннях'
        ],
        strategy: [
          'Дивіться на техніку: моделі машин, телефони, літаки дають десятиліття найточніше.',
          'Колір і якість знімка — підказка: ранні фото коричневі й розмиті, колір масово з’являється після 1950-х.',
          'Одяг і зачіски змінюються швидко — капелюхи, довжина спідниць, ширина штанів.',
          'Додавайте день, лише якщо впізнали подію: дата — це ставка, навмання вона в середньому забирає очки.',
          'У живопису дивіться на манеру: пласкі золоті тла — до Відродження, різке світло з темряви — бароко, мазки плямами — імпресіонізм.'
        ],
        mistakes: [
          'Тягнуть до останньої секунди — очки за час тануть від найпершої.',
          'Ставлять дату навмання: промах на місяць уже в мінусі.',
          'Забувають натиснути «Відповісти» — без відповіді раунд приносить нуль.'
        ],
        faq: [
          {
            q: 'Звідки беруться фотографії?',
            a: 'З Wikimedia Commons і Вікіданих: туди передали знімки музеї, бібліотеки й архіви — Бібліотека Конгресу США, Національний архів Нідерландів, Федеральний архів Німеччини та інші. Фото завантажуються просто із сайтів Wikimedia; після раунду видно автора, ліцензію й посилання на файл.'
          },
          {
            q: 'Чи можна вгадувати картини?',
            a: 'Так. У налаштуваннях оберіть «Живопис» або «Усе разом» — за замовчуванням у грі лише фото. У картин свої епохи: до 1600, 1600–1799, 1800–1899 і 1900–1945. У пулі лише картини, у яких точно відомий рік, без «близько» й «між».'
          },
          {
            q: 'Як рахуються очки?',
            a: 'За точний рік — 1000. Допуск росте з віком знімка: промах на 5 років у фото XIX століття майже нічого не коштує, а у фото останніх років — майже всі очки. Якщо вказати день і місяць, можна отримати до +300 за точну дату або до −100 за промах. Трьом найточнішим — +100, +60 і +30 за місце, а час із першої секунди знімає до 200: хто відповів раніше, втрачає менше.'
          },
          {
            q: 'Що таке режим 18+?',
            a: 'Без нього в грі немає війни, катастроф і оголеної натури. Режим 18+ вмикається в додаткових налаштуваннях і додає такі знімки й картини, а «Лише 18+» залишає тільки їх. Тіл загиблих і страт на фото, крові й тортур немає й там.'
          },
          {
            q: 'Це гра Wikimedia?',
            a: 'Ні. Timler використовує відкриті фотографії та зображення картин із Wikimedia Commons, але не пов’язаний із фондом Вікімедіа.'
          }
        ]
      }
    }
  },
  {
    ...gameFacts('songler'),
    locales: {
      ru: {
        ...localeFacts('songler', 'ru'),
        metaTitle: 'Songler — угадай песню по отрывку',
        metaDescription:
          'Музыкальная викторина: угадайте песню по отрывку в полсекунды — с каждой попыткой он длиннее. 37 категорий, соло и компанией до 20 игроков.',
        intro: [
          'Songler — музыкальная викторина в духе Heardle и Songless. Всем играет одна и та же песня: сначала полсекунды, и если не узнали — отрывок растёт до 1, 2, 4, 8 и 15 секунд.',
          'Песен несколько тысяч: хиты по десятилетиям от 60-х до 2020-х, рок, поп, хип-хоп, электроника, K-pop, латино, джаз, классика, музыка из кино, игр и аниме, Евровидение, а также русская поп-музыка, русский рок и рэп, советская эстрада и украинская музыка.',
          'Играть можно одному или компанией до двадцати человек. Кто узнал песню по самому короткому отрывку и быстрее, получает больше очков.'
        ],
        howToPlay: [
          'Выберите категорию, сложность, число раундов и время на раунд.',
          'Нажмите ▶ и послушайте отрывок — сначала это полсекунды.',
          'Начните вводить название или исполнителя и выберите песню из подсказок.',
          'Не узнали — нажмите «Пропустить»: отрывок станет длиннее. Всего шесть попыток.',
          'После раунда — обложка, название, исполнитель, весь 30-секундный отрывок и результаты всех.',
          'После всех раундов сравните итоговые очки с соперниками.'
        ],
        features: [
          'Отрывки растут: 0,5 → 1 → 2 → 4 → 8 → 15 секунд',
          '37 категорий: десятилетия, жанры, кино, игры, аниме, русская, советская и украинская музыка',
          'Подсказки по мере ввода — из всех песен игры',
          'Соло и мультиплеер до двадцати игроков',
          'Три уровня сложности по популярности песен',
          'Таблица лидеров и свои достижения'
        ],
        strategy: [
          'Первые полсекунды — это тембр и аранжировка: голос, гитара, синтезатор. Часто этого хватает, чтобы понять эпоху и исполнителя.',
          'Не уверены в песне, но узнали исполнителя — назовите его самую известную песню: если это не она, вы хотя бы получите утешительные очки.',
          'Пропуск стоит только очков за попытку: лучше послушать подольше, чем гадать вслепую.',
          'Отрывок — обычно середина песни или припев, а не самое начало: вспоминайте припевы.'
        ],
        mistakes: [
          'Тянут время — очки тают с первой секунды.',
          'Ищут песню по неточному названию: попробуйте ввести исполнителя — подсказки найдут песню и по нему.',
          'Сдаются раньше времени: даже на последней попытке песня приносит 100 очков.'
        ],
        faq: [
          {
            q: 'Откуда берутся песни?',
            a: 'Из Deezer: редакторские плейлисты по десятилетиям и жанрам и самые популярные треки известных исполнителей. Отрывки — 30-секундные превью Deezer, они загружаются прямо с его серверов.'
          },
          {
            q: 'Почему отрывок не с самого начала песни?',
            a: 'Превью, которые Deezer разрешает показывать, — это 30 секунд, которые выбрал сам сервис, обычно середина или припев. Песню целиком с первой секунды без подписки показать нельзя.'
          },
          {
            q: 'Как считаются очки?',
            a: 'Угадали с первой попытки — 1000, дальше 800, 600, 400, 250 и 100. Назвали другую песню того же исполнителя, но не угадали — 100 утешительных. Трём лучшим — +100, +60 и +30 за место, а время с первой секунды снимает до 200.'
          },
          {
            q: 'Это игра Deezer?',
            a: 'Нет. Songler использует открытый API и превью Deezer, но не связан с Deezer.'
          }
        ]
      },
      en: {
        ...localeFacts('songler', 'en'),
        metaTitle: 'Songler — name the song from a snippet',
        metaDescription:
          'A music quiz: name the song from half a second of it — every try makes the snippet longer. 37 categories, solo or with up to 20 players.',
        intro: [
          'Songler is a music quiz in the spirit of Heardle and Songless. Everyone hears the same song: half a second at first, and if nobody knows it the snippet grows to 1, 2, 4, 8 and 15 seconds.',
          'There are thousands of songs: hits by decade from the 1960s to the 2020s, rock, pop, hip-hop, electronic, K-pop, Latin, jazz, classical, film, game and anime music, Eurovision, plus Russian pop, Russian rock and rap, Soviet pop and Ukrainian music.',
          'Play alone or with up to twenty people. Whoever knew the song from the shortest snippet, and fastest, scores the most.'
        ],
        howToPlay: [
          'Pick a category, a difficulty, the number of rounds and the time per round.',
          'Press ▶ to hear the snippet — half a second at first.',
          'Start typing the title or the artist and pick the song from the suggestions.',
          'No idea? Press Skip and the snippet grows. Six tries in all.',
          'After the round: the cover, title, artist, the whole 30-second preview and everyone’s results.',
          'After the final round, compare your total with everyone else.'
        ],
        features: [
          'Growing snippets: 0.5 → 1 → 2 → 4 → 8 → 15 seconds',
          '37 categories: decades, genres, film, games, anime, Russian, Soviet and Ukrainian music',
          'Suggestions as you type, from every song in the game',
          'Solo and multiplayer for up to twenty',
          'Three difficulties by how popular the songs are',
          'A live leaderboard and achievements of its own'
        ],
        strategy: [
          'The first half second is the sound: the voice, the guitar, the synth. It often gives away the era and the artist.',
          'Not sure of the song but you know the artist? Name their best-known one: if it is not that, you still get a consolation.',
          'A skip costs only the points of the try — better to hear more than to guess blind.',
          'The snippet is usually the middle of the song or the chorus, not its start: think choruses.'
        ],
        mistakes: [
          'Waiting — points melt from the first second.',
          'Searching for a half-remembered title: type the artist instead, the suggestions find the song by it too.',
          'Giving up early: even the last try is worth 100.'
        ],
        faq: [
          {
            q: 'Where do the songs come from?',
            a: 'From Deezer: its editors’ playlists by decade and genre, and the most played tracks of well-known artists. The snippets are Deezer’s 30-second previews, loaded straight from its servers.'
          },
          {
            q: 'Why does the snippet not start at the very beginning?',
            a: 'The previews Deezer allows others to play are 30 seconds it picks itself — usually the middle or the chorus. A whole song from its first second cannot be played without a subscription.'
          },
          {
            q: 'How is the score calculated?',
            a: 'Named on the first try — 1,000, then 800, 600, 400, 250 and 100. Named another song by the same artist but never this one — 100 as a consolation. The best three get +100, +60 and +30 for their place, and time costs up to 200 from the first second.'
          },
          {
            q: 'Is this a Deezer game?',
            a: 'No. Songler uses Deezer’s open API and previews but is not affiliated with Deezer.'
          }
        ]
      },
      uk: {
        ...localeFacts('songler', 'uk'),
        metaTitle: 'Songler — вгадай пісню за уривком',
        metaDescription:
          'Музична вікторина: вгадайте пісню за уривком у пів секунди — з кожною спробою він довшає. 37 категорій, соло й компанією до 20 гравців.',
        intro: [
          'Songler — музична вікторина в дусі Heardle і Songless. Усім грає та сама пісня: спершу пів секунди, і якщо не впізнали — уривок росте до 1, 2, 4, 8 і 15 секунд.',
          'Пісень кілька тисяч: хіти за десятиліттями від 60-х до 2020-х, рок, поп, хіп-хоп, електроніка, K-pop, латино, джаз, класика, музика з кіно, ігор і аніме, Євробачення, а також російська поп-музика, російський рок і реп, радянська естрада та українська музика.',
          'Грати можна самому або компанією до двадцяти людей. Хто впізнав пісню за найкоротшим уривком і швидше, отримує більше очок.'
        ],
        howToPlay: [
          'Оберіть категорію, складність, кількість раундів і час на раунд.',
          'Натисніть ▶ і послухайте уривок — спершу це пів секунди.',
          'Почніть вводити назву або виконавця й оберіть пісню з підказок.',
          'Не впізнали — натисніть «Пропустити»: уривок стане довшим. Усього шість спроб.',
          'Після раунду — обкладинка, назва, виконавець, увесь 30-секундний уривок і результати всіх.',
          'Після всіх раундів порівняйте підсумкові очки із суперниками.'
        ],
        features: [
          'Уривки ростуть: 0,5 → 1 → 2 → 4 → 8 → 15 секунд',
          '37 категорій: десятиліття, жанри, кіно, ігри, аніме, російська, радянська та українська музика',
          'Підказки під час введення — з усіх пісень гри',
          'Соло й мультиплеєр до двадцяти гравців',
          'Три рівні складності за популярністю пісень',
          'Таблиця лідерів і свої досягнення'
        ],
        strategy: [
          'Перші пів секунди — це тембр і аранжування: голос, гітара, синтезатор. Часто цього досить, щоб зрозуміти епоху й виконавця.',
          'Не впевнені в пісні, але впізнали виконавця, — назвіть його найвідомішу пісню: якщо це не вона, ви принаймні отримаєте втішні очки.',
          'Пропуск коштує лише очок за спробу: краще послухати довше, ніж гадати наосліп.',
          'Уривок — зазвичай середина пісні або приспів, а не самий початок: згадуйте приспіви.'
        ],
        mistakes: [
          'Тягнуть час — очки тануть із першої секунди.',
          'Шукають пісню за неточною назвою: спробуйте ввести виконавця — підказки знайдуть пісню й за ним.',
          'Здаються завчасно: навіть на останній спробі пісня приносить 100 очок.'
        ],
        faq: [
          {
            q: 'Звідки беруться пісні?',
            a: 'З Deezer: редакторські плейлисти за десятиліттями й жанрами та найпопулярніші треки відомих виконавців. Уривки — 30-секундні превʼю Deezer, вони завантажуються просто з його серверів.'
          },
          {
            q: 'Чому уривок не з самого початку пісні?',
            a: 'Превʼю, які Deezer дозволяє показувати, — це 30 секунд, які обрав сам сервіс, зазвичай середина або приспів. Пісню повністю з першої секунди без підписки показати не можна.'
          },
          {
            q: 'Як рахуються очки?',
            a: 'Вгадали з першої спроби — 1000, далі 800, 600, 400, 250 і 100. Назвали іншу пісню того самого виконавця, але не вгадали — 100 утішних. Трьом найкращим — +100, +60 і +30 за місце, а час із першої секунди знімає до 200.'
          },
          {
            q: 'Це гра Deezer?',
            a: 'Ні. Songler використовує відкритий API і превʼю Deezer, але не пов’язаний із Deezer.'
          }
        ]
      }
    }
  },
];

/**
 * When the public copy in this file last actually changed (YYYY-MM-DD).
 *
 * This is the sitemap's `lastmod`. It must NOT be a build timestamp: stamping
 * every URL with "now" on each deploy claims the whole site changed whenever
 * anything ships, and search engines respond by ignoring the field. Bump this
 * by hand when the wording, the games or the FAQs change — not for styling or
 * unrelated code.
 */
export const CONTENT_REVISION = '2026-10-07';

/** Every public game slug, in the order they should appear on the hub page. */
export const GAME_SLUGS = GAMES_CONTENT.map((g) => g.slug);

/** Look up a game by slug; returns undefined for unknown slugs (→ notFound). */
export const getGameContent = (slug: string): GameContent | undefined =>
  GAMES_CONTENT.find((g) => g.slug === slug);

/* -------------------------------------------------------------------------- */
/* Page-level copy                                                            */
/*                                                                            */
/* The root and the hub deliberately say different things. `/` explains the   */
/* platform — what it is, how a room works, why nothing is installed. `/games`*/
/* helps you choose between the five. Giving them the same text would make    */
/* two of our own pages compete for the same query.                           */
/* -------------------------------------------------------------------------- */

export interface PageSection {
  title: string;
  body: string;
}

export interface HomeCopy {
  heroTitle: string;
  heroLead: string;
  about: string[];
  steps: PageSection[];
  faq: GameFaq[];
  gamesTitle: string;
  gamesLead: string;
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
}

export interface HubCopy {
  intro: string[];
  chooseTitle: string;
  choose: PageSection[];
  faq: GameFaq[];
}

export const HOME_CONTENT: Record<Locale, HomeCopy> = {
  ru: {
    heroTitle: 'Игры с друзьями прямо в браузере',
    heroLead: GAME_COUNT_COPY.ru.heroLead,
    about: [
      'Darhaal Games — платформа для тех вечеров, когда все в разных городах, а поиграть вместе хочется. Здесь нет лаунчеров, установки и обязательных аккаунтов: игра живёт по ссылке, которую можно просто кинуть в чат.',
      'Каждая комната — это отдельная партия со своими настройками. Хост выбирает игру, число игроков, длительность раунда и при желании ставит пароль. Остальные заходят по ссылке или по шестизначному коду.',
      'Партии рассчитаны на 10–15 минут: столько, чтобы успеть сыграть в перерыве или несколько раз подряд за вечер. Прогресс, статистика и достижения сохраняются, если войти в аккаунт, но попробовать можно и гостем.'
    ],
    gamesTitle: 'Во что можно сыграть',
    gamesLead: GAME_COUNT_COPY.ru.gamesLead,
    steps: [
      {
        title: 'Создайте комнату',
        body: 'Выберите игру и настройте партию: сколько игроков, сколько длится раунд, нужен ли пароль. На всё уходит несколько секунд.'
      },
      {
        title: 'Позовите друзей',
        body: 'Скопируйте ссылку на комнату или продиктуйте шестизначный код. Присоединиться можно и тем, и другим способом, с телефона или компьютера.'
      },
      {
        title: 'Играйте',
        body: 'Партия синхронизируется в реальном времени: ходы, таймеры и результаты видны всем сразу. Отключившийся игрок успевает вернуться, прежде чем его исключат.'
      }
    ],
    ctaTitle: 'Готовы начать?',
    ctaText: 'Создайте комнату за пару секунд и позовите друзей по ссылке.',
    ctaButton: 'Играть',
    faq: [
      {
        q: 'Нужно ли регистрироваться, чтобы поиграть?',
        a: 'Нет. Гостевой вход открывает все игры сразу. Аккаунт нужен только чтобы сохранять статистику, достижения и свою аватарку.'
      },
      {
        q: 'Нужно ли что-то скачивать?',
        a: 'Нет. Всё работает в браузере на компьютере и телефоне — устанавливать ничего не требуется.'
      },
      {
        q: 'Сколько человек можно позвать?',
        a: 'Зависит от игры: Морской бой и Реверси рассчитаны на двоих; Сапёр, Стены и «Точки и квадраты» — до четырёх; Переворот — до шести; Шпион — до двенадцати; Флагер, Wikiler, Timler и Songler — до двадцати.'
      },
      {
        q: 'Это бесплатно?',
        a: 'Да, все игры бесплатны и без рекламы внутри партии.'
      },
      {
        q: 'Как пригласить друга в уже созданную комнату?',
        a: 'Отправьте ему ссылку на комнату или продиктуйте её код — он попадёт сразу в вашу партию.'
      },
      {
        q: 'Кто делает Darhaal Games?',
        a: 'Артем Охтень, украинский разработчик с ником Darhaal — отсюда и название. Юридически платформа принадлежит студии Okhten Group LLC, а исходный код открыт для чтения на GitHub.'
      }
    ]
  },
  en: {
    heroTitle: 'Play with friends right in the browser',
    heroLead: GAME_COUNT_COPY.en.heroLead,
    about: [
      'Darhaal Games is for the evenings when everyone is in a different city and you still want to play together. No launchers, no installs, no mandatory accounts: a game lives behind a link you can paste into a chat.',
      'Each room is its own match with its own settings. The host picks the game, the player count, the round length, and optionally a password. Everyone else joins by link or by a six-character code.',
      'Matches run 10–15 minutes — long enough to fit into a break, short enough to play several in an evening. Stats and achievements are saved once you sign in, but you can try everything as a guest first.'
    ],
    gamesTitle: 'What you can play',
    gamesLead: GAME_COUNT_COPY.en.gamesLead,
    steps: [
      {
        title: 'Create a room',
        body: 'Pick a game and set the match up: how many players, how long a round lasts, whether it needs a password. It takes seconds.'
      },
      {
        title: 'Invite your friends',
        body: 'Copy the room link or read out the six-character code. Either one works, from a phone or a desktop.'
      },
      {
        title: 'Play',
        body: 'The match syncs in real time: moves, timers and results appear for everyone at once. A player who drops out has time to reconnect before being removed.'
      }
    ],
    ctaTitle: 'Ready to play?',
    ctaText: 'Create a room in seconds and invite your friends with a link.',
    ctaButton: 'Play',
    faq: [
      {
        q: 'Do I need an account to play?',
        a: 'No. Guest sign-in opens every game immediately. An account only matters if you want your statistics, achievements and custom avatar saved.'
      },
      {
        q: 'Is there anything to download?',
        a: 'No. Everything runs in the browser on desktop and mobile, with nothing to install.'
      },
      {
        q: 'How many people can join?',
        a: 'It depends on the game: Battleship and Reversi are for two; Minesweeper, Wall Rush and Dots & Boxes take up to four; Coup up to six; Spyfall up to twelve; and Flager, Wikiler, Timler and Songler up to twenty.'
      },
      {
        q: 'Is it free?',
        a: 'Yes, every game is free and there are no ads inside a match.'
      },
      {
        q: 'How do I invite someone to a room I already made?',
        a: 'Send them the room link or read out its code — they land straight in your match.'
      },
      {
        q: 'Who makes Darhaal Games?',
        a: 'Artem Okhten, a Ukrainian developer — Darhaal is the handle, hence the name. The platform belongs to the studio Okhten Group LLC, and the source code is published on GitHub for anyone to read.'
      }
    ]
  },
  uk: {
    heroTitle: 'Ігри з друзями просто в браузері',
    heroLead: GAME_COUNT_COPY.uk.heroLead,
    about: [
      'Darhaal Games — платформа для тих вечорів, коли всі в різних містах, а пограти разом хочеться. Тут немає лаунчерів, встановлення й обов’язкових акаунтів: гра живе за посиланням, яке можна просто кинути в чат.',
      'Кожна кімната — це окрема партія зі своїми налаштуваннями. Хост обирає гру, кількість гравців, тривалість раунду й за бажання ставить пароль. Решта заходять за посиланням або за шестизначним кодом.',
      'Партії розраховані на 10–15 хвилин: стільки, щоб устигнути зіграти на перерві або кілька разів поспіль за вечір. Прогрес, статистика й досягнення зберігаються, якщо увійти в акаунт, але спробувати можна й гостем.'
    ],
    gamesTitle: 'У що можна зіграти',
    gamesLead: GAME_COUNT_COPY.uk.gamesLead,
    steps: [
      {
        title: 'Створіть кімнату',
        body: 'Оберіть гру й налаштуйте партію: скільки гравців, скільки триває раунд, чи потрібен пароль. На все йде кілька секунд.'
      },
      {
        title: 'Покличте друзів',
        body: 'Скопіюйте посилання на кімнату або продиктуйте шестизначний код. Приєднатися можна і так, і так, із телефона чи комп’ютера.'
      },
      {
        title: 'Грайте',
        body: 'Партія синхронізується в реальному часі: ходи, таймери й результати видно всім одразу. Гравець, що відключився, встигає повернутися, перш ніж його виключать.'
      }
    ],
    ctaTitle: 'Готові почати?',
    ctaText: 'Створіть кімнату за кілька секунд і покличте друзів за посиланням.',
    ctaButton: 'Грати',
    faq: [
      {
        q: 'Чи потрібно реєструватися, щоб пограти?',
        a: 'Ні. Гостьовий вхід відкриває всі ігри одразу. Акаунт потрібен лише для того, щоб зберігати статистику, досягнення й свою аватарку.'
      },
      {
        q: 'Чи потрібно щось завантажувати?',
        a: 'Ні. Усе працює в браузері на комп’ютері й телефоні — встановлювати нічого не потрібно.'
      },
      {
        q: 'Скільки людей можна покликати?',
        a: 'Залежить від гри: Морський бій і Реверсі розраховані на двох; Сапер, Стіни й «Точки й квадрати» — до чотирьох; Переворот — до шести; Шпигун — до дванадцяти; Флагер, Wikiler, Timler і Songler — до двадцяти.'
      },
      {
        q: 'Це безкоштовно?',
        a: 'Так, усі ігри безкоштовні й без реклами всередині партії.'
      },
      {
        q: 'Як запросити друга у вже створену кімнату?',
        a: 'Надішліть йому посилання на кімнату або продиктуйте її код — він потрапить одразу у вашу партію.'
      },
      {
        q: 'Хто робить Darhaal Games?',
        a: 'Артем Охтень, український розробник із ніком Darhaal — звідси й назва. Юридично платформа належить студії Okhten Group LLC, а вихідний код відкритий для читання на GitHub.'
      }
    ]
  }
};

export const HUB_CONTENT: Record<Locale, HubCopy> = {
  ru: {
    intro: [
      GAME_COUNT_COPY.ru.hubIntro,
      'Ниже — короткая подсказка, что выбрать под конкретную ситуацию, а на странице каждой игры есть подробные правила, тактика и разбор частых ошибок.'
    ],
    chooseTitle: 'Что выбрать',
    choose: [
      {
        title: 'Большой компанией',
        body: 'Шпион — единственная игра здесь, которая тем лучше, чем больше людей: от пяти до двенадцати. Ей не нужна ни реакция, ни знания, только разговор, поэтому играть могут все сразу и вперемешку по возрасту.'
      },
      {
        title: 'Вдвоём',
        body: 'Морской бой — классическая дуэль на двоих, где всё решает расстановка флота и порядок обстрела. Переворот тоже играется вдвоём, но раскрывается в компании от четырёх.'
      },
      {
        title: 'Когда хочется соревнования на скорость',
        body: 'Сапёр и Флагер дают всем одинаковые условия и сравнивают результат. В Сапёре у каждого своё поле, но одинаково сгенерированное; во Флагере — общая цепочка флагов и общий таймер.'
      },
      {
        title: 'В одиночку',
        body: 'Сапёр и Флагер работают и без соперников: первый как классическая головоломка, второй как тренировка географии. Результат записывается в личную статистику отдельно от мультиплеера.'
      },
      {
        title: 'Если есть только десять минут',
        body: 'Партия в Шпиона или Флагера укладывается примерно в десять минут. Переворот и Морской бой чуть длиннее — рассчитывайте на четверть часа.'
      }
    ],
    faq: [
      {
        q: 'С какой игры начать, если никто ни во что не играл?',
        a: 'С Шпиона: правила объясняются за минуту, не нужно ничего уметь, и партия идёт сама собой за счёт разговора.'
      },
      {
        q: 'Можно ли играть с телефона?',
        a: 'Да, все игры работают в мобильном браузере. Сапёр и Морской бой удобнее на большом экране, остальные одинаково хороши везде.'
      },
      {
        q: 'Что будет, если игрок отключится посреди партии?',
        a: 'У него есть время вернуться — платформа отслеживает присутствие и исключает только после паузы. В играх с ходами очередь при этом не застревает.'
      },
      {
        q: 'Можно ли закрыть комнату от посторонних?',
        a: 'Да, при создании включите приватность и задайте пароль. Такая комната остаётся в списке, но войти в неё можно только с паролем.'
      }
    ]
  },
  en: {
    intro: [
      GAME_COUNT_COPY.en.hubIntro,
      'Below is a short guide to picking one for the situation you are actually in. Each game page then covers the full rules, tactics and the mistakes people usually make.'
    ],
    chooseTitle: 'Which one to pick',
    choose: [
      {
        title: 'For a large group',
        body: 'Spyfall is the only game here that gets better the more people join — five to twelve. It needs no reflexes and no knowledge, just conversation, so a mixed group can all play at once.'
      },
      {
        title: 'For two',
        body: 'Battleship is the classic duel, decided by how you lay out the fleet and how you search. Coup also works with two, though it comes alive from four upwards.'
      },
      {
        title: 'When you want a race',
        body: 'Minesweeper and Flager give everyone identical conditions and compare the result. In Minesweeper each player has their own grid, generated the same; in Flager everyone shares one chain of flags and one clock.'
      },
      {
        title: 'On your own',
        body: 'Minesweeper and Flager both work without opponents — one as the classic puzzle, the other as geography practice. Solo results are tracked separately from multiplayer.'
      },
      {
        title: 'If you only have ten minutes',
        body: 'A round of Spyfall or Flager fits into roughly ten minutes. Coup and Battleship run a little longer — plan for about fifteen.'
      }
    ],
    faq: [
      {
        q: 'Which game should a group of complete beginners start with?',
        a: 'Spyfall. The rules take a minute to explain, no skill is required, and the conversation carries the match on its own.'
      },
      {
        q: 'Can I play on a phone?',
        a: 'Yes, every game runs in a mobile browser. Minesweeper and Battleship are more comfortable on a large screen; the rest play equally well anywhere.'
      },
      {
        q: 'What happens if someone disconnects mid-match?',
        a: 'They get time to come back — the platform tracks presence and only removes a player after a grace period. In turn-based games the turn order does not stall meanwhile.'
      },
      {
        q: 'Can a room be closed to strangers?',
        a: 'Yes. Enable privacy when creating it and set a password. The room still appears in the list, but only someone with the password can enter.'
      }
    ]
  },
  uk: {
    intro: [
      GAME_COUNT_COPY.uk.hubIntro,
      'Нижче — коротка підказка, що обрати для конкретної ситуації, а на сторінці кожної гри є докладні правила, тактика й розбір частих помилок.'
    ],
    chooseTitle: 'Що обрати',
    choose: [
      {
        title: 'Великою компанією',
        body: 'Шпигун — єдина гра тут, яка тим краща, чим більше людей: від п’яти до дванадцяти. Їй не потрібна ні реакція, ні знання, лише розмова, тому грати можуть усі одразу й упереміш за віком.'
      },
      {
        title: 'Удвох',
        body: 'Морський бій — класична дуель на двох, де все вирішують розставлення флоту й порядок обстрілу. Переворот теж грається вдвох, але розкривається в компанії від чотирьох.'
      },
      {
        title: 'Коли хочеться змагання на швидкість',
        body: 'Сапер і Флагер дають усім однакові умови й порівнюють результат. У Сапері в кожного своє поле, але однаково згенероване; у Флагері — спільний ланцюжок прапорів і спільний таймер.'
      },
      {
        title: 'Самому',
        body: 'Сапер і Флагер працюють і без суперників: перший — як класична головоломка, другий — як тренування географії. Результат записується в особисту статистику окремо від мультиплеєра.'
      },
      {
        title: 'Якщо є лише десять хвилин',
        body: 'Партія в Шпигуна або Флагера вкладається приблизно в десять хвилин. Переворот і Морський бій трохи довші — розраховуйте на чверть години.'
      }
    ],
    faq: [
      {
        q: 'З якої гри почати, якщо ніхто ні в що не грав?',
        a: 'Зі Шпигуна: правила пояснюються за хвилину, не треба нічого вміти, і партія йде сама собою завдяки розмові.'
      },
      {
        q: 'Чи можна грати з телефона?',
        a: 'Так, усі ігри працюють у мобільному браузері. Сапер і Морський бій зручніші на великому екрані, решта однаково гарні всюди.'
      },
      {
        q: 'Що буде, якщо гравець відключиться посеред партії?',
        a: 'У нього є час повернутися — платформа стежить за присутністю й виключає лише після паузи. В іграх із ходами черга при цьому не застрягає.'
      },
      {
        q: 'Чи можна закрити кімнату від сторонніх?',
        a: 'Так, під час створення увімкніть приватність і задайте пароль. Така кімната залишається в списку, але ввійти в неї можна лише з паролем.'
      }
    ]
  }
};
