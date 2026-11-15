import type { MetadataRoute } from 'next';
import { CONTENT_REVISION, GAMES_CONTENT } from '@/content/games';
import { INDEXED_LOCALES, absoluteUrl, localizedPath } from '@/lib/seo';
import { POLICY_UPDATED } from '@/content/privacy';

/**
 * Only genuinely public, indexable URLs belong here — the app screens are
 * disallowed in robots.ts and are deliberately absent.
 *
 * Only the indexed locales are listed (`INDEXED_LOCALES`); once there is more
 * than one, every entry carries its hreflang pair so search engines treat the
 * versions as translations rather than duplicates.
 *
 * The changelog is left out on purpose (SEO audit, 2026-11-09): it is
 * crawlable through the footer, but listed here its date moved with every
 * release and asked Google to spend its small crawl budget for this site on
 * release notes instead of the game pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // A fixed content-revision date, never a build timestamp — see the note on
  // CONTENT_REVISION. Date-only precision is deliberate: the copy does not
  // change by the second, and claiming otherwise is noise.
  const lastModified = CONTENT_REVISION;

  const withAlternates = (path: string) =>
    INDEXED_LOCALES.length > 1
      ? {
          alternates: {
            languages: Object.fromEntries(
              INDEXED_LOCALES.map((l) => [l, absoluteUrl(localizedPath(l, path))])
            )
          }
        }
      : {};

  const hub: MetadataRoute.Sitemap = INDEXED_LOCALES.map((locale) => ({
    url: absoluteUrl(localizedPath(locale, '/games')),
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.9,
    ...withAlternates('/games')
  }));

  const privacy: MetadataRoute.Sitemap = INDEXED_LOCALES.map((locale) => ({
    url: absoluteUrl(localizedPath(locale, '/privacy')),
    lastModified: new Date(POLICY_UPDATED),
    changeFrequency: 'yearly',
    priority: 0.3,
    ...withAlternates('/privacy')
  }));

  const details: MetadataRoute.Sitemap = GAMES_CONTENT.flatMap((game) =>
    INDEXED_LOCALES.map((locale) => ({
      url: absoluteUrl(localizedPath(locale, `/games/${game.slug}`)),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      ...withAlternates(`/games/${game.slug}`)
    }))
  );

  const home: MetadataRoute.Sitemap = INDEXED_LOCALES.map((locale) => ({
    url: absoluteUrl(localizedPath(locale, '/')),
    lastModified,
    changeFrequency: 'weekly',
    priority: 1,
    ...withAlternates('/')
  }));

  return [
    ...home,
    ...hub,
    ...details,
    ...privacy
  ];
}
