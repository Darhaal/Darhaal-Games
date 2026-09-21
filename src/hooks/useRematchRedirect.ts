import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { rematchIdOf } from '@/lib/rematchId';
import type { GameId } from '@/games/registry';

/**
 * Sends someone arriving on an old room link to the room that replaced it.
 *
 * "Play again" opens a successor rather than resetting the finished room, so
 * the results survive for whoever is still reading them — but it also means
 * the link already sitting in a group chat points at a room nobody will play
 * in again. A private room shares exactly one link, so that was the link.
 *
 * Only visitors who are *not* seated are forwarded. A player still looking at
 * the scoreboard of the match they just played stays where they are; the
 * finish overlay gives them the button.
 *
 * `replace` rather than `push`: the dead room should not sit in history, or
 * Back from the new lobby lands on the redirect and bounces forward again.
 */

/** Seating, across both roster shapes the games use. */
const isSeated = (state: unknown, userId: string | undefined): boolean => {
  if (!userId) return false;
  const players = (state as { players?: unknown } | null | undefined)?.players;

  if (Array.isArray(players)) {
    return players.some((p) => (p as { id?: string })?.id === userId);
  }
  if (players && typeof players === 'object') {
    return Boolean((players as Record<string, unknown>)[userId]);
  }
  return false;
};

export function useRematchRedirect(
  gameId: GameId,
  state: unknown,
  userId: string | undefined
): string | undefined {
  const router = useRouter();
  const successor = isSeated(state, userId) ? undefined : rematchIdOf(state);

  useEffect(() => {
    if (successor) router.replace(`/game/${gameId}?id=${successor}`);
  }, [successor, gameId, router]);

  return successor;
}
