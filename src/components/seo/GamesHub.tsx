import Link from 'next/link';
import { GAMES_CONTENT, HUB_CONTENT, type Locale } from '@/content/games';
import { GAME_COUNT_COPY } from '@/content/gameCount';
import { breadcrumbJsonLd, faqPageJsonLd, gameListJsonLd, localizedPath } from '@/lib/seo';
import JsonLd from './JsonLd';
import PublicShell from './PublicShell';

/**
 * The /games hub — a crawlable collection page linking to every game.
 * Shared by the RU route and its /en counterpart; the only difference is the
 * locale passed in.
 */

const T = {
  ru: {
    h1: 'Игры онлайн с друзьями',
    lead: GAME_COUNT_COPY.ru.hubLead,
    players: 'игроков',
    player: 'игрока',
    minutes: 'мин',
    readMore: 'Правила и описание',
    ctaTitle: 'Готовы начать?',
    ctaText: 'Создайте комнату за пару секунд и позовите друзей по ссылке.',
    ctaButton: 'Открыть платформу',
    faqTitle: 'Частые вопросы',
    crumbGames: 'Игры'
  },
  en: {
    h1: 'Online games to play with friends',
    lead: GAME_COUNT_COPY.en.hubLead,
    players: 'players',
    player: 'players',
    minutes: 'min',
    readMore: 'Rules and overview',
    ctaTitle: 'Ready to play?',
    ctaText: 'Create a room in seconds and invite your friends with a link.',
    ctaButton: 'Open the platform',
    faqTitle: 'Frequently asked questions',
    crumbGames: 'Games'
  }
} as const;

export default function GamesHub({ locale }: { locale: Locale }) {
  const t = T[locale];
  const hub = HUB_CONTENT[locale];

  return (
    <PublicShell locale={locale}>
      <JsonLd data={gameListJsonLd(GAMES_CONTENT, locale)} />
      <JsonLd data={faqPageJsonLd(hub.faq)} />
      <JsonLd
        data={breadcrumbJsonLd(locale, [{ name: t.crumbGames, path: '/games' }])}
      />

      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-14 md:pt-20 pb-10">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.05] text-gray-900 max-w-3xl">
          {t.h1}
        </h1>
        <p className="mt-6 text-base md:text-lg text-gray-500 font-medium leading-relaxed max-w-2xl">
          {t.lead}
        </p>
        <div className="mt-6 space-y-4 max-w-2xl">
          {hub.intro.map((paragraph, i) => (
            <p key={i} className="text-base text-gray-600 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-6">
        <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES_CONTENT.map((game) => {
            const copy = game.locales[locale];
            const range =
              game.players.min === game.players.max
                ? `${game.players.min}`
                : `${game.players.min}–${game.players.max}`;

            return (
              <article
                key={game.slug}
                className="group relative bg-white border border-gray-200 rounded-[24px] p-6 flex flex-col transition-all duration-300 hover:border-[#9e1316]/30 hover:shadow-xl hover:shadow-[#9e1316]/5 hover:-translate-y-1"
              >
                <div
                  className="w-10 h-1.5 rounded-full mb-5"
                  style={{ backgroundColor: game.accent }}
                  aria-hidden
                />
                <h2 className="text-2xl font-black tracking-tight text-gray-900">
                  <Link
                    href={localizedPath(locale, `/games/${game.slug}`)}
                    className="after:absolute after:inset-0 focus:outline-none"
                  >
                    {copy.name}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-gray-500 font-medium leading-relaxed flex-1">
                  {copy.tagline}
                </p>

                <dl className="mt-5 flex items-center gap-4 text-2xs font-bold uppercase tracking-wider text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">{t.players}</dt>
                    <dd>
                      {range} {t.players}
                    </dd>
                  </div>
                  <span aria-hidden className="w-px h-3 bg-gray-200" />
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">{game.genre[locale]}</dt>
                    <dd>
                      ~{game.playtimeMinutes} {t.minutes}
                    </dd>
                  </div>
                </dl>

                <span className="mt-4 text-xs font-bold uppercase tracking-wider text-[#9e1316] opacity-0 group-hover:opacity-100 transition-opacity">
                  {t.readMore} →
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-12">
        <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-gray-900">
          {hub.chooseTitle}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {hub.choose.map((item, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-[24px] p-6">
              <h3 className="text-lg font-black tracking-tight text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 md:px-6 pt-14">
        <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-gray-900">{t.faqTitle}</h2>
        <div className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
          {hub.faq.map((item, i) => (
            <div key={i} className="py-5">
              <h3 className="text-base font-black tracking-tight text-gray-900">{item.q}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-14">
        <div className="bg-[#1A1F26] rounded-[28px] px-8 py-10 md:px-12 md:py-14 text-center">
          <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-white">
            {t.ctaTitle}
          </h2>
          <p className="mt-3 text-sm md:text-base text-gray-400 font-medium max-w-xl mx-auto">
            {t.ctaText}
          </p>
          <Link
            href="/"
            className="inline-block mt-7 bg-[#9e1316] text-white text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-full hover:bg-white hover:text-[#1A1F26] transition-colors"
          >
            {t.ctaButton}
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
