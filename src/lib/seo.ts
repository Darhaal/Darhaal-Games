/**
 * SEO helpers: URL construction, hreflang alternates and JSON-LD builders.
 *
 * Locale strategy — Russian is canonical and lives at the bare path
 * (`/games/coup`); English is a parallel tree under `/en` (`/en/games/coup`).
 * Every public page therefore declares both alternates plus an `x-default`
 * pointing at the Russian version.
 *
 * Server-safe: pure data, no React and no client imports.
 */

import type { Metadata } from 'next';
import { APP_NAME, COMPANY_NAME, SITE_URL } from '@/constants/app';
import type { GameContent, GameFaq, Locale } from '@/content/games';
import { GAME_COUNT_COPY } from '@/content/gameCount';

/** Absolute URL for a site-relative path (`/games` → `https://…/games`). */
export const absoluteUrl = (path = '/'): string =>
  new URL(path.startsWith('/') ? path : `/${path}`, SITE_URL).toString();

/**
 * Locale-aware path. Russian keeps the bare path, English is prefixed with
 * `/en`. Passing `/` yields `/` and `/en` respectively.
 */
export const localizedPath = (locale: Locale, path = '/'): string => {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return locale === 'en' ? `/en${clean}` || '/en' : clean || '/';
};

/**
 * `alternates` block for a public page: canonical for the current locale plus
 * both hreflang variants. `path` is the locale-independent path (`/games/coup`).
 */
export const buildAlternates = (locale: Locale, path = '/'): Metadata['alternates'] => ({
  canonical: absoluteUrl(localizedPath(locale, path)),
  languages: {
    ru: absoluteUrl(localizedPath('ru', path)),
    en: absoluteUrl(localizedPath('en', path)),
    'x-default': absoluteUrl(localizedPath('ru', path))
  }
});

/** Metadata shared by every page that must stay out of the index. */
export const NOINDEX: Metadata = {
  robots: { index: false, follow: false, nocache: true }
};

/** BCP-47 tag for the `<html lang>` attribute and JSON-LD `inLanguage`. */
export const htmlLang = (locale: Locale): string => (locale === 'en' ? 'en' : 'ru');

/* -------------------------------------------------------------------------- */
/* JSON-LD builders                                                            */
/* -------------------------------------------------------------------------- */

/** Stable @id for the publishing organization, referenced from other nodes. */
const ORGANIZATION_ID = `${absoluteUrl('/')}#organization`;
const WEBSITE_ID = `${absoluteUrl('/')}#website`;

export const organizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: COMPANY_NAME,
  url: absoluteUrl('/'),
  logo: {
    '@type': 'ImageObject',
    url: absoluteUrl('/logo512.png'),
    width: 512,
    height: 512
  },
  brand: {
    '@type': 'Brand',
    name: APP_NAME
  }
});

export const websiteJsonLd = (locale: Locale) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: APP_NAME,
  url: absoluteUrl('/'),
  inLanguage: htmlLang(locale),
  publisher: { '@id': ORGANIZATION_ID }
});

/**
 * VideoGame node for a game detail page. `playMode` and `numberOfPlayers`
 * are what let search engines surface player counts in rich results.
 */
export const videoGameJsonLd = (game: GameContent, locale: Locale) => {
  const copy = game.locales[locale];
  const url = absoluteUrl(localizedPath(locale, `/games/${game.slug}`));

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    '@id': `${url}#game`,
    name: copy.name,
    url,
    description: copy.metaDescription,
    inLanguage: htmlLang(locale),
    genre: game.genre[locale],
    gamePlatform: ['Web browser'],
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    playMode: game.players.max > 1 ? 'MultiPlayer' : 'SinglePlayer',
    numberOfPlayers: {
      '@type': 'QuantitativeValue',
      minValue: game.players.min,
      maxValue: game.players.max
    },
    image: absoluteUrl('/logo512.png'),
    publisher: { '@id': ORGANIZATION_ID },
    isPartOf: { '@id': WEBSITE_ID },
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock'
    }
  };
};

/** FAQPage node for any question list — the hub and the home page use it too. */
export const faqPageJsonLd = (faq: GameFaq[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a
    }
  }))
});

export const faqJsonLd = (game: GameContent, locale: Locale) =>
  faqPageJsonLd(game.locales[locale].faq);

export const howToJsonLd = (game: GameContent, locale: Locale) => {
  const copy = game.locales[locale];
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    // Russian needs the title in quotes to stay grammatical ("играть в «Шпион»")
    name: locale === 'en' ? `How to play ${copy.name}` : `Как играть в «${copy.name}»`,
    inLanguage: htmlLang(locale),
    totalTime: `PT${game.playtimeMinutes}M`,
    step: copy.howToPlay.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text
    }))
  };
};

export const breadcrumbJsonLd = (
  locale: Locale,
  trail: { name: string; path: string }[]
) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((crumb, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: crumb.name,
    item: absoluteUrl(localizedPath(locale, crumb.path))
  }))
});

/* -------------------------------------------------------------------------- */
/* Metadata builders — keep the route files down to a few lines each           */
/* -------------------------------------------------------------------------- */

const HUB_COPY = {
  ru: {
    title: 'Игры онлайн с друзьями — бесплатно',
    description: GAME_COUNT_COPY.ru.hubDescription
  },
  en: {
    title: 'Online games with friends — free',
    description: GAME_COUNT_COPY.en.hubDescription
  }
} as const;

const OG_LOCALE: Record<Locale, string> = { ru: 'ru_RU', en: 'en_US' };

/** Metadata for the /games hub in the given locale. */
export const hubMetadata = (locale: Locale): Metadata => {
  const copy = HUB_COPY[locale];
  const url = absoluteUrl(localizedPath(locale, '/games'));

  return {
    title: copy.title,
    description: copy.description,
    alternates: buildAlternates(locale, '/games'),
    openGraph: {
      type: 'website',
      title: copy.title,
      description: copy.description,
      url,
      locale: OG_LOCALE[locale]
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description
    }
  };
};

/** Metadata for a single game page in the given locale. */
export const gameMetadata = (game: GameContent, locale: Locale): Metadata => {
  const copy = game.locales[locale];
  const url = absoluteUrl(localizedPath(locale, `/games/${game.slug}`));

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: buildAlternates(locale, `/games/${game.slug}`),
    openGraph: {
      type: 'article',
      title: copy.metaTitle,
      description: copy.metaDescription,
      url,
      locale: OG_LOCALE[locale]
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.metaTitle,
      description: copy.metaDescription
    }
  };
};

/** ItemList for the games hub — helps the hub rank as a collection page. */
export const gameListJsonLd = (games: GameContent[], locale: Locale) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: games.map((game, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: game.locales[locale].name,
    url: absoluteUrl(localizedPath(locale, `/games/${game.slug}`))
  }))
});
