'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Smile, X } from 'lucide-react';
import { useLobbyChat } from '@/hooks/useLobbyChat';
import { useEscape } from '@/hooks/useEscape';
import { CHAT_EMOJI, CHAT_MAX_LENGTH, unreadCount } from '@/lib/chat';
import { usePreference } from '@/lib/preferences';

const T = {
  ru: {
    open: 'Чат',
    title: 'Чат комнаты',
    placeholder: 'Сообщение…',
    send: 'Отправить',
    empty: 'Здесь пока тихо. Напишите первым.',
    slow: 'Не так быстро — подождите пару секунд.',
    failed: 'Не отправилось. Попробуйте ещё раз.',
    emoji: 'Смайлики',
    close: 'Закрыть',
    unread: (n: number) => `Чат, непрочитанных: ${n}`
  },
  en: {
    open: 'Chat',
    title: 'Room chat',
    placeholder: 'Message…',
    send: 'Send',
    empty: 'Quiet so far. Say something first.',
    slow: 'Not so fast — give it a couple of seconds.',
    failed: 'Did not send. Try again.',
    emoji: 'Emoji',
    close: 'Close',
    unread: (n: number) => `Chat, ${n} unread`
  },
  uk: {
    open: 'Чат',
    title: 'Чат кімнати',
    placeholder: 'Повідомлення…',
    send: 'Надіслати',
    empty: 'Тут поки тихо. Напишіть першим.',
    slow: 'Не так швидко — зачекайте кілька секунд.',
    failed: 'Не надіслалося. Спробуйте ще раз.',
    emoji: 'Смайлики',
    close: 'Закрити',
    unread: (n: number) => `Чат, непрочитаних: ${n}`
  }
} as const;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * How far the reader got, per room, for the life of the tab — so a reload
 * does not bring back as "new" what was read a minute ago. Session storage
 * is enough for that and leaves nothing behind; when it is unavailable the
 * count simply starts from zero.
 */
const readKey = (lobbyId: string) => `darhaal.chat-read.${lobbyId}`;

function loadReadMark(lobbyId: string | null): number {
  if (!lobbyId || typeof window === 'undefined') return 0;
  try {
    return Number(window.sessionStorage.getItem(readKey(lobbyId))) || 0;
  } catch {
    return 0;
  }
}

function saveReadMark(lobbyId: string | null, id: number) {
  if (!lobbyId) return;
  try {
    window.sessionStorage.setItem(readKey(lobbyId), String(id));
  } catch {
    // Private mode or storage blocked: the count just resets on reload.
  }
}

/**
 * Where the chat button sits.
 *
 * Bottom right by default. A screen that keeps its own controls pinned to
 * the bottom edge — Coup's hand, Flager's results — asks for the top instead,
 * so the button never lands on something the player has to press.
 * `top-below-lg` is for controls pinned only on phones and tablets, as
 * Wikiler's guess bar: the top there, the usual corner on a wide screen.
 */
export type ChatAnchor = 'bottom' | 'top' | 'top-below-lg';

/** The closed button's corner, and the open panel's from `sm` up (below it the panel is a bottom sheet). */
const BUTTON_CORNER: Record<ChatAnchor, string> = {
  bottom: 'bottom-4',
  top: 'top-24',
  'top-below-lg': 'top-24 lg:top-auto lg:bottom-4'
};
const PANEL_CORNER: Record<ChatAnchor, string> = {
  bottom: 'sm:bottom-4',
  top: 'sm:bottom-auto sm:top-24',
  'top-below-lg': 'sm:bottom-auto sm:top-24 lg:top-auto lg:bottom-4'
};

/**
 * A room's chat, as a button that opens a panel.
 *
 * Floating rather than laid into each screen: the eight games have eight
 * layouts, and a panel over whichever is showing works the same in the
 * lobby, mid-match and on the results. It stacks above the games' own
 * overlays on purpose — "gg" is said on the results screen. Closed, it counts
 * what arrived since it was last open, so nobody has to keep it open to keep
 * up.
 */
