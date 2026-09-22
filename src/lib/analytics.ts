import {
  ANALYTICS_ENABLED, ANALYTICS_ENDPOINT, CLIENT_ID_KEY, CONSENT_KEY, REDACTED_PARAMS,
  type ConsentChoice, type GaEvent
} from '@/constants/analytics';
import { SITE_URL } from '@/constants/app';

/**
 * The app's side of analytics.
 *
 * It loads nothing, sets no cookie and talks to nobody but this site. An
 * event is a small POST to our own route handler, which is the piece that
 * speaks to Google. Three rules hold here so the rest of the app does not
 * have to think about them:
 *
 *   1. Nothing is sent before the visitor says yes.
 *   2. No identifiers leave the app — not the Supabase user id, not a
 *      nickname, and above all not a room id, because a room link is an
 *      invitation.
 *   3. Nothing is sent from anywhere but production, so a developer
 *      reloading localhost does not move the numbers.
 */

/** Analytics runs on the real site only. */
export const analyticsEnabled = (): boolean => {
  if (!ANALYTICS_ENABLED) return false;
  if (typeof window === 'undefined') return false;
  try {
    return window.location.hostname === new URL(SITE_URL).hostname;
  } catch {
    return false;
  }
};

/**
 * A path with the parts that identify a room or a session taken out.
 *
 * Exported for its own test. The server applies the same treatment to
 * whatever arrives, so this is the first of two passes rather than the only
 * one — a client can be tampered with, and the server does not assume
 * otherwise.
 */
export function redactUrl(input: string): string {
  try {
    const url = new URL(input, SITE_URL);
    for (const key of REDACTED_PARAMS) {
      if (url.searchParams.has(key)) url.searchParams.set(key, 'redacted');
    }
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}

/**
 * An error message cut down to something safe to report.
 *
 * Messages routinely quote a URL, and a URL in this app routinely carries a
 * room id — so anything URL-shaped is dropped rather than trimmed, and what
 * is left is capped. The point is to count crashes and tell them apart, not
 * to reconstruct them; the browser console still has the whole thing.
 */
export function shortReason(message: string): string {
  const withoutUrls = message.replace(/https?:\/\/\S+/gi, '[url]');
  return withoutUrls.replace(/\s+/g, ' ').trim().slice(0, 120) || 'unknown';
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    // Private browsing, blocked storage: undecided, not a yes.
    return null;
  }
}

export function writeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
    if (choice === 'denied') window.localStorage.removeItem(CLIENT_ID_KEY);
  } catch {
    // Not remembering the answer is no reason to ignore it for this visit.
  }
}

/**
 * A random id for this browser, created on first use after consent.
 *
 * GA needs something to tell one visitor's events from another's. This is
 * generated here, is not derived from anything about the person, means
 * nothing to any other system, and goes when they clear their site data.
 */
function clientId(): string {
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;

    const fresh = crypto.randomUUID();
    window.localStorage.setItem(CLIENT_ID_KEY, fresh);
    return fresh;
  } catch {
    // Storage refused: this visit counts as its own visitor rather than not
    // counting at all.
    return crypto.randomUUID();
  }
}

/** Values safe to attach to an event: no free text, no identifiers. */
export type EventParams = Record<string, string | number | boolean>;

/**
 * Reports an event, if the visitor allowed it.
 *
 * `sendBeacon` first so a report survives the navigation that often follows
 * it — creating a room fires an event and immediately routes away. It also
 * cannot be made to wait, which is the point: analytics must never be in
 * front of the thing the player asked for.
 */
export function track(event: GaEvent, params: EventParams = {}): void {
  if (!analyticsEnabled()) return;
  if (readConsent() !== 'granted') return;

  const body = JSON.stringify({
    name: event,
    clientId: clientId(),
    // Redacted here and again on the server.
    path: redactUrl(window.location.pathname + window.location.search),
    params
  });

  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.(ANALYTICS_ENDPOINT, blob)) return;
  } catch {
    // Fall through to fetch.
  }

  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {
    // A dropped measurement is not worth a word to the player.
  });
}

/** A page view, with the room id taken out of the path. */
export function trackPageView(path: string): void {
  if (!analyticsEnabled()) return;
  if (readConsent() !== 'granted') return;

  track('page_view', { page_path: redactUrl(path) });
}
