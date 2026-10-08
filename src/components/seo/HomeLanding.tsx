import Image from 'next/image';
import Link from 'next/link';
import { GAMES_CONTENT, HOME_CONTENT, type Locale } from '@/content/games';
import { APP_NAME, AUTHOR, COPYRIGHT, SOURCE_URL } from '@/constants/app';
import { faqPageJsonLd, localizedPath } from '@/lib/seo';
import JsonLd from './JsonLd';
import { LANGUAGE_LINKS } from '@/lib/locale';

/**
 * Server-rendered content for the domain root.
 *
 * `/` is the application entry and therefore the most authoritative URL on the
 * domain — but the app itself is a client component behind an auth wall, so a
 * crawler used to receive seven words and not a single outbound link. Every
 * public page was reachable only through the sitemap.
 *
 * This renders in the initial HTML regardless of auth state. `HomeClient`
 * hides it before paint for a visitor who already has a session, so a
 * returning player never sees it flash.
 *
 * The copy deliberately does not repeat `/games`: this page explains the
 * platform, the hub helps you choose between the five. Saying the same thing
 * twice would put two of our own pages in the same auction.
 */
export default function HomeLanding({ locale = 'en' }: { locale?: Locale }) {
  const copy = HOME_CONTENT[locale];

  return (
    <div lang={locale} className="w-full bg-page text-gray-900 font-sans">
      <JsonLd data={faqPageJsonLd(copy.faq)} />

      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-10 text-center">
        <div className="w-12 h-12 mx-auto bg-surface border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
          <Image src="/logo512.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
        </div>

        <p className="mt-6 text-2xs font-black uppercase tracking-widest text-muted">
          {APP_NAME}
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-black tracking-tighter leading-[1.05] text-gray-900">
          {copy.heroTitle}
        </h1>
        <p className="mt-6 text-base md:text-lg text-gray-500 font-medium leading-relaxed max-w-2xl mx-auto">
          {copy.heroLead}
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 md:px-6 pb-4 space-y-4">
        {copy.about.map((paragraph, i) => (
          <p key={i} className="text-base text-gray-600 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </section>

      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-12">
        <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-gray-900">
          {copy.gamesTitle}
        </h2>
        <p className="mt-3 text-sm md:text-base text-gray-500 font-medium max-w-2xl">
          {copy.gamesLead}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES_CONTENT.map((game) => {
            const g = game.locales[locale];
            const range =
              game.players.min === game.players.max
                ? `${game.players.min}`
                : `${game.players.min}–${game.players.max}`;

            return (
              <article
                key={game.slug}
                className="group relative bg-surface border border-gray-200 rounded-[24px] p-6 flex flex-col transition-all duration-300 hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-1"
              >
                <div
                  className="w-10 h-1.5 rounded-full mb-5"
                  style={{ backgroundColor: game.accent }}
                  aria-hidden
                />
                <h3 className="text-xl font-black tracking-tight text-gray-900">
                  <Link
                    href={localizedPath(locale, `/games/${game.slug}`)}
                    className="after:absolute after:inset-0 focus:outline-none"
                  >
                    {g.name}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-gray-500 font-medium leading-relaxed flex-1">
                  {g.tagline}
                </p>
                <div className="mt-4 text-2xs font-bold uppercase tracking-wider text-gray-400">
                  {range} · ~{game.playtimeMinutes} {{ ru: 'мин', en: 'min', uk: 'хв' }[locale]}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-14">
        <ol className="grid gap-4 md:grid-cols-3">
          {copy.steps.map((step, i) => (
            <li key={i} className="bg-surface border border-gray-200 rounded-[24px] p-6">
              <div className="w-7 h-7 rounded-full bg-ink text-on-ink text-xs font-black flex items-center justify-center">
                {i + 1}
              </div>
              <h3 className="mt-4 text-lg font-black tracking-tight text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-3xl mx-auto px-4 md:px-6 pt-14">
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {copy.faq.map((item, i) => (
            <div key={i} className="py-5">
              <h3 className="text-base font-black tracking-tight text-gray-900">{item.q}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-14 pb-6">
        <div className="bg-night rounded-[28px] px-8 py-10 md:px-12 md:py-14 text-center">
          <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-white">
            {copy.ctaTitle}
          </h2>
          <p className="mt-3 text-sm md:text-base text-white/60 font-medium max-w-xl mx-auto">
            {copy.ctaText}
          </p>
          <Link
            href={localizedPath(locale, '/games')}
            className="inline-block mt-7 bg-accent text-white text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-full hover:bg-surface hover:text-ink transition-colors"
          >
            {copy.ctaButton}
          </Link>
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-4 md:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-2xs font-black tracking-[0.2em] uppercase text-gray-500">
          {COPYRIGHT}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a href={AUTHOR.url} rel="author" className="text-2xs font-bold uppercase tracking-wider text-gray-400 hover:text-accent transition-colors">
            {AUTHOR.name[locale]}
          </a>
          <a href={SOURCE_URL} className="text-2xs font-bold uppercase tracking-wider text-gray-400 hover:text-accent transition-colors">
            GitHub
          </a>
          {LANGUAGE_LINKS.filter((l) => l.locale !== locale).map((l) => (
            <Link
              key={l.locale}
              href={localizedPath(l.locale, '/')}
              hrefLang={l.locale}
              className="text-2xs font-bold uppercase tracking-wider text-gray-400 hover:text-accent transition-colors"
            >
              {l.name}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
