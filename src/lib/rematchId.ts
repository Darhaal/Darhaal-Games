/**
 * The successor a finished room already has, if anyone has pressed first.
 *
 * `create_rematch_lobby` writes this into `game_state` for every game, but
 * only Wall Rush's state type declares it — reading it loosely here beats
 * adding the same optional field to eight interfaces that never use it
 * themselves.
 *
 * Kept apart from `rematch.ts`, which opens the successor and therefore pulls
 * in the Supabase client: this half is a field lookup and should stay usable
 * anywhere, including in a test with no environment.
 */
export const rematchIdOf = (state: unknown): string | undefined =>
  (state as { rematchLobbyId?: string } | null | undefined)?.rematchLobbyId;
