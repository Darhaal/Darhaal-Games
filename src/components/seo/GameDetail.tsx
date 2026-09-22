import Link from 'next/link';
import { GAMES_CONTENT, type GameContent, type Locale } from '@/content/games';
import {
  breadcrumbJsonLd,
  faqJsonLd,
  howToJsonLd,
  localizedPath,
  videoGameJsonLd
} from '@/lib/seo';
import JsonLd from './JsonLd';
import PublicShell from './PublicShell';

/**
 * A single game's public page — the main ranking surface.
 *
 * Emits VideoGame, HowTo, FAQPage and BreadcrumbList structured data so the
 * player count, the steps and the questions are all eligible for rich results.
 */

const T = {
  ru: {
    crumbGames: 'Игры',
    players: 'Игроки',
    duration: 'Длительность',
    genre: 'Жанр',
    minutes: 'мин',
    howTo: 'Как играть',
    features: 'Особенности',
    strategy: 'Тактика и советы',
    mistakes: 'Частые ошибки',
    faq: 'Частые вопросы',
    play: 'Играть в',
    playButton: 'Играть',
    playNote: 'Откроется платформа — создайте комнату и позовите друзей по ссылке.',
    other: 'Другие игры'
  },
  en: {
    crumbGames: 'Games',
    players: 'Players',
    duration: 'Length',
    genre: 'Genre',
    minutes: 'min',
    howTo: 'How to play',
    features: 'Highlights',
    strategy: 'Tactics and tips',
    mistakes: 'Common mistakes',
    faq: 'Frequently asked questions',
    play: 'Play',
    playButton: 'Play now',
    playNote: 'Opens the platform — create a room and invite friends with a link.',
    other: 'More games'
  }
} as const;

export default function GameDetail({
  game,
  locale
}: {
  game: GameContent;
  locale: Locale;
}) {
  const t = T[locale];
  const copy = game.locales[locale];
  const range =
    game.players.min === game.players.max
      ? `${game.players.min}`
      : `${game.players.min}–${game.players.max}`;
  const others = GAMES_CONTENT.filter((g) => g.slug !== game.slug);
  // "Играть в «Шпион»" — Russian needs the quotes; English reads fine without.
  const playLabel = locale === 'ru' ? `${t.play} «${copy.name}»` : `${t.play} ${copy.name}`;

  return (
    <PublicShell locale={locale}>
      <JsonLd data={videoGameJsonLd(game, locale)} />
      <JsonLd data={howToJsonLd(game, locale)} />
      <JsonLd data={faqJsonLd(game, locale)} />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: t.crumbGames, path: '/games' },
          { name: copy.name, path: `/games/${game.slug}` }
        ])}
      />

      <article className="max-w-3xl mx-auto px-4 md:px-6 pt-10 md:pt-14">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-gray-400">
            <li>
              <Link href={localizedPath(locale, '/games')} className="hover:text-[#9e1316] transition-colors">
                {t.crumbGames}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-gray-900">{copy.name}</li>
          </ol>
        </nav>

        <div className="w-12 h-1.5 rounded-full mb-6" style={{ backgroundColor: game.accent }} aria-hidden />

        <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.05] text-gray-900">
          {copy.name}
        </h1>
        <p className="mt-5 text-lg text-gray-500 font-medium leading-relaxed">{copy.tagline}</p>

        <dl className="mt-8 grid grid-cols-3 gap-3 border-y border-gray-200 py-5">
          <div>
            <dt className="text-2xs font-bold uppercase tracking-wider text-gray-400">{t.players}</dt>
            <dd className="mt-1 text-lg font-black tracking-tight text-gray-900">{range}</dd>
          </div>
          <div>
            <dt className="text-2xs font-bold uppercase tracking-wider text-gray-400">{t.duration}</dt>
            <dd className="mt-1 text-lg font-black tracking-tight text-gray-900">
              ~{game.playtimeMinutes} {t.minutes}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-bold uppercase tracking-wider text-gray-400">{t.genre}</dt>
            <dd className="mt-1 text-sm font-black tracking-tight text-gray-900 leading-tight pt-1">
              {game.genre[locale]}
            </dd>
          </div>
        </dl>

        <div className="mt-8 space-y-4">
          {copy.intro.map((paragraph, i) => (
            <p key={i} className="text-base text-gray-600 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900">{t.howTo}</h2>
          <ol className="mt-5 space-y-3">
            {copy.howToPlay.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-[#1A1F26] text-white text-xs font-black flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-base text-gray-600 leading-relaxed pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900">{t.features}</h2>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {copy.features.map((feature, i) => (
              <li
                key={i}
                className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-600 font-medium leading-snug"
              >
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900">{t.strategy}</h2>
          <ul className="mt-5 space-y-3">
            {copy.strategy.map((tip, i) => (
              <li key={i} className="flex gap-4">
                <span
                  className="shrink-0 w-1.5 h-1.5 rounded-full mt-2.5"
                  style={{ backgroundColor: game.accent }}
                  aria-hidden
                />
                <span className="text-base text-gray-600 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900">{t.mistakes}</h2>
          <ul className="mt-5 space-y-2.5">
            {copy.mistakes.map((item, i) => (
              <li
                key={i}
                className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl px-4 py-3 text-sm text-[#7F1D1D] leading-snug"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900">{t.faq}</h2>
          <div className="mt-5 divide-y divide-gray-200 border-y border-gray-200">
            {copy.faq.map((item, i) => (
              <div key={i} className="py-5">
                <h3 className="text-base font-black tracking-tight text-gray-900">{item.q}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="bg-[#1A1F26] rounded-[28px] px-8 py-10 text-center">
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-white">
              {playLabel}
            </h2>
            <p className="mt-3 text-sm text-gray-400 font-medium max-w-md mx-auto">{t.playNote}</p>
            <Link
              href="/"
              className="inline-block mt-7 bg-[#9e1316] text-white text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-full hover:bg-white hover:text-[#1A1F26] transition-colors"
            >
              {t.playButton}
            </Link>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">{t.other}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={localizedPath(locale, `/games/${other.slug}`)}
                className="bg-white border border-gray-200 rounded-full px-4 py-2 text-xs font-bold text-gray-600 hover:border-[#9e1316]/30 hover:text-[#9e1316] transition-colors"
              >
                {other.locales[locale].name}
              </Link>
            ))}
          </div>
        </section>
      </article>
    </PublicShell>
  );
}
