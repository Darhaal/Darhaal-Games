# 🔐 Security Analysis — 2026-08-20

Live audit of the production Supabase project (`amemndrojsaccfhtbsxc`) and of
the lobby/game data flow in the client, performed against the running database
rather than against the migration files.

That distinction mattered: the headline finding is that a migration which has
sat in the repository since July, and was believed to be the last remaining
security task, does not do anything.

## Who this is defended against

The platform is played by people who already know each other. A room is a link
pasted into a group chat; the opponents are friends. That shapes where the
effort went, and it is worth stating plainly rather than implying the security
work is more complete than it is.

**Two categories, treated differently.**

*Things that hurt a player no matter who they are playing with* were fixed.
Leaking every room password and every user email to anyone holding the public
anon key is not a trust problem — it is a data problem, and it was live.
`TRUNCATE` granted to the public role meant a single request could wipe the
database. Any signed-in user, guests included, could delete rooms belonging to
strangers. None of that becomes acceptable because the players are friendly, so
all of it is closed and re-tested from the outside.

*Cheating inside a match* was not fixed, deliberately. `game_state` is computed
on the client and written back; the database validates the version, not the
move. A crafted client can read an opponent's ships or improve its own hand.

**Why that line, and not further.** Making the server authoritative means
re-implementing five separate rulebooks — Coup's nested challenge chains,
Minesweeper's flood fill, Battleship's placement constraints — inside the
database or an edge function, then adding a round-trip to every move. That is
roughly double the code, permanently, plus latency on every click. The people
who pay that cost are the ones playing honestly; the people it stops are
friends who could simply have said "let me win" instead.

At this scale the defence costs more than the thing it protects. The calculation
changes the moment the platform opens to strangers, or a leaderboard makes a
fabricated score worth something — and at that point server-side move validation
is the first thing to build. It is finding 7 below, tracked rather than
forgotten.

## Method

- Schema, grants, RLS policies, functions and storage policies read directly
  out of `information_schema` / `pg_catalog` via the Management API.
- Every privilege finding re-tested from the outside with the **public anon
  key**, so the results reflect what an actual attacker sees, not what the DDL
  suggests.
- Client write paths traced through `src/` to establish which privileges are
  load-bearing before proposing to remove any.

## Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | 🔴 Critical | `TRUNCATE` granted to `anon` on every public table — bypasses RLS | ✅ Fixed 2026-08-20 |
| 2 | 🟠 High | `lobbies.password` and `profiles.email` readable by `anon` | ✅ Fixed 2026-08-20 |
| 3 | 🟠 High | Any authenticated user can UPDATE/DELETE any lobby | ✅ Fixed 2026-08-20 |
| 4 | 🟠 High | Four tables with RLS off and full DML granted to `anon` | ✅ Fixed 2026-08-20 |
| 5 | 🟡 Medium | `handle_new_user_stats` is SECURITY DEFINER without `search_path` | ✅ Fixed 2026-08-20 |
| 6 | 🟡 Medium | `player_stats` FK to `auth.users` lacked ON DELETE CASCADE *(finding corrected)* | ✅ Fixed 2026-08-20 |
| 7 | 🟡 Medium | `game_state` is client-authoritative | 🤝 Accepted risk |
| 8 | 🟢 Low | `profiles` fully enumerable by `anon` | Accepted |
| 9 | 🟢 Low | Avatar upload has no server-side size/type limit | ✅ Fixed 2026-08-20 |
| 10 | 🟢 Low | Anon key present in the public repo *(finding reassessed)* | 🤝 No action needed |

---

## 1. 🔴 `TRUNCATE` granted to `anon` on every public table

```
events, groups, group_members, personal_schedule,
lobbies, player_stats, profiles
  → anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
```

**`TRUNCATE` is not subject to row-level security.** RLS policies filter
`SELECT`/`INSERT`/`UPDATE`/`DELETE`, but a `TRUNCATE` succeeds on the strength
of the table privilege alone. The anon key is public by design — it ships in
the browser bundle — so anyone who opens the site can read it out and issue a
truncate against `lobbies`, `profiles` or `player_stats`.

This is the most severe issue in the project: total, irreversible data loss
available to any visitor, with no account required.

**Fix:** `revoke truncate on all tables in schema public from anon, authenticated;`

## 2. 🟠 Room passwords and user emails readable by `anon`

`supabase/migrations/20260709000001_v2_lockdown.sql` was written to close this
and has been tracked as "pending apply" ever since. It is a **no-op**:

```sql
revoke select (password) on table public.lobbies from anon, authenticated;
```

In PostgreSQL a table-level `GRANT SELECT` covers every column. Revoking one
column's privilege while the table-level grant stands changes nothing. The
correct sequence is to revoke `SELECT` on the table and re-grant it per column.

Verified by running the migration and then re-probing with the anon key —
`lobbies.password` and `profiles.email` were still readable afterwards.

