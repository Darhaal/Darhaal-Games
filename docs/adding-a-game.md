# Adding a game

A sixth game should be one registry entry plus the game itself — not an edit to
ten screens. This page is the checklist, and it explains what will break loudly
if you skip a step.

## Why there is a registry at all

Before `src/games/`, every game was described five or six times over: the create
screen kept its own names, taglines, player counts and icons; the lobby list
kept a second set of names, a `switch` for icons and a ternary chain for
colours; the achievements grid kept a third set plus a hardcoded array of ids;
`UniversalLobby` kept a fourth icon map; each game route hardcoded its own
player limits; and `src/content/games.ts` kept a fifth set for the public pages.

They had already drifted. The lobby list said *Сапер* while the public page said
*Сапёр*. Four of the five game screens passed the game's absolute maximum to the
lobby instead of the cap the host had chosen, so a Coup room created for three
players advertised six seats and let six people in through the invite link.
Neither was a typo anyone made twice — they were the predictable result of
writing the same fact in six places.

## The modules

| File | What it owns | Who imports it |
|---|---|---|
| [`src/games/registry.ts`](../src/games/registry.ts) | ids, names, taglines, player counts, genre, playtime, accent, tint, solo-mode flag | everything, including the SEO pages |
| [`src/games/icons.ts`](../src/games/icons.ts) | one lucide icon per game | client screens only |
| [`src/games/options.ts`](../src/games/options.ts) | the create screen's per-game controls, as data | the create screen only |
| [`src/games/initialState.ts`](../src/games/initialState.ts) | the `game_state` a new room starts from | the create screen only |

`registry.ts` is **server-safe on purpose**: no React, no lucide, nothing
`'use client'` in its import graph. `src/content/games.ts` builds on it and feeds
statically rendered pages, so an icon import there would drag the client bundle
into them. That is also why options and starting states are separate modules —
the lobby list has no business shipping 330 Spyfall locations.

## The checklist

**1. Register it.** Add the id to `GAME_IDS` and an entry to `GAMES` in
[`registry.ts`](../src/games/registry.ts). The id is also the stored
`game_state.gameType` and the `/game/<id>` route segment, so pick it once and
keep it — renaming orphans existing rooms and inbound links.

**2. Follow the type errors.** `GAME_ICONS`, `GAME_OPTIONS`, `FACTORIES` and
`GAME_RULES` are all `Record<GameId, …>`, so `tsc` now names each missing piece:

```
src/games/icons.ts: Property 'fibbage' is missing …
src/games/options.ts: Property 'fibbage' is missing …
src/games/initialState.ts: Function lacks ending return statement …
src/constants/rules.ts: Property 'fibbage' is missing …   (twice: ru and en)
```

**3. Declare the create-screen controls** in `GAME_OPTIONS`. Sliders and
choice grids are data — `kind: 'slider'` with min/max/step/default, or
`kind: 'choice'` with a list of packs. A slider can carry a `format` (Minesweeper
shows `20 × 20`) and a `note`, a derived line recomputed as the sliders move
(`Клеток: 400 · Всего мин: 60`). An empty array is fine: Coup and Battleship have
no options. Only reach for bespoke JSX when a control genuinely cannot be
described this way.

**4. Write the starting state** as a factory in `FACTORIES`. It is a pure
function of the host, the player cap and the chosen options, so it is unit
tested rather than only reachable by clicking through the form. Always set
`settings.maxPlayers` — every screen reads it to decide whether a room is full.

**5. Build the game itself**: `src/types/<id>.ts`, pure rules in
`src/lib/gameLogic/<id>.ts` (this is the part worth testing), the hook in
`src/hooks/use<Name>Game.ts` on top of
[`useLobbySync`](../src/hooks/core/useLobbySync.ts), the component, and the route
at `src/app/game/<id>/page.tsx`. Copy the closest existing route — the five are
deliberately the same shape, including the capacity guard that stops an invite
link seating more players than the host allowed.

**6. Write the rulebook** in [`src/constants/rules.ts`](../src/constants/rules.ts),
both languages.

**7. Write the public content** in [`src/content/games.ts`](../src/content/games.ts):
meta title and description, intro, how-to-play, features, strategy, mistakes and
FAQ, in both languages. Everything else on the public page — player range,
genre, playtime, accent, name and tagline — comes from the registry. The route,
sitemap entry, hreflang pair, OG image and JSON-LD are all generated.

**8. Run the checks.** `tests/registry.test.ts` covers what TypeScript cannot
see: that the route file exists, that both rulebooks are non-empty, that the
public content exists and agrees with the registry, that option defaults are
actually selectable, and that the starting state seats the host with a sane cap.

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

## What you do not have to touch

The create screen, the lobby list, the achievements grid, `UniversalLobby`,
`playerStats.ts`, `sitemap.ts` and the OG image generator all read the registry.
If you find yourself editing one of them to add a game, that is a sign the fact
belongs in the registry instead.

## Statistics

Set `hasSoloMode: true` when a match can be played alone — `playerStats.ts` then
splits that game's record into solo and multiplayer, and the achievements grid
renders two cards. Set `extraStat` when the game counts something of its own
beyond wins, losses and time (Minesweeper counts mines found, Flager counts
flags guessed); it appears as a fourth figure on the card.

## Before you write any of it

Read the trade-off in [security.md](security.md) first. Game state is computed by
the client and checked only for its version, so hidden information in
`game_state` is readable by every player. In Spyfall that spoils a round; in a
game built on hidden roles it would remove the point of playing. Either pick a
game where that does not matter, or plan a `SECURITY DEFINER` RPC that hands the
secret only to the player entitled to it.
