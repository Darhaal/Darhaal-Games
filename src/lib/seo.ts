/**
 * SEO helpers: URL construction, hreflang alternates and JSON-LD builders.
 *
 * Locale strategy — English is the default and lives at the bare path
 * (`/games/coup`), like the app itself; Russian is a parallel tree under `/ru`
 * (`/ru/games/coup`). Only the locales in `INDEXED_LOCALES` are offered to
 * search engines: the rest render `noindex, follow`, stay out of the sitemap
 * and out of hreflang. Adding `'ru'` there turns the Russian tree back on —
 * pages, sitemap and hreflang pairs — with nothing else to touch.
 *
 * Server-safe: pure data, no React and no client imports.
 */

import type { Metadata } from 'next';
import { APP_NAME, APP_TAGLINE, AUTHOR, COMPANY_NAME, COMPANY_URL, DEFAULT_LOCALE, SITE_URL, SOURCE_URL } from '@/constants/app';
import type { GameContent, GameFaq, Locale } from '@/content/games';
import { GAME_COUNT_COPY } from '@/content/gameCount';
import { PRIVACY_CONTENT } from '@/content/privacy';
import { CHANGELOG_COPY } from '@/content/changelog';

/** Absolute URL for a site-relative path (`/games` → `https://…/games`). */
export const absoluteUrl = (path = '/'): string =>
  new URL(path.startsWith('/') ? path : `/${path}`, SITE_URL).toString();

/**
 * Locales offered to search engines. Russian is left out for now (decided
 * 2026-10-05): the site is English by default and the audience to find first
 * searches in English.
 */
export const INDEXED_LOCALES: readonly Locale[] = ['en'];

export const isIndexed = (locale: Locale): boolean => INDEXED_LOCALES.includes(locale);

/**
 * Locale-aware path. English keeps the bare path, Russian is prefixed with
 * `/ru`. Passing `/` yields `/` and `/ru` respectively.
 */
export const localizedPath = (locale: Locale, path = '/'): string => {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`;
};

/**
 * `alternates` block for a public page: canonical for the current locale, plus
 * an hreflang pair once more than one locale is indexed — a pair pointing at a
 * `noindex` page is one search engines reject. `path` is the
 * locale-independent path (`/games/coup`).
 */
export const buildAlternates = (locale: Locale, path = '/'): Metadata['alternates'] => ({
  canonical: absoluteUrl(localizedPath(locale, path)),
  ...(INDEXED_LOCALES.length > 1 && {
    languages: {
      ...Object.fromEntries(INDEXED_LOCALES.map((l) => [l, absoluteUrl(localizedPath(l, path))])),
      'x-default': absoluteUrl(localizedPath(DEFAULT_LOCALE, path))
    }
  })
});

/**
 * `robots` for a public page: nothing (the root layout's `index, follow`) for
 * an indexed locale, `noindex, follow` for the rest — the links still count,
 * the page just is not listed.
 */
const indexing = (locale: Locale): Pick<Metadata, 'robots'> =>
  isIndexed(locale) ? {} : { robots: { index: false, follow: true } };

/** Metadata shared by every page that must stay out of the index. */
export const NOINDEX: Metadata = {
  robots: { index: false, follow: false, nocache: true }
};

/** BCP-47 tag for the `<html lang>` attribute and JSON-LD `inLanguage`. */
export const htmlLang = (locale: Locale): string => locale;

/* -------------------------------------------------------------------------- */
/* JSON-LD builders                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The company and the developer carry the same @ids okhten.com gives them, so
 * a search engine reads both sites as one person and one company rather than
 * guessing. A brand nobody searched for yet ("darhaal games" was corrected to
 * "darfall games") has nothing else to stand on.
 */
export const ORGANIZATION_ID = 'https://okhtengroup.com/#organization';
export const PERSON_ID = 'https://okhten.com/#artem-okhten';
const WEBSITE_ID = `${absoluteUrl('/')}#website`;

export const personJsonLd = () => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: AUTHOR.name.en,
  alternateName: [AUTHOR.name.ru, AUTHOR.handle],
  nationality: { '@type': 'Country', name: 'Ukraine' },
  url: AUTHOR.url,
  sameAs: [AUTHOR.github, AUTHOR.linkedin]
});

export const organizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: COMPANY_NAME,
  url: COMPANY_URL,
  founder: personJsonLd(),
  brand: {
    '@type': 'Brand',
    name: APP_NAME,
    url: absoluteUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/logo512.png'),
      width: 512,
      height: 512
    }
  }
});

/** Both locales: one site, English at the bare path and Russian under /ru. */
export const websiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: APP_NAME,
  alternateName: [AUTHOR.handle, `${APP_NAME} Platform`],
  url: absoluteUrl('/'),
  inLanguage: ['ru', 'en'],
  creator: { '@id': PERSON_ID },
  publisher: { '@id': ORGANIZATION_ID },
  sameAs: [SOURCE_URL]
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
    author: { '@id': PERSON_ID },
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

const HOME_TITLE: Record<Locale, string> = {
  ru: `${APP_NAME} — настольные и логические игры онлайн с друзьями`,
  en: `${APP_NAME} — board and logic games online with friends`
};

/**
 * Metadata for the domain root in either locale: `/` and `/ru` are the same
 * app entry with the landing in a different language, declared as a pair.
 */
export const homeMetadata = (locale: Locale): Metadata => ({
  ...indexing(locale),
  title: { absolute: HOME_TITLE[locale] },
  description: APP_TAGLINE[locale],
  alternates: buildAlternates(locale, '/'),
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: HOME_TITLE[locale],
    description: APP_TAGLINE[locale],
    url: absoluteUrl(localizedPath(locale, '/')),
    locale: OG_LOCALE[locale],
    alternateLocale: [OG_LOCALE[locale === 'ru' ? 'en' : 'ru']]
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE[locale],
    description: APP_TAGLINE[locale]
  }
});

/** Metadata for the /games hub in the given locale. */
/**
 * Metadata for the privacy policy, in the given locale.
 *
 * `robots: index` on purpose — a policy nobody can find is not a policy.
 */
export const privacyMetadata = (locale: Locale): Metadata => {
  const copy = PRIVACY_CONTENT[locale];
  const url = absoluteUrl(localizedPath(locale, '/privacy'));

  return {
    ...indexing(locale),
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: buildAlternates(locale, '/privacy'),
    openGraph: {
      type: 'article',
      title: copy.metaTitle,
      description: copy.metaDescription,
      url,
      locale: OG_LOCALE[locale]
    },
    twitter: {
      card: 'summary',
      title: copy.metaTitle,
      description: copy.metaDescription
    }
  };
};

/** Metadata for the changelog — every version with its date, in the given locale. */
export const changelogMetadata = (locale: Locale): Metadata => {
  const copy = CHANGELOG_COPY[locale];
  const url = absoluteUrl(localizedPath(locale, '/changelog'));

  return {
    ...indexing(locale),
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: buildAlternates(locale, '/changelog'),
    openGraph: {
      type: 'article',
      title: copy.metaTitle,
      description: copy.metaDescription,
      url,
      locale: OG_LOCALE[locale]
    },
    twitter: {
      card: 'summary',
      title: copy.metaTitle,
      description: copy.metaDescription
    }
  };
};

export const hubMetadata = (locale: Locale): Metadata => {
  const copy = HUB_COPY[locale];
  const url = absoluteUrl(localizedPath(locale, '/games'));

  return {
    ...indexing(locale),
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
    ...indexing(locale),
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
