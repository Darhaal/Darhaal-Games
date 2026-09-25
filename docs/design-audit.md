# Design audit — game screens

Checked 2026-09-24 against the rules in
[`design-system.md` → Game screens](design-system.md#game-screens), from the
code and from screenshots of every game rendered with a live-looking match.
The same day every game was moved onto the shared parts in
`src/components/game/`; this file records what was found and what was done.

Priority: **P1** a visible bug or a clash a player notices, **P2** a
difference from the shared pattern, **P3** polish.

---

## Across all games

| # | Finding | P | Status |
|---|---------|---|--------|
| G1 | Header titles hard-coded in English (COUP, SPYFALL…); Flager's said "Flagger". | P1 | **Fixed** — `requireGame(id).name[lang]`, enforced by `tests/game-screens.test.ts`. |
| G2 | Six different result overlays, z-index 50–200. | P1 | **Fixed** — one `ResultDialog` in all eight games, with "View the board". |
| G3 | «Ваш ход» drawn three ways, including red pills over the board. | P2 | **Fixed** — `TurnCard` in the five turn-based games. |
| G4 | Hurry threshold 10 s in the header, 5 s on the Wall Rush bar. | P2 | **Fixed** — `HURRY_SECONDS = 10` everywhere. |
| G5 | Players shown five ways. | P2 | **Fixed** — `PlayersCard` everywhere but Minesweeper (status on each board) and Coup (the table is the players). |
| G6 | The header clock counted a turn, a round or the match, unlabelled. | P2 | **Fixed** — `timeCaption` «раунд» / «матч». |
| G7 | Minesweeper, Battleship and Coup do not use `GameNotificationToast`. | P3 | **Fixed** — Minesweeper says who hit a mine and who left, Battleship whose fleet is ready and whose clock ran out; Coup keeps its history card. One `pushNotice` in `src/lib/notifications.ts` posts every notice. |

Found along the way and fixed:

- **English-speaking players saw Russian.** Coup's whole history was written
  into the shared state in Russian only (≈35 messages, plus the «Система»
  author); it is now written in both languages and read in the reader's.
  Minesweeper and Spyfall had a hard-coded «(Вы)»; Minesweeper's result
  stickers said WON / DEAD / LEFT in every language; Coup's answer panel
  showed an action's code ("STEAL!").
- **New accounts start in English** until a language is picked in settings.
- **Minesweeper told losers «Победа»** whenever anybody had won.
- **Battleship's result replaced the whole screen**; it is now a dialog over
  the final boards.
- **Reversi did not record the last move**; `lastMove` is now kept and ringed.

---

## Per game

### Wall Rush — reference
On the shared parts; nothing open.

### Dots & Boxes — done
Shared page, Turn and Players cards (boxes as the stat), legend dropped, the
hint moved into the Turn card, result dialog; the board sits on a white
square with a hairline edge.

### Reversi — done
As Dots, plus the board redrawn as white squares on the grey grid and the
last disc ringed.

### Minesweeper — done
Warm grey closed tiles and white opened ones with square corners, standard
board cards with a localised status chip, «матч» under the clock, results in
the dialog with the table inside.

### Battleship — done
Russian ship names and full words, the white-on-grey grid, Turn card instead
of the pill and the red-bordered radar, shipyard and buttons in the design
system, result dialog over the final boards.

### Coup — done
Opponents on standard cards, an answer card in place of the floating panel,
Turn and History cards in the side column; the hand stays pinned to the
bottom (see the layout exceptions in the design system).

### Spyfall — done
Location art fills its card (it was letterboxed with grey bands), a Status
card with the round clock, Players card with the accuse button, all dialogs
on the standard overlay, result dialog with the location and the spy.

### Flager — done
Status card «Раунд N из M», a white score card instead of the dark panel,
answer box in the input style (it looked like an error at rest), Players
card, between-round and final results in the shared shell.
