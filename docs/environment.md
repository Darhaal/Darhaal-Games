# 🔐 Environment Variables

All runtime configuration lives in environment variables. Locally they are read
from `.env.local`; in production they are set in your host's dashboard
(e.g. Vercel → Project → Settings → Environment Variables).

## Required variables

| Variable | Required | Example | Description |
|----------|:--------:|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://abcd1234.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | `sb_publishable_...` | Supabase **publishable** key |
| `NEXT_PUBLIC_SITE_URL` | — | `https://games.example.com` | Canonical site URL for og-tags and the auth-redirect fallback (optional; defaults to the current deployment) |

Where to find them: **Supabase Dashboard → Project Settings → API Keys**.

The old JWT keys (`anon`, `service_role`, starting `eyJ`) are retired by
Supabase in 2027 and are not read anywhere. Local scripts that need admin
access (`scripts/authz-test.mjs`) read `SUPABASE_SECRET_KEY` (`sb_secret_…`)
from `.env.local`; it bypasses RLS and never goes to Vercel or the browser.

## Notes

- **`NEXT_PUBLIC_` prefix.** In Next.js, only variables prefixed with
  `NEXT_PUBLIC_` are exposed to the browser. Both variables above are read on the
  client (the Supabase client runs in the browser), so the prefix is required.
- **The publishable key is meant to be public.** It is protected by
  Supabase Row Level Security (RLS). It is safe to ship to the browser — but your
  database is only as safe as your RLS policies, so make sure they are configured.
- **Never expose a secret key** (`sb_secret_…`, or the old `service_role`). It
  bypasses RLS and must never appear in committed files or client-side code.
- **Domain suffix.** Supabase project URLs end in `.supabase.co` (not `.com`).

## How the app consumes them

The single Supabase client is created in
[`src/lib/supabase.ts`](../src/lib/supabase.ts). It validates that both variables
are present and throws a descriptive error if either is missing:

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. ...');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

Every feature (auth, lobbies, realtime, stats, avatars) imports this shared
`supabase` instance.

## Local vs. production

| Environment | Where variables live |
|-------------|----------------------|
| Local dev | `.env.local` (git-ignored) |
| Production (Vercel) | Project → Settings → Environment Variables |

After changing an environment variable you must **restart the dev server** (or
redeploy in production) for the change to take effect — `NEXT_PUBLIC_*` values are
inlined at build time.
