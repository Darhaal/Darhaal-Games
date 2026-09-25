# 🧠 Business Logic — Deep Dive

This document describes how the game logic actually works, based on a full source
audit (v1.5.4). It covers the synchronization model, the lobby lifecycle, and the
state machine of every game.

## Core synchronization model

The platform is **client-authoritative**: there is no game server. All game state
lives in one JSONB column (`lobbies.game_state`) in Supabase Postgres, and every
mutation is performed by a client:

```
Player action → clone state (JSON.parse/stringify) → mutate → version++ →
setGameState (optimistic local) → UPDATE lobbies SET game_state → 
Supabase Realtime (postgres_changes) → all other clients receive new state
```

Key elements, identical in all five game hooks:

| Element | Purpose |
|---------|---------|
| `version` (number) | Monotonic counter. Incoming realtime states with `version < local` are dropped (protects against out-of-order delivery). |
| `lastActionTime` | Timestamp of the last mutation; some UIs derive timers from it. |
| `turnDeadline` | Absolute epoch-ms deadline for the current turn (Coup, Battleship) so timers agree across clients. |
| `stateRef` (React ref) | Every hook mirrors its state into a ref so async callbacks always read the freshest state. |
| Latency hiding | Flager and Minesweeper merge the local player's own sub-state over incoming server state when the local copy is "ahead" (more guesses / more opened cells). |

**Write path.** All state writes go through
[`src/lib/gameStateSync.ts`](../src/lib/gameStateSync.ts) → the `update_game_state`
RPC, which performs a **compare-and-swap**: the update only lands where the
stored version equals `newState.version - 1` *and* is strictly lower than it.
There is **no fallback** to a plain `UPDATE` — clients hold no write privilege on
`game_state` after the v2.1 hardening, and the old fallback reported success
while failing, which silently ate players' moves.

### Two rules this makes load-bearing

**1. Game code never assigns `version`.** Only `useLobbySync` increments it.
Coup's `startGame` once rebuilt its state with `version: 1` after spreading the
current state, which reset the counter: the CAS then asked the database for
version 1, true only in a room nobody had joined. From the moment a second
player arrived the row sat at version 2 and **every attempt to start the match
was refused** — the mode was unplayable, and stranded rooms accumulated in the
lobby list.

**2. Writes use the retryable form of `updateState`.** It accepts either a
finished state or a function of the current state:

```ts
// One attempt. Outraced -> the move is lost and the player is told.
await updateState(newState);

// Re-run against freshly fetched state on a conflict, up to 3 times.
await updateState((current) => {
  if (!stillLegal(current)) return null;   // abort quietly
  return next(current);
});
```

Simultaneous actions are the norm here, not an edge case: everyone votes at once
in Spyfall, everyone passes at once in Coup, everyone taps "ready" at once in
Flager, and everyone opens the invite link at once when it is posted in a group
chat. All write paths in all five hooks now take the functional form, and the
updater re-checks legality against the fresh state so a retry cannot apply an
action twice.

Both rules are enforced by [`tests/sync-invariants.test.ts`](../tests/sync-invariants.test.ts),
which scans the hook sources. The retry loop itself — a lost race rebuilt on
the winner's state, a finished state given one try, a hard failure taken back
and reported — is played out in [`tests/lobby-sync.test.ts`](../tests/lobby-sync.test.ts).

## Lobby lifecycle

