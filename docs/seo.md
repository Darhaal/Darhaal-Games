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
| `/` | App entry (client, auth wall), EN landing | ✅ |
| `/games`, `/games/[slug]`, `/privacy`, `/changelog` | Public pages, EN | ✅ |
| `/ru`, `/ru/games`, `/ru/games/[slug]`, `/ru/privacy`, `/ru/changelog` | The same in Russian | ❌ `noindex, follow` for now |
| `/en`, `/en/*` | Where English used to live | 308 → the bare path |
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

English is the default and served from the bare path, like the app itself
(it starts in English until a player picks Russian); Russian lives under `/ru`.
Until 2026-10-05 it was the other way round — Russian at the root, English
under `/en` — and `/en/*` now redirects permanently to the bare path.

**Only English is indexed for now** (decided 2026-10-05). `INDEXED_LOCALES` in
`lib/seo.ts` is the one switch:

- a locale outside it renders `noindex, follow` — its links still count, the
  page is just not listed — and stays out of `sitemap.xml`;
- while only one locale is indexed, no page declares `hreflang`: a pair that
  points at a `noindex` page is one search engines reject;
- adding `'ru'` brings back the Russian pages, their sitemap entries and the
  `/games/coup` ⇄ `/ru/games/coup` pairs with `x-default` → English, with
  nothing else to touch (and the "indexed locales" tests to update).

The document element is `<html lang="en">`; the Russian subtree overrides it
with `lang="ru"` on the `PublicShell` / `HomeLanding` root, which is valid
HTML — the nearest ancestor `lang` wins. Reading the pathname in the root
layout to set `<html lang>` per request would require `headers()`, which
opts the **entire app** out of static generation.

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

### Who is behind it

The `Organization` is Okhten Group LLC and its `founder` is the developer,
both under the **same `@id`s okhten.com publishes** —
`https://okhtengroup.com/#organization` and `https://okhten.com/#artem-okhten`
(`PERSON_ID`, `ORGANIZATION_ID` in `lib/seo.ts`). Matching ids are how a
search engine reads two sites as one person rather than two strangers who
share a name. The person node carries both spellings, the handle Darhaal and
Ukrainian nationality; `WebSite` names Darhaal as an alternate name and the
person as `creator`; every `VideoGame` names the person as `author`.

The visible half matters as much for AI answers, which read the page rather
than the markup: the home FAQ answers "Who makes Darhaal Games?" in both
languages, and every public footer links to okhten.com (`rel="author"`) and
the GitHub repository.

Why (2026-10-05): "darhaal games" was corrected to "darfall games", `site:`
showed six English game pages and no home page, and Google's AI answer
called the platform Russian — the root was Russian and nothing said
otherwise. The same day English moved to the root (see Locale strategy). If okhten.com changes its ids, change them here too; a test pins
them.

Validate after changes with the
[Rich Results Test](https://search.google.com/test/rich-results).

## Adding a game

1. Add an entry to `GAMES_CONTENT` in `src/content/games.ts` — both locales,
   all fields, including `strategy` and `mistakes`. `metaDescription` should
   land around 140–160 characters, and `metaTitle` must leave room for the
   ` · Darhaal Games` suffix: tests fail above 60 rendered characters.
2. That is the whole job. The hub card, the detail page, both locale routes,
   the sitemap entries, the hreflang pairs (once both locales are indexed) and
   the OG image all derive from it, for both locales, automatically.
3. Run `npm run build` and confirm the new `/games/<slug>` and
   `/ru/games/<slug>` routes appear as prerendered.

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

Yandex matters once the Russian pages are indexed; until then it has nothing
Russian to list.

After verifying, submit `https://games.okhten.com/sitemap.xml`. It lists the
indexed locales only — today the English root, hub, games, privacy policy and
changelog.

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

- [x] Verify ownership in Google Search Console — done by the owner, confirmed
      2026-10-05 (not through the meta tag: the env var is unset)
- [ ] Verify ownership in Yandex Webmaster
- [ ] Submit the sitemap in both
- [ ] Run the [Rich Results Test](https://search.google.com/test/rich-results)
      on one RU and one EN game page
- [ ] Check the social card in a real share preview (Telegram, Slack, X)

Indexing takes days to weeks. The useful early signal in Search Console is
Pages → "Why pages aren't indexed", not the impression count.
