# 🗄️ Data Model

The backend is a Supabase project. The client code references the following
objects (schemas inferred from usage — the authoritative DDL lives in the
Supabase dashboard).

## Tables

### `lobbies`
One row per game room. The whole game lives in `game_state`.

| Column | Type | Usage |
|--------|------|-------|
| `id` | uuid (PK) | Referenced as `?id=` in game URLs |
| `code` | text | 6-char room code (A–Z, 0–9), join-by-code |
| `name` | text | Room display name |
| `host_id` | uuid | Creator; battleship hook re-syncs it on host transfer |
| `is_private` | boolean | Requires password to join |
| `password` | text | ⚠️ Plaintext; fetched by the lobby list (see audit) |
| `status` | text | `waiting` / `playing` / `finished` — duplicated from `game_state.status` for filtering |
| `game_state` | jsonb | Full game state (shapes below) |
| `created_at` | timestamptz | Sorting in the lobby browser |

Realtime: `postgres_changes` on UPDATE/DELETE per lobby id, plus a global
subscription in `/play` for the list.

### `profiles`
| Column | Type | Usage |
|--------|------|-------|
| `id` | uuid (PK, = auth.users.id) | |
| `username` | text | Unique display name; login-by-username resolves email through this table |
| `email` | text | ⚠️ Readable by the anon role for username → email resolution (see audit) |
| `avatar_url` | text | |

Expected to be created by a DB trigger on signup (the client only ever
`select`s/`update`s it, never inserts).

### `match_results` (2.11)
One row per player per finished match. Written only through `record_match`;
readable by its owner.

| Column | Type | Usage |
|--------|------|-------|
| `id` | bigint identity (PK) | |
| `user_id` | uuid → `auth.users` (cascade) | always `auth.uid()` of the caller |
| `game` | text | registry id |
| `match_key` | text | the match; `unique (user_id, match_key)` makes a repeat a no-op |
| `result` | text | `win` / `loss` |
| `mode` | text | `single` / `multi` |
| `duration_seconds` | int | 0–86400 |
| `score` | int, null | boxes, discs, Flager points |
| `details` | jsonb | what the game's achievements read — see business-logic.md |
| `played_at` | timestamptz | |

`record_match(p_game, p_match_key, p_result, p_mode, p_duration_seconds, p_score, p_details)`
→ `true` when the match was new.

### `achievement_unlocks` (2.11)
`(user_id, achievement_id)` primary key, `unlocked_at`. The achievements
themselves are defined in `src/achievements/definitions.ts`; this only dates
them. Written through `unlock_achievements(p_ids text[])`, which returns the
ids that were new.

### `player_stats`
| Column | Type | Usage |
|--------|------|-------|
| `user_id` | uuid (PK) | |
| `total_games` | int | |
| `details` | jsonb | Per-game totals from before 2.11 |
| `updated_at` | timestamptz | |

**A read-only baseline since 2.11**: nothing in the app writes it, and
clients no longer hold `UPDATE`. One flat record per game —

```jsonc
{ "battleship": { "wins": 3, "lost": 1, "time": 45, "extra": 0 } }
```

— `time` in minutes as it was recorded. Before the cleanup it held two shapes
(flat, and `{single, multi}` for games with a solo mode), for one player both
at once, and a game that no longer exists; see
`supabase/migrations/20260925000001_stats_baseline.sql`.

## Storage

### `avatars` bucket
- Public bucket; files named `<userId>-<timestamp>.<ext>`, max 2 MB (client-side check).
- Listed with `search: user.id` to show "my uploads"; public URLs saved into
  `profiles.avatar_url` and auth metadata.

## Realtime channels

| Channel | Type | Used by |
|---------|------|---------|
| `public_lobbies` | postgres_changes (table-wide) | `/play` lobby browser |
| `lobby-coup:<id>`, `lobby-bs:<id>`, `lobby-flager:<id>`, `lobby-mines:<id>`, `lobby-spyfall:<id>` | postgres_changes (row-filtered) | Game hooks |
| `presence:<code>` | Presence (key = userId) | `usePresenceHeartbeat` / lobby auto-kick |

