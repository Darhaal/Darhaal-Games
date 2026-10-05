import { describe, it, expect } from 'vitest';
import {
  absoluteUrl,
  localizedPath,
  buildAlternates,
  breadcrumbJsonLd,
  faqJsonLd,
  videoGameJsonLd,
  NOINDEX,
  hubMetadata,
  homeMetadata,
  gameMetadata,
  INDEXED_LOCALES,
  organizationJsonLd,
  websiteJsonLd,
  PERSON_ID,
  ORGANIZATION_ID
} from '@/lib/seo';
import { GAMES_CONTENT, GAME_SLUGS, HOME_CONTENT, getGameContent, CONTENT_REVISION } from '@/content/games';
import sitemap from '@/app/sitemap';

/**
 * These are cheap to get wrong and expensive to notice: a malformed canonical
 * or a broken hreflang pair fails silently in production and only shows up
 * weeks later as pages missing from the index.
 */

describe('localizedPath', () => {
  it('serves English from the bare path', () => {
    expect(localizedPath('en', '/games/coup')).toBe('/games/coup');
    expect(localizedPath('en', '/')).toBe('/');
  });

  it('prefixes Russian with /ru', () => {
    expect(localizedPath('ru', '/games/coup')).toBe('/ru/games/coup');
  });

  it('never produces an empty href for the Russian root', () => {
    expect(localizedPath('ru', '/')).toBe('/ru');
  });
});

describe('absoluteUrl', () => {
  it('produces absolute URLs on the canonical host', () => {
    expect(absoluteUrl('/games')).toBe('https://games.okhten.com/games');
  });

  it('tolerates a missing leading slash', () => {
    expect(absoluteUrl('games')).toBe('https://games.okhten.com/games');
  });
});

describe('indexed locales', () => {
  // Russian is off the index for now (2026-10-05). These pin what that means;
  // adding 'ru' to INDEXED_LOCALES is meant to fail them.
  it('offers English only', () => {
    expect(INDEXED_LOCALES).toEqual(['en']);
  });

  it('points canonical at the current locale', () => {
    expect(buildAlternates('en', '/games/spyfall')?.canonical).toBe('https://games.okhten.com/games/spyfall');
    expect(buildAlternates('ru', '/games/spyfall')?.canonical).toBe('https://games.okhten.com/ru/games/spyfall');
  });

  it('declares no hreflang pair that would point at a noindex page', () => {
    expect(buildAlternates('en', '/games/coup')?.languages).toBeUndefined();
    expect(buildAlternates('ru', '/games/coup')?.languages).toBeUndefined();
  });

  it('keeps Russian pages out of the index but lets their links count', () => {
    const coup = getGameContent('coup')!;
    for (const meta of [homeMetadata('ru'), hubMetadata('ru'), gameMetadata(coup, 'ru')]) {
      expect(meta.robots).toEqual({ index: false, follow: true });
    }
  });

  it('leaves English pages to the root layout robots (index, follow)', () => {
    const coup = getGameContent('coup')!;
    for (const meta of [homeMetadata('en'), hubMetadata('en'), gameMetadata(coup, 'en')]) {
      expect(meta.robots).toBeUndefined();
    }
  });

  it('lists English pages only in the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain('https://games.okhten.com/');
    expect(urls).toContain('https://games.okhten.com/games/timler');
    expect(urls.filter((url) => /\/(ru|en)(\/|$)/.test(url.replace('https://games.okhten.com', '')))).toEqual([]);
  });
});

