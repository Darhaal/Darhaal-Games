# Working on Darhaal Games

## UI style

Any screen, panel or component must follow [`docs/design-system.md`](docs/design-system.md).
It is taken from the main menu (`src/components/HomeClient.tsx`), `/create`
and `/play` — copy their recipes rather than inventing new ones.

The short version:

- **Colours are theme tokens, never hex classes** — there is a light and a
  dark theme (`src/app/globals.css`), and `tests/theme.test.ts` fails a
  hard-coded design colour or a solid `bg-white`. Tokens: `page`,
  `surface`, `line`, `divider`, `ink` (+ `on-ink` for text on an ink
  fill), `muted`, `accent`, `warm`, `scrim` (modal backdrop), `shade`
  (shadow tint), `night` (a panel that stays dark in both themes).
- Page `bg-page`; content in cards —
  `bg-surface rounded-2xl border border-line shadow-sm`.
- Text `text-ink`, captions `text-muted`, one accent `accent` for hover and
  focus (borders at `/20`–`/30`, primary buttons turn red on hover).
- Primary button: `bg-ink text-on-ink`, `rounded-xl`, `font-black uppercase`,
  `hover:bg-accent`. Secondary: `bg-surface` with the hairline border that
  warms to red on hover.
- Labels: `text-2xs font-black uppercase tracking-widest text-muted`.
- Inputs: `bg-page border-gray-200 rounded-xl`, `focus:border-ink`.
- White text belongs on `night`, `accent` or a colour fill — on `ink` it is
  `text-on-ink`, because ink turns light in the dark theme. An inline style
  uses `var(--surface)` and friends, or `light-dark(a, b)`.
- Modals are in-app (`role="dialog" aria-modal="true"`, Escape closes) —
  never `window.confirm` or `alert`.
- Game boards are the exception: square, `surface` cells on a `line` grid,
  seat colours from `src/games/palette.ts`, softened on large surfaces.
- Game screens are built from `src/components/game/` (design-system.md →
  Game screens): `GameLayout` (board left, cards right), `TurnCard` (or a
  Status card), `PlayersCard`, `ResultDialog`, and the classes in `ui.ts`.
  One clock, in the header. A new game uses these;
  `tests/game-screens.test.ts` fails one that does not.

## Releases

- Do not cut a version per change. Add work to `## [Unreleased]` in
  CHANGELOG.md and release only when asked; polish and fixes are patch bumps.
- Every string in Russian, Ukrainian and English; code and comments in English.
