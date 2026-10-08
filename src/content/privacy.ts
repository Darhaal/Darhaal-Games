import type { Locale } from '@/games/registry';

/**
 * The privacy policy.
 *
 * Written from what the code actually does, not from a template. Every claim
 * here is checkable against a file: the redaction list in
 * `src/constants/analytics.ts`, the consent gate in
 * `src/components/Analytics.tsx`, the column grants in `supabase/migrations/`.
 * A policy that describes a different application is worse than none.
 */

export interface PolicySection {
  title: string;
  body: string[];
}

export interface PolicyCopy {
  metaTitle: string;
  metaDescription: string;
  title: string;
  updated: string;
  intro: string[];
  sections: PolicySection[];
  contactTitle: string;
  contact: string[];
}

/** Changed by hand when the policy changes — never a build timestamp. */
export const POLICY_UPDATED = '2026-10-07';

export const PRIVACY_CONTENT: Record<Locale, PolicyCopy> = {
  ru: {
    metaTitle: 'Политика конфиденциальности',
    metaDescription:
      'Какие данные собирает Darhaal Games, зачем, сколько они хранятся и как их удалить. Аналитика — только с вашего согласия.',
    title: 'Политика конфиденциальности',
    updated: 'Обновлено',
    intro: [
      'Darhaal Games — платформа для игр с друзьями в браузере. Здесь описано, какие данные мы собираем, зачем и что с ними можно сделать.',
      'Коротко: чтобы играть, аккаунт не нужен — гостевой вход не спрашивает ни почту, ни имя. Аналитика не включается, пока вы не разрешите, и без неё сайт работает точно так же.'
    ],
    sections: [
      {
        title: 'Что хранится, пока вы играете',
        body: [
          'Комната и партия. Пока комната существует, в ней хранится её состояние: кто за столом, ход игры, счёт. Никнейм и аватарка видны другим игрокам в той же комнате — в этом и смысл.',
          'Чат. Сообщения в чате комнаты видят только те, кто в ней сидит, — у остальных, даже со ссылкой, доступа к ним нет на уровне базы данных. Сообщение подписывается вашим никнеймом из комнаты и удаляется вместе с комнатой, по тем же срокам, что ниже. В аналитику текст сообщений не попадает.',
          'Завершённые комнаты удаляются автоматически через сутки, брошенное лобби — через десять минут после того, как его закрыл последний игрок, прерванный матч — через полчаса, если его никто не открывал и в нём не было ходов.',
          'Статистика. Если вы вошли в аккаунт, каждая сыгранная партия записывается в профиль: какая игра, выиграна ли, сколько длилась, когда была, и немного о её ходе (например, сколько кораблей потеряно или флагов угадано). Из этого складываются история матчей, достижения и уровень на странице прогресса. Эти записи видите только вы.',
          'Гостевые аккаунты. Гостевой вход создаёт временную учётную запись без почты и пароля. Если ею не пользоваться 30 дней, она удаляется вместе со статистикой. Чтобы этого не случилось, гостевой профиль можно сделать постоянным: привязать почту или Google в настройках — статистика и достижения останутся с вами.',
          'Настройки — тема, язык, громкость, уведомления, чат — хранятся только в вашем браузере. Системные уведомления о ходе показывает сам браузер, и только если вы их разрешили; на наш сервер при этом ничего не уходит.'
        ]
      },
      {
        title: 'Аккаунт',
        body: [
          'При регистрации хранятся адрес почты, никнейм и аватарка, если вы её загрузили. Почта нужна для входа и восстановления пароля; другим игрокам она не видна — доступ к этому полю закрыт на уровне базы данных. Сменить почту можно в настройках; подтверждение приходит и на старый, и на новый адрес.',
          'Паролей мы не храним и не видим: аутентификацией занимается Supabase, пароль передаётся туда напрямую.',
          'Вход через Google передаёт нам имя, адрес почты и ссылку на аватарку из вашего профиля Google. Больше ничего.'
        ]
      },
      {
        title: 'Аналитика',
        body: [
          'Мы считаем, во что играют и что ломается. Сбор не начинается, пока вы не нажали «Разрешить».',
          'Google Analytics не загружается в ваш браузер. Скрипты Google на страницах отсутствуют, cookie Google не ставятся. Страница отправляет событие на наш собственный адрес, а дальше его передаём мы, со своего сервера.',
          'Поэтому ваш IP-адрес в Google не попадает: с их стороны виден адрес нашего сервера, а не ваш.',
          'Что отправляется: какая игра, сколько игроков, сколько длилась партия, какая ошибка произошла, и на какой странице это было. Список допустимых полей фиксирован в коде, всё остальное сервер отбрасывает, не передавая. Ваш идентификатор, никнейм, почта и содержимое партии не отправляются.',
          'Отдельно про ссылки: ссылка на комнату — это приглашение, а у приватной комнаты она единственное, что отделяет её от посторонних. Идентификаторы комнат вырезаются из адреса дважды — в браузере и ещё раз на сервере, который не доверяет пришедшему. Сам адрес страницы для Google собирает наш сервер, а не браузер.',
          'Чтобы отличать одного посетителя от другого, при согласии создаётся случайный идентификатор и хранится в вашем браузере. Он ни из чего не выводится, ничего о вас не значит и исчезает, когда вы очищаете данные сайта. При отказе он удаляется.'
        ]
      },
      {
        title: 'Кому передаются данные',
        body: [
          'Supabase — база данных и аутентификация, хранит всё перечисленное выше.',
          'Vercel — хостинг, обрабатывает запросы к сайту и ведёт технические логи.',
          'Google Analytics — только с вашего согласия и только обезличенные события.',
          'Википедия и Wikimedia Commons (фонд Викимедиа) — только в играх Wikiler и Timler: ваш браузер сам загружает оттуда статьи и фотографии, поэтому Викимедиа видит ваш IP-адрес и что загружено, как при обычном чтении Википедии. Ваш идентификатор, никнейм и ходы в игре туда не передаются. Как Википедия обращается с этими данными — в её политике конфиденциальности: foundation.wikimedia.org/wiki/Policy:Privacy_policy/ru.',
          'Deezer — только в игре Songler: ваш браузер сам загружает оттуда 30-секундные отрывки песен и обложки, поэтому Deezer видит ваш IP-адрес и какие песни загружены. Ссылку на отрывок для каждого раунда наш сервер запрашивает у Deezer по номеру песни — без ваших данных. Ваш идентификатор, никнейм и ответы туда не передаются. Политика Deezer: deezer.com/legal/personal-datas.',
          'Мы не продаём данные и не передаём их рекламным сетям.'
        ]
      },
      {
        title: 'Ваши права',
        body: [
          'Аккаунт можно удалить в настройках: «Аккаунт» → «Удалить аккаунт». Вместе с ним сразу и навсегда удаляются профиль, статистика, история матчей, достижения, загруженные аватарки и комнаты, которые вы создали.',
          'От аналитики можно отказаться: при первом визите или позже, очистив данные сайта.',
          'Чтобы получить копию своих данных или удалить их вручную, напишите нам.'
        ]
      },
      {
        title: 'Дети',
        body: [
          'Сервис не предназначен для детей младше 13 лет, и мы сознательно не собираем их данные.'
        ]
      }
    ],
    contactTitle: 'Связаться',
    contact: ['По любым вопросам о данных пишите на okhtengroup@gmail.com.']
  },

  en: {
    metaTitle: 'Privacy policy',
    metaDescription:
      'What Darhaal Games collects, why, how long it is kept and how to remove it. Analytics runs only if you allow it.',
    title: 'Privacy policy',
    updated: 'Updated',
    intro: [
      'Darhaal Games is a platform for playing with friends in the browser. This describes what we collect, why, and what you can do about it.',
      'In short: you do not need an account to play — guest sign-in asks for neither an email nor a name. Analytics does not start until you allow it, and the site works exactly the same without it.'
    ],
    sections: [
      {
        title: 'What is kept while you play',
        body: [
          'The room and the match. For as long as a room exists it holds its state: who is at the table, the position, the score. Your nickname and avatar are visible to the other players in that room, which is the point of them.',
          'Chat. A room’s chat can be read only by the people seated in it — anyone else, even holding the link, is refused at the database level. A message is signed with your nickname from the room and is deleted along with the room, on the schedule below. The text of messages is never sent to analytics.',
          'Finished rooms are deleted automatically after a day, an abandoned lobby ten minutes after the last player closed it, and an interrupted match after half an hour in which nobody had it open and nobody moved.',
          'Statistics. If you are signed in, every match you finish is recorded against your profile: which game, whether you won, how long it took, when, and a little about how it went (ships lost, flags named). Your match history, achievements and level on the progress page are built from these. Only you can see them.',
          'Guest accounts. Guest sign-in creates a temporary account with no email and no password. Left unused for 30 days, it is deleted along with its statistics. To keep it, make the guest profile permanent by adding an email or Google in the settings — the statistics and achievements stay with you.',
          'Settings — theme, language, volume, notifications, chat — are kept only in your browser. System notifications about your turn are shown by the browser itself, and only if you allowed them; nothing is sent to our server for them.'
        ]
      },
      {
        title: 'Your account',
        body: [
          'If you register we keep your email address, your nickname and your avatar if you uploaded one. The email is used for signing in and password recovery; other players cannot see it — access to that column is closed at the database level. You can change it in the settings; the change is confirmed at both the old and the new address.',
          'We neither store nor see passwords: authentication is handled by Supabase, and the password goes to it directly.',
          'Signing in with Google gives us the name, email address and avatar URL from your Google profile. Nothing else.'
        ]
      },
      {
        title: 'Analytics',
        body: [
          'We count what people play and what breaks. Nothing is collected until you have pressed "Allow".',
          'Google Analytics does not load in your browser. There is no Google script on these pages and no Google cookie is set. The page sends an event to an address of our own, and we forward it from our server.',
          'Your IP address therefore does not reach Google: what they see is our server’s address, not yours.',
          'What is sent: which game, how many players, how long a match ran, which error occurred, and which page it happened on. The list of permitted fields is fixed in the code and the server discards anything else rather than passing it on. Your identifier, nickname, email and anything from the match itself are not sent.',
          'One thing in particular: a room link is an invitation, and for a private room it is the only thing standing between it and a stranger. Room identifiers are stripped from the address twice — in the browser and again on the server, which does not trust what arrived. The page address Google receives is assembled by our server, not taken from your browser.',
          'To tell one visitor’s events from another’s, a random identifier is created when you consent and kept in your browser. It is derived from nothing, means nothing about you, and goes when you clear the site data. Declining deletes it.'
        ]
      },
      {
        title: 'Who else sees the data',
        body: [
          'Supabase — the database and authentication; it holds everything listed above.',
          'Vercel — hosting; it serves requests to the site and keeps technical logs.',
          'Google Analytics — only with your consent, and only anonymous events.',
          'Wikipedia and Wikimedia Commons (the Wikimedia Foundation) — only in Wikiler and Timler: your browser loads the articles and photographs from them directly, so Wikimedia sees your IP address and what was loaded, just as when you read Wikipedia. Your identifier, nickname and moves in the game are not sent. How Wikipedia handles that data is in its privacy policy: foundation.wikimedia.org/wiki/Policy:Privacy_policy.',
          'Deezer — only in Songler: your browser loads the 30-second song previews and album covers from it directly, so Deezer sees your IP address and which songs were loaded. Our server asks Deezer for each round’s preview link by the song’s number alone — none of your data goes with it. Your identifier, nickname and answers are not sent. Deezer’s policy: deezer.com/legal/personal-datas.',
          'We do not sell data and do not pass it to advertising networks.'
        ]
      },
      {
        title: 'Your rights',
        body: [
          'You can delete your account in the settings: Account → Delete account. Your profile, statistics, match history, achievements, uploaded avatars and the rooms you created go with it, at once and for good.',
          'You can decline analytics, on your first visit or later by clearing the site data.',
          'For a copy of your data, or to have it removed by hand, write to us.'
        ]
      },
      {
        title: 'Children',
        body: [
          'The service is not intended for children under 13, and we do not knowingly collect their data.'
        ]
      }
    ],
    contactTitle: 'Contact',
    contact: ['For anything about your data, write to okhtengroup@gmail.com.']
  },

  uk: {
    metaTitle: 'Політика конфіденційності',
    metaDescription:
      'Які дані збирає Darhaal Games, навіщо, скільки вони зберігаються і як їх видалити. Аналітика — лише з вашої згоди.',
    title: 'Політика конфіденційності',
    updated: 'Оновлено',
    intro: [
      'Darhaal Games — платформа для ігор із друзями в браузері. Тут описано, які дані ми збираємо, навіщо і що з ними можна зробити.',
      'Коротко: щоб грати, акаунт не потрібен — гостьовий вхід не питає ні пошти, ні імені. Аналітика не вмикається, доки ви не дозволите, і без неї сайт працює так само.'
    ],
    sections: [
      {
        title: 'Що зберігається, поки ви граєте',
        body: [
          'Кімната й партія. Поки кімната існує, у ній зберігається її стан: хто за столом, хід гри, рахунок. Нікнейм і аватарку бачать інші гравці в тій самій кімнаті — у цьому й сенс.',
          'Чат. Повідомлення в чаті кімнати бачать лише ті, хто в ній сидить, — решта, навіть маючи посилання, доступу до них не має на рівні бази даних. Повідомлення підписується вашим нікнеймом із кімнати й видаляється разом із кімнатою, у ті самі терміни, що нижче. В аналітику текст повідомлень не потрапляє.',
          'Завершені кімнати видаляються автоматично через добу, покинуте лобі — через десять хвилин після того, як його закрив останній гравець, перерваний матч — через пів години, якщо його ніхто не відкривав і в ньому не було ходів.',
          'Статистика. Якщо ви ввійшли в акаунт, кожна зіграна партія записується в профіль: яка гра, чи виграна, скільки тривала, коли була, і трохи про її хід (наприклад, скільки кораблів втрачено чи прапорів вгадано). З цього складаються історія матчів, досягнення й рівень на сторінці прогресу. Ці записи бачите лише ви.',
          'Гостьові акаунти. Гостьовий вхід створює тимчасовий обліковий запис без пошти й пароля. Якщо ним не користуватися 30 днів, він видаляється разом зі статистикою. Щоб цього не сталося, гостьовий профіль можна зробити постійним: прив’язати пошту або Google у налаштуваннях — статистика й досягнення залишаться з вами.',
          'Налаштування — тема, мова, гучність, сповіщення, чат — зберігаються лише у вашому браузері. Системні сповіщення про хід показує сам браузер, і лише якщо ви їх дозволили; на наш сервер при цьому нічого не надходить.'
        ]
      },
      {
        title: 'Акаунт',
        body: [
          'Під час реєстрації зберігаються адреса пошти, нікнейм і аватарка, якщо ви її завантажили. Пошта потрібна для входу й відновлення пароля; іншим гравцям вона не видна — доступ до цього поля закрито на рівні бази даних. Змінити пошту можна в налаштуваннях; підтвердження надходить і на стару, і на нову адресу.',
          'Паролів ми не зберігаємо й не бачимо: автентифікацією займається Supabase, пароль передається туди напряму.',
          'Вхід через Google передає нам ім’я, адресу пошти й посилання на аватарку з вашого профілю Google. Більше нічого.'
        ]
      },
      {
        title: 'Аналітика',
        body: [
          'Ми рахуємо, у що грають і що ламається. Збір не починається, доки ви не натиснули «Дозволити».',
          'Google Analytics не завантажується у ваш браузер. Скриптів Google на сторінках немає, cookie Google не встановлюються. Сторінка надсилає подію на нашу власну адресу, а далі її передаємо ми, зі свого сервера.',
          'Тому ваша IP-адреса до Google не потрапляє: з їхнього боку видно адресу нашого сервера, а не вашу.',
          'Що надсилається: яка гра, скільки гравців, скільки тривала партія, яка помилка сталася і на якій сторінці це було. Перелік допустимих полів зафіксовано в коді, усе інше сервер відкидає, не передаючи. Ваш ідентифікатор, нікнейм, пошта й вміст партії не надсилаються.',
          'Окремо про посилання: посилання на кімнату — це запрошення, а для приватної кімнати воно єдине, що відділяє її від сторонніх. Ідентифікатори кімнат вирізаються з адреси двічі — у браузері та ще раз на сервері, який не довіряє тому, що прийшло. Саму адресу сторінки для Google збирає наш сервер, а не браузер.',
          'Щоб відрізняти одного відвідувача від іншого, за згоди створюється випадковий ідентифікатор і зберігається у вашому браузері. Він ні з чого не виводиться, нічого про вас не означає і зникає, коли ви очищаєте дані сайту. У разі відмови його буде видалено.'
        ]
      },
      {
        title: 'Кому передаються дані',
        body: [
          'Supabase — база даних і автентифікація, зберігає все перелічене вище.',
          'Vercel — хостинг, обробляє запити до сайту й веде технічні журнали.',
          'Google Analytics — лише з вашої згоди й лише знеособлені події.',
          'Вікіпедія та Wikimedia Commons (фонд Вікімедіа) — лише в іграх Wikiler і Timler: ваш браузер сам завантажує звідти статті й фотографії, тому Вікімедіа бачить вашу IP-адресу та що завантажено, як під час звичайного читання Вікіпедії. Ваш ідентифікатор, нікнейм і ходи в грі туди не передаються. Як Вікіпедія поводиться з цими даними — у її політиці конфіденційності: foundation.wikimedia.org/wiki/Policy:Privacy_policy/uk.',
          'Deezer — лише в грі Songler: ваш браузер сам завантажує звідти 30-секундні уривки пісень і обкладинки, тому Deezer бачить вашу IP-адресу та які пісні завантажено. Посилання на уривок для кожного раунду наш сервер запитує в Deezer за номером пісні — без ваших даних. Ваш ідентифікатор, нікнейм і відповіді туди не передаються. Політика Deezer: deezer.com/legal/personal-datas.',
          'Ми не продаємо дані й не передаємо їх рекламним мережам.'
        ]
      },
      {
        title: 'Ваші права',
        body: [
          'Акаунт можна видалити в налаштуваннях: «Акаунт» → «Видалити акаунт». Разом із ним одразу й назавжди видаляються профіль, статистика, історія матчів, досягнення, завантажені аватарки та кімнати, які ви створили.',
          'Від аналітики можна відмовитися: під час першого візиту або пізніше, очистивши дані сайту.',
          'Щоб отримати копію своїх даних або видалити їх вручну, напишіть нам.'
        ]
      },
      {
        title: 'Діти',
        body: [
          'Сервіс не призначений для дітей до 13 років, і ми свідомо не збираємо їхніх даних.'
        ]
      }
    ],
    contactTitle: 'Зв’язатися',
    contact: ['З будь-яких питань щодо даних пишіть на okhtengroup@gmail.com.']
  }
};