export default function LobbyChat({
  lobbyId,
  userId,
  lang,
  anchor = 'bottom'
}: {
  lobbyId: string | null;
  userId: string;
  lang: 'ru' | 'en' | 'uk';
  anchor?: ChatAnchor;
}) {
  const t = T[lang];
  // Turned off in the settings: no button, nothing to read
  const [chatPreference] = usePreference('chat');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [readUpTo, setReadUpTo] = useState(() => loadReadMark(lobbyId));

  const { messages, send } = useLobbyChat(lobbyId);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lastId = messages.at(-1)?.id ?? 0;

  // While open everything is read; closing records how far that went.
  const unread = open ? 0 : unreadCount(messages, readUpTo, userId);

  const close = () => {
    setReadUpTo(lastId);
    setOpen(false);
    setShowEmoji(false);
  };

  useEscape(open, close);

  // Keep the newest line in view — including when the emoji tray opens and
  // takes a slice of the list's height — and remember it as read, even if
  // the page is left with the panel still open.
  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    saveReadMark(lobbyId, lastId);
  }, [open, lastId, showEmoji, lobbyId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    setShowEmoji(false);
    const result = await send(text);
    if (result !== 'sent') {
      setNotice(result === 'slow' ? t.slow : t.failed);
      setDraft(text); // handed back rather than lost
    }
    inputRef.current?.focus();
  };

  const addEmoji = (emoji: string) => {
    setDraft((d) => (d + emoji).slice(0, CHAT_MAX_LENGTH));
    inputRef.current?.focus();
  };

  if (!lobbyId || chatPreference === 'off') return null;

  const corner = BUTTON_CORNER[anchor];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={unread > 0 ? t.unread(unread) : t.open}
          title={t.open}
          className={`fixed right-4 ${corner} z-[220] w-14 h-14 rounded-full bg-ink text-on-ink ring-2 ring-surface shadow-xl shadow-shade/25 hover:bg-accent active:scale-95 transition-all flex items-center justify-center`}
        >
          <MessageCircle className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-accent text-white text-2xs font-black flex items-center justify-center ring-2 ring-surface tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={t.title}
          className={`fixed z-[220] inset-x-2 bottom-2 sm:inset-x-auto sm:right-4 ${PANEL_CORNER[anchor]} sm:w-[360px] h-[min(70vh,520px)] flex flex-col bg-surface border border-line rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200`}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
            <span className="text-sm font-black uppercase tracking-wider text-ink">{t.title}</span>
            <button
              onClick={close}
              aria-label={t.close}
              className="p-1.5 rounded-lg text-muted hover:bg-warm hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {messages.length === 0 && (
              <p className="h-full flex items-center justify-center text-sm text-muted text-center px-6">
                {t.empty}
              </p>
            )}
            {messages.map((m) => {
              const mine = m.userId === userId;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && (
                    <span className="text-2xs font-bold text-muted mb-0.5 px-1">{m.authorName}</span>
                  )}
                  {/* A text node only: React escapes it, so a message cannot carry markup. */}
                  <div
                    className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-snug break-words whitespace-pre-wrap ${
                      mine ? 'bg-ink text-on-ink rounded-br-md' : 'bg-warm text-ink rounded-bl-md'
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="text-3xs text-faded mt-0.5 px-1 tabular-nums">{timeOf(m.createdAt)}</span>
                </div>
              );
            })}
          </div>

          {showEmoji && (
            <div className="grid grid-cols-10 gap-0.5 px-3 py-2 border-t border-line">
              {CHAT_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => addEmoji(e)}
                  aria-label={e}
                  className="aspect-square rounded-lg text-xl flex items-center justify-center hover:bg-warm active:scale-90 transition-all"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {notice && (
            <div role="status" className="px-4 py-1.5 text-2xs font-bold text-accent bg-red-50 border-t border-red-100">
              {notice}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="flex items-center gap-1.5 p-2.5 border-t border-line"
          >
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              aria-label={t.emoji}
              aria-pressed={showEmoji}
              className={`p-2 rounded-xl transition-colors ${showEmoji ? 'bg-warm text-ink' : 'text-muted hover:bg-warm'}`}
            >
              <Smile className="w-5 h-5" />
            </button>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_LENGTH))}
              placeholder={t.placeholder}
              maxLength={CHAT_MAX_LENGTH}
              autoFocus
              enterKeyHint="send"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-page border border-line text-sm focus:outline-none focus:border-ink/30"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label={t.send}
              className="p-2.5 rounded-xl bg-ink text-on-ink disabled:opacity-30 hover:bg-accent transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
