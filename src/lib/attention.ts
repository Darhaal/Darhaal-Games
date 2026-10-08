'use client';

import { playSfx } from '@/lib/sound';
import { readPreference } from '@/lib/preferences';

/**
 * Calling a player back to a tab they left in the background: the title
 * flashes, a chime plays, and — when they allowed it — the system shows a
 * notification. Nothing happens while the tab is in front; everything stops
 * the moment it comes back.
 */
export type AttentionReason = 'turn' | 'started';

const TEXT = {
  ru: { turn: 'Ваш ход', started: 'Игра началась' },
  en: { turn: 'Your turn', started: 'The game has started' },
  uk: { turn: 'Ваш хід', started: 'Гра почалася' },
};

/** The interface language, read the way useLang stores it. */
function language(): keyof typeof TEXT {
  try {
    const stored = localStorage.getItem('dg_lang');
    if (stored === 'ru' || stored === 'en' || stored === 'uk') return stored;
  } catch {
    // Blocked storage: fall through to the page's language
  }
  const path = window.location.pathname;
  if (path === '/uk' || path.startsWith('/uk/')) return 'uk';
  if (path === '/ru' || path.startsWith('/ru/')) return 'ru';
  return 'en';
}

let active: { reason: AttentionReason; stop: () => void } | null = null;

export function callAttention(reason: AttentionReason) {
  if (typeof document === 'undefined' || !document.hidden) return;
  if (readPreference('alerts') === 'off') return;

  stopAttention();
  const message = TEXT[language()][reason];
  const original = document.title;
  let lit = true;
  document.title = `● ${message}`;
  const timer = window.setInterval(() => {
    lit = !lit;
    document.title = lit ? `● ${message}` : original;
  }, 1000);

  playSfx('notify');

  let note: Notification | null = null;
  if (readPreference('notify') === 'on' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      note = new Notification(message, { body: 'Darhaal Games', icon: '/logo512.png', tag: 'darhaal-attention' });
      note.onclick = () => { window.focus(); note?.close(); };
    } catch {
      // Mobile browsers only show notifications through a service worker
    }
  }

  const onVisible = () => { if (!document.hidden) stopAttention(); };
  document.addEventListener('visibilitychange', onVisible);

  active = {
    reason,
    stop: () => {
      window.clearInterval(timer);
      document.title = original;
      note?.close();
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
}

/** Stops the call — only one for `reason`, when given. */
export function stopAttention(reason?: AttentionReason) {
  if (!active || (reason && active.reason !== reason)) return;
  active.stop();
  active = null;
}

/** Whether this browser can show system notifications at all. */
export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;
