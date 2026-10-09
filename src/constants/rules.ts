import { Target, Zap, Shield, Trophy, MousePointer2, Eye, Flag, Ship, RefreshCw, Crosshair, AlertTriangle, Search, Clock, Grid, Keyboard, Map as MapIcon } from 'lucide-react';
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
            'Поворот: клавиша R (или Q, E), пробел, правый клик по полю или кнопка поворота. Кнопка «Авто» расставит флот случайно.',
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
        },
        {
          title: 'Управление',
          icon: Keyboard,
          content: [
            'Свои действия — кнопками в панели внизу экрана. Когда ходит другой, над панелью всплывают кнопки ответа: оспорить, заблокировать или пропустить.',
            'Переворот, кража и убийство просят цель: нажмите на игрока. Esc отменяет выбор цели.'
          ],
          type: 'list'
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
            'ЛКМ или касание: открыть клетку.',
            'Флаг: ПКМ, ПРОБЕЛ по клетке под курсором или долгое нажатие на телефоне. На телефоне есть и переключатель «Копать / Флаг».',
            'АККОРД: клик, СКМ или ПРОБЕЛ по открытой цифре. Если вокруг неё стоит ровно столько флагов, сколько она показывает, мгновенно откроются все остальные клетки вокруг. Главный инструмент скоростной игры!',
            'Перемещение по полю: зажмите ЛКМ и тяните, или WASD / стрелки.',
            'Масштаб: колесо мыши над полем, «+» / «−» или кнопки лупы. «0» возвращает поле на место.'
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
            'Между раундами — минута, чтобы посмотреть ответ; потом следующий раунд начнётся сам, даже если кто-то не нажал «Далее».',
            'Цель: Угадать максимально быстро и с минимальным количеством попыток, чтобы сохранить как можно больше очков.'
          ],
          type: 'list'
        },
        {
          title: 'Совет',
          icon: Search,
          content: 'Начинайте с "разноцветных" флагов (например, ЮАР, Сейшелы, ЦАР), чтобы "просканировать" сразу много цветов и понять структуру загаданного флага.',
          type: 'text'
        },
        {
          title: 'Управление',
          icon: Keyboard,
          content: [
            'Начните печатать название страны — появятся подсказки.',
            'Стрелки ↑ / ↓ выбирают подсказку, Enter или Tab отвечают ею, Esc прячет список.',
            'После раунда Enter нажимает «Далее».'
          ],
          type: 'list'
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
        },
        {
          title: 'Управление',
          icon: Keyboard,
          content: [
            'Кнопка «Показать / Скрыть» под карточкой открывает и прячет вашу роль.',
            'Esc закрывает окно угадывания локации и подтверждение обвинения. Голосование закрыть нельзя — это обязательный шаг.'
          ],
          type: 'list'
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
          content: 'В дуэли и в паре доска 9×9: пешка стоит посередине одного края, дойти нужно до любой клетки противоположного. Втроём и вчетвером всё иначе — доска 11×11, и все бегут в одну золотую клетку в самом центре. Кто дошёл первым, тот и выиграл; в режиме 2 на 2 достаточно, чтобы дошёл любой из пары.',
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
            'Вдвоём у каждого по 10 стен, втроём по 8, в паре по 5, вчетвером по 7. Кончились — остаётся только идти.'
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
          content: 'Если вы стоите вплотную к чужой пешке, вы перепрыгиваете через неё и встаёте сразу за ней. Если прямо за ней стена или край доски — вместо прыжка вы обходите её сбоку, вставая слева или справа. Это единственный способ сходить по диагонали. В гонке к центру, где фишки скапливаются у одной клетки, прыжок перемахивает сразу через две.',
          type: 'text'
        },
        {
          title: 'Режимы',
          icon: Target,
          content: [
            '1 на 1 — доска 9×9, двое друг напротив друга, по 10 стен.',
            'Втроём — доска 11×11, трое с трёх сторон, каждый сам за себя, по 8 стен, цель общая: золотая клетка в центре.',
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
        },
        {
          title: 'Управление',
          icon: Keyboard,
          content: [
            'Ход пешкой: нажмите на подсвеченную клетку или стрелку / WASD в нужную сторону. Прыжок через соседнюю пешку — та же стрелка; обход сбоку — только нажатием на клетку.',
            'Стена: возьмите её из лотка под доской и перетащите в промежуток. Пока держите, R, Q, E или пробел поворачивают стену, Esc возвращает её в лоток.',
            'Там, где стену поставить нельзя, предпросмотр не появляется — отпустите, и ничего не случится.'
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
    },
    wikiler: {
      title: 'Wikiler',
      description: 'Угадайте статью Википедии',
      sections: [
        {
          title: 'Цель игры',
          icon: Trophy,
          content: 'Всем дают одну и ту же статью Википедии, в которой скрыта большая часть значимых слов (по умолчанию 75%) и всё название. Открывайте слова и узнайте статью. Раунд угадан, когда вы ввели её название или открыли все слова названия.',
          type: 'text'
        },
        {
          title: 'Как играть',
          icon: Search,
          content: [
            'СЛОВО: напишите слово — если оно есть в статье, откроются все его места и видно, сколько раз оно встретилось. Вместе со словом могут открыться его грамматические формы.',
            'СТАТЬЯ: рискните и введите название целиком. Верно — раунд ваш с текущим счётом; неверно — минус 50 очков.',
            'Служебные слова (и, в, на, the, of…), числа и знаки видны сразу. Название и его переводы в скобке после него сразу не открываются никогда.',
            'Когда раунд для вас закончился — угадали вы или нет, — откроется вся статья и её карточка из Википедии.',
            'Скрытое слово — серая плашка длиной со слово. Число букв на ней видно сразу или по нажатию — как решит хост.'
          ],
          type: 'list'
        },
        {
          title: 'Очки',
          icon: Target,
          content: [
            'В начале раунда — 1000 очков.',
            'Время: весь раунд стоит 500 очков, они тают равномерно.',
            'Слово: промах — минус 10, найденное слово — минус 2. Это при 50 попытках; чем меньше лимит, тем дороже каждая попытка: при 10 попытках промах стоит 50, находка — 10.',
            'Неверное название — минус 50.',
            'Угаданный раунд — не меньше 10 очков, неугаданный — 0. Итог — сумма раундов.'
          ],
          type: 'list'
        },
        {
          title: 'Режимы',
          icon: Clock,
          content: [
            'Без ограничений: пробуйте сколько угодно, держат только очки и время.',
            'Ограниченные попытки: каждое слово и каждое название тратит попытку, даже бесплатное. Кончились — раунд не угадан.'
          ],
          type: 'list'
        },
        {
          title: 'Управление',
          icon: Keyboard,
          content: [
            'Enter — отправить слово или название.',
            'Tab в поле ввода — переключить СЛОВО и СТАТЬЯ.',
            'После раунда Enter нажимает «Далее».'
          ],
          type: 'list'
        },
        {
          title: 'Откуда статьи',
          icon: Eye,
          content: 'Статьи загружаются прямо с сайта Википедии (uk.wikipedia.org, ru.wikipedia.org или en.wikipedia.org). Тему выбирает хост: любая статья или одна из 34 тем, и сложность: «Легко» — самая читаемая треть темы, «Средне» — средняя, «Сложно» — наименее читаемая. Статья у всех одна, но каждый читает её на языке своего интерфейса — версии на разных языках немного отличаются; в дополнительных настройках хост может дать всем один текст на своём языке. Тексты написаны авторами Википедии и доступны по лицензии CC BY-SA 4.0 — после раунда видны ссылка на статью, лицензию и список авторов. Wikiler не связан с Википедией и фондом Викимедиа.',
          type: 'text'
        }
      ]
    },
    timler: {
      title: 'Timler',
      description: 'Угадайте, когда снято фото или написана картина',
      sections: [
        {
          title: 'Цель игры',
          icon: Trophy,
          content: 'Всем показывают одну и ту же фотографию — или картину, если хост включил живопись. Назовите, когда она снята или написана: год — обязательно, день и месяц — если знаете. Чем ближе к настоящей дате, тем больше очков.',
          type: 'text'
        },
        {
          title: 'Как играть',
          icon: Search,
          content: [
            'Выберите год ползунком, кнопками − и + или впишите его. Если у фото известен день, можно добавить день и месяц.',
            'Нажмите «Ответить» — ответ окончательный. Соперники видят только, что вы ответили.',
            'Раунд кончается, когда ответили все или вышло время. Нет ответа — 0 очков.',
            'После раунда — шкала с ответами всех цветными пузырьками, правильная дата и рассказ о фото или картине и её авторе.'
          ],
          type: 'list'
        },
        {
          title: 'Очки',
          icon: Target,
          content: [
            'Год: 1000 за точный год, меньше — чем дальше. Допуск растёт с возрастом снимка: ошибка на 5 лет у фото 1840-х почти не стоит очков (около 900), у фото 1960-х — около 700, у фото последних лет — почти всё (около 80). Картины считаются так же: у полотна XVI века и ошибка на 20 лет даёт больше 800.',
            'Дата — это ставка: день в день +300, неделя +143, месяц −53, дальше до −100. Не уверены — оставьте только год.',
            'Места: трём самым точным +100, +60 и +30; последнему месту бонуса нет.',
            'Время: очки тают с первой секунды, к концу раунда — до −200. Кто ответил раньше, тот потерял меньше.',
            'Очки раунда не бывают меньше 0. Итог — сумма раундов.'
          ],
          type: 'list'
        },
        {
          title: 'Настройки',
          icon: Clock,
          content: [
            'Что угадываем: фото (по умолчанию), живопись или всё вместе — тогда каждый раунд фото или картина поровну.',
            'Эпоха: всё время или одна из эпох. У фото — 1800–1899 (снимки с 1839 года), 1900–1945, 1946–2000, с 2001. У живописи — до 1600, 1600–1799, 1800–1899, 1900–1945: картин позже 1945 на свободных лицензиях почти нет.',
            'Сложность: самая известная треть — «Легко», наименее известная — «Сложно».',
            'Режим 18+ (в дополнительных настройках) добавляет бои, катастрофы и обнажённую натуру в фотоискусстве, а в живописи — обнажённую натуру, битвы, распятия, мучеников и казни. Тел погибших и казней на фото нет и в нём, а крови, пыток и отрубленных голов — нигде. «Только 18+» показывает лишь такие снимки и картины.'
          ],
          type: 'list'
        },
        {
          title: 'Управление',
          icon: Keyboard,
          content: [
            '← и → — год на один назад или вперёд, с Shift — на десять.',
            'Enter — ответить.',
            'После раунда Enter нажимает «Далее».'
          ],
          type: 'list'
        },
        {
          title: 'Откуда фото и картины',
          icon: Eye,
          content: 'Фотографии — из Wikimedia Commons, куда их передали музеи, библиотеки и архивы (Библиотека Конгресса, Национальный архив Нидерландов, Федеральный архив Германии и другие), и из Викиданных. Картины — из Викиданных: только те, о которых есть статьи хотя бы в двух Википедиях и у которых точно известен год, без «около» и «между»; изображения — с Wikimedia Commons. Всё загружается прямо с сайтов Wikimedia; после раунда видны автор, лицензия и ссылка на файл. Timler не связан с фондом Викимедиа.',
          type: 'text'
        }
      ]
    },
    songler: {
      title: 'Songler',
      description: 'Угадайте песню по отрывку',
      sections: [
        {
          title: 'Цель игры',
          icon: Trophy,
          content: 'Всем играет одна и та же песня — сначала полсекунды. Назовите её: чем короче отрывок, по которому вы её узнали, тем больше очков.',
          type: 'text'
        },
        {
          title: 'Как играть',
          icon: Search,
          content: [
            'Нажмите ▶ — прозвучит отрывок. Слушать его можно сколько угодно раз.',
            'Начните вводить название или исполнителя и выберите песню из подсказок. Подсказки — из всех песен игры, не только из категории.',
            'Не угадали или нажали «Пропустить» — отрывок становится длиннее: 0,5 → 1 → 2 → 4 → 8 → 15 секунд. Всего шесть попыток.',
            'Раунд кончается, когда все угадали или исчерпали попытки, или вышло время. После раунда — обложка, название, исполнитель, весь 30-секундный отрывок и ответы всех.'
          ],
          type: 'list'
        },
        {
          title: 'Очки',
          icon: Target,
          content: [
            'Угадали с первой попытки — 1000, со второй — 800, дальше 600, 400, 250 и 100.',
            'Назвали другую песню того же исполнителя, но так и не угадали — 100 утешительных.',
            'Места: трём угадавшим за меньше всего попыток (при равенстве — кто быстрее) +100, +60 и +30; последнему месту бонуса нет.',
            'Время: очки тают с первой секунды, к концу раунда — до −200.',
            'Очки раунда не бывают меньше 0. Итог — сумма раундов.'
          ],
          type: 'list'
        },
        {
          title: 'Настройки',
          icon: Clock,
          content: [
            'Категория: всё подряд, хиты сейчас, десятилетия от 60-х до 2020-х, жанры (поп, рок, метал, хип-хоп, электроника, латино, K-pop, джаз, классика и другие), музыка из кино, игр и аниме, Евровидение, Рождество, а также русская поп-музыка, русский рок и рэп, советская эстрада и украинская музыка.',
            'Сложность: самая популярная треть песен категории — «Легко», наименее популярная — «Сложно».',
            'Раунды и время на раунд.'
          ],
          type: 'list'
        },
        {
          title: 'Управление',
          icon: Keyboard,
          content: [
            'Пробел — проиграть отрывок (когда курсор не в поле ввода).',
            '↑ и ↓ — выбрать подсказку, Enter — ответить ею, Esc — скрыть подсказки.',
            'После раунда Enter нажимает «Далее».'
          ],
          type: 'list'
        },
        {
          title: 'Откуда музыка',
          icon: Eye,
          content: 'Песни и 30-секундные отрывки — из Deezer: редакторские плейлисты по десятилетиям и жанрам и самые популярные треки известных исполнителей. Отрывок выбирает Deezer — обычно это середина песни или припев, а не самое начало. Звук загружается прямо с серверов Deezer. Songler не связан с Deezer.',
          type: 'text'
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
            'Rotate: R (or Q, E), Space, right-click on the grid, or the rotate button. "Auto" deploys the fleet randomly.',
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
        },
        {
          title: 'Controls',
          icon: Keyboard,
          content: [
            'Your own actions are buttons in the panel at the bottom of the screen. When someone else moves, the answers — challenge, block or pass — pop up above it.',
            'Coup, steal and assassinate ask for a target: tap a player. Esc cancels the choice.'
          ],
          type: 'list'
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
            'Left Click or tap: open a cell.',
            'Flag: Right Click, SPACE over the cell under the pointer, or Long Press on mobile. Phones also get a Dig / Flag switch.',
            'CHORD: click, Middle Click or SPACE on an opened number. When it has exactly that many flags around it, all remaining neighbours open instantly. Essential for speedruns!',
            'Moving around: hold Left Click and drag, or WASD / arrow keys.',
            'Zoom: the mouse wheel over the board, "+" / "-", or the magnifier buttons. "0" puts the board back.'
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
            'Between rounds you get a minute to look at the answer; then the next round starts on its own, even if someone has not pressed "Next".',
            'Goal: Solve fast with few guesses to keep a high score.'
          ],
          type: 'list'
        },
        {
          title: 'Strategy',
          icon: Search,
          content: 'Start with colorful flags (South Africa, Seychelles) to "scan" for multiple colors at once.',
          type: 'text'
        },
        {
          title: 'Controls',
          icon: Keyboard,
          content: [
            'Start typing a country name and suggestions appear.',
            'Arrow keys ↑ / ↓ pick a suggestion, Enter or Tab answers with it, Esc hides the list.',
            'After a round, Enter presses "Next".'
          ],
          type: 'list'
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
        },
        {
          title: 'Controls',
          icon: Keyboard,
          content: [
            'The Reveal / Hide button under your card shows and hides your role.',
            'Esc closes the location guess and the accusation prompt. The vote cannot be closed — it is a required step.'
          ],
          type: 'list'
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
          content: 'In the duel and the team game the board is 9x9: your pawn starts mid-edge and has to reach any square on the opposite edge. Three and four at a table are different — an 11x11 board, and everyone races for a single golden square in the very centre. First one home wins; in 2v2 either partner getting there is enough.',
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
            'Three-way — an 11x11 board, three players on three sides, everyone for themselves, 8 walls each, all racing for the golden square in the centre.',
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
        },
        {
          title: 'Controls',
          icon: Keyboard,
          content: [
            'Moving: tap a highlighted square, or press an arrow key / WASD in that direction. Jumping an adjacent pawn is the same key; stepping round it sideways is a tap on the square.',
            'Walls: pick one up from the tray below the board and drag it into a groove. While you hold it, R, Q, E or Space turns it and Esc puts it back.',
            'Where a wall cannot go, no preview appears — let go and nothing happens.'
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
    },
    wikiler: {
      title: 'Wikiler',
      description: 'Name the Wikipedia article',
      sections: [
        {
          title: 'Goal',
          icon: Trophy,
          content: 'Everyone gets the same Wikipedia article with most of its meaningful words hidden (75% by default) and the whole title. Open words and work out the article. A round is solved when you type its title or open every word of the title.',
          type: 'text'
        },
        {
          title: 'How to play',
          icon: Search,
          content: [
            'WORD: type a word — if the article has it, every place it occurs opens and you see how many there are. Its grammatical forms may open with it.',
            'ARTICLE: take the risk and type the whole title. Right, and the round is yours at the current score; wrong costs 50 points.',
            'Function words (the, of, and…), numbers and punctuation are shown from the start. The title and its translations in the bracket after it never are.',
            'Once the round is over for you — solved or not — the whole article opens with its Wikipedia card.',
            'A hidden word is a grey block as long as the word. Its letter count shows from the start or on a tap — the host decides.'
          ],
          type: 'list'
        },
        {
          title: 'Score',
          icon: Target,
          content: [
            'A round starts at 1,000 points.',
            'Time: the whole round costs 500 points, melting away evenly.',
            'Words: a miss costs 10, a word the article has costs 2. That is at 50 attempts; the tighter the limit, the dearer each attempt: at 10 attempts a miss costs 50 and a find 10.',
            'A wrong title costs 50.',
            'A solved round is worth at least 10, an unsolved one 0. The match adds up the rounds.'
          ],
          type: 'list'
        },
        {
          title: 'Modes',
          icon: Clock,
          content: [
            'Unlimited: guess as much as you like; only the score and the clock hold you back.',
            'Limited attempts: every word and every title spends an attempt, even a free one. Run out and the round is lost.'
          ],
          type: 'list'
        },
        {
          title: 'Controls',
          icon: Keyboard,
          content: [
            'Enter — send the word or the title.',
            'Tab in the input — switch between WORD and ARTICLE.',
            'After a round, Enter presses Next.'
          ],
          type: 'list'
        },
        {
          title: 'Where the articles come from',
          icon: Eye,
          content: 'Articles load straight from Wikipedia (en.wikipedia.org, uk.wikipedia.org or ru.wikipedia.org). The host picks the topic — any article or one of 34 topics — and the difficulty: Easy is the most read third of the topic, Medium the middle one, Hard the least read. Everyone gets the same article, each reading it in their own interface language — the language versions differ a little; in the advanced settings the host can give everyone one text in the host’s language. The text is written by Wikipedia’s authors and available under CC BY-SA 4.0 — after each round you get a link to the article, the licence and the list of authors. Wikiler is not affiliated with Wikipedia or the Wikimedia Foundation.',
          type: 'text'
        }
      ]
    },
    timler: {
      title: 'Timler',
      description: 'Guess when the photo was taken or the painting painted',
      sections: [
        {
          title: 'Goal',
          icon: Trophy,
          content: 'Everyone sees the same photograph — or painting, if the host turned paintings on. Say when it was taken or painted: the year is a must, the day and month if you know them. The closer to the real date, the more points.',
          type: 'text'
        },
        {
          title: 'How to play',
          icon: Search,
          content: [
            'Pick the year with the slider, the − and + buttons, or type it in. If the photo’s day is known, you can add the day and month.',
            'Press Answer — it is final. The others only see that you have answered.',
            'A round ends when everyone has answered or time is up. No answer scores 0.',
            'After the round: a timeline of everyone’s answers as coloured bubbles, the right date and the story of the photo or painting and who made it.'
          ],
          type: 'list'
        },
        {
          title: 'Score',
          icon: Target,
          content: [
            'The year: 1,000 for the exact year, less the further off. The older the photo, the more room: five years off costs almost nothing on a photo from the 1840s (about 900), gives about 700 on one from the 1960s, and almost nothing on one from the last few years (about 80). Paintings score the same way: on a 16th-century canvas even twenty years off gives over 800.',
            'The date is a bet: the very day +300, a week off +143, a month off −53, further down to −100. Not sure? Leave just the year.',
            'Places: the three most accurate get +100, +60 and +30; the last place never does.',
            'Time: points melt from the first second, up to −200 by the end of the round. Whoever answers first loses the least.',
            'A round never scores below 0. The match adds up the rounds.'
          ],
          type: 'list'
        },
        {
          title: 'Settings',
          icon: Clock,
          content: [
            'What to date: photos (the default), paintings, or both — then each round is a photo or a painting, half and half.',
            'Era: all time or one era. Photos have 1800–1899 (from 1839), 1900–1945, 1946–2000 and since 2001; paintings have before 1600, 1600–1799, 1800–1899 and 1900–1945 — hardly any later paintings are free to show.',
            'Difficulty: the best known third is Easy, the least known Hard.',
            '18+ mode (in the advanced settings) adds battles, disasters and nudes in fine-art photography, and in paintings nudes, battles, crucifixions, martyrs and executions. Even there, no bodies or executions in photos — and no blood, torture or severed heads anywhere. "18+ only" shows nothing else.'
          ],
          type: 'list'
        },
        {
          title: 'Controls',
          icon: Keyboard,
          content: [
            '← and → — the year one back or forward, ten with Shift.',
            'Enter — answer.',
            'After a round, Enter presses Next.'
          ],
          type: 'list'
        },
        {
          title: 'Where the pictures come from',
          icon: Eye,
          content: 'The photographs come from Wikimedia Commons — given to it by museums, libraries and archives (the Library of Congress, the National Archives of the Netherlands, the German Federal Archives and others) — and from Wikidata. The paintings come from Wikidata: only those written about on at least two Wikipedias whose year is known for certain, not "circa" or "between"; their images are on Wikimedia Commons. Everything loads straight from Wikimedia’s sites; after each round you see the author, the licence and a link to the file. Timler is not affiliated with the Wikimedia Foundation.',
          type: 'text'
        }
      ]
    },
    songler: {
      title: 'Songler',
      description: 'Name the song from a snippet',
      sections: [
        {
          title: 'Goal',
          icon: Trophy,
          content: 'Everyone hears the same song — half a second of it at first. Name it: the shorter the snippet you knew it from, the more points.',
          type: 'text'
        },
        {
          title: 'How to play',
          icon: Search,
          content: [
            'Press ▶ to hear the snippet. Play it as often as you like.',
            'Start typing the title or the artist and pick the song from the suggestions. They come from every song in the game, not just the category.',
            'A miss or a Skip makes the snippet longer: 0.5 → 1 → 2 → 4 → 8 → 15 seconds. Six tries in all.',
            'A round ends when everyone has named it or run out of tries, or when time is up. Afterwards: the cover, title, artist, the whole 30-second preview and everyone’s answers.'
          ],
          type: 'list'
        },
        {
          title: 'Score',
          icon: Target,
          content: [
            'Named on the first try — 1,000; on the second — 800; then 600, 400, 250 and 100.',
            'Named another song by the same artist but never this one — 100 as a consolation.',
            'Places: the three who named it in the fewest tries (ties go to the quicker) get +100, +60 and +30; the last place never does.',
            'Time: points melt from the first second, up to −200 by the end of the round.',
            'A round never scores below 0. The match adds up the rounds.'
          ],
          type: 'list'
        },
        {
          title: 'Settings',
          icon: Clock,
          content: [
            'Category: everything, current hits, the decades from the 1960s to the 2020s, genres (pop, rock, metal, hip-hop, electronic, Latin, K-pop, jazz, classical and more), film, game and anime music, Eurovision, Christmas, and Russian pop, Russian rock and rap, Soviet pop and Ukrainian music.',
            'Difficulty: the most played third of the category is Easy, the least played Hard.',
            'Rounds and time per round.'
          ],
          type: 'list'
        },
        {
          title: 'Controls',
          icon: Keyboard,
          content: [
            'Space — play the snippet (when the cursor is not in the input).',
            '↑ and ↓ — pick a suggestion, Enter — answer with it, Esc — hide the suggestions.',
            'After a round, Enter presses Next.'
          ],
          type: 'list'
        },
        {
          title: 'Where the music comes from',
          icon: Eye,
          content: 'The songs and their 30-second previews come from Deezer: its editors’ playlists by decade and genre, and the most played tracks of well-known artists. Deezer picks the preview — usually the middle of the song or the chorus, not its very start. The audio loads straight from Deezer’s servers. Songler is not affiliated with Deezer.',
          type: 'text'
        }
      ]
    }
  },
  uk: {
    battleship: {
      title: 'Морський бій',
      description: 'Стратегічна морська битва',
      sections: [
        {
          title: 'Мета гри',
          icon: Trophy,
          content: 'Ваше головне завдання — виявити й знищити флотилію суперника раніше, ніж він знищить вашу. Перемагає той, хто першим пустить на дно всі 10 кораблів суперника. Гра триває до повного знищення флоту одного з гравців.',
          type: 'text'
        },
        {
          title: 'Склад флоту',
          icon: Ship,
          content: [
            '1x Лінкор (4 клітинки) — найбільший і найцінніший корабель, основа вашої сили.',
            '2x Крейсери (3 клітинки) — універсальні бойові одиниці.',
            '3x Есмінці (2 клітинки) — маневрені кораблі підтримки.',
            '4x Підводні човни (1 клітинка) — їх найважче знайти на мапі.'
          ],
          type: 'list'
        },
        {
          title: 'Правила розставлення',
          icon: MapIcon,
          content: [
            'Розставлення: перетягніть корабель із верфі на поле — або оберіть його кліком і клікніть по клітинці. Клік по вже поставленому кораблю бере його назад.',
            'Поворот: клавіша R (або Q, E), пробіл, правий клік по полю або кнопка повороту. Кнопка «Авто» розставить флот випадково.',
            'ВАЖЛИВЕ ПРАВИЛО: між кораблями має бути відстань щонайменше в одну клітинку. Вони не можуть торкатися одне одного навіть кутами.'
          ],
          type: 'list'
        },
        {
          title: 'Хід битви',
          icon: Crosshair,
          content: [
            'Стріляють по черзі. На кожен постріл дається 60 секунд.',
            'ВЛУЧАННЯ (X): Якщо ви влучили в корабель, ви отримуєте право на ДОДАТКОВИЙ ХІД. Продовжуйте стріляти, доки не промахнетеся.',
            'ПРОМАХ (•): Якщо постріл влучив у порожню клітинку, хід переходить до суперника.',
            'ЗНИЩЕННЯ (☠): Коли всі палуби корабля підбито, він вважається знищеним. Клітинки навколо нього (ореол) автоматично позначаються як "Повз", бо за правилами там не може бути інших кораблів.'
          ],
          type: 'list'
        }
      ]
    },
    coup: {
      title: 'Переворот (Coup)',
      description: 'Гра на блеф, інтриги й дедукцію',
      sections: [
        {
          title: 'Суть гри',
          icon: Trophy,
          content: 'Ви — глава впливової родини в корумпованому місті-державі. Ваша мета — знищити вплив інших родин і залишитися єдиним, хто вижив. Ваш вплив — це карти персонажів (ролі), які лежать перед вами сорочкою догори.',
          type: 'text'
        },
        {
          title: 'Ресурси й життя',
          icon: Shield,
          content: [
            'Кожен гравець починає гру з 2 картами (ролями) і 2 монетами.',
            'Одна карта = одне життя. Втративши вплив (життя), ви мусите відкрити одну зі своїх карт. Відкрита карта вибуває з гри.',
            'Втративши обидві карти, ви вибуваєте з гри.',
            'Монети потрібні, щоб платити за сильні дії, як-от Убивство чи Переворот.'
          ],
          type: 'list'
        },
        {
          title: 'Ролі й дії',
          icon: Zap,
          content: [
            'ГЕРЦОГ (Duke): Може брати "Податок" (+3 монети). Блокує "Іноземну допомогу" іншим гравцям.',
            'АСАСИН (Assassin): Платить 3 монети, щоб змусити жертву втратити карту. Блокується Графинею.',
            'КАПІТАН (Captain): Краде 2 монети в іншого гравця. Блокується іншим Капітаном або Послом.',
            'ПОСОЛ (Ambassador): Бере 2 карти з колоди, міняє їх на свої (або залишає свої). Блокує Крадіжку.',
            'ГРАФИНЯ (Contessa): Не має активної дії, але блокує спробу Убивства проти себе.',
            'ЗАГАЛЬНІ ДІЇ: Дохід (+1 монета, не можна блокувати), Іноз. допомога (+2 монети, блок Герцогом), Переворот (-7 монет, гарантоване вбивство карти, не можна блокувати).'
          ],
          type: 'list'
        },
        {
          title: 'Мистецтво блефу',
          icon: Eye,
          content: 'Це головне правило гри! Ви можете оголосити БУДЬ-ЯКУ дію, навіть якщо у вас немає відповідної карти. Наприклад, сказати "Я Герцог" і взяти 3 монети, маючи на руках двох Асасинів. Але будь-який гравець може сказати "НЕ ВІРЮ!" (Challenge). Якщо вас спіймали на брехні — ви втрачаєте карту. Якщо ви казали правду (і показали карту) — карту втрачає той, хто вам не повірив (а ви берете нову карту з колоди).',
          type: 'text'
        },
        {
          title: 'Керування',
          icon: Keyboard,
          content: [
            'Свої дії — кнопками в панелі внизу екрана. Коли ходить інший, над панеллю спливають кнопки відповіді: оскаржити, заблокувати або пропустити.',
            'Переворот, крадіжка й убивство просять ціль: натисніть на гравця. Esc скасовує вибір цілі.'
          ],
          type: 'list'
        }
      ]
    },
    minesweeper: {
      title: 'Сапер',
      description: 'Перегони на виживання й логіку',
      sections: [
        {
          title: 'Завдання',
          icon: Trophy,
          content: 'Очистити мінне поле швидше за суперників. У цьому режимі гра йде не просто на очки, а на швидкість і виживання. Переможе той, хто першим відкриє всі безпечні клітинки або залишиться єдиним "живим" гравцем, якщо решта підірветься.',
          type: 'text'
        },
        {
          title: 'Механіка',
          icon: Shield,
          content: [
            'Цифра в клітинці (1-8) показує кількість мін у радіусі 3x3 навколо неї.',
            'Якщо мін навколо немає, клітинка порожня, і відкриється ціла безпечна область.',
            'Перший клік завжди безпечний — міни генеруються після першого ходу, тож сміливо починайте!',
            'Помилка фатальна: натиснувши на міну, ви негайно вибуваєте з раунду.'
          ],
          type: 'list'
        },
        {
          title: 'Керування (PRO)',
          icon: MousePointer2,
          content: [
            'ЛКМ або дотик: відкрити клітинку.',
            'Прапорець: ПКМ, ПРОБІЛ по клітинці під курсором або довге натискання на телефоні. На телефоні є й перемикач «Копати / Прапорець».',
            'АКОРД: клік, СКМ або ПРОБІЛ по відкритій цифрі. Якщо навколо неї стоїть рівно стільки прапорців, скільки вона показує, миттєво відкриються всі інші клітинки навколо. Головний інструмент швидкісної гри!',
            'Переміщення полем: затисніть ЛКМ і тягніть, або WASD / стрілки.',
            'Масштаб: коліщатко миші над полем, «+» / «−» або кнопки лупи. «0» повертає поле на місце.'
          ],
          type: 'list'
        },
        {
          title: 'Мультиплеєр',
          icon: Clock,
          content: 'Усі гравці починають одночасно на однакових мапах. Ви бачите прогрес суперників у реальному часі (відсотки). Якщо всі суперники підірвалися на мінах, ви автоматично перемагаєте як "Останній герой".',
          type: 'text'
        }
      ]
    },
    flager: {
      title: 'Флагер',
      description: 'Вікторина з механікою Pixel Match',
      sections: [
        {
          title: 'Як це працює',
          icon: Flag,
          content: 'Вам загадано прапор країни, прихований під "шумом". Ваше завдання — вгадати країну. Але вам не обов’язково вгадати з першої спроби! У грі використовується унікальна механіка "Часткового збігу" (Pixel Match).',
          type: 'text'
        },
        {
          title: 'Pixel Match',
          icon: Target,
          content: 'Вводьте назви БУДЬ-ЯКИХ країн. Система накладе прапор введеної вами країни на загаданий. Якщо в якійсь точці пікселі збіжаться за кольором — ця частина картинки проявиться на екрані. Приклад: загадано прапор Франції (синій-білий-червоний). Ви вводите "Італія" (зелений-білий-червоний). Біла й червона смуги збіжаться й відкриються!',
          type: 'text'
        },
        {
          title: 'Нарахування очок',
          icon: Trophy,
          content: [
            'Стартовий банк: 1000 очок на початку раунду.',
            'Штраф за спробу: -50 очок за кожну неправильну здогадку.',
            'Штраф за час: -10 очок за кожну секунду, що минула.',
            'Ліміт: 10 спроб на раунд.',
            'Між раундами — хвилина, щоб подивитися відповідь; потім наступний раунд почнеться сам, навіть якщо хтось не натиснув «Далі».',
            'Мета: вгадати якомога швидше й за мінімальну кількість спроб, щоб зберегти якомога більше очок.'
          ],
          type: 'list'
        },
        {
          title: 'Порада',
          icon: Search,
          content: 'Починайте з "різнокольорових" прапорів (наприклад, ПАР, Сейшели, ЦАР), щоб "просканувати" одразу багато кольорів і зрозуміти структуру загаданого прапора.',
          type: 'text'
        },
        {
          title: 'Керування',
          icon: Keyboard,
          content: [
            'Почніть друкувати назву країни — з’являться підказки.',
            'Стрілки ↑ / ↓ обирають підказку, Enter або Tab відповідають нею, Esc ховає список.',
            'Після раунду Enter натискає «Далі».'
          ],
          type: 'list'
        }
      ]
    },
    spyfall: {
      title: 'Знахідка для шпигуна',
      description: 'Соціальна дедукція й розмовний жанр',
      sections: [
        {
          title: 'Сюжет',
          icon: Eye,
          content: 'Усі гравці перебувають в одній локації (наприклад, "Океанський лайнер", "Полярна станція" чи "Театр"). Усі знають, де вони, крім однієї людини — Шпигуна. Шпигун бачить у своїй картці напис "НЕВІДОМО".',
          type: 'text'
        },
        {
          title: 'Ігровий процес',
          icon: RefreshCw,
          content: 'Запускається таймер. Гравці починають ставити одне одному запитання по колу або хаотично. Завдання Мирних — за відповідями обчислити того, хто не розуміє, про що йдеться, і плаває в деталях. Завдання Шпигуна — уважно слухати, аналізувати запитання й відповіді, щоб зрозуміти, де він перебуває, і при цьому відповідати так, щоб не викликати підозр.',
          type: 'text'
        },
        {
          title: 'Умови перемоги',
          icon: Trophy,
          content: [
            'ШПИГУН ПЕРЕМАГАЄ, ЯКЩО: 1) Таймер сплив, а його не викрили. 2) Він натиснув кнопку "Назвати локацію" і правильно вгадав місце. 3) Мирні помилилися й проголосували проти невинного гравця.',
            'МИРНІ ПЕРЕМАГАЮТЬ, ЯКЩО: одностайно проголосують проти справжнього Шпигуна під час фази звинувачення.'
          ],
          type: 'list'
        },
        {
          title: 'Звинувачення',
          icon: AlertTriangle,
          content: 'Будь-який гравець 1 раз за раунд може натиснути кнопку "Звинуватити". Починається голосування. Якщо ВСІ (крім звинуваченого) голосують ЗА — гра закінчується вердиктом. Якщо хоч один голосує ПРОТИ — гра триває.',
          type: 'text'
        },
        {
          title: 'Керування',
          icon: Keyboard,
          content: [
            'Кнопка «Показати / Сховати» під карткою відкриває й ховає вашу роль.',
            'Esc закриває вікно вгадування локації й підтвердження звинувачення. Голосування закрити не можна — це обов’язковий крок.'
          ],
          type: 'list'
        }
      ]
    },
    wallrush: {
      title: 'Стіни',
      description: 'Абстрактна стратегія: перегони й перекриття шляхів',
      sections: [
        {
          title: 'Мета',
          icon: Flag,
          content: 'У дуелі й у парі дошка 9×9: пішак стоїть посередині одного краю, дійти треба до будь-якої клітинки протилежного. Утрьох і вчотирьох усе інакше — дошка 11×11, і всі біжать до однієї золотої клітинки в самому центрі. Хто дійшов першим, той і виграв; у режимі 2 на 2 досить, щоб дійшов будь-хто з пари.',
          type: 'text'
        },
        {
          title: 'Хід',
          icon: MousePointer2,
          content: 'За хід ви робите рівно одне з двох: або рухаєте пішака на сусідню клітинку по вертикалі чи горизонталі, або ставите стіну. Пропустити хід не можна, і робити обидві дії одразу теж не можна — у цьому виборі вся гра.',
          type: 'text'
        },
        {
          title: 'Стіни',
          icon: Shield,
          content: [
            'Стіна завдовжки дві клітинки ставиться в проміжок між рядами або стовпцями.',
            'Стіни не можна класти одна на одну, перетинати їх чи накладати внапуск.',
            'Поставлену стіну вже не прибрати й не зсунути.',
            'Удвох у кожного по 10 стін, утрьох по 8, у парі по 5, учотирьох по 7. Скінчилися — залишається лише йти.'
          ],
          type: 'list'
        },
        {
          title: 'Головне обмеження',
          icon: AlertTriangle,
          content: 'Стіну не можна поставити так, щоб у когось не залишилося жодного шляху до свого краю. Замкнути суперника наглухо неможливо — стіни лише подовжують дорогу. Інтерфейс сам не дасть вам поставити таку стіну.',
          type: 'text'
        },
        {
          title: 'Стрибок',
          icon: Zap,
          content: 'Якщо ви стоїте впритул до чужого пішака, ви перестрибуєте через нього й стаєте одразу за ним. Якщо просто за ним стіна або край дошки — замість стрибка ви обходите його збоку, стаючи ліворуч або праворуч. Це єдиний спосіб піти по діагоналі. У перегонах до центру, де фішки скупчуються біля однієї клітинки, стрибок перемахує одразу через дві.',
          type: 'text'
        },
        {
          title: 'Режими',
          icon: Target,
          content: [
            '1 на 1 — дошка 9×9, двоє одне навпроти одного, по 10 стін.',
            'Утрьох — дошка 11×11, троє з трьох боків, кожен сам за себе, по 8 стін, мета спільна: золота клітинка в центрі.',
            '2 на 2 — дошка 9×9, четверо, партнери одне навпроти одного, ходи йдуть по колу й тому чергуються між парами. По 5 стін.',
            'Учотирьох — дошка 11×11, по одному з кожного боку, по 7 стін, і мета в усіх спільна: золота клітинка в центрі. Перемагає один, троє програють.'
          ],
          type: 'list'
        },
        {
          title: 'Тактика',
          icon: Search,
          content: [
            'Стіна, яка подовжує чужий шлях на два кроки, коштує менше, ніж ваш власний крок уперед. Рахуйте різницю, а не шкоду.',
            'Бережіть стіни на кінець: в ендшпілі один вдалий бар’єр вирішує партію, а на початку він майже нічого не вартий.',
            'Учотирьох стіни вдвічі дорожчі: їх удвічі менше, а суперників удвічі більше. Не витрачайте їх на того, хто й так відстає.',
            'У парі не будуйте проти того самого — розводьте цілі, інакше ви просто дублюєте роботу.'
          ],
          type: 'list'
        },
        {
          title: 'Керування',
          icon: Keyboard,
          content: [
            'Хід пішаком: натисніть на підсвічену клітинку або стрілку / WASD у потрібний бік. Стрибок через сусіднього пішака — та сама стрілка; обхід збоку — лише натисканням на клітинку.',
            'Стіна: візьміть її з лотка під дошкою й перетягніть у проміжок. Поки тримаєте, R, Q, E або пробіл повертають стіну, Esc повертає її в лоток.',
            'Там, де стіну поставити не можна, попередній перегляд не з’являється — відпустіть, і нічого не станеться.'
          ],
          type: 'list'
        }
      ]
    },
    dots: {
      title: 'Точки й квадрати',
      description: 'Абстрактна стратегія: ланцюжки й розміни',
      sections: [
        {
          title: 'Хід',
          icon: MousePointer2,
          content: 'Поле — сітка точок. За хід ви проводите одну лінію між двома сусідніми точками: по горизонталі або по вертикалі. Навскіс не можна, через уже проведену лінію — теж.',
          type: 'text'
        },
        {
          title: 'Квадрати',
          icon: Trophy,
          content: 'Якщо ваша лінія замкнула квадрат, він зафарбовується вашим кольором і зараховується вам — і ви ходите ще раз. Одна лінія може закрити одразу два квадрати, і обидва дістануться вам. Ходіть, доки закриваєте.',
          type: 'text'
        },
        {
          title: 'Як читати дошку',
          icon: Grid,
          content: 'Кожна лінія забарвлена в колір того, хто її провів, а закритий квадрат — у колір господаря. Останню проведену лінію намальовано товщою за інші: за нею видно, куди щойно сходив суперник.',
          type: 'text'
        },
        {
          title: 'Кінець',
          icon: Flag,
          content: 'Партія закінчується, коли проведено всі лінії. Перемагає той, у кого більше квадратів. У разі рівності — нічия на двох або на всіх, хто набрав порівну.',
          type: 'text'
        },
        {
          title: 'Головне правило гри',
          icon: AlertTriangle,
          content: 'Третя лінія в квадрата — подарунок суперникові: він закриє його й сходить знову. Тому більшу частину партії обидві сторони намагаються ходити туди, де до квадрата ще далеко. Рано чи пізно безпечні лінії скінчуються, і комусь доводиться відкрити перший ланцюжок.',
          type: 'text'
        },
        {
          title: 'Тактика',
          icon: Search,
          content: [
            'Рахуйте безпечні ходи. Перемагає не той, хто раніше захопить квадрат, а той, у кого залишиться хід, коли в суперника їх не буде.',
            'Віддаючи ланцюжок, віддавайте короткий. Довгі приберігайте на кінець — там вони вирішують.',
            'Подвійний хрест: закривши довгий ланцюжок не до кінця, а залишивши два останні квадрати, ви змушуєте суперника відкрити наступний. Це головний прийом гри.',
            'Учотирьох ланцюжки дістаються тому, хто опинився біля них у свій хід, — рахуйте не лише свої лінії, а й чию чергу ви підводите.'
          ],
          type: 'list'
        }
      ]
    }
,
    reversi: {
      title: 'Реверсі',
      description: 'Абстрактна стратегія: лінії, що перевертаються',
      sections: [
        {
          title: 'Хід',
          icon: MousePointer2,
          content: 'Ви ставите фішку свого кольору так, щоб між нею й однією з ваших уже поставлених фішок опинилася суцільна лінія чужих. Усі затиснуті фішки перевертаються й стають вашими. Лінії рахуються по горизонталі, вертикалі й діагоналі, і один хід може перевернути одразу кілька.',
          type: 'text'
        },
        {
          title: 'Що вважається ходом',
          icon: Target,
          content: 'Хід дозволено, лише якщо він перевертає хоча б одну фішку. Лінія, що впирається в край дошки або розірвана порожньою клітинкою, нічого не затискає — тому не кожна вільна клітинка доступна для ходу.',
          type: 'text'
        },
        {
          title: 'Пропуск',
          icon: RefreshCw,
          content: 'Якщо у вас немає жодного допустимого ходу, хід переходить автоматично. Партія закінчується, коли ходів немає ні в кого — зазвичай коли дошка повна, але іноді й з вільними клітинками.',
          type: 'text'
        },
        {
          title: 'Кінець',
          icon: Flag,
          content: 'Перемагає той, у кого більше фішок. Порівну — нічия.',
          type: 'text'
        },
        {
          title: 'Тактика',
          icon: Search,
          content: [
            'Кути перевернути неможливо. Усе інше — можна, тому кут дорожчий за будь-яку кількість фішок у центрі.',
            'Не займайте клітинки біля кута завчасно — саме вони відкривають суперникові дорогу в сам кут.',
            'У середині партії вигідно мати менше фішок: менше фішок — менше того, що можна затиснути, і більше місць, куди ви ще можете піти.',
            'Рахуйте ходи, а не фішки. Партія виграється тим, що суперникові стає нікуди ставити.'
          ],
          type: 'list'
        }
      ]
    },
    wikiler: {
      title: 'Wikiler',
      description: 'Вгадайте статтю Вікіпедії',
      sections: [
        {
          title: 'Мета гри',
          icon: Trophy,
          content: 'Усім дають ту саму статтю Вікіпедії, у якій приховано більшість значущих слів (за замовчуванням 75%) і всю назву. Відкривайте слова й упізнайте статтю. Раунд вгадано, коли ви ввели її назву або відкрили всі слова назви.',
          type: 'text'
        },
        {
          title: 'Як грати',
          icon: Search,
          content: [
            'СЛОВО: напишіть слово — якщо воно є в статті, відкриються всі його місця й видно, скільки разів воно трапилося. Разом зі словом можуть відкритися його граматичні форми.',
            'СТАТТЯ: ризикніть і введіть назву повністю. Правильно — раунд ваш із поточним рахунком; неправильно — мінус 50 очок.',
            'Службові слова (і, в, на, the, of…), числа й знаки видно одразу. Назва та її переклади в дужках після неї одразу не відкриваються ніколи.',
            'Коли раунд для вас закінчився — вгадали ви чи ні, — відкриється вся стаття та її картка з Вікіпедії.',
            'Приховане слово — сіра плашка завдовжки зі слово. Кількість літер на ній видно одразу або після натискання — як вирішить хост.'
          ],
          type: 'list'
        },
        {
          title: 'Очки',
          icon: Target,
          content: [
            'На початку раунду — 1000 очок.',
            'Час: увесь раунд коштує 500 очок, вони тануть рівномірно.',
            'Слово: промах — мінус 10, знайдене слово — мінус 2. Це за 50 спроб; що менший ліміт, то дорожча кожна спроба: за 10 спроб промах коштує 50, знахідка — 10.',
            'Неправильна назва — мінус 50.',
            'Вгаданий раунд — щонайменше 10 очок, невгаданий — 0. Підсумок — сума раундів.'
          ],
          type: 'list'
        },
        {
          title: 'Режими',
          icon: Clock,
          content: [
            'Без обмежень: пробуйте скільки завгодно, тримають лише очки й час.',
            'Обмежені спроби: кожне слово й кожна назва витрачає спробу, навіть безкоштовну. Скінчилися — раунд не вгадано.'
          ],
          type: 'list'
        },
        {
          title: 'Керування',
          icon: Keyboard,
          content: [
            'Enter — надіслати слово або назву.',
            'Tab у полі введення — перемкнути СЛОВО і СТАТТЯ.',
            'Після раунду Enter натискає «Далі».'
          ],
          type: 'list'
        },
        {
          title: 'Звідки статті',
          icon: Eye,
          content: 'Статті завантажуються просто із сайту Вікіпедії (uk.wikipedia.org, ru.wikipedia.org або en.wikipedia.org). Тему обирає хост: будь-яка стаття або одна з 34 тем, і складність: «Легко» — найпопулярніша третина теми, «Середньо» — середня, «Складно» — найменш популярна. Стаття в усіх одна, але кожен читає її мовою свого інтерфейсу, а версії різними мовами трохи відрізняються; у додаткових налаштуваннях хост може дати всім один текст своєю мовою. Тексти написали автори Вікіпедії, вони доступні за ліцензією CC BY-SA 4.0 — після раунду видно посилання на статтю, ліцензію й список авторів. Wikiler не пов’язаний із Вікіпедією та фондом Вікімедіа.',
          type: 'text'
        }
      ]
    },
    timler: {
      title: 'Timler',
      description: 'Вгадайте, коли знято фото або написано картину',
      sections: [
        {
          title: 'Мета гри',
          icon: Trophy,
          content: 'Усім показують ту саму фотографію — або картину, якщо хост увімкнув живопис. Назвіть, коли її знято чи написано: рік — обов’язково, день і місяць — якщо знаєте. Що ближче до справжньої дати, то більше очок.',
          type: 'text'
        },
        {
          title: 'Як грати',
          icon: Search,
          content: [
            'Оберіть рік повзунком, кнопками − і + або впишіть його. Якщо в фото відомий день, можна додати день і місяць.',
            'Натисніть «Відповісти» — відповідь остаточна. Суперники бачать лише, що ви відповіли.',
            'Раунд закінчується, коли відповіли всі або вийшов час. Немає відповіді — 0 очок.',
            'Після раунду — шкала з відповідями всіх кольоровими бульбашками, правильна дата й розповідь про фото чи картину та її автора.'
          ],
          type: 'list'
        },
        {
          title: 'Очки',
          icon: Target,
          content: [
            'Рік: 1000 за точний рік, менше — що далі. Допуск росте з віком знімка: помилка на 5 років у фото 1840-х майже не коштує очок (близько 900), у фото 1960-х — близько 700, у фото останніх років — майже все (близько 80). Картини рахуються так само: у полотна XVI століття й помилка на 20 років дає понад 800.',
            'Дата — це ставка: день у день +300, тиждень +143, місяць −53, далі до −100. Не впевнені — залиште лише рік.',
            'Місця: трьом найточнішим +100, +60 і +30; останньому місцю бонусу немає.',
            'Час: очки тануть із першої секунди, до кінця раунду — до −200. Хто відповів раніше, той втратив менше.',
            'Очки раунду не бувають меншими за 0. Підсумок — сума раундів.'
          ],
          type: 'list'
        },
        {
          title: 'Налаштування',
          icon: Clock,
          content: [
            'Що вгадуємо: фото (за замовчуванням), живопис або все разом — тоді кожен раунд фото або картина порівну.',
            'Епоха: увесь час або одна з епох. У фото — 1800–1899 (знімки з 1839 року), 1900–1945, 1946–2000, з 2001. У живопису — до 1600, 1600–1799, 1800–1899, 1900–1945: картин, пізніших за 1945, на вільних ліцензіях майже немає.',
            'Складність: найвідоміша третина — «Легко», найменш відома — «Складно».',
            'Режим 18+ (у додаткових налаштуваннях) додає бої, катастрофи й оголену натуру у фотомистецтві, а в живописі — оголену натуру, битви, розп’яття, мучеників і страти. Тіл загиблих і страт на фото немає й у ньому, а крові, тортур і відрубаних голів — ніде. «Лише 18+» показує тільки такі знімки й картини.'
          ],
          type: 'list'
        },
        {
          title: 'Керування',
          icon: Keyboard,
          content: [
            '← і → — рік на один назад або вперед, із Shift — на десять.',
            'Enter — відповісти.',
            'Після раунду Enter натискає «Далі».'
          ],
          type: 'list'
        },
        {
          title: 'Звідки фото й картини',
          icon: Eye,
          content: 'Фотографії — з Wikimedia Commons, куди їх передали музеї, бібліотеки й архіви (Бібліотека Конгресу, Національний архів Нідерландів, Федеральний архів Німеччини та інші), і з Вікіданих. Картини — з Вікіданих: лише ті, про які є статті хоча б у двох Вікіпедіях і в яких точно відомий рік, без «близько» й «між»; зображення — з Wikimedia Commons. Усе завантажується просто із сайтів Wikimedia; після раунду видно автора, ліцензію й посилання на файл. Timler не пов’язаний із фондом Вікімедіа.',
          type: 'text'
        }
      ]
    },
    songler: {
      title: 'Songler',
      description: 'Вгадайте пісню за уривком',
      sections: [
        {
          title: 'Мета гри',
          icon: Trophy,
          content: 'Усім грає та сама пісня — спершу пів секунди. Назвіть її: що коротший уривок, за яким ви її впізнали, то більше очок.',
          type: 'text'
        },
        {
          title: 'Як грати',
          icon: Search,
          content: [
            'Натисніть ▶ — пролунає уривок. Слухати його можна скільки завгодно разів.',
            'Почніть вводити назву або виконавця й оберіть пісню з підказок. Підказки — з усіх пісень гри, не лише з категорії.',
            'Не вгадали або натиснули «Пропустити» — уривок стає довшим: 0,5 → 1 → 2 → 4 → 8 → 15 секунд. Усього шість спроб.',
            'Раунд закінчується, коли всі вгадали або вичерпали спроби, або вийшов час. Після раунду — обкладинка, назва, виконавець, увесь 30-секундний уривок і відповіді всіх.'
          ],
          type: 'list'
        },
        {
          title: 'Очки',
          icon: Target,
          content: [
            'Вгадали з першої спроби — 1000, з другої — 800, далі 600, 400, 250 і 100.',
            'Назвали іншу пісню того самого виконавця, але так і не вгадали — 100 утішних.',
            'Місця: трьом, хто вгадав за найменшу кількість спроб (у разі рівності — хто швидше), +100, +60 і +30; останньому місцю бонусу немає.',
            'Час: очки тануть із першої секунди, до кінця раунду — до −200.',
            'Очки раунду не бувають меншими за 0. Підсумок — сума раундів.'
          ],
          type: 'list'
        },
        {
          title: 'Налаштування',
          icon: Clock,
          content: [
            'Категорія: усе поспіль, хіти зараз, десятиліття від 60-х до 2020-х, жанри (поп, рок, метал, хіп-хоп, електроніка, латино, K-pop, джаз, класика та інші), музика з кіно, ігор і аніме, Євробачення, Різдво, а також російська поп-музика, російський рок і реп, радянська естрада та українська музика.',
            'Складність: найпопулярніша третина пісень категорії — «Легко», найменш популярна — «Складно».',
            'Раунди й час на раунд.'
          ],
          type: 'list'
        },
        {
          title: 'Керування',
          icon: Keyboard,
          content: [
            'Пробіл — програти уривок (коли курсор не в полі введення).',
            '↑ і ↓ — обрати підказку, Enter — відповісти нею, Esc — сховати підказки.',
            'Після раунду Enter натискає «Далі».'
          ],
          type: 'list'
        },
        {
          title: 'Звідки музика',
          icon: Eye,
          content: 'Пісні й 30-секундні уривки — з Deezer: редакторські плейлисти за десятиліттями й жанрами та найпопулярніші треки відомих виконавців. Уривок обирає Deezer — зазвичай це середина пісні або приспів, а не самий початок. Звук завантажується просто із серверів Deezer. Songler не пов’язаний із Deezer.',
          type: 'text'
        }
      ]
    }
  }
};