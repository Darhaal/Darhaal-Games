# 📚 Darhaal Games — Documentation

Documentation for **Darhaal Games** — five browser games for playing with
friends, at https://games.okhten.com.

Written to be read by someone deciding whether the engineering here is any good,
so it tries to be accurate about what works, what is deliberately unfinished,
and why. [Security](security.md) is the most honest of these documents and
probably the most interesting.

## Guides

| Document | Description |
|----------|-------------|
| [Getting Started](getting-started.md) | Prerequisites, installation, and running the app locally |
| [Environment Variables](environment.md) | Full reference for all `NEXT_PUBLIC_*` variables |
| [Deployment](deployment.md) | Deploying to Vercel and configuring Supabase |

## Architecture & internals

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | Tech stack, folder structure, and real-time data flow |
| [Business Logic](business-logic.md) | Deep dive: sync model, lobby lifecycle, per-game state machines, scoring, stats |
| [Data Model](data-model.md) | Supabase tables, `game_state` shapes, realtime channels, lobby lifecycle and cleanup |
| [Games](games.md) | Overview of each game mode and where its code lives |
| [SEO](seo.md) | The public crawlable layer: routes, locales, structured data, adding a game |

## Project status

| Document | Description |
|----------|-------------|
| [Security Analysis](security.md) | Audit of the live database and the lobby flow: what was broken, what was fixed, and which risks are accepted on purpose |
| [Audit Report](audit-report.md) | *Historical* — the v1.5.4 audit that preceded the 2.0 rewrite |
| [Backlog](../TODO.md) | What is open, what is held back by upstream, and what is shelved |
| [Changelog](../CHANGELOG.md) | Version history |

## Quick links

- **Live demo:** https://games.okhten.com
- **Tech stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase
- **Current version:** see [`src/constants/version.ts`](../src/constants/version.ts); every version with its date is at [/changelog](https://games.okhten.com/changelog)

## TL;DR

```bash
git clone https://github.com/Darhaal/Darhaal-Games.git
cd Darhaal-Games
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

Open http://localhost:3000.
