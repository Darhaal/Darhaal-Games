import { DEFAULT_LOCALE } from '@/constants/app';

export type Locale = 'ru' | 'en' | 'uk';

/** BCP-47 tags for Intl formatting (numbers, dates) in each interface language. */
export const INTL_LOCALE = { ru: 'ru-RU', en: 'en-GB', uk: 'uk-UA' } as const;

/** The languages a reader can switch to, each named in itself. */
export const LANGUAGE_LINKS: readonly { locale: Locale; name: string; short: string }[] = [
  { locale: 'en', name: 'English', short: 'EN' },
  { locale: 'uk', name: 'Українська', short: 'UA' },
  { locale: 'ru', name: 'Русский', short: 'RU' },
];

/**
 * Locale-aware path. English keeps the bare path, the others are prefixed
 * (`/ru`, `/uk`). Passing `/` yields `/`, `/ru` and `/uk`. Kept here, free of
 * the SEO content, so client components can link without bundling it.
 */
export const localizedPath = (locale: Locale, path = '/'): string => {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return locale === DEFAULT_LOCALE ? clean || '/' : `/${locale}${clean}`;
};
