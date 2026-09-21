# 🏗️ Architecture

Darhaal Games is a single-page, real-time multiplayer platform built on the
Next.js App Router with Supabase as the backend.

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack), React 19, React Compiler |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, Lucide React icons |
| Backend | Supabase — PostgreSQL, Auth, Realtime, Storage |
| State | Custom React hooks + optimistic UI updates |
| Hosting | Vercel |

## Folder structure

```
src/
├── app/                  # Next.js App Router routes
│   ├── page.tsx          # Landing / home
│   ├── layout.tsx        # Root layout (fonts, metadata, global styles)
│   ├── play/             # Matchmaking / active-game entry point
│   ├── create/           # Room creation
│   ├── achievements/     # Player achievements
│   ├── reset-password/   # Auth: password reset
│   └── game/             # One route per game mode
│       ├── battleship/
│       ├── coup/
│       ├── flager/
│       ├── minesweeper/
│       └── spyfall/
├── components/           # UI components (per-game + shared: AuthForm, Settings,
│                         #   UniversalLobby, GameHeader, GameRulesModal, ...)
├── hooks/                # Game logic hooks (useBattleshipGame, useCoupGame,
│   │                     #   useFlagerGame, useMinesweeperGame, useSpyfallGame,
│   │                     #   usePresenceHeartbeat, useLang)
│   └── core/             # useLobbySync — shared sync layer for all games
├── lib/                  # supabase.ts, gameStateSync.ts (CAS writes), playerStats.ts,
│   │                     #   toast.ts, sound.ts, errors.ts
│   └── gameLogic/        # Pure game logic (covered by unit tests)
├── games/                # The game registry — see docs/adding-a-game.md
│                         #   registry.ts (server-safe facts), icons.ts,
│                         #   options.ts (create-screen controls as data),
│                         #   initialState.ts (starting game_state per game)
├── content/              # games.ts — public SEO copy, built on the registry
├── constants/            # coup.ts, rules.ts, version.ts
├── data/                 # Static game data (flags, spyfall locations & packs)
└── types/                # TypeScript types per game
```

## Core concepts

### Single Supabase client
[`src/lib/supabase.ts`](../src/lib/supabase.ts) creates one shared client from
environment variables. Every feature imports it — there is no second instance.

### Shared sync core (v2.0)
[`src/hooks/core/useLobbySync.ts`](../src/hooks/core/useLobbySync.ts) implements
the common lobby lifecycle for every game: initial fetch, realtime
subscription (UPDATE/DELETE), version-guarded merging (with per-game custom merge
callbacks), and optimistic CAS writes with automatic re-sync on conflict. Game
hooks contain only game logic on top. Pure, testable game rules live in
[`src/lib/gameLogic/`](../src/lib/gameLogic/) (see `tests/`).

### Game registry
[`src/games/registry.ts`](../src/games/registry.ts) is the single source of truth
for which games exist and what they are like — ids, names, player counts, genre,
accent, solo-mode flag. The create screen, the lobby list, the achievements grid,
the lobby header, the statistics writer and the public SEO pages all read it, so
adding a game is one entry plus the game itself rather than an edit to ten
screens. The per-game records around it (`GAME_ICONS`, `GAME_OPTIONS`,
`FACTORIES`, `GAME_RULES`) are keyed by `GameId`, so a half-registered game is a
type error rather than a blank card at runtime. It is deliberately free of React
and lucide imports: `src/content/games.ts` builds on it and feeds statically
rendered pages. Full checklist in [adding-a-game.md](adding-a-game.md).

### Universal Lobby
`UniversalLobby` provides one lobby architecture reused across all game modes:
room creation, matchmaking, and player management. Game-specific logic is layered
on top via each game's hook, rather than duplicated per game.

### Real-time synchronization
Game and lobby state is synchronized through **Supabase Realtime channels**.
The `play` route and each game hook subscribe to channels to receive turns,
timers, and lobby events. This powers instant multiplayer without a custom
WebSocket server.

Channels are used in:
- `src/app/play/page.tsx`
- `src/hooks/useBattleshipGame.ts`, `useCoupGame.ts`, `useFlagerGame.ts`,
  `useMinesweeperGame.ts`, `useSpyfallGame.ts`
- `src/hooks/usePresenceHeartbeat.ts` (player presence / AFK detection)

### Optimistic UI
User actions (e.g. firing a shot in Battleship) update the local UI immediately
and reconcile with the stored state when the realtime update arrives, keeping
the interface responsive. Note that the database is the source of truth for
*state*, not for *rules*: it checks the version of a write, never the legality
of the move (see [Security](security.md)).

## Data model (Supabase)

The client reads/writes these Postgres tables and a storage bucket:

| Object | Type | Purpose |
|--------|------|---------|
| `profiles` | table | User profile data |
| `lobbies` | table | Rooms / match state |
| `player_stats` | table | Per-player statistics |
| `avatars` | storage | Uploaded avatar images |

> Exact columns and RLS policies are defined in your Supabase project. See
> [Deployment](deployment.md) for setup guidance.

## Authentication

Auth is handled by Supabase Auth via `AuthForm`, supporting:
- Guest mode
- Email / password
- Google OAuth
- Password reset (`/reset-password` route)
