# 🎮 Game Modes

Darhaal Games ships eight real-time multiplayer games. Each has a route under
`src/app/game/`, a UI component in `src/components/`, and its logic in a hook
under `src/hooks/`.

| Game | Genre | Route | Component | Hook |
|------|-------|-------|-----------|------|
| Flager | Geography quiz | `game/flager` | `FlagerGame.tsx` | `useFlagerGame.ts` |
| Minesweeper | Co-op / versus puzzle | `game/minesweeper` | `MinesweeperGame.tsx` | `useMinesweeperGame.ts` |
| Battleship | Strategy | `game/battleship` | `BattleshipGame.tsx` | `useBattleshipGame.ts` |
| Coup | Social deduction | `game/coup` | `CoupGame.tsx`, `CoupComponents.tsx` | `useCoupGame.ts` |
| Spyfall | Social | `game/spyfall` | `SpyfallGame.tsx` | `useSpyfallGame.ts` |
| Wall Rush | Abstract race | `game/wallrush` | `WallRushGame.tsx` | `useWallRushGame.ts` |
| Dots & Boxes | Abstract | `game/dots` | `DotsGame.tsx` | `useDotsGame.ts` |
| Reversi | Abstract | `game/reversi` | `ReversiGame.tsx` | `useReversiGame.ts` |

## 🚩 Flager — Geography quiz
Guess the country while its flag is gradually revealed through digital noise, with
pixel-by-pixel comparison unlocking correct fragments. Uses HTML5 Canvas image
processing and round-based multiplayer sync. Country data: `src/data/flager/countries.ts`.

## 💣 Minesweeper — Co-op / Versus
A multiplayer take on the classic, with a pan/zoom viewport (transform/scale),
first-click safety, chording, and multiplayer conflict resolution.

## ⚓ Battleship — Strategy
Real-time naval combat with drag-and-drop ship placement and rotation, optimistic
UI for instant shot feedback, and fleet tracking. Turn deadlines are stored as
server timestamps so every client counts down to the same moment — the countdown
itself still runs, and is enforced, on the client.

## 🎭 Coup — Social deduction
A digital Coup with a state machine handling nested phases
(Action → Challenge → Block → Resolution), a full action log, client-side action
validation, and AFK protection. Constants: `src/constants/coup.ts`.

## 🕵️ Spyfall — Social
Hidden role distribution and location guessing under time pressure, with
synchronized timers, voting, and dynamic location/card packs. Content lives in
`src/data/spyfall/` (`locations.ts` and `packs/`).

## 🧱 Wall Rush — Abstract race
The Quoridor family: race a pawn across the board or spend the turn on a wall
that sends a rival the long way round. Duel, three-way, 2v2 and free-for-all.
Rules live in `src/lib/gameLogic/wallrush.ts` (path search keeps every wall
legal), turn flow and resigning in `wallrushFlow.ts`, and how wall ends meet on
screen — flush, half-way, filling an L corner — in `wallrushJoints.ts`.

## ⬛ Dots & Boxes — Abstract
Draw a line; close a box and move again. Logic in `src/lib/gameLogic/dots.ts`.

## ⚫ Reversi — Abstract
Legal moves are highlighted; a turn with none passes by itself. Logic in
`src/lib/gameLogic/reversi.ts`.

## ⌨️ Controls

Every game is playable by mouse and by touch. Keyboard controls are listed in
each game's in-game rules (`src/constants/rules.ts`, a "Controls" section) and
here:

| Game | Keys |
|------|------|
| Minesweeper | **Space** flags the cell under the pointer, or chords an open number · **WASD / arrows** move around the board · **+ / −** or the **mouse wheel** zoom · **0** resets the view |
| Wall Rush | **Arrows / WASD** step your pawn (a pawn in the way is jumped) · while dragging a wall: **R, Q, E or Space** turn it, **Esc** puts it back |
| Battleship | Setup: **R, Q, E or Space** rotate the ship being placed; right click on the grid does the same |
| Flager | **↑ / ↓** pick a suggestion · **Enter / Tab** answer with it · **Esc** hides the list · **Enter** presses "Next" after a round |
| Coup | **Esc** cancels choosing a target |
| Spyfall | **Esc** closes the location guess and the accusation prompt (the vote cannot be dismissed) |
| Dots & Boxes, Reversi | Pointer only — a move is a single tap on the board |
| Everywhere | **Esc** closes the rules and the chat · **Enter** sends a chat message |

Board keys go through `useGameKeys` (`src/hooks/useGameKeys.ts`), which ignores
any press made in a text field or a dialog and any press with Ctrl, Alt or Cmd
held — so typing in the chat never moves a piece, and browser shortcuts stay
the browser's. Keys are read by physical position with the character as a
fallback (`src/lib/keys.ts`), so WASD works on a Russian layout too.

## Adding a new game (high-level)

1. Add static data under `src/data/<game>/` and types under `src/types/<game>.ts`.
2. Create the logic hook `src/hooks/use<Game>Game.ts`, subscribing to a Supabase
   Realtime channel and building on the shared lobby.
3. Build the UI in `src/components/<Game>Game.tsx`, reusing shared components
   (`UniversalLobby`, `GameHeader`, `GameRulesModal`).
4. Add the route `src/app/game/<game>/page.tsx`.
5. Register rules in `src/constants/rules.ts` — including a Controls section for
   any keyboard shortcut, wired through `useGameKeys` — and bump
   `src/constants/version.ts`.
