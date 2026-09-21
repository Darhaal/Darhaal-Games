# Backlog

State after **v2.2.0**. This is the real list, including the things that are
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
- **Spyfall custom locations.** The settings already exist in state; there is no
  UI for them. The create screen's option schema has no free-text list control
  yet, so this needs either that or a bespoke block.
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

**Coup was unplayable (2.2.x).** `startGame` reset `game_state.version` to 1,
so the compare-and-swap asked the database for a version that only exists in a
room nobody has joined. Any room with a second player refused to start, and no
Coup match has ever been recorded in `player_stats`. Fixed, and both rules that
make the write path work are now enforced by tests.

**Simultaneous actions no longer cost a move (2.2.x).** All 37 write paths across
the five games take the retryable form of `updateState`; previously only six
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
