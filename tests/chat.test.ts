import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CHAT_EMOJI, CHAT_HISTORY, CHAT_MAX_LENGTH, mergeMessages, unreadCount, type ChatMessage
} from '@/lib/chat';

/**
 * Room chat: what the client does with messages, and the promises the
 * database makes about them.
 *
 * The client half is a merge — the same message can arrive by fetch and by
 * push, and must show once, in order. The database half is read from the
 * migration itself, because those guarantees (who may read, who may write)
 * are the part that matters and the part a careless edit would quietly drop.
 */

const msg = (id: number, userId = 'a'): ChatMessage => ({
  id, userId, authorName: userId.toUpperCase(), body: `m${id}`, createdAt: '2026-09-24T12:00:00Z'
});

describe('merging what arrives', () => {
  it('shows a message that arrives twice once', () => {
    const shown = mergeMessages([], [msg(1), msg(2)]);
    const again = mergeMessages(shown, [msg(2)]);

    expect(again.map((m) => m.id)).toEqual([1, 2]);
  });

  it('hands back the same list when nothing is new, so nothing re-renders', () => {
    const shown = mergeMessages([], [msg(1)]);
    expect(mergeMessages(shown, [msg(1)])).toBe(shown);
  });

  it('orders by id whatever order they came in', () => {
    // The history fetch returns newest first; the push can overtake it.
    const shown = mergeMessages(mergeMessages([], [msg(5)]), [msg(4), msg(3)]);
    expect(shown.map((m) => m.id)).toEqual([3, 4, 5]);
  });

  it('dedupes within a single batch too', () => {
    expect(mergeMessages([], [msg(1), msg(1)]).length).toBe(1);
  });

  it('keeps only the latest, and drops the oldest first', () => {
    const many = Array.from({ length: CHAT_HISTORY + 10 }, (_, i) => msg(i + 1));
    const shown = mergeMessages([], many);

    expect(shown.length).toBe(CHAT_HISTORY);
    expect(shown[0].id).toBe(11);
    expect(shown.at(-1)?.id).toBe(CHAT_HISTORY + 10);
  });
});

describe('unread', () => {
  it('counts other people’s messages after the mark', () => {
    const list = [msg(1, 'b'), msg(2, 'b'), msg(3, 'b')];
    expect(unreadCount(list, 1, 'a')).toBe(2);
  });

  it('never counts your own', () => {
    const list = [msg(1, 'a'), msg(2, 'b'), msg(3, 'a')];
    expect(unreadCount(list, 0, 'a')).toBe(1);
  });
});

describe('emoji', () => {
  it('offers thirty, none twice', () => {
    expect(CHAT_EMOJI.length).toBe(30);
    expect(new Set(CHAT_EMOJI).size).toBe(30);
  });
});

describe('the database side', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260924000000_lobby_chat.sql'),
    'utf8'
  );

  it('caps a message at the length the input allows', () => {
    expect(sql).toContain(`char_length(body) between 1 and ${CHAT_MAX_LENGTH}`);
    expect(sql).toContain(`left(v_body, ${CHAT_MAX_LENGTH})`);
  });

  it('lets nobody write to the table directly', () => {
    expect(sql).toMatch(/revoke all on public\.lobby_messages from public, anon, authenticated/);
    expect(sql).toMatch(/grant select on public\.lobby_messages to authenticated/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*lobby_messages/i);
  });

  it('lets only the people in the room read it', () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/using \(public\.is_lobby_participant\(lobby_id\)\)/);
  });

  it('takes the author’s name from the room, not from the sender', () => {
    // The function has no name parameter at all — there is nothing to forge.
    expect(sql).toMatch(/send_lobby_message\(p_lobby_id uuid, p_body text\)/);
    expect(sql).toMatch(/raise exception 'not a participant of this room'/);
  });

  it('deletes a room’s messages with the room', () => {
    expect(sql).toMatch(/references public\.lobbies \(id\) on delete cascade/);
  });

  it('keeps chat out of game_state', () => {
    // Every write there bumps the version a move is checked against.
    expect(sql).not.toMatch(/update public\.lobbies/i);
  });
});
