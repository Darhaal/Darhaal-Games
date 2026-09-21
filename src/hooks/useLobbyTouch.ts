import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/** Twenty of these may be missed before the room is considered empty. */
const PING_MS = 30_000;

/**
 * Leaves a mark on the row while this client has the lobby open.
 *
 * Realtime presence already knows who is in the room, but it lives in the
 * Realtime service and the cleanup job runs in SQL, which cannot see it. So
 * the fact that somebody is here is written down: `touch_lobby` moves
 * `last_seen_at` forward, and a waiting room nobody has touched for ten
 * minutes is swept.
 *
 * The write goes through an RPC because clients hold no UPDATE grant on the
 * column, and the function checks the caller is in the room — a lobby cannot
 * be held open from outside it.
 *
 * Fires once on mount so a freshly opened room is marked immediately rather
 * than thirty seconds later.
 */
export function useLobbyTouch(lobbyId: string | null | undefined, enabled: boolean) {
  useEffect(() => {
    if (!lobbyId || !enabled) return;

    let cancelled = false;

    const ping = async () => {
      if (cancelled) return;
      // A failed ping is not worth surfacing: the next one is thirty seconds
      // away and the timeout allows twenty misses.
      await supabase.rpc('touch_lobby', { p_lobby_id: lobbyId });
    };

    ping();
    const timer = setInterval(ping, PING_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [lobbyId, enabled]);
}
