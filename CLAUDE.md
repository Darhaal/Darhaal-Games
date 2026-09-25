# Working on Darhaal Games

## UI style

Any screen, panel or component must follow [`docs/design-system.md`](docs/design-system.md).
It is taken from the main menu (`src/components/HomeClient.tsx`), `/create`
and `/play` — copy their recipes rather than inventing new ones.

The short version:

- Page `bg-[#F8FAFC]`; content in white cards —
  `bg-white rounded-2xl border border-[#E6E1DC] shadow-sm`.
- Ink `#1A1F26`, muted `#8A9099`, one accent `#9e1316` for hover and focus
  (borders at `/20`–`/30`, primary buttons turn red on hover).
- Primary button: dark `#1A1F26`, `rounded-xl`, `font-black uppercase`,
  `hover:bg-[#9e1316]`. Secondary: white with the hairline border that warms
  to red on hover.
- Labels: `text-2xs font-black uppercase tracking-widest text-[#8A9099]`.
- Inputs: `bg-[#F8FAFC] border-gray-200 rounded-xl`, `focus:border-[#1A1F26]`.
- Modals are in-app (`role="dialog" aria-modal="true"`, Escape closes) —
  never `window.confirm` or `alert`.
- Game boards are the exception: square, white cells on a `#E6E1DC` grid,
  seat colours from `src/games/palette.ts`, softened on large surfaces.
- Game screens are built from `src/components/game/` (design-system.md →
  Game screens): `GameLayout` (board left, cards right), `TurnCard` (or a
  Status card), `PlayersCard`, `ResultDialog`, and the classes in `ui.ts`.
  One clock, in the header. A new game uses these;
  `tests/game-screens.test.ts` fails one that does not.

## Releases

- Do not cut a version per change. Add work to `## [Unreleased]` in
  CHANGELOG.md and release only when asked; polish and fixes are patch bumps.
- Every string in Russian and English; code and comments in English.
