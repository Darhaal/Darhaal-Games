import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/** Twenty of these may be missed before the room is considered empty. */
const PING_MS = 30_000;

/**
 * Leaves a mark on the row while this client has the room open — in the
 * lobby and during the match (useLobbySync runs it for every game).
 *
 * Realtime presence already knows who is in the room, but it lives in the
 * Realtime service and the cleanup job runs in SQL, which cannot see it. So
 * the fact that somebody is here is written down: `touch_lobby` moves
 * `last_seen_at` forward. A waiting room nobody has touched for ten minutes
 * is swept, a match with no touch and no move for thirty.
 *
 * Closing the tab says so (`pagehide`), and so does leaving the room's page
 * inside the site (the unmount): a waiting room is then left a minute
 * short of the timeout, so an empty one is gone in a minute or two instead of
 * fifteen. Anyone still inside pings within thirty seconds and keeps it, and
 * a reload pings again on load. A phone switching apps or a laptop going to
 * sleep sends nothing and keeps the full ten minutes.
 *
 * The write goes through an RPC because clients hold no UPDATE grant on the
 * column, and the function checks the caller is in the room — a lobby cannot
 * be held open from outside it.
 */
export function useLobbyTouch(lobbyId: string | null | undefined, enabled: boolean) {
  useEffect(() => {
    if (!lobbyId || !enabled) return;

    let cancelled = false;
    // The leaving call has to be sent synchronously from `pagehide`, so the
    // token it needs is kept from the last ping rather than looked up then.
    let accessToken: string | null = null;

    const ping = async () => {
      if (cancelled) return;
      // A failed ping is not worth surfacing: the next one is thirty seconds
      // away and the timeout allows twenty misses. Nothing here may throw —
      // it runs from a timer, where an error would be unhandled.
      try {
        accessToken = (await supabase.auth.getSession()).data.session?.access_token ?? null;
        await supabase.rpc('touch_lobby', { p_lobby_id: lobbyId });
      } catch {
        // the next ping tries again
      }
    };

    // `keepalive` lets the request outlive the page; supabase-js cannot ask for it.
    const leaving = () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key || !accessToken) return;
      fetch(`${url}/rest/v1/rpc/touch_lobby`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: key, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_lobby_id: lobbyId, p_leaving: true })
      }).catch(() => {});
    };

    ping();
    const timer = setInterval(ping, PING_MS);
    window.addEventListener('pagehide', leaving);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('pagehide', leaving);
      leaving();
    };
  }, [lobbyId, enabled]);
}