describe('game content integrity', () => {
  it('exposes a slug for every game', () => {
    expect(GAME_SLUGS).toHaveLength(GAMES_CONTENT.length);
    expect(new Set(GAME_SLUGS).size).toBe(GAME_SLUGS.length); // no duplicates
  });

  it('resolves known slugs and rejects unknown ones', () => {
    expect(getGameContent('coup')?.slug).toBe('coup');
    expect(getGameContent('mafia')).toBeUndefined();
  });

  it('uses a fixed content revision, never a build timestamp', () => {
    expect(CONTENT_REVISION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  for (const game of GAMES_CONTENT) {
    for (const locale of ['ru', 'en'] as const) {
      const copy = game.locales[locale];

      it(`${game.slug}/${locale}: has the fields every page and JSON-LD block needs`, () => {
        expect(copy.name.length).toBeGreaterThan(0);
        expect(copy.metaTitle.length).toBeGreaterThan(0);
        expect(copy.intro.length).toBeGreaterThan(0);
        expect(copy.howToPlay.length).toBeGreaterThan(0);
        expect(copy.faq.length).toBeGreaterThan(0);
      });

      /**
       * The rendered title is `%s · Darhaal Games` — the 16-character brand
       * suffix is part of the budget. Google truncates around 60 characters,
       * and six of nine pages were being cut mid-phrase before this was caught.
       */
      it(`${game.slug}/${locale}: rendered title survives SERP truncation`, () => {
        expect(`${copy.metaTitle} · Darhaal Games`.length).toBeLessThanOrEqual(60);
      });

      it(`${game.slug}/${locale}: meta description stays within snippet length`, () => {
        expect(copy.metaDescription.length).toBeGreaterThanOrEqual(100);
        expect(copy.metaDescription.length).toBeLessThanOrEqual(200);
      });
    }

    it(`${game.slug}: player range is coherent`, () => {
      expect(game.players.min).toBeGreaterThan(0);
      expect(game.players.max).toBeGreaterThanOrEqual(game.players.min);
    });
  }
});

describe('hub metadata', () => {
  for (const locale of ['ru', 'en'] as const) {
    it(`${locale}: rendered hub title survives SERP truncation`, () => {
      const title = hubMetadata(locale).title as string;
      expect(`${title} · Darhaal Games`.length).toBeLessThanOrEqual(60);
    });
  }
});

describe('structured data', () => {
  const coup = getGameContent('coup')!;

  it('emits a VideoGame node with a resolvable url and player range', () => {
    const node = videoGameJsonLd(coup, 'en') as Record<string, unknown>;
    expect(node['@type']).toBe('VideoGame');
    expect(node.url).toBe('https://games.okhten.com/games/coup');
    expect(node.numberOfPlayers).toMatchObject({ minValue: 2, maxValue: 6 });
  });

  it('marks single-player-capable games as such', () => {
    const solo = getGameContent('minesweeper')!;
    const node = videoGameJsonLd(solo, 'ru') as Record<string, unknown>;
    // max > 1, so the listing is a multiplayer one even though solo is allowed
    expect(node.playMode).toBe('MultiPlayer');
  });

  it('turns every FAQ entry into a Question/Answer pair', () => {
    const node = faqJsonLd(coup, 'en') as { mainEntity: unknown[] };
    expect(node.mainEntity).toHaveLength(coup.locales.en.faq.length);
  });

  it('numbers breadcrumbs from 1 and resolves each item', () => {
    const node = breadcrumbJsonLd('ru', [
      { name: 'Игры', path: '/games' },
      { name: 'Переворот', path: '/games/coup' }
    ]) as { itemListElement: { position: number; item: string }[] };

    expect(node.itemListElement[0].position).toBe(1);
    expect(node.itemListElement[1].item).toBe('https://games.okhten.com/ru/games/coup');
  });
});

describe('NOINDEX', () => {
  it('keeps app screens out of the index and stops link-following', () => {
    expect(NOINDEX.robots).toMatchObject({ index: false, follow: false });
  });
});

describe('who is behind the site', () => {
  // okhten.com publishes the developer and the company under these ids; the
  // same ids here are what lets a search engine join the two sites.
  it('reuses the ids okhten.com publishes', () => {
    expect(PERSON_ID).toBe('https://okhten.com/#artem-okhten');
    expect(ORGANIZATION_ID).toBe('https://okhtengroup.com/#organization');
  });

  it('names the developer, the handle and the nationality', () => {
    const founder = organizationJsonLd().founder;
    expect(founder['@id']).toBe(PERSON_ID);
    expect(founder.name).toBe('Artem Okhten');
    expect(founder.alternateName).toEqual(expect.arrayContaining(['Артем Охтень', 'Darhaal']));
    expect(founder.nationality.name).toBe('Ukraine');
  });

  it('credits the developer on the site and on every game', () => {
    expect(websiteJsonLd().creator['@id']).toBe(PERSON_ID);
    for (const game of GAMES_CONTENT) {
      expect((videoGameJsonLd(game, 'en') as { author: { '@id': string } }).author['@id']).toBe(PERSON_ID);
    }
  });

  it('answers it on the home page in both languages', () => {
    for (const [locale, name] of [['ru', 'Артем Охтень'], ['en', 'Artem Okhten']] as const) {
      const answer = HOME_CONTENT[locale].faq.find((item) => item.q.includes('Darhaal Games'));
      expect(answer?.a, locale).toContain(name);
      expect(answer?.a, locale).toMatch(/украинск|Ukrainian/);
    }
  });
});

describe('the home page', () => {
  it('is English at the root and Russian under /ru', () => {
    expect(homeMetadata('en').alternates?.canonical).toBe('https://games.okhten.com/');
    expect(homeMetadata('ru').alternates?.canonical).toBe('https://games.okhten.com/ru');
  });
});