1. **Create** (`/create`): the host picks a game and settings; the client inserts a
   row into `lobbies` with a random 6-char `code`, `is_private` + `password`
   (optional), and a pre-seeded `game_state` (host is player #1).
2. **Discover** (`/play`): all non-finished lobbies are listed with realtime
   refresh; join by code is also supported. Private lobbies require the password.
3. **Join**: for Coup the joiner is added to `game_state.players` directly from
   `/play`; all other games auto-join via `initGame()` inside the game page
   (effect: "if I'm not in players and status === waiting → add me").
4. **Waiting room** (`UniversalLobby`): shows presence (Supabase Presence channel
   `presence:<code>`), host can kick, offline players are auto-kicked by the host
   after a 10-second grace period. Start button unlocks at `minPlayers`.
5. **Playing**: game-specific (below).
6. **Finish/Leave**: when the last player leaves, the client deletes the lobby row.
   Host leaving transfers `isHost` to the first remaining player.

### Presence & auto-kick

`usePresenceHeartbeat(roomCode, userId)` tracks a Supabase Presence channel keyed
by user id. In `UniversalLobby`, **only the host** runs a 1-second interval: any
player missing from presence gets a 10s countdown; if still offline they are
removed from `game_state.players` (fetch-fresh → filter → update).

## Per-game state machines

### 🎭 Coup (`useCoupGame`)
The most complex machine. `players` is an **array**; `turnIndex` points at the
current player.

Phases:
```
choosing_action
   ├─ income ──────────────────────────────► nextTurn
   ├─ coup (-7) ─────────────► losing_influence(target) ─► nextTurn
   ├─ foreign_aid ──────────► waiting_for_blocks
   └─ tax / steal / exchange / assassinate ─► waiting_for_challenges
waiting_for_challenges ─(all pass)─► apply effect      (tax/exchange)
                        └─(steal/assassinate)─► waiting_for_blocks
waiting_for_blocks ─(block)─► waiting_for_block_challenges
                   └─(all pass)─► apply effect
waiting_for_block_challenges ─(pass)─► action cancelled ─► nextTurn
                             └─(challenge)─► losing_influence(...)
losing_influence ─(card picked)─► resolves action.nextPhase
resolving_exchange ─(cards picked)─► nextTurn
```

- **Challenge resolution**: if the accused proves the role, the shown card is
  shuffled into the deck and replaced, and the challenger loses influence; the
  original action continues (`nextPhase: 'continue_action'`). If the accused
  bluffed, they lose influence and the action is cancelled/continues per context.
- **Deck**: 15 cards (3 of each of 5 roles), 2 dealt per player.
- **AFK protection**: 60s turn / 30s reaction deadlines; on expiry `skipTurn()`
  removes the offending player (choose/lose/exchange phases) or force-resolves the
  reaction phase. Any client whose local timer hits 0 may fire it.
- **A player leaving or removed** goes through one `dropPlayer`, which carries
  the table on according to their part in the action on it: their own turn
  passes to the next player; an action aimed at them is dropped and the turn
  passes; a block they made falls and the action goes ahead; a challenge they
  lost still decides the outcome, as if they had given up the card; if they
  only had a chance to answer and everyone else has passed, the action
  resolves at once. Cards drawn for an unfinished exchange go back to the deck.
- **Win**: last player with an unrevealed card; also triggered when others leave.
- **Stats**: on `finished`, each client records win/loss for itself with the
  real match length.
- **Tests**: `tests/coup-flow.test.ts` plays every phase above through the hook,
  several players against one in-memory row.

### ⚓ Battleship (`useBattleshipGame`)
`players` is a **Record<userId, PlayerBoard>** (exactly 2). Phases:
`setup → playing → finished`; lobby `status` mirrors `waiting → playing → finished`.

- **Placement**: ships are kept **locally** (`myShips`) during setup and only
  written to the DB on "Ready" (`submitShips`). Placement validation: 10×10 board,
  no touching (1-cell danger zone), fleet = 1×4, 2×3, 3×2, 4×1. Auto-placement
  retries up to 200 board attempts.
- **Both ready → playing**: a coin toss decides who shoots first, 60s
  `turnDeadline`. The first to be ready is announced to the other.
- **Shots**: hit → shoot again; miss → turn passes. A killed ship auto-marks its
  1-cell perimeter as misses. Win when `aliveShipsCount === 0`.
- **Timeout**: any client passes the turn once the deadline is past, and says
  whose clock ran out.
- **Leaving mid-match** = surrender: remaining player wins.

### 🚩 Flager (`useFlagerGame`)
`players` is an **array**. Statuses: `waiting → playing ⇄ round_end → finished`.

- **Start**: host generates `targetChain` — N random country codes (out of ~246);
  every round has a 3-second countdown (`roundStartTime = now + 3000`).
- **Guessing**: up to 10 attempts per round. The flag is revealed via canvas
  pixel-matching: every guessed flag's pixels within RGB distance <45 of the
  target's pixels become permanently visible ("Pixel Match").
- **Scoring**: `points = max(10, 1000 − (attempts−1)×50 − seconds×10)`.
- **Round end**: when every player `hasFinishedRound` (guessed, out of attempts,
  or personal timeout), results are appended to `history`, status → `round_end`;
  next round starts when **all** players press "Next" — or on its own a minute
  after the round closed (`roundEndedAt`), so a closed tab cannot hold it back.
  A player who leaves between rounds no longer strands those already ready.
- **Finish**: after the last round; the result dialog ranks by total score.
- **Tests**: `tests/flager-flow.test.ts`.
- **Stats**: split into solo/multiplayer, with flags guessed as the extra
  counter.

### 💣 Minesweeper (`useMinesweeperGame`)
`players` is a **Record<userId, MinesweeperPlayer>`; each player has their **own
board** with the same settings (versus race). Statuses: `waiting → playing → finished`.

- **Board generation**: empty boards on start; mines are placed on the player's
  *first click* with a 3×3 safe zone (first-click safety).
- **Opening**: iterative flood-fill (stack-based, no recursion). Chording (middle
  click on a number with matching flags) opens remaining neighbors.
- **Win**: open all safe cells **or** flag exactly all mines. First winner ends
  the match for everyone (`status = finished`, `winner = name`).
- **Loss**: mine hit or personal timeout → player status `lost`; match ends when
  no one is left playing.
- **Leaving** mid-game marks the player `left` (board stays visible, grayed).
- **Notices**: in a shared match the others are told who hit a mine and who left.
- **Stats**: win/loss with `mode` (single vs multi by player count) and
  `extraCount` = correctly flagged mines.

### 🕵️ Spyfall (`useSpyfallGame`)
`players` is an **array**. Statuses: `waiting → playing ⇄ voting → finished`.

- **Start**: one random location from the selected pack; one random spy
  (`spyCount` is fixed at 1); civilians get roles from the location's role list
  (roles repeat if players > roles). Roles are stored as JSON-stringified
  `{ru, en}` names.
- **Nomination**: any player may accuse once per round (`hasNominated`); the game
  switches to `voting`, author auto-votes "yes".
- **Voting**: everyone except the target votes; conviction requires **unanimous**
  yes. Spy convicted → locals win (`spy_caught`); innocent convicted → spy wins
  (`innocent_killed`). Any "no" returns to playing.
- **Spy guess**: the spy may at any time name the location — correct → spy wins
  (`guessed_loc`), wrong → locals win (`spy_failed_guess`).
- **Timer**: round duration (3–15 min); on expiry the spy wins (`time`). A vote
  pauses it: a rejected vote shifts the round start by the time it took.
- **Leaving**: spy leaving → locals win (`spy_left`); a civilian leaving below 3
  players → technical spy win.
- **Scoring across rounds** (persists via "New Round"): spy win +5 to spy;
  locals win +1 to each civilian, +1 bonus to a successful nomination author.
- **Stats**: recorded on every finished round (win for the side you were on).

## Statistics (`lib/playerStats.ts`)

`updatePlayerStats(userId, {gameType, result, durationSeconds, mode?, extraCount?})`:

- Reads `player_stats` by `user_id` (a row must already exist — created by a
  DB-side signup trigger; guests without a row are skipped).
- For **minesweeper/flager with `mode`**: keeps `details[game].single|multi`
  buckets `{wins, lost, time, extra}` and migrates the legacy flat format on the fly.
- Otherwise: flat `details[game] = {wins, lost, time}`.
- `time` is stored in minutes (min 1 per game); `total_games` increments.
- The achievements page aggregates single+multi and tolerates both formats.

## Authentication flows (`AuthForm`, `Settings`, `reset-password`)

- **Sign up**: username uniqueness check against `profiles`, then
  `auth.signUp` with `{username, avatar_url}` metadata (random DiceBear avatar);
  email confirmation redirect → current origin.
- **Sign in**: the single input accepts username *or* email; usernames are
  resolved to email via `profiles`.
- **Guest**: `signInAnonymously` + random avatar; progress not persisted.
- **Google OAuth**: standard redirect flow.
- **Password reset**: "Forgot password?" on the login form, or from Settings
  when logged in, via `resetPasswordForEmail` → `/reset-password`.
- Route guards: every protected page redirects unauthenticated users to
  `/?returnUrl=<path>`; `AuthForm` honors `returnUrl` after login.
