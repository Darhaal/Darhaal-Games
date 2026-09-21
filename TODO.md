# Backlog

State after **v2.3.0**. This is the real list, including the things that are
open on purpose — see [docs/security.md](docs/security.md) for the reasoning
behind the accepted risks.

## Open

### Worth doing next

- **Server-side move validation.** The client computes `game_state` and writes
  it; the database checks the version, not the legality of the move, so a
  crafted client can cheat. Accepted while the platform is played among friends
  — the first thing to build if it ever opens to strangers or gains a
  leaderboard. See finding 7 in the security analysis.
- **Extend tests to the state machines.** Coverage is good on pure game logic
  and on the SEO layer, but Coup phase transitions and Flager rounds are only
  exercised by playing. Needs either a Supabase mock or further extraction of
  pure reducers.
- **E2E smoke for multiplayer.** Two browser contexts, one match, assert both
  see the same state. Playwright would do it; nothing exists yet.
- **The retry path has no unit test.** Conflict-and-retry was verified against
  the live database (twelve simultaneous writes, none lost) but not in CI —
  `useLobbySync` is a hook and needs a renderer or a mocked client.
  [`tests/sync-invariants.test.ts`](tests/sync-invariants.test.ts) covers the
  rules *around* it (no hook assigns `version`, every write is retryable) but
  not the retry loop itself.

### Smaller

- **Coup edge case.** Challenge/block chains where a player with a pending card
  loss leaves mid-resolution. Guards are in place; wants live verification with
  real players rather than reasoning.
- **Spyfall custom locations.** Bigger than it looks. `useCustomLocations` and
  `customLocations` are declared on the state and written by the initialiser,
  but **read nowhere** — they are a stub, not a half-built feature. A round
  takes its locations from the chosen pack, hands out `location.roles`, and
  shows everyone `locationList` as pack ids; a custom location is a bare string
  with no id and no roles. So this needs a free-text list control on the create
  screen *and* changes to the round logic, the state shape and the board that
  displays the list.
- **Profile enumeration.** `profiles` is readable by anyone, so usernames can be
  harvested. Needed by the sign-up "name taken" check; would require moving that
  check behind an RPC.
- **`lobbies.host_id` has no delete cascade,** deliberately — cascading it would
  destroy rooms other people are still playing in. The trade-off is that an
  account hosting a lobby cannot be deleted until that lobby is gone.

### Held back by upstream

- **ESLint 10.** `eslint-plugin-react`, pulled in by `eslint-config-next`, still
  calls `context.getFilename()`, removed in 10 — linting crashes outright.
- **TypeScript 7.** `typescript-eslint` refuses TS 7.0 by design; support is
  tracked for >= 7.1. Worth revisiting, since `tsc`, the tests and the build all
  pass under it already.

## Done

Kept short — the [changelog](CHANGELOG.md) has the full history.

**An old link follows the rematch (2.3.x).** "Play again" opens a successor, so
the link already shared for the finished room pointed nowhere anyone would
play again — and a private room shares exactly one link. A visitor who is not
seated is now forwarded to the successor; a player still reading the scoreboard
is left where they are.

**The Spyfall score survives a rematch (2.3.x).** It is documented as running
across a series of games and did so inside a room, but the successor starts
with an empty roster, so the series reset whenever the table wanted another
game. Scores now travel beside the roster and come back by id.

**Guest accounts are collected (2.3.x).** Guest sign-in creates a real
`auth.users` row and nothing removed it; 20 of 31 accounts were guests.
Anonymous accounts idle for 30 days are now swept daily, ten minutes after the
lobby sweep frees the `host_id` references they would otherwise be held by.
Registered accounts are never touched.

**The signup trigger stopped calling a third party (2.3.x).** It still wrote an
`api.dicebear.com` URL with the user id inside into `profiles.avatar_url` long
after the app moved to rendering the same artwork locally — the two had drifted
despite a comment asking that they be kept in sync. 7 of 31 profiles were
affected; the trigger and the existing rows now use `/avatar/<id>`.

**Three new games (2.3.0).** Wall Rush, Dots & Boxes and Reversi, taking the
line-up from five to eight. Each one is a registry entry plus its own logic,
hook and screen — no edits to the create flow, lobby, statistics or public
pages, which is what the registry was extracted for.

**Rematch opens a new room (2.3.0).** "Play again" creates a fresh lobby that
inherits the parent's settings, and both players pressing it land in the same
room. Needed a `SECURITY DEFINER` RPC: clients cannot read `lobbies.password`,
so the successor could not be built client-side.

**Five disconnect hangs (2.3.0).** A room could freeze until everyone left: the
Spyfall vote had no timeout, Coup's AFK kick could only be fired by the absent
player, Battleship's timeout required it to be your turn, Flager did not
re-check the round end on leave, and Minesweeper never finished. Every deadline
is now authoritative and any client may act on it.

**The homepage promised five games (2.3.0)** while the registry held eight —
on the page, in the `/games` intro and in the meta description Google prints.
The count is derived from the registry now, in both languages and all three
Russian grammatical forms.

**Coup was unplayable (2.2.x).** `startGame` reset `game_state.version` to 1,
so the compare-and-swap asked the database for a version that only exists in a
room nobody has joined. Any room with a second player refused to start, and no
Coup match has ever been recorded in `player_stats`. Fixed, and both rules that
make the write path work are now enforced by tests.

**Simultaneous actions no longer cost a move (2.2.x).** Every write path takes
the retryable form of `updateState` — 37 of them across the five games at the
time, and the invariant is test-enforced for the three added since; previously
only six
did, so Spyfall votes, Coup passes and blocks, Flager "ready" taps and every
join through an invite link could be silently dropped.

**Game registry (2.2.x).** Each game was described separately in six places and
they had drifted. [`src/games/`](src/games/) now owns ids, names, player counts,
icons, create-screen options and starting states; the create screen, lobby list,
achievements grid, lobby header, statistics writer and public pages all read it.
Adding a game is one entry plus the game — see
[docs/adding-a-game.md](docs/adding-a-game.md). Two bugs fell out of it: four of
the five game screens showed the game's maximum rather than the cap the host
chose (and the invite link enforced nothing at all), and the create screen was
still sending Supabase user ids to api.dicebear.com months after the rest of the
app stopped.

**Security (2.1.0).** `TRUNCATE` revoked from client roles; room passwords and
user emails hidden at column level; lobby writes narrowed to a compare-and-swap
RPC with `leave_lobby` for deletion; four tables belonging to an unrelated
project closed off; `search_path` pinned on every `SECURITY DEFINER` function.
All re-tested from outside with [`scripts/authz-test.mjs`](scripts/authz-test.mjs).

**Reliability (2.1.0).** Simultaneous actions no longer cost a player their
move. Finished matches keep their results when someone leaves. Stale lobbies are
collected daily by a `pg_cron` job instead of accumulating forever.

**Reach (2.1.0).** Public server-rendered pages with hreflang, structured data
and Open Graph cards; the domain root serves content instead of an empty shell.

**Onboarding (2.1.0).** Every new account gets an avatar; first run offers a
nickname.

**Earlier (2.0).** Shared sync core extracted from all five game hooks
(−350 lines); zero `any` and zero lint warnings; honest statistics in every
game; sound, toasts and keyboard controls; join-by-link; password recovery.

## Shelved

- **Geo Defense** — a tower-defence prototype that never fit the platform's
  "share a link, play for ten minutes" shape. Not ported.
- **Mafia** — the placeholder was removed in 2.1.0 rather than left as a
  permanent "coming soon". Worth building properly or not at all.
