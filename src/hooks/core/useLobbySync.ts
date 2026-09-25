'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { notifyConflict, writeGameState } from '@/lib/gameStateSync';

/** How many times a retryable write is rebuilt on fresh state before giving up. */
const MAX_WRITE_RETRIES = 3;

/** A finished state, or a function producing one from the current state. */
export type StateUpdater<T> = T | ((current: T) => T | null);

export interface RoomMeta {
  name: string;
  code: string;
  isHost: boolean;
}

interface LobbySyncOptions<T> {
  lobbyId: string | null;
  userId?: string;
  /** Realtime channel name prefix, e.g. 'lobby-coup' */
  channelPrefix: string;
  /**
   * Rule for accepting incoming realtime state.
   * Default: version guard + always accept states in waiting status.
   */
  mergeIncoming?: (prev: T | null, incoming: T) => T;
  /** Normalize state coming from the DB (e.g. repair the players shape) */
  normalize?: (state: T) => T;
  /** Side effect on each incoming state (e.g. syncing local ships) */
  onIncoming?: (incoming: T) => void;
  /** host_id to sync on write (Battleship) */
  getHostId?: (state: T) => string | undefined;
  /** Whether to touch lastActionTime on every write (default: yes) */
  touchLastAction?: boolean;
}

/**
 * Shared lobby-sync core for all games:
 * state fetch, realtime subscription (UPDATE/DELETE), version guard,
 * optimistic writes via the CAS RPC with re-sync on conflict.
 *
 * Game hooks add only their game logic on top.
 */
export function useLobbySync<T extends { version?: number; status?: string; lastActionTime?: number }>(
  opts: LobbySyncOptions<T>
) {
  const { lobbyId, userId, channelPrefix, mergeIncoming, normalize, onIncoming, getHostId, touchLastAction = true } = opts;

  const [gameState, setGameState] = useState<T | null>(null);
  const [roomMeta, setRoomMeta] = useState<RoomMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [lobbyDeleted, setLobbyDeleted] = useState(false);

  // Fresh references for async handlers
  const gameStateRef = useRef<T | null>(null);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const optsRef = useRef({ mergeIncoming, normalize, onIncoming, getHostId });
  useEffect(() => { optsRef.current = { mergeIncoming, normalize, onIncoming, getHostId }; });

  const fetchLobbyState = useCallback(async (): Promise<T | null> => {
    if (!lobbyId) return null;
    try {
      const { data } = await supabase.from('lobbies').select('name, code, host_id, game_state').eq('id', lobbyId).single();
      if (data) {
        setRoomMeta({ name: data.name, code: data.code, isHost: data.host_id === userId });
        if (data.game_state) {
          const normalized = optsRef.current.normalize
            ? optsRef.current.normalize(data.game_state as T)
            : (data.game_state as T);
          setGameState(normalized);
          gameStateRef.current = normalized;
          optsRef.current.onIncoming?.(normalized);
          return normalized;
        }
      } else {
        setGameState(null);
        setLobbyDeleted(true);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
    return null;
  }, [lobbyId, userId]);

  useEffect(() => {
    if (!lobbyId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchLobbyState is async; its setState runs after the query resolves, not synchronously
    fetchLobbyState();

    const ch = supabase.channel(`${channelPrefix}:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => {
          if (!payload.new.game_state) return;
          let incoming = payload.new.game_state as T;
          if (optsRef.current.normalize) incoming = optsRef.current.normalize(incoming);

          setGameState(prev => {
              if (optsRef.current.mergeIncoming) {
                  return optsRef.current.mergeIncoming(prev, incoming);
              }
              // Default rule: always accept waiting states, otherwise apply the version guard
              if (incoming.status === 'waiting') return incoming;
              if (prev && (incoming.version || 0) < (prev.version || 0)) return prev;
              return incoming;
          });

          optsRef.current.onIncoming?.(incoming);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      () => {
          setGameState(null);
          setLobbyDeleted(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [lobbyId, fetchLobbyState, channelPrefix]);

  /**
   * Optimistic write: version++, apply locally, CAS write.
   *
   * Accepts either a finished state or a function of the current state. The
   * functional form is retryable: on a version conflict the fresh state is
   * pulled and the function re-run against it, so two players acting at the
   * same moment no longer cost one of them their move. That matters most where
   * the actions do not actually overlap — in Minesweeper every player has
   * their own board, yet all boards share one row and one version counter, so
   * unrelated clicks used to collide and one was silently dropped.
   *
   * Return `null` from the updater to abort (the action is no longer legal
   * against the fresh state).
   *
   * The plain-object form cannot be recomputed, so it keeps the old behaviour:
   * one attempt, then re-sync and tell the user.
   */
  const updateState = useCallback(async (updater: StateUpdater<T>) => {
    const recompute = typeof updater === 'function'
      ? (updater as (current: T) => T | null)
      : null;

    for (let attempt = 0; attempt <= MAX_WRITE_RETRIES; attempt++) {
      const base = gameStateRef.current;
      const next = recompute ? (base ? recompute(base) : null) : (updater as T);
      if (!next) return;

      next.version = (next.version || 0) + 1;
      if (touchLastAction) next.lastActionTime = Date.now();
      setGameState(next);
      gameStateRef.current = next;

      if (!lobbyId) return;

      // Silent: this loop decides when the player hears about it, so a
      // conflict is reported once and a resolved one not at all.
      const res = await writeGameState(
          lobbyId,
          next as unknown as Record<string, unknown> & { version?: number; status?: string },
          { hostId: optsRef.current.getHostId?.(next), silent: true }
      );

      if (res.ok) return;

      // A hard failure is not a race — retrying cannot help. The move is
      // already on this player's screen, so take it back and say so.
      if (!res.conflict) {
          await fetchLobbyState();
          notifyConflict();
          return;
      }

      // Someone wrote first. Pull their state; retry only if we can rebuild on it.
      const fresh = await fetchLobbyState();
      if (!recompute) {
          notifyConflict();
          return;
      }
      if (!fresh) return;
    }

    // Repeatedly outraced — the move really is lost, so say so.
    notifyConflict();
  }, [lobbyId, fetchLobbyState, touchLastAction]);

  /**
   * Delete the lobby (when the last player leaves).
   *
   * Goes through the `leave_lobby` RPC rather than a direct DELETE: clients
   * hold no delete privilege on the table, so the room can only be removed by
   * its host or by its last remaining participant. A `false` result means
   * someone else is still in the room — we leave locally either way.
   */
  const deleteLobby = useCallback(async () => {
    if (!lobbyId) return;
    await supabase.rpc('leave_lobby', { p_lobby_id: lobbyId });
    setGameState(null);
    setLobbyDeleted(true);
  }, [lobbyId]);

  return {
    gameState, setGameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    fetchLobbyState, updateState, deleteLobby
  };
}
