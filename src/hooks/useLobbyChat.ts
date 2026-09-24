import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CHAT_HISTORY, mergeMessages, type ChatMessage } from '@/lib/chat';

interface Row {
  id: number;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

const fromRow = (r: Row): ChatMessage => ({
  id: r.id,
  userId: r.user_id,
  authorName: r.author_name,
  body: r.body,
  createdAt: r.created_at
});

const NONE: ChatMessage[] = [];

export type SendResult = 'sent' | 'slow' | 'failed';

/**
 * A room's chat.
 *
 * Its own table and its own channel, deliberately apart from `game_state`:
 * that row is written under a compare-and-swap, and a message there would be
 * one more write competing with players' moves. Here nothing else writes.
 *
 * The latest messages are fetched every time the channel (re)connects, not
 * just once: a phone that slept through part of a match would otherwise wake
 * up to a chat with a hole in it. Fetch and push are merged by id, so a
 * message that arrives both ways shows once.
 *
 * What is held is tagged with the room it came from. "Play again" moves the
 * page to a new room without unmounting it, and the old room's conversation
 * must not carry over into the new one.
 */
export function useLobbyChat(lobbyId: string | null | undefined) {
  const [log, setLog] = useState<{ room: string | null; list: ChatMessage[] }>({ room: null, list: NONE });

  const merge = useCallback((room: string, incoming: ChatMessage[]) => {
    setLog((prev) => {
      const base = prev.room === room ? prev.list : NONE;
      const list = mergeMessages(base, incoming);
      return prev.room === room && list === prev.list ? prev : { room, list };
    });
  }, []);

  useEffect(() => {
    if (!lobbyId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('lobby_messages')
        .select('id, user_id, author_name, body, created_at')
        .eq('lobby_id', lobbyId)
        .order('id', { ascending: false })
        .limit(CHAT_HISTORY);
      if (!cancelled && data) merge(lobbyId, (data as Row[]).map(fromRow));
    };

    const channel = supabase
      .channel(`lobby-chat:${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lobby_messages', filter: `lobby_id=eq.${lobbyId}` },
        (payload) => merge(lobbyId, [fromRow(payload.new as Row)])
      )
      .subscribe((status) => {
        // After the subscription is live, so nothing can slip between the
        // fetch and the first push.
        if (status === 'SUBSCRIBED') load();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [lobbyId, merge]);

  /**
   * Sends through the one function allowed to write: it checks the sender is
   * in the room, caps the text and takes the name from the room's roster, so
   * nothing typed here can claim to be somebody else.
   */
  const send = useCallback(async (text: string): Promise<SendResult> => {
    const body = text.trim();
    if (!lobbyId || !body) return 'failed';

    const { error } = await supabase.rpc('send_lobby_message', {
      p_lobby_id: lobbyId,
      p_body: body
    });

    if (!error) return 'sent';
    return /slow down/i.test(error.message) ? 'slow' : 'failed';
  }, [lobbyId]);

  return {
    messages: log.room === lobbyId ? log.list : NONE,
    send
  };
}
