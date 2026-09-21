# 🔎 SEO

How the crawlable surface of the platform is built, and the rules to follow
when adding a page or a game.

## The problem this solves

Every application route is a `'use client'` component behind an auth wall. A
crawler hitting `/` saw an app shell and nothing else — seven words, no
headings, no outbound links. Before 2.1.0 the site also had no `robots.txt`,
no `sitemap.xml`, no canonical links and a single global title.

The fix is a **separate public layer** that is fully server-rendered and
statically prerendered, sitting alongside the app rather than inside it — plus
a server-rendered landing on the root itself.

### The root

`app/page.tsx` is a **server component**. It renders `HomeLanding` into the
initial HTML and passes it to `HomeClient`, which decides what the visitor
actually sees:

- a returning player never sees the landing — `HomeClient` reads the stored
  Supabase session in `useLayoutEffect` and swaps in a spinner *before the
  browser paints*;
- a signed-out visitor gets the sign-in card, with the landing beneath it;
- a crawler, which never runs the effect, gets the landing.

> ⚠️ Suspense belongs around **AuthForm**, not around the whole screen.
> `useSearchParams` is read by AuthForm alone; wrapping everything made the
> landing render twice — once as the fallback, once resolved — producing two
> H1s and a duplicated body.

`/` and `/games` deliberately carry different copy: the root explains the
platform and how a room works, the hub helps you choose between the games.
Repeating one on the other would enter two of our own pages in the same
auction.

## Layout

| URL | Type | Indexable |
|-----|------|-----------|
| `/` | App entry (client, auth wall) | ✅ (brand queries only) |
| `/games` | Public hub, RU | ✅ |
| `/games/[slug]` | Public game page, RU | ✅ |
| `/en/games` | Public hub, EN | ✅ |
| `/en/games/[slug]` | Public game page, EN | ✅ |
| `/play`, `/create`, `/achievements`, `/reset-password`, `/game/*` | App screens | ❌ noindex |

App screens are excluded twice over: `Disallow` in `robots.ts` **and** a
`noindex` meta tag from a per-route `layout.tsx` exporting `NOINDEX`. Belt and
braces — `Disallow` alone does not remove a URL that is already indexed.

## Files

| File | Responsibility |
|------|----------------|
| `src/content/games.ts` | All public copy (RU/EN): per-game text plus `HOME_CONTENT` and `HUB_CONTENT`. **Server-safe**: no React, no lucide, no client imports |
| `src/components/seo/HomeLanding.tsx` | Server-rendered content for the domain root |
| `src/components/HomeClient.tsx` | The app shell; chooses between landing, sign-in and the app |
| `src/lib/seo.ts` | URL helpers, hreflang alternates, metadata builders, JSON-LD builders |
| `src/lib/og.tsx` | Shared Open Graph card renderer (`next/og`) |
| `src/components/seo/JsonLd.tsx` | Renders an `ld+json` block into the initial HTML |
| `src/components/seo/PublicShell.tsx` | Header/footer chrome for public pages |
| `src/components/seo/GamesHub.tsx` | Hub implementation, shared by both locales |
| `src/components/seo/GameDetail.tsx` | Game page implementation, shared by both locales |
| `src/app/robots.ts` · `sitemap.ts` · `manifest.ts` | Generated `robots.txt`, `sitemap.xml`, web manifest |
| `src/app/**/opengraph-image.tsx` | Per-page social cards, 1200×630 |

> ⚠️ **Do not import `src/constants/rules.ts` into the public layer.** It pulls
> in `lucide-react` icons and a `'use client'` module, which would drag the
> client graph into these static pages. `src/content/games.ts` exists precisely
> to keep that boundary. The two are intentionally separate: `rules.ts` is
> in-game reference material, `games.ts` is marketing copy.

## Locale strategy

Russian is canonical and served from the bare path; English lives under `/en`.

- `/games/coup` ⇄ `/en/games/coup`, each declaring both `hreflang` alternates
  plus `x-default` → the Russian URL.
- The document element is `<html lang="ru">`. The English subtree overrides it
  with `lang="en"` on the `PublicShell` root, which is valid HTML — the nearest
  ancestor `lang` wins.
