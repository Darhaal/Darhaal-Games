# Darhaal Games

![Version](https://img.shields.io/badge/version-2.8.0-blue.svg) ![License](https://img.shields.io/badge/license-View%20%26%20Study%20Only-red.svg) ![Tests](https://img.shields.io/badge/tests-524-brightgreen.svg)

Eight board and logic games you can play with friends in a browser. One person
creates a room, shares the link, everyone else joins — no install, no account
required.

**Live:** https://games.okhten.com

Built and run by one person. It is a real product with real users rather than a
demo, but it is a small one, and the notes below try to describe it as it
actually is.

---

## What is interesting in here

A few parts are worth reading if you are looking at this as engineering work.

**One sync core for every game.** Every game does the same four things: fetch
state, subscribe to changes, guard against stale updates, write back. That lives
once in [`hooks/core/useLobbySync.ts`](src/hooks/core/useLobbySync.ts); the game
hooks contain only game logic. Extracting it removed about 350 duplicated lines.

**Writes that survive two people acting at once.** Every game shares a single
`game_state` row behind one version counter, so simultaneous actions collide —
constantly in Minesweeper, where every player has their own board and clicks are
independent. Writes go through a compare-and-swap RPC; on a conflict the update
is rebuilt against fresh state and retried, so nobody loses their move. Verified
against the live database: twelve simultaneous clicks, twelve applied, six
conflicts silently resolved.

**A public layer bolted onto an auth-walled app.** Every application route is a
client component behind a login screen, so search engines saw nothing. The fix
was a separate server-rendered tree (`/games`, `/en/games`) plus a landing on the
root, with hreflang pairs, per-page Open Graph cards and structured data — all
generated from one content module. See [`docs/seo.md`](docs/seo.md).

**One registry instead of six copies of each game.** Every game used to be
described separately in the create screen, the lobby list, the achievements
grid, the lobby header, each game route and the SEO content — and they had
drifted, down to two spellings of the same game's name and four screens that
ignored the player cap the host had chosen. [`src/games/`](src/games/) holds it
once; the per-game records are keyed so a half-registered game is a type error,
not a blank card.

**Authorization that is actually tested.** [`scripts/authz-test.mjs`](scripts/authz-test.mjs)
signs in two throwaway guests and has one attempt six attacks on the other's
room. It runs against the live database, cleans up after itself, and fails the
build if any attack succeeds.

---

## The games

| Game | Players | Notable bits |
|------|---------|--------------|
| **Spyfall** | 3–12 | 15 packs, 330 locations, 20 roles each; artwork generated per card, nothing fetched |
| **Minesweeper** | 1–4 | Pan/zoom viewport, first-click safety, chording, identical grids for a fair race |
| **Flager** | 1–4 | Canvas pixel-reveal mechanic, ~200 countries, score decays with time |
| **Battleship** | 2 | Drag-and-drop placement with live rule validation, extra turn on a hit |
| **Coup** | 2–6 | Nested state machine: action → challenge → block → resolution |
| **Wall Rush** | 2–4 | Duel, three-way, 2v2 and free-for-all; path-finding keeps every wall legal; resign and stay to watch |
| **Dots & Boxes** | 2–4 | Close a box and move again; the last line drawn is marked |
| **Reversi** | 2 | Legal moves shown; a turn with none passes by itself |

Rules, tactics and per-game notes: [`docs/games.md`](docs/games.md).

---

## Security posture, honestly

Some of this is deliberately unfinished, so it is worth being direct about
where the line is and why it sits there.

**What was worth fixing, and is fixed.** These hurt players regardless of who
they are playing with, and all were live in production at some point:

- Room passwords and user emails were readable by anyone holding the public
  anon key — which ships in the browser bundle.
- `TRUNCATE` was granted to the public role on every table. It ignores
  row-level security, so any visitor could have wiped the database outright.
- Any signed-in user, guests included, could rewrite or delete **any** room.

All closed, and re-tested from the outside rather than by reading the config.
The full write-up, including one finding I got wrong and had to correct, is in
[`docs/security.md`](docs/security.md).

**What is deliberately not built: server-authoritative game rules.** The client
computes `game_state` and writes it. The database checks the *version*, not the
*move*. A crafted client can cheat — read the opponent's ship positions, deal
itself better Coup cards.

That is a real hole and it stays open on purpose. Closing it means
re-implementing all five rulebooks inside the database, adding a round-trip to
every single move, and roughly doubling the amount of code to maintain. The cost
lands on the people playing honestly, in latency and complexity. The benefit,
for a group of friends sharing a room link in a group chat, is close to nothing:
cheating here is a social problem, and a friend who edits their board to win has
already ended the game in the way that matters.

The trade-off would flip immediately if the platform opened to strangers or
added a leaderboard worth gaming. It is tracked as the first thing to change,
not forgotten.

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, Lucide icons |
| Backend | Supabase — Postgres, Auth, Realtime, Storage |
| State | Custom hooks, optimistic updates with CAS write-back |
| Hosting | Vercel |

No state-management library: the shared sync hook and React state cover it.
Zero `any`, zero `@ts-ignore`, zero dependency vulnerabilities, 239 tests.

---

## Running it locally

Included so the setup is legible when reading the code — note that the license
does not grant the right to deploy or run this. Requires Node 22 and a Supabase
project.

```bash
git clone https://github.com/Darhaal/Darhaal-Games.git
cd Darhaal-Games
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

The SQL that sets up the database lives in [`supabase/migrations/`](supabase/migrations/)
and is applied in filename order. [`docs/getting-started.md`](docs/getting-started.md)
walks through it.

---

## Documentation

| | |
|---|---|
| [Getting Started](docs/getting-started.md) | Install and run |
| [Environment](docs/environment.md) | Every variable and what breaks without it |
| [Architecture](docs/architecture.md) | Structure and real-time data flow |
| [Business Logic](docs/business-logic.md) | Sync model, lobby lifecycle, per-game state machines |
| [Data Model](docs/data-model.md) | Tables, `game_state` shapes, lobby lifecycle and cleanup |
| [Games](docs/games.md) | Each mode and where its code lives |
| [Adding a Game](docs/adding-a-game.md) | The registry, and the checklist for a new mode |
| [SEO](docs/seo.md) | The public crawlable layer |
| [Security](docs/security.md) | Audit, fixes, and the accepted risks |
| [Deployment](docs/deployment.md) | Vercel and Supabase setup |

Status: [Backlog](TODO.md) · [Changelog](CHANGELOG.md)

---

## License

**Source-available, not open source.** The code is published so it can be read,
studied and evaluated — not used. Running it, reusing any part of it, deriving
from it or training models on it all need written permission.

Forking on GitHub is permitted by GitHub's own Terms of Service; that permission
comes from GitHub, not from this license, and grants none of the rights withheld
above.

Full terms in [LICENSE](LICENSE). For anything beyond reading:
artem@okhten.com.

A product of Okhten Group LLC.
