# ☁️ Deployment

Darhaal Games is a standard Next.js app and deploys cleanly to **Vercel**. Any
host that supports Next.js 16 will also work.

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. From **Project Settings → API**, copy the **Project URL** and the **anon public** key.
3. Create the database objects the app expects:
   - Tables: `profiles`, `lobbies`, `player_stats`
   - Storage bucket: `avatars`
4. **Apply the v2 security migration** — run
   [`supabase/migrations/20260709000000_v2_security.sql`](../supabase/migrations/20260709000000_v2_security.sql)
   in **SQL Editor**. It adds: server-side password checks (`join_lobby_check`),
   optimistic-locking writes (`update_game_state`), login email resolution
   (`get_login_email`), a unique room-code index, and baseline RLS policies.
   The frontend works without it (legacy fallbacks), but security features
   activate only once applied.
5. Review the **RLS policies** from the migration and tighten them for your
   needs. The anon key is public, so RLS is your primary access control.
6. Enable **Realtime** for the tables that drive live state (e.g. `lobbies`).
7. Configure **Auth providers** you want to support (Email, Google OAuth,
   Anonymous) under **Authentication → Providers**, and add your production URL
   to the allowed redirect URLs.

## 2. Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Import** the repository (framework auto-detected as Next.js).
3. Add the environment variables under **Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. Vercel runs `npm install` and `npm run build` automatically.

See [Environment Variables](environment.md) for details on each value.

## 3. Post-deploy checklist

- [ ] Both env vars are set for the **Production** (and Preview) environments.
- [ ] Supabase Auth redirect URLs include your Vercel domain.
- [ ] RLS policies are enabled and tested.
- [ ] Realtime is enabled for the relevant tables.
- [ ] The live site loads and a guest can create/join a lobby.

## Local production build

To reproduce the production build locally:

```bash
npm run build
npm run start
```

This requires the same environment variables in `.env.local`.