- Reading the pathname in the root layout to set `<html lang>` per request
  would require `headers()`, which opts the **entire app** out of static
  generation. Not worth it for one attribute when hreflang already carries the
  locale signal.

## Structured data

Each game page emits six JSON-LD blocks:

| Type | Source | Why |
|------|--------|-----|
| `Organization` | root layout | Publisher identity, referenced by `@id` |
| `WebSite` | root layout | Site identity |
| `VideoGame` | `videoGameJsonLd` | Player count and genre in rich results |
| `HowTo` | `howToJsonLd` | The "how to play" steps |
| `FAQPage` | `faqJsonLd` | The FAQ block |
| `BreadcrumbList` | `breadcrumbJsonLd` | Breadcrumb trail in the SERP |

The hub emits `ItemList` + `BreadcrumbList`.

Validate after changes with the
[Rich Results Test](https://search.google.com/test/rich-results).

## Adding a game

1. Add an entry to `GAMES_CONTENT` in `src/content/games.ts` — both locales,
   all fields, including `strategy` and `mistakes`. `metaDescription` should
   land around 140–160 characters, and `metaTitle` must leave room for the
   ` · Darhaal Games` suffix: tests fail above 60 rendered characters.
2. That is the whole job. The hub card, the detail page, both locale routes,
   the sitemap entries, the hreflang pairs and the OG image all derive from it,
   for both locales, automatically.
3. Run `npm run build` and confirm the new `/games/<slug>` and
   `/en/games/<slug>` routes appear as prerendered.

## Environment

| Variable | Effect if missing |
|----------|-------------------|
| `NEXT_PUBLIC_SITE_URL` | Falls back to `https://games.okhten.com`. If wrong in Vercel, the sitemap and every canonical advertise the wrong host |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | No verification meta tag is rendered (harmless) |

## Search-console setup

Two ways to prove ownership. Both work; pick per provider.

**HTML file.** Drop the provider's file (`google<hash>.html`,
`yandex_<hash>.html`) into `public/`. Everything in `public/` is served from
the domain root, verified live — `https://games.okhten.com/noise.svg` and
`/logo512.png` both return 200. Nothing in `robots.ts` blocks a root-level
file. Needs a commit and a deploy before the provider can fetch it.

**Meta tag.** Set the token in Vercel and redeploy — no commit:

| Variable | Provider |
|----------|----------|
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Google Search Console |
| `NEXT_PUBLIC_YANDEX_VERIFICATION` | Yandex Webmaster |

Each renders its meta tag only when set, so an unused one costs nothing.

Yandex is worth doing alongside Google here: the canonical locale is Russian
and the Russian-speaking audience is the primary one.

After verifying, submit `https://games.okhten.com/sitemap.xml` in both. It
lists the app entry, both hubs and every game in both locales, each carrying
its hreflang pair.

## Post-deploy checklist

Confirmed live on 2026-08-21:

- [x] `NEXT_PUBLIC_SITE_URL` correct in Vercel — canonical, og:url and the
      sitemap all resolve to `https://games.okhten.com`
- [x] Old deployment URL **308-redirects** to the new domain, so link equity
      carries over
- [x] `robots.txt` resolves, points at the sitemap, and declares the host
- [x] `sitemap.xml` serves 13 URLs with hreflang alternates
- [x] `manifest.webmanifest` serves
- [x] OG image renders and serves as `image/png` (Cyrillic verified visually)
- [x] Structured data present on game pages — 14 JSON-LD nodes on `/games/coup`
- [x] App screens return `noindex`, public pages return `index, follow`
- [x] Supabase Auth `site_url` moved to the new domain and `uri_allow_list`
      populated — it was **empty**, which meant every OAuth and password-reset
      redirect fell back to the old deployment URL

Still to do, all outside the codebase:

- [ ] Verify ownership in Google Search Console (file or meta tag above)
- [ ] Verify ownership in Yandex Webmaster
- [ ] Submit the sitemap in both
- [ ] Run the [Rich Results Test](https://search.google.com/test/rich-results)
      on one RU and one EN game page
- [ ] Check the social card in a real share preview (Telegram, Slack, X)

Indexing takes days to weeks. The useful early signal in Search Console is
Pages → "Why pages aren't indexed", not the impression count.
