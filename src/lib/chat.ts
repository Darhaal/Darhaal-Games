/**
 * The parts of room chat that are plain data, kept apart from the hook so
 * they can be tested without a Supabase client.
 */

export interface ChatMessage {
  id: number;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** Enough to catch up on a lobby; a room's chat is a conversation, not an archive. */
export const CHAT_HISTORY = 50;

/** Mirrors the cap `send_lobby_message` enforces, so the input never promises more. */
export const CHAT_MAX_LENGTH = 300;

/**
 * Thirty standard emoji, one tap each.
 *
 * Chosen for what people say across a table — reactions to a move, to a
 * bluff, to a loss — rather than the whole keyboard, which the phone already
 * has. Faces first, then hands, then verdicts.
 */
export const CHAT_EMOJI = [
  '😀', '😂', '🤣', '😊', '😍', '😎', '🤔', '😮', '😢', '😡',
  '😴', '🤯', '😱', '🥳', '😈', '👀', '👍', '👎', '👏', '🙌',
  '🙏', '💪', '🔥', '🎉', '❤️', '💔', '✅', '❌', '⏳', '🏆'
] as const;

/**
 * Folds newly arrived messages into what is already shown.
 *
 * Messages come two ways — the fetch on (re)connect and the realtime push —
 * and the same one can arrive by both. Ids are unique and only ever grow, so
 * deduplicating and ordering by id is enough to show each message once, in
 * the order it was sent. Returns the same array when nothing is new, so a
 * duplicate delivery does not re-render the list.
 */
export function mergeMessages(
  shown: ChatMessage[],
  incoming: ChatMessage[],
  limit = CHAT_HISTORY
): ChatMessage[] {
  const have = new Set(shown.map((m) => m.id));
  const fresh: ChatMessage[] = [];
  for (const m of incoming) {
    if (have.has(m.id)) continue;
    have.add(m.id);
    fresh.push(m);
  }
  if (fresh.length === 0) return shown;

  return [...shown, ...fresh].sort((a, b) => a.id - b.id).slice(-limit);
}

/** Messages from other people that arrived after `readUpTo`. */
export const unreadCount = (messages: ChatMessage[], readUpTo: number, me: string): number =>
  messages.filter((m) => m.id > readUpTo && m.userId !== me).length;
