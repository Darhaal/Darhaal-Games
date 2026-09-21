import { supabase } from '@/lib/supabase';
import { generateRoomCode } from '@/constants/app';
import { createRematchState, type GameStateByType } from '@/games/initialState';
import type { GameId } from '@/games/registry';

/**
 * "Play again" opens a new room rather than resetting the finished one.
 *
 * Resetting in place pulled the results out from under anyone still reading
 * them, and a room people arrived at by link kept its old identity for good.
 * The successor inherits the parent's settings — a private room stays private
 * with the same password, a public one stays public.
 *
 * Two things push the work into `create_rematch_lobby` rather than a plain
 * insert:
 *
 *   1. `lobbies.password` is not readable by clients at all, so a private
 *      room's password cannot be copied from here.
 *   2. Everyone at the table presses the button. Whoever presses second must
 *      land in the *same* successor, not open another one. The function locks
 *      the parent and records the successor on it, so later callers are handed
 *      the id the first one created.
 *
 * Returns the room to navigate to, or null when it could not be opened.
 */
export async function startRematch<T extends GameId>(
  lobbyId: string,
  gameId: T,
  parent: GameStateByType[T]
): Promise<string | null> {
  const fresh = createRematchState(gameId, parent);

  // The room code carries a unique index, so a collision is worth a retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.rpc('create_rematch_lobby', {
      p_parent: lobbyId,
      p_code: generateRoomCode(),
      p_state: fresh
    });

    if (!error && data) return data as string;
    if (error?.code !== '23505') {
      if (error) console.error('rematch failed:', error.message);
      return null;
    }
  }

  return null;
}
