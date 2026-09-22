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
export const POLICY_UPDATED = '2026-09-22';

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
          'Завершённые комнаты удаляются автоматически через сутки, брошенное лобби — через десять минут после того, как его закрыл последний игрок, прерванный матч — через семь дней.',
          'Статистика. Если вы вошли в аккаунт, результаты партий записываются в профиль: сколько сыграно, выиграно и сколько это заняло. Из этого складываются страницы прогресса и достижений.',
          'Гостевые аккаунты. Гостевой вход создаёт временную учётную запись без почты и пароля. Если ею не пользоваться 30 дней, она удаляется вместе со статистикой.'
        ]
      },
      {
        title: 'Аккаунт',
        body: [
          'При регистрации хранятся адрес почты, никнейм и аватарка, если вы её загрузили. Почта нужна для входа и восстановления пароля; другим игрокам она не видна — доступ к этому полю закрыт на уровне базы данных.',
          'Паролей мы не храним и не видим: аутентификацией занимается Supabase, пароль передаётся туда напрямую.',
          'Вход через Google передаёт нам имя, адрес почты и ссылку на аватарку из вашего профиля Google. Больше ничего.'
        ]
      },
      {
        title: 'Аналитика',
        body: [
          'Мы используем Google Analytics, чтобы понимать, во что играют и что ломается. Он не загружается, пока вы не нажали «Разрешить»: до этого момента скрипт Google просто отсутствует на странице и не может ни поставить, ни прочитать cookie.',
          'Если вы разрешили, отправляются обезличенные события: какая игра, сколько игроков, сколько длилась партия, какая ошибка произошла. Ваш идентификатор, никнейм, почта и содержимое партии в Google не уходят.',
          'Отдельно про ссылки: ссылка на комнату — это приглашение, а у приватной комнаты она единственное, что отделяет её от посторонних. Поэтому идентификаторы комнат вырезаются из адресов до отправки и в Google не попадают.',
          'Рекламные функции Google отключены, IP-адрес обезличивается. Решение можно изменить в любой момент, очистив данные сайта в браузере.'
        ]
      },
      {
        title: 'Кому передаются данные',
        body: [
          'Supabase — база данных и аутентификация, хранит всё перечисленное выше.',
          'Vercel — хостинг, обрабатывает запросы к сайту и ведёт технические логи.',
          'Google Analytics — только с вашего согласия и только обезличенные события.',
          'Мы не продаём данные и не передаём их рекламным сетям.'
        ]
      },
      {
        title: 'Ваши права',
        body: [
          'Аккаунт можно удалить в настройках профиля — вместе с ним удаляются профиль и вся статистика.',
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
          'Finished rooms are deleted automatically after a day, an abandoned lobby ten minutes after the last player closed it, and an interrupted match after seven days.',
          'Statistics. If you are signed in, results are recorded against your profile: matches played, won, and how long they took. The progress and achievements pages are built from these.',
          'Guest accounts. Guest sign-in creates a temporary account with no email and no password. Left unused for 30 days, it is deleted along with its statistics.'
        ]
      },
      {
        title: 'Your account',
        body: [
          'If you register we keep your email address, your nickname and your avatar if you uploaded one. The email is used for signing in and password recovery; other players cannot see it — access to that column is closed at the database level.',
          'We neither store nor see passwords: authentication is handled by Supabase, and the password goes to it directly.',
          'Signing in with Google gives us the name, email address and avatar URL from your Google profile. Nothing else.'
        ]
      },
      {
        title: 'Analytics',
        body: [
          'We use Google Analytics to understand what people play and what breaks. It is not loaded until you have pressed "Allow": until then the Google script is simply not on the page, and can neither set nor read a cookie.',
          'If you allow it, anonymous events are sent: which game, how many players, how long a match ran, which error occurred. Your identifier, nickname, email and anything from the match itself do not go to Google.',
          'One thing in particular: a room link is an invitation, and for a private room it is the only thing standing between it and a stranger. Room identifiers are therefore stripped from addresses before anything is reported, and never reach Google.',
          'Google advertising features are switched off and IP addresses are anonymised. You can change your answer at any time by clearing the site data in your browser.'
        ]
      },
      {
        title: 'Who else sees the data',
        body: [
          'Supabase — the database and authentication; it holds everything listed above.',
          'Vercel — hosting; it serves requests to the site and keeps technical logs.',
          'Google Analytics — only with your consent, and only anonymous events.',
          'We do not sell data and do not pass it to advertising networks.'
        ]
      },
      {
        title: 'Your rights',
        body: [
          'You can delete your account from the profile settings — your profile and all of your statistics go with it.',
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
  }
};
