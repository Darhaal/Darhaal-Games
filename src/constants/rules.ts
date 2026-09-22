import { Target, Zap, Shield, Trophy, MousePointer2, Eye, Flag, Ship, RefreshCw, Crosshair, AlertTriangle, Search, Clock, Grid, Map as MapIcon } from 'lucide-react';
import { GameRulesData } from '@/components/GameRulesModal';
import type { GameId, Locale } from '@/games/registry';

/**
 * In-game rulebooks, one per game per language.
 *
 * Keyed by `GameId` rather than `string` on purpose: a new game now fails the
 * type check here until both languages are written, instead of shipping with a
 * rules button that opens an empty dialog.
 */
export const GAME_RULES: Record<Locale, Record<GameId, GameRulesData>> = {
  ru: {
    battleship: {
      title: 'Морской Бой',
      description: 'Стратегическое морское сражение',
      sections: [
        {
          title: 'Цель игры',
          icon: Trophy,
          content: 'Ваша главная задача — обнаружить и уничтожить флотилию противника раньше, чем он уничтожит вашу. Побеждает тот, кто первым пустит ко дну все 10 кораблей соперника. Игра ведется до полного уничтожения флота одного из игроков.',
          type: 'text'
        },
        {
          title: 'Состав флота',
          icon: Ship,
          content: [
            '1x Линкор (4 клетки) — самый большой и ценный корабль, основа вашей мощи.',
            '2x Крейсера (3 клетки) — универсальные боевые единицы.',
            '3x Эсминца (2 клетки) — маневренные корабли поддержки.',
            '4x Подлодки (1 клетка) — их сложнее всего найти на карте.'
          ],
          type: 'list'
        },
        {
          title: 'Правила расстановки',
          icon: MapIcon,
          content: [
            'Расстановка: перетащите корабль с верфи на поле — или выберите его кликом и кликните по клетке. Клик по уже поставленному кораблю берёт его обратно.',
            'Поворот: клавиша R / Пробел / Q, правый клик по полю или кнопка поворота. Кнопка «Авто» расставит флот случайно.',
            'ВАЖНОЕ ПРАВИЛО: между кораблями должно быть расстояние минимум в одну клетку. Они не могут касаться друг друга даже углами.'
          ],
          type: 'list'
        },
        {
          title: 'Ход сражения',
          icon: Crosshair,
          content: [
            'Стрельба ведется по очереди. На каждый выстрел дается 60 секунд.',
            'ПОПАДАНИЕ (X): Если вы попали в корабль, вы получаете право на ДОПОЛНИТЕЛЬНЫЙ ХОД. Продолжайте стрелять, пока не промахнетесь.',
            'ПРОМАХ (•): Если выстрел пришелся в пустую клетку, ход переходит к сопернику.',
            'УНИЧТОЖЕНИЕ (☠): Когда все палубы корабля подбиты, он считается уничтоженным. Клетки вокруг него (ореол) автоматически помечаются как "Мимо", так как по правилам там не может быть других кораблей.'
          ],
          type: 'list'
        }
      ]
    },
    coup: {
      title: 'Переворот (Coup)',
      description: 'Игра на блеф, интриги и дедукцию',
      sections: [
        {
          title: 'Суть игры',
          icon: Trophy,
          content: 'Вы — глава влиятельной семьи в коррумпированном городе-государстве. Ваша цель — уничтожить влияние других семей и остаться единственным выжившим. Ваше влияние — это карты персонажей (роли), которые лежат перед вами рубашкой вверх.',
          type: 'text'
        },
        {
          title: 'Ресурсы и Жизни',
          icon: Shield,
          content: [
            'Каждый игрок начинает игру с 2 картами (ролями) и 2 монетами.',
            'Одна карта = Одна жизнь. Потеряв влияние (жизнь), вы обязаны открыть одну из своих карт. Открытая карта выбывает из игры.',
            'Потеряв обе карты, вы выбываете из игры.',
            'Монеты нужны для оплаты сильных действий, таких как Убийство или Переворот.'
          ],
          type: 'list'
        },
        {
          title: 'Роли и Действия',
          icon: Zap,
          content: [
            'ГЕРЦОГ (Duke): Может брать "Налог" (+3 монеты). Блокирует "Иностранную помощь" другим игрокам.',
            'АССАСИН (Assassin): Платит 3 монеты, чтобы заставить жертву потерять карту. Блокируется Графиней.',
            'КАПИТАН (Captain): Крадет 2 монеты у другого игрока. Блокируется другим Капитаном или Послом.',
            'ПОСОЛ (Ambassador): Берет 2 карты из колоды, меняет их на свои (или оставляет свои). Блокирует Кражу.',
            'ГРАФИНЯ (Contessa): Не имеет активного действия, но блокирует попытку Убийства против себя.',
            'ОБЩИЕ ДЕЙСТВИЯ: Доход (+1 монета, нельзя блокировать), Иностр. помощь (+2 монеты, блок Герцогом), Переворот (-7 монет, гарантированное убийство карты, нельзя блокировать).'
          ],
          type: 'list'
        },
        {
          title: 'Искусство Блефа',
          icon: Eye,
          content: 'Это главное правило игры! Вы можете объявить ЛЮБОЕ действие, даже если у вас нет соответствующей карты. Например, сказать "Я Герцог" и взять 3 монеты, имея на руках двух Ассасинов. Но любой игрок может сказать "НЕ ВЕРЮ!" (Challenge). Если вас поймали на лжи — вы теряете карту. Если вы говорили правду (и показали карту) — карту теряет тот, кто вам не поверил (а вы берете новую карту из колоды).',
          type: 'text'
        }
      ]
    },
    minesweeper: {
      title: 'Сапер',
      description: 'Гонка на выживание и логику',
      sections: [
        {
          title: 'Задача',
          icon: Trophy,
          content: 'Очистить минное поле быстрее соперников. В этом режиме игра идет не просто на очки, а на скорость и выживание. Победит тот, кто первым откроет все безопасные клетки или останется единственным "живым" игроком, если остальные подорвутся.',
          type: 'text'
        },
        {
          title: 'Механика',
          icon: Shield,
          content: [
            'Цифра в клетке (1-8) показывает количество мин в радиусе 3x3 вокруг неё.',
            'Если мин вокруг нет, клетка пустая, и откроется целая безопасная область.',
            'Первый клик всегда безопасен — мины генерируются после первого хода, так что смело начинайте!',
            'Ошибка фатальна: нажав на мину, вы немедленно выбываете из раунда.'
          ],
          type: 'list'
        },
        {
          title: 'Управление (PRO)',
          icon: MousePointer2,
          content: [
            'ЛКМ: открыть клетку.',
            'ПКМ (или долгое нажатие на телефоне): поставить/снять флаг.',
            'АККОРД: клик по открытой цифре (или СКМ). Если вокруг цифры стоит ровно столько флагов, сколько она показывает, мгновенно откроются все остальные клетки вокруг. Главный инструмент скоростной игры!',
            'Навигация по большому полю: зажмите ЛКМ и тяните для панорамирования, WASD — перемещение, «+»/«−» или кнопки лупы — масштаб.'
          ],
          type: 'list'
        },
        {
          title: 'Мультиплеер',
          icon: Clock,
          content: 'Все игроки начинают одновременно на одинаковых картах. Вы видите прогресс соперников в реальном времени (проценты). Если все соперники подорвались на минах, вы автоматически побеждаете как "Последний герой".',
          type: 'text'
        }
      ]
    },
    flager: {
      title: 'Флагер',
      description: 'Викторина с механикой Pixel Match',
      sections: [
        {
          title: 'Как это работает',
          icon: Flag,
          content: 'Вам загадан флаг страны, который скрыт под "шумом". Ваша задача — угадать страну. Но вы не обязаны угадать с первой попытки! В игре используется уникальная механика "Частичного совпадения" (Pixel Match).',
          type: 'text'
        },
        {
          title: 'Pixel Match',
          icon: Target,
          content: 'Вводите названия ЛЮБЫХ стран. Система наложит флаг введенной вами страны на загаданный. Если в какой-то точке пиксели совпадут по цвету — эта часть картинки проявится на экране. Пример: Загадан флаг Франции (Синий-Белый-Красный). Вы вводите "Италия" (Зеленый-Белый-Красный). Белая и Красная полосы совпадут и откроются!',
          type: 'text'
        },
        {
          title: 'Начисление очков',
          icon: Trophy,
          content: [
            'Стартовый банк: 1000 очков в начале раунда.',
            'Штраф за попытку: -50 очков за каждую неверную догадку.',
            'Штраф за время: -10 очков за каждую прошедшую секунду.',
            'Лимит: 10 попыток на раунд.',
            'Цель: Угадать максимально быстро и с минимальным количеством попыток, чтобы сохранить как можно больше очков.'
          ],
          type: 'list'
        },
        {
          title: 'Совет',
          icon: Search,
          content: 'Начинайте с "разноцветных" флагов (например, ЮАР, Сейшелы, ЦАР), чтобы "просканировать" сразу много цветов и понять структуру загаданного флага.',
          type: 'text'
        }
      ]
    },
    spyfall: {
      title: 'Находка для шпиона',
      description: 'Социальная дедукция и разговорный жанр',
      sections: [
        {
          title: 'Сюжет',
          icon: Eye,
          content: 'Все игроки находятся в одной локации (например, "Океанский лайнер", "Полярная станция" или "Театр"). Все знают, где они, кроме одного человека — Шпиона. Шпион видит в своей карте надпись "НЕИЗВЕСТНО".',
          type: 'text'
        },
        {
          title: 'Геймплей',
          icon: RefreshCw,
          content: 'Запускается таймер. Игроки начинают задавать друг другу вопросы по кругу или хаотично. Задача Мирных — по ответам вычислить того, кто не понимает, о чем речь и плавает в деталях. Задача Шпиона — внимательно слушать, анализировать вопросы и ответы, чтобы понять, где он находится, при этом отвечая так, чтобы не вызвать подозрений.',
          type: 'text'
        },
        {
          title: 'Условия победы',
          icon: Trophy,
          content: [
            'ШПИОН ПОБЕЖДАЕТ, ЕСЛИ: 1) Таймер истек, а его не раскрыли. 2) Он нажал кнопку "Назвать локацию" и верно угадал место. 3) Мирные ошиблись и проголосовали против невиновного игрока.',
            'МИРНЫЕ ПОБЕЖДАЮТ, ЕСЛИ: Единогласно проголосуют против реального Шпиона во время фазы обвинения.'
          ],
          type: 'list'
        },
        {
          title: 'Обвинение',
          icon: AlertTriangle,
          content: 'Любой игрок 1 раз за раунд может нажать кнопку "Обвинить". Начинается голосование. Если ВСЕ (кроме обвиняемого) голосуют ЗА — игра заканчивается вердиктом. Если хоть один голосует ПРОТИВ — игра продолжается.',
          type: 'text'
        }
      ]
    },
    wallrush: {
      title: 'Стены',
      description: 'Абстрактная стратегия: гонка и перекрытие путей',
      sections: [
        {
          title: 'Цель',
          icon: Flag,
          content: 'В дуэли и в паре доска 9×9: пешка стоит посередине одного края, дойти нужно до любой клетки противоположного. Вчетвером всё иначе — доска 11×11, и все четверо бегут в одну золотую клетку в самом центре. Кто дошёл первым, тот и выиграл; в режиме 2 на 2 достаточно, чтобы дошёл любой из пары.',
          type: 'text'
        },
        {
          title: 'Ход',
          icon: MousePointer2,
          content: 'За ход вы делаете ровно одно из двух: либо двигаете пешку на соседнюю клетку по вертикали или горизонтали, либо ставите стену. Пропустить ход нельзя, и делать оба действия сразу тоже нельзя — в этом выборе вся игра.',
          type: 'text'
        },
        {
          title: 'Стены',
          icon: Shield,
          content: [
            'Стена длиной в две клетки ставится в промежуток между рядами или столбцами.',
            'Стены нельзя класть поверх друг друга, пересекать их или накладывать внахлёст.',
            'Поставленную стену уже не убрать и не сдвинуть.',
            'Вдвоём у каждого по 10 стен, в паре по 5, вчетвером по 7. Кончились — остаётся только идти.'
          ],
          type: 'list'
        },
        {
          title: 'Главное ограничение',
          icon: AlertTriangle,
          content: 'Стену нельзя поставить так, чтобы у кого-то не осталось ни одного пути до своего края. Запереть соперника наглухо невозможно — стены только удлиняют дорогу. Интерфейс сам не даст вам поставить такую стену.',
          type: 'text'
        },
        {
          title: 'Прыжок',
          icon: Zap,
          content: 'Если вы стоите вплотную к чужой пешке, вы перепрыгиваете через неё и встаёте сразу за ней. Если прямо за ней стена или край доски — вместо прыжка вы обходите её сбоку, вставая слева или справа. Это единственный способ сходить по диагонали. Вчетвером, когда перед вами выстроились сразу две фишки, прыжок перемахивает через обе.',
          type: 'text'
        },
        {
          title: 'Режимы',
          icon: Target,
          content: [
            '1 на 1 — доска 9×9, двое друг напротив друга, по 10 стен.',
            '2 на 2 — доска 9×9, четверо, партнёры напротив друг друга, ходы идут по кругу и потому чередуются между парами. По 5 стен.',
            'Вчетвером — доска 11×11, по одному с каждой стороны, по 7 стен, и цель у всех общая: золотая клетка в центре. Побеждает один, трое проигрывают.'
          ],
          type: 'list'
        },
        {
          title: 'Тактика',
          icon: Search,
          content: [
            'Стена, которая удлиняет чужой путь на два шага, стоит меньше, чем ваш собственный шаг вперёд. Считайте разницу, а не ущерб.',
            'Берегите стены на конец: в эндшпиле один удачный барьер решает партию, а в начале он почти ничего не стоит.',
            'Вчетвером стены дороже вдвое: их вдвое меньше, а соперников вдвое больше. Не тратьте их на того, кто и так отстаёт.',
            'В паре не стройте против одного и того же — разводите цели, иначе вы просто дублируете работу.'
          ],
          type: 'list'
        }
      ]
    },
    dots: {
      title: 'Точки и квадраты',
      description: 'Абстрактная стратегия: цепочки и размены',
      sections: [
        {
          title: 'Ход',
          icon: MousePointer2,
          content: 'Поле — сетка точек. За ход вы проводите одну линию между двумя соседними точками: по горизонтали или по вертикали. Наискосок нельзя, через уже проведённую линию — тоже.',
          type: 'text'
        },
        {
          title: 'Квадраты',
          icon: Trophy,
          content: 'Если ваша линия замкнула квадрат, он закрашивается вашим цветом и засчитывается вам — и вы ходите ещё раз. Одна линия может закрыть сразу два квадрата, и оба достанутся вам. Ходите, пока закрываете.',
          type: 'text'
        },
        {
          title: 'Как читать доску',
          icon: Grid,
          content: 'Каждая линия окрашена в цвет того, кто её провёл, а закрытый квадрат — в цвет хозяина. Последняя проведённая линия нарисована толще остальных: по ней видно, куда только что сходил соперник.',
          type: 'text'
        },
        {
          title: 'Конец',
          icon: Flag,
          content: 'Партия заканчивается, когда проведены все линии. Побеждает тот, у кого больше квадратов. При равенстве — ничья на двоих или на всех, кто набрал поровну.',
          type: 'text'
        },
        {
          title: 'Главное правило игры',
          icon: AlertTriangle,
          content: 'Третья линия у квадрата — подарок сопернику: он закроет его и походит снова. Поэтому большую часть партии обе стороны стараются ходить туда, где до квадрата ещё далеко. Рано или поздно безопасные линии кончаются, и кому-то приходится открыть первую цепочку.',
          type: 'text'
        },
        {
          title: 'Тактика',
          icon: Search,
          content: [
            'Считайте безопасные ходы. Побеждает не тот, кто раньше захватит квадрат, а тот, у кого останется ход, когда у соперника их не будет.',
            'Отдавая цепочку, отдавайте короткую. Длинные приберегите к концу — там они решают.',
            'Двойной крест: закрыв длинную цепочку не до конца, а оставив два последних квадрата, вы заставляете соперника открыть следующую. Это главный приём игры.',
            'Вчетвером цепочки достаются тому, кто оказался у них в свой ход, — считайте не только свои линии, но и чью очередь вы подводите.'
          ],
          type: 'list'
        }
      ]
    }
,
    reversi: {
      title: 'Реверси',
      description: 'Абстрактная стратегия: линии, которые переворачиваются',
      sections: [
        {
          title: 'Ход',
          icon: MousePointer2,
          content: 'Вы ставите фишку своего цвета так, чтобы между ней и одной из ваших уже стоящих фишек оказалась сплошная линия чужих. Все зажатые фишки переворачиваются и становятся вашими. Линии считаются по горизонтали, вертикали и диагонали, и один ход может перевернуть сразу несколько.',
          type: 'text'
        },
        {
          title: 'Что считается ходом',
          icon: Target,
          content: 'Ход разрешён, только если он переворачивает хотя бы одну фишку. Линия, упирающаяся в край доски или разорванная пустой клеткой, не зажимает ничего — поэтому не всякая свободная клетка доступна для хода.',
          type: 'text'
        },
        {
          title: 'Пропуск',
          icon: RefreshCw,
          content: 'Если у вас нет ни одного допустимого хода, ход переходит автоматически. Партия заканчивается, когда ходов нет ни у кого — обычно при полной доске, но иногда и со свободными клетками.',
          type: 'text'
        },
        {
          title: 'Конец',
          icon: Flag,
          content: 'Побеждает тот, у кого больше фишек. Поровну — ничья.',
          type: 'text'
        },
        {
          title: 'Тактика',
          icon: Search,
          content: [
            'Углы перевернуть невозможно. Всё остальное — можно, поэтому угол дороже любого количества фишек в центре.',
            'Не занимайте клетки рядом с углом раньше времени — именно они открывают сопернику дорогу в сам угол.',
            'В середине партии выгодно иметь меньше фишек: меньше фишек — меньше того, что можно зажать, и больше мест, куда вы ещё можете пойти.',
            'Считайте ходы, а не фишки. Партия выигрывается тем, что сопернику становится некуда ставить.'
          ],
          type: 'list'
        }
      ]
    }
  },
  en: {
    battleship: {
      title: 'Battleship',
      description: 'Strategic Naval Combat',
      sections: [
        {
          title: 'Objective',
          icon: Trophy,
          content: 'Your goal is to locate and destroy the enemy fleet before they destroy yours. The winner is the first to sink all 10 opponent ships. The game continues until total destruction of one side.',
          type: 'text'
        },
        {
          title: 'Fleet Composition',
          icon: Ship,
          content: [
            '1x Battleship (4 cells) — the largest and most valuable asset.',
            '2x Cruisers (3 cells) — the backbone of your strike force.',
            '3x Destroyers (2 cells) — agile and dangerous.',
            '4x Submarines (1 cell) — hardest to locate.'
          ],
          type: 'list'
        },
        {
          title: 'Deployment Rules',
          icon: MapIcon,
          content: [
            'Placement: drag a ship from the shipyard onto the grid — or select it and click a cell. Clicking a placed ship picks it back up.',
            'Rotate: R / Spacebar / Q, right-click on the grid, or the rotate button. "Auto" deploys the fleet randomly.',
            'CRITICAL: Ships cannot touch each other, not even diagonally. A 1-cell gap is mandatory.'
          ],
          type: 'list'
        },
        {
          title: 'Combat Phase',
          icon: Crosshair,
          content: [
            'Players take turns firing. Turn time limit: 60 seconds.',
            'HIT (X): If you hit a ship, you get a BONUS TURN. Keep firing until you miss.',
            'MISS (•): Turn passes to the opponent.',
            'SUNK (☠): When all decks of a ship are hit, it is destroyed. All surrounding cells are automatically marked as "Miss" to save time and prevent useless shots.'
          ],
          type: 'list'
        }
      ]
    },
    coup: {
      title: 'Coup',
      description: 'Game of Bluff, Intrigue & Deduction',
      sections: [
        {
          title: 'The Core',
          icon: Trophy,
          content: 'You are the head of a family in a corrupt Italian city-state. Destroy the influence of other families. Be the last survivor. Your influence consists of face-down character cards.',
          type: 'text'
        },
        {
          title: 'Life & Money',
          icon: Shield,
          content: [
            'Start with 2 cards and 2 coins.',
            '1 Card = 1 Life. Lose a life -> Reveal a card. Lose both -> You are out.',
            'Coins are ammo for powerful actions (Assassination, Coup).'
          ],
          type: 'list'
        },
        {
          title: 'Roles & Actions',
          icon: Zap,
          content: [
            'DUKE: Tax (+3 coins). Blocks Foreign Aid.',
            'ASSASSIN: Pay 3 coins to kill a card. Blocked by Contessa.',
            'CAPTAIN: Steal 2 coins from another player. Blocked by Captain/Ambassador.',
            'AMBASSADOR: Swap cards with the deck. Blocks Stealing.',
            'CONTESSA: Blocks Assassination.',
            'GENERAL ACTIONS: Income (+1, safe), Foreign Aid (+2, blocked by Duke), Coup (-7, unblockable kill, mandatory at 10+ coins).'
          ],
          type: 'list'
        },
        {
          title: 'Bluffing',
          icon: Eye,
          content: 'This is the heart of the game. You can claim ANY action, regardless of your cards. Claim to be a Duke to take 3 coins? Sure! But anyone can CHALLENGE you. If caught lying, you lose a card. If truthful (and you prove it), the challenger loses a card.',
          type: 'text'
        }
      ]
    },
    minesweeper: {
      title: 'Minesweeper',
      description: 'Speed & Logic Survival',
      sections: [
        {
          title: 'Goal',
          icon: Trophy,
          content: 'Clear the minefield faster than your opponents. In multiplayer, this is a race. The winner is the first to open all safe cells or the last survivor standing.',
          type: 'text'
        },
        {
          title: 'Mechanics',
          icon: Shield,
          content: [
            'Number (1-8): Shows how many mines are in the 8 surrounding cells.',
            'Empty space: No mines around, safe to open.',
            'First Click: Always safe (mines generated after).',
            'One Mistake: Hitting a mine eliminates you instantly.'
          ],
          type: 'list'
        },
        {
          title: 'Pro Controls',
          icon: MousePointer2,
          content: [
            'Left Click: open a cell.',
            'Right Click (or Long Press on mobile): place/remove a flag.',
            'CHORD: click an opened number (or Middle Click). When the number has exactly that many flags around it, all remaining neighbors open instantly. Essential for speedruns!',
            'Board navigation: hold Left Click and drag to pan, WASD to move, "+"/"-" or the magnifier buttons to zoom.'
          ],
          type: 'list'
        },
        {
          title: 'Multiplayer',
          icon: Clock,
          content: 'You play on identical boards. You see opponents\' progress in % real-time. If all opponents explode, you win by default.',
          type: 'text'
        }
      ]
    },
    flager: {
      title: 'Flager',
      description: 'Pixel Match Geography Quiz',
      sections: [
        {
          title: 'Concept',
          icon: Flag,
          content: 'A country flag is hidden behind "noise". Your job is to guess the country. But you don\'t have to guess blindly! We use the "Pixel Match" mechanic.',
          type: 'text'
        },
        {
          title: 'Pixel Match',
          icon: Target,
          content: 'Type the name of ANY country. The game compares your guess\'s flag with the hidden target. If pixels match in color and position, those parts of the image are revealed. Example: Target is France (Blue-White-Red). You guess "Italy" (Green-White-Red). The White and Red stripes match and reveal!',
          type: 'text'
        },
        {
          title: 'Scoring',
          icon: Trophy,
          content: [
            'Start Bank: 1000 points.',
            'Guess Penalty: -50 points per attempt.',
            'Time Penalty: -10 points per second.',
            'Limit: 10 guesses per round.',
            'Goal: Solve fast with few guesses to keep a high score.'
          ],
          type: 'list'
        },
        {
          title: 'Strategy',
          icon: Search,
          content: 'Start with colorful flags (South Africa, Seychelles) to "scan" for multiple colors at once.',
          type: 'text'
        }
      ]
    },
    spyfall: {
      title: 'Spyfall',
      description: 'Social Deduction & Talk',
      sections: [
        {
          title: 'The Plot',
          icon: Eye,
          content: 'All players are in the same location (e.g., "Space Station"), except one — the Spy. The Spy sees "UNKNOWN". Locals know the place.',
          type: 'text'
        },
        {
          title: 'Gameplay',
          icon: RefreshCw,
          content: 'A timer starts. Players ask each other questions. Locals try to spot the person who is clueless. The Spy listens to clues to figure out the location and blends in.',
          type: 'text'
        },
        {
          title: 'Winning Conditions',
          icon: Trophy,
          content: [
            'SPY WINS IF: 1) Timer runs out without being caught. 2) Guesses the location correctly (action button). 3) Locals vote out an innocent player.',
            'LOCALS WIN IF: They unanimously vote for the real Spy.'
          ],
          type: 'list'
        },
        {
          title: 'Accusation',
          icon: AlertTriangle,
          content: 'Any player can "Accuse" once per round. A vote starts. Unanimous "Guilty" verdict ends the game. Any "Innocent" vote continues the game.',
          type: 'text'
        }
      ]
    },
    wallrush: {
      title: 'Wall Rush',
      description: 'Abstract strategy: a race and a blockade',
      sections: [
        {
          title: 'Goal',
          icon: Flag,
          content: 'In the duel and the team game the board is 9x9: your pawn starts mid-edge and has to reach any square on the opposite edge. Four at a table is different — an 11x11 board, and all four race for a single golden square in the very centre. First one home wins; in 2v2 either partner getting there is enough.',
          type: 'text'
        },
        {
          title: 'Your turn',
          icon: MousePointer2,
          content: 'Each turn you do exactly one of two things: move your pawn one square up, down, left or right, or place a wall. You cannot pass, and you cannot do both. That choice is the whole game.',
          type: 'text'
        },
        {
          title: 'Walls',
          icon: Shield,
          content: [
            'A wall is two squares long and sits in the gap between rows or columns.',
            'Walls may not cross, overlap or share a slot with another wall.',
            'Once placed, a wall never moves and never comes back.',
            'Two players get 10 walls each, a team game 5 each, four at a table 7 each. Once they are gone, all you can do is run.'
          ],
          type: 'list'
        },
        {
          title: 'The one hard limit',
          icon: AlertTriangle,
          content: 'A wall may never leave anyone without a route to their edge. Sealing a rival in is impossible — walls only lengthen the journey. The board will not let you place a wall that breaks this.',
          type: 'text'
        },
        {
          title: 'Jumping',
          icon: Zap,
          content: 'Standing face to face with another pawn, you hop straight over it and land behind. If a wall or the board edge is directly behind it, you step around it instead, landing to its left or right. That side-step is the only way a pawn ever moves diagonally. Four at a table, two pawns queued in front of you are cleared by a single hop over both.',
          type: 'text'
        },
        {
          title: 'Modes',
          icon: Target,
          content: [
            '1v1 — a 9x9 board, two players facing each other, 10 walls each.',
            '2v2 — a 9x9 board, four players with partners opposite, so turns run clockwise and alternate between the teams. 5 walls each.',
            'Four at a table — an 11x11 board, one player per side, 7 walls each, and a single shared target: the golden centre square. One winner, three losers.'
          ],
          type: 'list'
        },
        {
          title: 'Tactics',
          icon: Search,
          content: [
            'A wall that adds two steps to a rival costs you one step of your own. Count the difference, not the damage.',
            'Save walls for the end. One barrier in the endgame decides a match; the same wall on turn two barely matters.',
            'With four players walls are twice as precious: half the allowance, twice the rivals. Do not spend them on whoever is already behind.',
            'Partnered up, do not both wall the same rival — split your targets or you are duplicating each other.'
          ],
          type: 'list'
        }
      ]
    },
    dots: {
      title: 'Dots & Boxes',
      description: 'Abstract strategy: chains and sacrifices',
      sections: [
        {
          title: 'Your turn',
          icon: MousePointer2,
          content: 'The board is a grid of dots. On your turn you draw one line between two neighbouring dots, across or down. Never diagonally, and never over a line already drawn.',
          type: 'text'
        },
        {
          title: 'Boxes',
          icon: Trophy,
          content: 'If your line closes a box, it is filled in your colour and counted to you — and you go again. One line can close two boxes at once, and both are yours. You keep going as long as you keep closing.',
          type: 'text'
        },
        {
          title: 'Reading the board',
          icon: Grid,
          content: 'Every line carries the colour of whoever drew it, and a closed box is filled in its owner’s. The line drawn most recently is heavier than the rest, so you can see where your rival has just played.',
          type: 'text'
        },
        {
          title: 'The end',
          icon: Flag,
          content: 'The match ends when every line has been drawn. Whoever holds the most boxes wins; level scores share it.',
          type: 'text'
        },
        {
          title: 'The rule the game turns on',
          icon: AlertTriangle,
          content: 'Drawing a third side of a box hands it to your rival: they close it and go again. So for most of the match both sides play where no box is nearly finished. Sooner or later the safe lines run out and somebody has to open the first chain.',
          type: 'text'
        },
        {
          title: 'Tactics',
          icon: Search,
          content: [
            'Count the safe moves. The winner is not whoever takes a box first — it is whoever still has a move when the other has none.',
            'When you must give a chain away, give away a short one. Save the long chains for the end, where they decide the match.',
            'The double cross: close a long chain but leave its last two boxes, and your rival has to open the next one. This is the central trick of the game.',
            'With four players a chain falls to whoever reaches it on their turn — so watch whose turn you are setting up, not only your own line.'
          ],
          type: 'list'
        }
      ]
    },
    reversi: {
      title: 'Reversi',
      description: 'Abstract strategy: lines that turn over',
      sections: [
        {
          title: 'Your turn',
          icon: MousePointer2,
          content: 'Place one disc of your colour so that a straight line of your rival\'s discs sits between the new disc and one of yours already on the board. Every disc in that line turns over and becomes yours. Lines run across, down and diagonally, and one move can turn over several at once.',
          type: 'text'
        },
        {
          title: 'What counts as a move',
          icon: Target,
          content: 'A move is legal only if it turns at least one disc over. A run that reaches the edge of the board, or that has a gap in it, traps nothing — so an empty square is not always a place you may play.',
          type: 'text'
        },
        {
          title: 'Passing',
          icon: RefreshCw,
          content: 'If you have no legal move, your turn passes automatically. The match ends when neither colour can play — usually with a full board, but sometimes with squares to spare.',
          type: 'text'
        },
        {
          title: 'The end',
          icon: Flag,
          content: 'Whoever holds more discs wins. A level count is a draw.',
          type: 'text'
        },
        {
          title: 'Tactics',
          icon: Search,
          content: [
            'Corners cannot be turned over. Everything else can, so a corner is worth more than any number of discs in the middle.',
            'Do not take the squares beside a corner early — they are what lets your rival reach the corner itself.',
            'Holding fewer discs in the middlegame is usually good: fewer discs means fewer of them can be trapped, and more places you can still play.',
            'Count moves, not discs. Leaving your rival with almost nothing to play is how the endgame is won.'
          ],
          type: 'list'
        }
      ]
    }
  }
};