## `game_state` shapes (per game)

All shapes share: `version: number`, `lastActionTime: number`,
`gameType`, `settings.maxPlayers`, and a `status` that mirrors the row column.

| Game | `players` container | Extra state |
|------|---------------------|-------------|
| coup | **array** of `Player {coins, cards[{role, revealed}], isDead, isHost}` | `deck: Role[]`, `turnIndex`, `phase`, `currentAction`, `pendingPlayerId`, `exchangeBuffer`, `passedPlayers`, `turnDeadline`, `logs` |
| battleship | **record** id → `PlayerBoard {ships, shots, isReady, aliveShipsCount}` | `turn`, `phase`, `winner`, `turnDeadline`, `logs` |
| flager | **array** of `FlagerPlayerState {score, guesses, hasFinishedRound, roundScore, history, isReadyForNextRound}` | `targetChain: string[]`, `currentRoundIndex`, `roundStartTime`, `notifications`, `settings.totalRounds/roundDuration` |
| minesweeper | **record** id → `MinesweeperPlayer {board: Cell[][], status, minesLeft, score}` | `startTime`, `winner`, `settings.width/height/minesCount/timeLimit/difficulty` |
| spyfall | **array** of `SpyfallPlayer {isSpy, role, hasNominated, score}` | `currentLocationId`, `locationList`, `startTime`, `nomination {authorId,targetId,votes,startTime}`, `winner`, `winReason`, `notifications`, `settings.roundDuration/packId` |

> ⚠️ The array-vs-record split matters: shared code (kick logic in
> `UniversalLobby`, player counting in `/play`) branches on
> `Array.isArray(players)`.

## Avatars

`profiles.avatar_url` holds one of two things:

- an uploaded file in the `avatars` storage bucket, or
- a path like `/avatar/<seed>`, served by the app's own route.

That second form used to be a full `api.dicebear.com` URL. The seed is the
Supabase user id, so every avatar render sent a user identifier to a third
party and depended on their uptime. The route at
[`src/app/avatar/[seed]/route.ts`](../src/app/avatar/[seed]/route.ts) renders
the same artwork locally from `@dicebear/core`, marked immutable so the edge
cache serves it after the first render.

Storing a data URI instead was considered and rejected: the SVG is ~4.4 KB, so
it would have gone into every profile row and every copy of a player inside
`game_state`.

Existing rows were migrated in place; uploaded avatars were left untouched.

## Lobby lifecycle & cleanup

A room is removed in exactly two ways:

| Trigger | Mechanism |
|---------|-----------|
| The last participant leaves, or the host closes the room | `leave_lobby(p_lobby_id)` RPC (SECURITY DEFINER) |
| The room goes stale | `cleanup_stale_lobbies()`, run daily at 04:00 UTC by pg_cron |

Leaving a **finished** match deliberately does not touch the row — the results
belong to everyone still looking at them, so the scoreboard must survive the
first player closing the tab. That is what makes the scheduled sweep necessary.

Staleness is measured from `game_state.lastActionTime` (JS milliseconds),
falling back to `created_at`, with two intentionally generous windows:

- `finished` → **1 day**
- anything else → **7 days** (a waiting or playing room untouched for a week
  was abandoned, not paused — this catches matches closed mid-game that never
  reached `finished`)

The function is housekeeping, not an app capability: execute is revoked from
`anon` and `authenticated`. Inspect the schedule with
`select * from cron.job where jobname = 'cleanup-stale-lobbies'`.

## Required Supabase configuration (checklist)

- RLS enabled on `lobbies`, `profiles`, `player_stats` (the anon key is public —
  RLS is the only access control).
- Realtime enabled for `lobbies`.
- Signup trigger creating `profiles` + `player_stats` rows.
- Auth providers: Email, Google, Anonymous sign-in enabled.
- Storage bucket `avatars` (public read).
- Redirect URLs include the production domain and `http://localhost:3000`.
