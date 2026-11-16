# 🚀 Getting Started

This guide walks you through running Darhaal Games on your machine.

## Prerequisites

- **Node.js 18+** (LTS recommended; the project is developed on Node 22)
- **npm** (bundled with Node) — or `yarn`/`pnpm` if you prefer
- A **Supabase project** (free tier is enough) — see [Deployment](deployment.md) for the schema it expects

## 1. Clone & install

```bash
git clone https://github.com/Darhaal/Darhaal-Games.git
cd Darhaal-Games
npm install
```

## 2. Configure environment

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

Both values come from **Supabase Dashboard → Project Settings → API Keys**.
See [Environment Variables](environment.md) for full details.

> `.env.local` is git-ignored and must never be committed. The app will throw a
> clear error on startup if either variable is missing.

## 3. Run the dev server

```bash
npm run dev
```

The app starts on http://localhost:3000 (Next.js picks the next free port if 3000 is busy).

## Available scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the development server (Turbopack, hot reload) |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Troubleshooting

- **`Missing Supabase environment variables`** — you haven't created `.env.local`, or a value is empty. Copy `.env.example` and fill both variables, then restart the dev server.
- **Auth / realtime not working** — confirm the Supabase URL and anon key belong to the same project and that the required tables and RLS policies exist (see [Deployment](deployment.md)).
- **Port already in use** — Next.js automatically falls back to the next free port and prints the URL in the console.
