import {
  Bomb, BrickWall, CircleDot, Fingerprint, Flag, Grid2x2, ScrollText, Ship, type LucideIcon
} from 'lucide-react';
import type { GameId } from './registry';

/**
 * One icon per game, kept out of `./registry` on purpose: importing
 * lucide-react there would pull the client graph into the statically rendered
 * SEO pages, which build on the registry.
 *
 * The record is exhaustive over `GameId`, so adding a game fails the type
 * check here until it has an icon — previously the lobby list fell through a
 * `switch` to the Coup scroll and a new game silently wore someone else's
 * symbol.
 */
export const GAME_ICONS: Record<GameId, LucideIcon> = {
  spyfall: Fingerprint,
  minesweeper: Bomb,
  flager: Flag,
  battleship: Ship,
  coup: ScrollText,
  wallrush: BrickWall,
  dots: Grid2x2,
  reversi: CircleDot
};
