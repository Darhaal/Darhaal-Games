# Changelog

All notable changes to Darhaal Games. The in-app changelog (RU/EN) lives in
[`src/constants/version.ts`](src/constants/version.ts) — keep both in sync when
releasing.

Format: [Semantic Versioning](https://semver.org/). Types: **major** = platform
milestone, **minor** = new game mode / feature, **patch** = fixes & improvements.

## [2.5.0] — 2026-09-22 (minor) — **Wall Rush for Three**

### Added
- **A three-player Wall Rush.** An 11x11 board, three players on three sides,
  8 walls each, all racing for the golden square in the middle. Three pawns
  cannot each have an opposite edge, so the centre goal the four-player table
  already uses is the answer here too — and with a centre goal every side sits
  the same distance from the target, so which one is left empty changes
  nothing about the race.

### Changed
- **A room closes when its host leaves.** It belongs to whoever opened it, and
  handing it to somebody who did not choose to run it kept rooms alive that
  nobody had asked to keep. The host's leave button now closes the room, after
  a confirmation — dropping everyone is not what "leave" reads like. If the
  host vanishes without leaving, a remaining player removes them and everyone
  is told why and shown out; the last one deletes the row.
- The double jump is now keyed to the goal rather than to the mode's name.
  Pawns pile up around a single target and a single hop stops being enough —
  that is the reason, so the three-player table gets it for the same reason
  the four-player one does.

## [2.4.1] — 2026-09-22 (patch)

### Security
- **The room id was reaching Google anyway.** 2.4.0 stripped it from the URL
  before reporting, and the stripping worked — but gtag fills `dl` from
  `document.location` on every hit by itself, and a repeated `config` call
  does not override it. So the redaction ran and was beside the point: the
  raw `/game/reversi?id=…` travelled in a field the library adds.
  The cleaned address is now attached explicitly to every hit, and page views
  go through `set` plus an explicit `page_view` event rather than a second
  `config`.

  Caught by checking what actually left the browser on production, which the
  unit tests could not see: they proved the redactor correct, and the redactor
  was correct. It simply was not the thing filling in the field.

> 2.4.0 was tagged and deployed but never published to the public repository;
> this release carries both.

## [2.4.0] — 2026-09-22 (minor) — **Analytics and Privacy**

> The site learns what people play, without learning who they are.

### Added
- **Google Analytics, behind consent.** gtag.js is not merely told to store
  nothing — it is not put on the page until the visitor has said yes, so a
  refusal means the script is never fetched and can neither set a cookie nor
  read one. Consent Mode v2 starts at denied for everything; advertising
  storage stays denied even after a yes, because the site does not advertise.
  Both buttons on the banner are the same size and weight.
- **Events**: lobby created, lobby joined, match started, match finished with
  its duration, rematch, and uncaught errors. The error count is hooked to
  real crashes rather than to the toast layer, which also carries ordinary
  refusals like a wrong room password — the app working, not the app breaking.
- **A privacy policy** at `/privacy` and `/en/privacy`, written from what the
  code does rather than from a template: every claim in it is checkable
  against a file. Linked from the footer, the sitemap and the banner.

### Security
- **Room links are stripped before anything is reported.** A room link *is*
  the invitation, and for a private room it is the only thing standing between
  it and a stranger — but it also sits in the address bar, which is exactly
  what GA reports as `page_location`. `send_page_view` is therefore off and
  views go through a redactor that replaces `id`, `code`, `returnUrl` and
  `token`. Crash messages get the same treatment: anything URL-shaped is
  dropped before the reason is sent.
- Analytics runs on the production host only, so a developer reloading
  localhost cannot move the numbers.

## [2.3.3] — 2026-09-22 (patch)

### Changed
- **Small text grows on a large screen.** The interface was drawn for a laptop,
  where a 10px caption reads fine; on a 27" monitor at arm's length the same
  caption is a smudge. Past 1280px the bottom of the type scale moves up —
  roughly 9→10.5, 10→11.5, 12→13.5, 14→15 — while headings and body copy stay
  where they are, so nothing reflows. Phones and tablets are untouched, which
  is where the tight sizes earn their keep.
- 123 hardcoded `text-[10px]` / `text-[9px]` / `text-[11px]` became the named
  tokens `text-2xs`, `text-3xs` and `text-xs`. A literal pixel value cannot
  respond to a screen size, which is why they were the sizes that needed to.
  A test now rejects new ones; the handful left are glyphs sized to their
  container, like the skull in a sunk Battleship cell.

## [2.3.2] — 2026-09-22 (patch)

### Changed
- **The opening move is drawn for, not given to the host.** Every game handed
  it to `players[0]`, which is whoever opened the room — so the host played
  Dark in every Reversi, shot first in every Battleship and took the first line
  in every Dots match. Battleship, Coup, Wall Rush and Dots now pick a random
  starting seat; Reversi shuffles the seating, because seat 0 *is* Dark and
  Dark opens, so colour and first move are the same draw. Wall Rush seats still
  decide sides and teams — only who begins changed.
- **The rules button is labelled.** A bare question mark could open anything,
  and its tooltip never appears on a touch screen, which is exactly where a
  player goes looking for the rules. The header now gives way at the title
  rather than pushing the controls off a narrow screen.
- Larger type across the Dots and Reversi boards, and a stronger fill on a
  claimed box — at fifteen percent opacity it was barely a tint, and who owns
  which half of the board is the whole scoreboard.

### Added
- **Dots & Boxes shows the last move**, drawn heavier than the rest. Every line
  weighed the same, so a move made while you were reading the other side of the
  grid left nothing to find. The in-game rules now say so, along with the
  colouring they never mentioned either.

## [2.3.1] — 2026-09-21 (patch)

> Rooms that nobody is in stop pretending otherwise.

### Added
- **A lobby nobody has open times out.** The auto-kick is run by the host and
  never kicks itself, so a host who closed their tab left the room frozen —
  no one to clear the ghosts, and no start button for anyone. The host role is
  now handed to the first player still present, and a lobby nobody has had
  open for ten minutes is collected instead of sitting in the list for a week.
  Presence lives in the Realtime service and the cleanup job runs in SQL, so
  the lobby screen writes the fact down through `touch_lobby`.
- The Spyfall score **survives a rematch**. It is documented as running across
  a series of games, and inside a room it did, but "play again" opens a new
  room with an empty roster, so the series reset whenever the table wanted
  another game.

### Changed
- **An old room link follows "play again".** The successor keeps the finished
  room's results readable, but the link already shared for it pointed at a room
  nobody would play in again — and a private room shares exactly one link.
  A visitor who is not seated is now forwarded; a player still reading the
  scoreboard is left where they are.
- **Full rooms are no longer listed.** One sat in the list wearing a disabled
  "Full" button, which reads as something you might be able to do. Rooms you
  are in still appear, full or not.

### Fixed
- **The signup trigger was still calling a third party.** It wrote an
  `api.dicebear.com` URL with the Supabase user id inside it into
  `profiles.avatar_url` long after the app moved to rendering the same artwork
  locally — the two had drifted despite a comment asking they be kept in sync.
  7 of 31 profiles carried one; the trigger and the existing rows now use
  `/avatar/<id>`.
- The lobby list read `settings.maxPlayers` raw while every game screen goes
  through `roomCapacity()`, so a row outside the game's range displayed as
  written — "2/99" for a two-player game, and a room that could never read as
  full.
- **Guest accounts are collected.** Guest sign-in creates a real `auth.users`
  row and nothing removed it; 20 of 31 accounts were guests. Anonymous accounts
  idle for 30 days are swept daily. Registered accounts are never touched.

## [2.3.0] — 2026-09-21 (minor) — **Three New Games**

> The line-up grows from five games to eight, and adding the ninth is now a
> single registry entry rather than a tour of a dozen files.

### Added
- **Wall Rush** — race to the far side of the board, or spend a wall and send
  your rival the long way round. 1v1, 2v2 and four-player free-for-all, built
  to the rules the reference game actually uses rather than plain Quoridor.
- **Dots & Boxes** — 3×3 to 8×8, two to four players, including the rule the
  game turns on: close a box and you go again, twice over for a double close.
- **Reversi** — eight by eight, two players, with the automatic pass handled
  properly. A player with no legal move does not stall the match; the turn
  returns, and when neither side can move the game ends on the count.
- **"Play again" opens a new room, in every game.** The new lobby inherits the
  parent's settings — a private room stays private with the same password —
  and both players pressing the button land in the same room rather than two.
- **A game registry** (`src/games/registry.ts`): every per-game fact — name,
  player range, colour, icon, options, initial state — lives in one keyed
  record. A half-registered game is now a type error, not a runtime surprise.

### Fixed
- **Coup could never start.** `startGame` assigned `version: 1` after spreading
  the current state, so the compare-and-swap write asked the database for a
  version that had long passed. Any room with a second player refused to begin,
  and no Coup match had ever been recorded in `player_stats`. Both rules that
  keep the write path honest are now enforced by tests.
- **Simultaneous actions no longer cost a move.** 31 of 37 write paths used a
  non-retryable form of `updateState`, so Spyfall votes, Coup passes and blocks,
  Flager "ready" taps and joins through an invite link could be dropped in
  silence. All 37 now rebuild against fresh state on a conflict.
- **A disconnecting player no longer freezes the room.** Five separate hangs:
  the Spyfall vote had no timeout at all, Coup's AFK kick could only be fired by
  the absent player, Battleship's timeout required it to be your turn, Flager
  did not re-check the round end on leave, and Minesweeper never finished. Every
  deadline is now authoritative and any client may act on it.
- **The homepage promised five games** while the registry held eight — on the
  page, in the `/games` intro and in the search snippet Google prints. The count
  is derived from the registry now, in both languages and all three Russian
  grammatical forms.
- Russian counts read correctly: "1 квадрат", "2 квадрата", "5 квадратов",
  rather than the genitive everywhere.

## [2.2.0] — 2026-09-02 (minor) — **Spyfall Expanded**

### Added
- **Spyfall content**: 15 packs of 22 locations with 20 roles each — 330
  locations and 6600 roles, up from 30 and 150. New packs: Nature, History,
  Sci-Fi, Sports, Food.
- **Location artwork**, generated per card rather than downloaded: a
  deterministic colour field seeded by the location id plus a thematic icon.
  No requests, no hosting bandwidth, identical for every player.

### Fixed
- Location images had been returning **404 since the packs were written** —
  `public/spyfall/` was never populated. The UI hid the broken image behind a
  gradient, so it degraded quietly instead of visibly.
- **Avatars no longer call a third party.** The previous URL sent the Supabase
  user id to `api.dicebear.com` on every render; the same artwork is now
  produced by the app itself and cached immutably.

## [2.1.0] — 2026-08-20 (minor) — **New Home**

> The platform moves to its own domain and gains a public, crawlable surface.

### Added
- **New domain**: the platform now lives at `games.okhten.com`; the previous
  deployment URL redirects to it.
- **Public game pages** with descriptions, rules and screenshots — reachable
  without signing in, so a game can be shared as a plain link.
- Search-engine groundwork: per-page titles and descriptions, social preview
  cards, `robots.txt`, `sitemap.xml` and a web app manifest.

### Changed
- **Modular UI architecture**: shared layout, header and localization extracted
  into reusable modules instead of being repeated per page.
- Faster first load — less JavaScript shipped for pages that do not need it.
- Refreshed navigation between the lobby, game and statistics screens.

## [2.0.4] — 2026-08-05 (patch)
- Stability on weak connections: rejoin your room without losing your seat, with
  clear notifications when the connection drops.

## [2.0.3] — 2026-07-27 (patch)
- Mobile: larger tap targets, fixed layout on narrow screens, and refined
  gestures in Minesweeper and Battleship.

## [2.0.2] — 2026-07-18 (patch)
- Faster room list and statistics page, with reduced traffic during match
  synchronization.

## [2.0.1] — 2026-07-11 (patch) — Polish
- The avatar-delete **native `confirm()` replaced with an in-app confirmation
  dialog** (Escape / backdrop to cancel) — the last native dialog is gone.
- **Zero-warning codebase**: remaining ESLint warnings resolved (unused
  imports/vars removed; intentional `exhaustive-deps` effects documented).
- Removed dead code and unused props.

## [2.0.0] — 2026-07-09 (major) — 🚀 **Platform 2.0**

> A full-codebase audit plus a round of hardening and polish. Consolidates the
> initial 2.0.0 launch and its same-day follow-ups (branding, keyboard UX, input
> fixes, controls & rules audit) into one release.

### Security
- Room passwords **never leave the database**: server-side verification via the
  `join_lobby_check` RPC; the lobby list no longer selects the `password` column.
- **Optimistic locking** for every game-state write (CAS RPC `update_game_state`)
  with automatic client re-sync on version conflicts.
- Username → email sign-in resolution behind the `get_login_email` RPC; RLS
  enabled on `profiles`; owner-only statistics reads; schema repair
  (`profiles.username`, signup trigger, user backfill).
- Credentials strictly from environment variables; 8 dependency vulnerabilities
  fixed; Next.js 16.2.10. All config centralized in `src/constants/app.ts`.

### Games & UX
- **Honest statistics in every game** (Spyfall recorded for the first time;
  Flager solo/multi parity; real match durations for Coup/Battleship).
- **Join-by-link for Coup**, a "game already in progress" screen for late
  visitors, **forgot-password** flow.
- **Keyboard controls**: Escape closes dismissible dialogs, Enter submits the
  private-room password, arrow keys navigate the Flager suggestions, Battleship
  rotate keys; dialogs also close on backdrop click.
- **Minesweeper chord** on a left-click/tap of a number (open remaining
  neighbors when the flag count matches) + keyboard zoom.
- **Sound**: synthesized WebAudio cues wired to the volume setting.
  **Toasts** replace every native `alert()`.
- **Branding**: platform *Darhaal Games*, a product of **Okhten Group LLC**
  (LICENSE, footers, README). Settings reachable from every page; the panel
  renders through a portal so it is never clipped by blurred headers.

### Engineering
- **Zero ESLint errors** (from 82): all `any` eliminated, `useLang` via
  `useSyncExternalStore`, nested render components hoisted.
- **Shared sync core** `hooks/core/useLobbySync` deduplicated out of all five
  game hooks (−350 lines). Pure game logic extracted to `src/lib/gameLogic/`.
- **Unit tests** (vitest) for placement/fleet, mines/flood-fill/chord,
  deck/roles, scoring. CI: build + blocking lint + tests. `next/image` everywhere.
- Full documentation set (`docs/`), SQL migrations.

### Fixed (highlights)
- Sign-in by email; Battleship waiting-lobby leave counted as a win; Minesweeper
  losses not recorded / all-lost game never finishing; Minesweeper cell clicks
  swallowed by pointer capture; Coup turn-order corruption on leave; multi-client
  timer races; Spyfall vote-timer overlap; room-code generation & collisions;
  the dead background-texture CDN; the settings panel clipped on secondary pages.

## [1.9.3] — 2026-06-22 (patch)
- Rule and hint copy fixes, with typos corrected in the Russian localization.

## [1.9.2] — 2026-06-10 (patch)
- Fixed closing the rules dialog on mobile and improved the layout of long
  descriptions.

## [1.9.1] — 2026-06-01 (patch)
- Rules open straight from the lobby, with short hints added for newcomers.

## [1.9.0] — 2026-05-14 (minor) — **Rules**
- Built-in rules for every game: a single dialog covering the goal, turn order
  and win conditions in Russian and English.

## [1.8.4] — 2026-05-06 (patch)
- Rare locations rebalanced and duplicate entries removed from the packs.

## [1.8.3] — 2026-04-28 (patch)
- Fixed pack selection when a round is restarted.

## [1.8.2] — 2026-04-20 (patch)
- Improved role card readability and refreshed the location icons.

## [1.8.1] — 2026-04-13 (patch)
- Minor Spy Mode fixes and voting stability.

## [1.8.0] — 2026-04-08 (minor) — **Theme Packs**
- New location sets for Spy Mode: school, university, office, horror, gaming,
  USA, USSR and extended general packs.

## [1.7.5] — 2026-03-31 (patch)
- Fixed rare cases where a room stayed in the list after every player had left.

## [1.7.4] — 2026-03-25 (patch)
- Faster room list updates and a corrected player counter.

## [1.7.3] — 2026-03-20 (patch)
- Copying the room code now works in every browser.

## [1.7.2] — 2026-03-17 (patch)
- Fixed host transfer when the room creator leaves.

## [1.7.1] — 2026-03-14 (patch)
- Minor private room and list filter fixes.

## [1.7.0] — 2026-03-12 (minor) — **Lobby**
- A reworked lobby: private rooms with a password, short invite codes, per-game
  filters, and automatic removal of disconnected players with a reconnect grace
  period.

## [1.6.4] — 2026-03-06 (patch)
- Fixed the average match duration calculation.

## [1.6.3] — 2026-03-01 (patch)
- Avatars: a file size limit and a clear error message on upload.

## [1.6.2] — 2026-02-25 (patch)
- Fixed statistics display for new players.

## [1.6.1] — 2026-02-22 (patch)
- Minor profile and settings fixes.

## [1.6.0] — 2026-02-20 (minor) — **Profile**
- Personal profile and achievements: a per-game statistics page, custom avatar
  uploads, and generated avatars for new accounts.

## [1.5.4] — 2026-02-08 (patch)
- Bug fixes, improved lobby performance, and additional cards and packs for Spy Mode.

## [1.5.3] — 2026-02-07 (patch)
- Reworked settings and achievements system, minor bug fixes, and overall stability and performance improvements.

## [1.5.2] — 2026-02-06 (patch)
- Minor bug fixes, reworked and simplified game rules, improved readability and design.

## [1.5.1] — 2026-02-06 (patch)
- Fixed Spyfall bugs, resolved rare crashes, and improved match stability and state synchronization.

## [1.5.0] — 2026-02-05 (minor) — **Spy Mode**
- Added Spy Mode, refreshed the UI visual style, improved new player onboarding, and fixed bugs.

## [1.4.5] — 2026-02-03 (patch)
- Minor bug fixes, improved UI responsiveness and click handling.

## [1.4.4] — 2026-02-03 (patch)
- Multiplayer fixes, improved lobby and timer stability.

## [1.4.3] — 2026-02-03 (patch)
- UX improvements for Minesweeper, animation optimizations.

## [1.4.2] — 2026-02-03 (patch)
- Fixed board generation issues and flag logic.

## [1.4.1] — 2026-02-03 (patch)
- Performance and networking optimizations.

## [1.4.0] — 2026-02-03 (minor) — **Minesweeper**
- Added Minesweeper: multiplayer, flags and board zoom.

## [1.3.5] — 2026-02-02 (patch)
- Localization fixes and question correctness.

## [1.3.4] — 2026-02-02 (patch)
- Quiz UI and animation smoothness improvements.

## [1.3.3] — 2026-02-02 (patch)
- Pixel Match optimizations and faster loading.

## [1.3.2] — 2026-02-01 (patch)
- Fixed rare score calculation issues.

## [1.3.1] — 2026-02-01 (patch)
- Minor bug fixes and stability improvements.

## [1.3.0] — 2026-02-01 (minor) — **Flager**
- Added flag quiz with Pixel Match mechanic.

## [1.2.5] — 2026-01-31 (patch)
- Drag&Drop and network sync optimizations.

## [1.2.4] — 2026-01-31 (patch)
- Visual bug fixes and improved responsiveness.

## [1.2.3] — 2026-01-31 (patch)
- Fixed ship placement issues.

## [1.2.2] — 2026-01-30 (patch)
- Match and timer stabilization.

## [1.2.1] — 2026-01-30 (patch)
- Minor bug fixes and UI improvements.

## [1.2.0] — 2026-01-30 (minor) — **Battleship**
- Added real-time Battleship.

## [1.1.5] — 2026-01-29 (patch)
- Role balance and card logic fixes.

## [1.1.4] — 2026-01-29 (patch)
- Network desync fixes.

## [1.1.3] — 2026-01-29 (patch)
- UI and match stability improvements.

## [1.1.2] — 2026-01-28 (patch)
- Fixed round ending issues.

## [1.1.1] — 2026-01-28 (patch)
- Minor bug fixes and optimizations.

## [1.1.0] — 2026-01-28 (minor) — **Coup**
- Added the card game Coup.

## [1.0.2] — 2026-01-27 (patch)
- Added RU/EN localization and audio settings.

## [1.0.1] — 2026-01-27 (patch)
- Authentication and lobby fixes.

## [1.0.0] — 2026-01-27 (init) — **Launch**
- Initial platform release: accounts, profiles and lobbies.
