import type { MetadataRoute } from 'next';
import { CONTENT_REVISION, GAMES_CONTENT } from '@/content/games';
import { absoluteUrl, localizedPath } from '@/lib/seo';
import { POLICY_UPDATED } from '@/content/privacy';

/**
 * Only genuinely public, indexable URLs belong here — the app screens are
 * disallowed in robots.ts and are deliberately absent.
 *
 * Every entry on the /games tree carries its hreflang pair so search engines
 * treat the RU and EN versions as translations rather than duplicates.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // A fixed content-revision date, never a build timestamp — see the note on
  // CONTENT_REVISION. Date-only precision is deliberate: the copy does not
  // change by the second, and claiming otherwise is noise.
  const lastModified = CONTENT_REVISION;

  const withAlternates = (path: string) => ({
    ru: absoluteUrl(localizedPath('ru', path)),
    en: absoluteUrl(localizedPath('en', path))
  });

  const hub: MetadataRoute.Sitemap = (['ru', 'en'] as const).map((locale) => ({
    url: absoluteUrl(localizedPath(locale, '/games')),
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.9,
    alternates: { languages: withAlternates('/games') }
  }));

  const privacy: MetadataRoute.Sitemap = (['ru', 'en'] as const).map((locale) => ({
    url: absoluteUrl(localizedPath(locale, '/privacy')),
    lastModified: new Date(POLICY_UPDATED),
    changeFrequency: 'yearly',
    priority: 0.3,
    alternates: { languages: withAlternates('/privacy') }
  }));

  const details: MetadataRoute.Sitemap = GAMES_CONTENT.flatMap((game) =>
    (['ru', 'en'] as const).map((locale) => ({
      url: absoluteUrl(localizedPath(locale, `/games/${game.slug}`)),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      alternates: { languages: withAlternates(`/games/${game.slug}`) }
    }))
  );

  return [
    {
      url: absoluteUrl('/'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 1
    },
    ...hub,
    ...details,
    ...privacy
  ];
}