**Impact:** every private room password and every registered user's email
address is retrievable by any visitor.

**Fix:** revoke table-level `SELECT`, then grant the safe columns explicitly.
Login by username keeps working — `AuthForm.resolveEmail` already calls the
`get_login_email` RPC first and only falls back to the direct query when the
RPC is absent.

## 3. 🟠 Any authenticated user can modify or destroy any lobby

```
lobbies | Enable all access for authenticated users | ALL | {authenticated} | using: true | check: true
```

Supabase anonymous sign-in produces the `authenticated` role, so this covers
**guests** too. One click of the guest button grants full write access to every lobby
row in the database:

- rewrite any room's `game_state` directly, bypassing the compare-and-swap RPC
  entirely (cheat in someone else's match, or corrupt it);
- change `password` and `is_private` on rooms they do not own;
- `DELETE` every lobby in the table.

**Fixed 2026-08-20.** `UPDATE` on the table was revoked and re-granted for
`host_id` alone, so `game_state` became writable *only* through
`update_game_state` — a `SECURITY DEFINER` function, and therefore unaffected
by the grant. The blanket policy was replaced with per-command
policies, and `DELETE` moved behind a `SECURITY DEFINER` function:

- `INSERT` now asserts `host_id = auth.uid()` — a room can only be created in
  your own name.
- `DELETE` is revoked from clients entirely. Removal goes through
  `leave_lobby(p_lobby_id)`, which deletes only when the caller is the host
  closing their own room, or the last remaining participant. It handles both
  `players` shapes (array in Coup/Flager/Spyfall, object in
  Battleship/Minesweeper).
- `SELECT` stays open — browsing the room list is how players find a game.
- `UPDATE` keeps an open row predicate because host transfer is performed by
  whichever player writes state after the host leaves; column privileges
  already restrict it to `host_id` alone.

Client call sites were moved onto the RPC (`useLobbySync.deleteLobby` and the
kick-to-empty branch in `UniversalLobby`).

## 4. 🟠 Unrelated tables wide open

`events`, `groups`, `group_members`, `personal_schedule` — a scheduling/groups
schema from a different project sharing this Supabase instance — have **RLS
disabled** and full DML granted to `anon`.

All four are currently **empty**, so nothing is exposed today. The risk is
write abuse: anyone can insert arbitrary rows into a database you pay for.
Note `groups.password` repeats the plaintext-password pattern.

**Fix:** revoke all client grants and enable RLS with no policies (deny-all).
Better still, drop the tables once their owner confirms they are dead.

## 5. 🟡 `handle_new_user_stats` lacks a fixed `search_path`

| function | SECURITY DEFINER | search_path |
|----------|------------------|-------------|
| `get_login_email` | yes | `public` |
| `handle_new_user` | yes | `public` |
| `join_lobby_check` | yes | `public` |
| `update_game_state` | yes | `public` |
| **`handle_new_user_stats`** | **yes** | **not set** |

A `SECURITY DEFINER` function without a pinned `search_path` can be induced to
resolve an unqualified object name against an attacker-controlled schema and
execute their code with the definer's privileges. The other four are pinned;
this one was missed.

**Fix:** `alter function public.handle_new_user_stats() set search_path = public;`

## 6. 🟡 Incomplete cascade on `auth.users` references — *corrected*

> **Correction.** This finding was first written as "no foreign keys reference
> `auth.users`", based on an `information_schema` query that returned nothing.
> That query was wrong: `information_schema.constraint_column_usage` only
> exposes constraints on objects the querying role has rights to, and
> `auth.users` is owned by `supabase_auth_admin`. Re-checked against
> `pg_constraint`, the foreign keys **do** exist. The corrected finding follows.

| child | definition | on delete |
|-------|------------|-----------|
| `profiles.id` | → `auth.users(id)` | **CASCADE** ✅ |
| `player_stats.user_id` | → `auth.users(id)` | *(none)* → **fixed to CASCADE** |
| `lobbies.host_id` | → `auth.users(id)` | *(none)* — left as is |

`profiles` cascaded correctly all along. `player_stats` did not, so deleting an
account would abort with a foreign-key violation rather than clean up after
itself. It now cascades.

`lobbies.host_id` still has no delete action, deliberately: cascading it would
mean deleting an account silently destroys rooms other people may be playing
in. The trade-off is that an account cannot be deleted while it hosts a lobby.

**Consequence for cleanup:** deletion order matters — `player_stats`, then
`profiles`, then the auth user — and any user hosting a lobby must be excluded.
The guest cleanup on 2026-08-20 used exactly that order and guarded on
`lobbies hosted by victims = 0`.

The apparent drift that suggested missing constraints (85 auth users against 33
profiles) was not orphaned data: 52 guests simply never had a profile row
created. After the cleanup, users, profiles and stats sit at 6 / 6 / 6 with
zero orphans.

## 7. 🟡 `game_state` is client-authoritative

`update_game_state` validates the **version**, not the **move**. It prevents
two players from clobbering each other, but a crafted client can still write
any legal-looking state: reveal Battleship ships, change its own Coup cards,
set an arbitrary score.

**Accepted as a deliberate risk (owner decision, 2026-08-20):** the platform is
played among people who know each other, where cheating is a social problem
rather than a technical one. Server-side move validation is not planned.

Revisit only if the platform opens to strangers, adds ranked play, or a
leaderboard makes a fabricated score worth something.

The same holds for the match history added in 2.11: `record_match` takes the
result the client reports. What the database does guarantee is that a row
belongs to its caller (`auth.uid()`, never a parameter), that a match counts
once (`unique (user_id, match_key)`), and that the values are in range. Nobody
can read or write another player's history or achievements — checked from
outside by `scripts/authz-test.mjs`.

## 8–10. Lower severity

- **Profile enumeration.** `profiles` `SELECT` policy is `true` for `public`, so
  every username and avatar is listable by anon. Needed by the sign-up
  "username taken" check; acceptable, but it does allow harvesting the user
  list. After finding 2 is fixed, emails are no longer part of that.
- **Avatar uploads — fixed 2026-08-20.** The 2 MiB cap lived only in the
  browser. The bucket now enforces it server-side (`file_size_limit`
  2 097 152 bytes) along with an explicit MIME allow-list of PNG, JPEG, WebP
  and GIF, matching what `Settings.tsx` already claimed to accept.
- **Anon key in the public repo — reassessed, no action needed.** The key is
  indeed committed in the public `DarhaalGames` repository (`952bf7d`,
  2026-02-05). That is not a leak in any meaningful sense: **the anon key is
  public by design** and ships inside the browser bundle, so anyone visiting
  games.okhten.com can read it out of DevTools regardless. It is a *routing*
  credential, not a secret — the only thing standing between it and the data is
  RLS and the table grants, which is exactly what findings 1-4 fixed. Rotation
  was worth doing while those were broken; now it would only invalidate the
  current deployment for no security gain. What must never be committed is the
  `service_role` key, which bypasses RLS entirely.

## What is in good shape

- RLS is enabled and correctly scoped on `player_stats` (owner-only reads;
  since 2.11 a read-only baseline with no client `UPDATE`), `match_results`
  and `achievement_unlocks` (owner-only reads, writes only through
  `record_match` / `unlock_achievements`) — verified from outside: another
  guest receives zero rows and a direct insert is refused with 42501.
- The three v2 RPCs exist, are correctly `SECURITY DEFINER` with pinned
  `search_path`, and are granted only to `anon`/`authenticated`.
- Password checking genuinely happens server-side in `join_lobby_check`; the
  client never compares passwords itself.
- Storage policies are properly scoped to the owner for write and delete.
- The application never issues `select('*')` against `lobbies` or `profiles`,
  so column-level grants can be tightened without breaking any query.
- No credentials in the bundle; `.env.local` is git-ignored and has never been
  committed.

## Applying the fixes

Findings 1–5 were applied to production on **2026-08-20** via
[`supabase/migrations/20260820000000_v2_1_hardening.sql`](../supabase/migrations/20260820000000_v2_1_hardening.sql),
plus the `player_stats` cascade from finding 6.

Verified afterwards from outside with the public anon key:

| Check | Result |
|-------|--------|
| `lobbies.password` readable | ❌ denied (`42501`) |
| `profiles.email` readable | ❌ denied (`42501`) |
| `TRUNCATE` granted to a client role anywhere | none |
| `UPDATE` on `lobbies` for `authenticated` | `host_id` only |
| Abandoned tables: RLS on, client grants | enabled / none |
| All SECURITY DEFINER functions pinned | 5 / 5 |
| Lobby list + safe columns readable by anon | ✅ still works |
| `get_login_email` resolves a real username | ✅ |
| `join_lobby_check` executes | ✅ |

Lobby authorization (finding 3) and the avatar limits (finding 9) followed in
`20260820000002_lobby_authz_and_avatar_limits.sql`, verified behaviourally
rather than by reading policies — two throwaway guest sessions driven through
the public anon key, with guest B attempting to tamper with guest A's room:

| Attack | Result |
|--------|--------|
| B creates a lobby owned by A | ❌ denied (`42501`) |
| B deletes A's lobby directly | ❌ denied, row intact |
| B rewrites A's `game_state` | ❌ denied, state intact |
| B reads `lobbies.password` | ❌ denied |
| B calls `leave_lobby` on A's room | returns `false`, room intact |
| A (host) calls `leave_lobby` on its own room | returns `true`, room removed |

That script is committed as `scripts/authz-test.mjs`. It cleans up after
itself and exits non-zero on any failure, so it can gate a deploy — re-run it
after any change to lobby policies or grants.

**Remaining, both by choice:** finding 7 (client-authoritative state, accepted
because the platform is played among friends) and finding 8 (profile
enumeration, needed by the sign-up username check).
