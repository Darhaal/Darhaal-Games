import type { GameNotification } from '@/types/notification';

/** How many notices a state keeps. The toast only ever shows the newest. */
const KEEP = 3;

/**
 * Posts an in-match notice — "someone left", "the vote was rejected" — into a
 * game state, keeping the last few.
 *
 * Every game wrote the same six lines inline, and two of them (Reversi, the
 * Spyfall vote) forgot the cap, so their list grew for as long as the room
 * lasted. The id is the time: the toast shows a notice once by comparing ids.
 */
export function pushNotice(
  state: { notifications?: GameNotification[] },
  message: GameNotification['message'],
  type: GameNotification['type'],
  at: number = Date.now()
) {
  state.notifications = [...(state.notifications ?? []), { id: at, message, type }].slice(-KEEP);
}

/** "X left the game", which every game posts. */
export const leftTheGame = (name: string): GameNotification['message'] => ({
  ru: `${name} покинул игру`,
  en: `${name} left the game`
});
