import {
  ANALYTICS_ENABLED, ANALYTICS_ENDPOINT, CLIENT_ID_KEY, CONSENT_KEY, GA_EVENTS, REDACTED_PARAMS,
  SESSION_KEY, SESSION_TIMEOUT_MS,
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
    if (choice === 'denied') {
      window.localStorage.removeItem(CLIENT_ID_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    }
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
/**
 * A version-4 UUID. `crypto.randomUUID` exists only on HTTPS pages and in
 * Safari 15.4+; without it this used to throw from inside an effect and take
 * the whole page down with it.
 */
function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function clientId(): { id: string; fresh: boolean } {
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return { id: existing, fresh: false };

    const id = randomId();
    window.localStorage.setItem(CLIENT_ID_KEY, id);
    return { id, fresh: true };
  } catch {
    // Storage refused: this visit counts as its own visitor rather than not
    // counting at all.
    return { id: randomId(), fresh: true };
  }
}

/**
 * The id of this visit: when it started, in Unix seconds.
 *
 * A new one after half an hour without an event, which is how GA decides a
 * visit has ended. The first version of this sent the browser id here, which
 * put every event a person ever fired into a single session that never ended.
 * The second sent a UUID, which GA4 does not accept as a session id (it must
 * be a positive integer, as gtag's own is), so no session was ever counted.
 * A stored UUID from that version simply starts a new visit.
 */
function sessionId(): { id: string; fresh: boolean } {
  const now = Date.now();
  const start = () => String(Math.floor(now / 1000));
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      const { id, seen } = JSON.parse(raw) as { id: string; seen: number };
      if (/^[1-9]\d*$/.test(id ?? '') && typeof seen === 'number' && now - seen < SESSION_TIMEOUT_MS) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify({ id, seen: now }));
        return { id, fresh: false };
      }
    }

    const id = start();
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ id, seen: now }));
    return { id, fresh: true };
  } catch {
    return { id: start(), fresh: true };
  }
}

/**
 * Time the page was actually on screen since the previous event.
 *
 * GA4 builds "engagement time" and "engaged sessions" from this. It used to
 * be a constant 1 ms, so every visit read as zero seconds long. A hidden tab
 * does not count, and the last page of a visit, which has no next event to
 * carry its time, sends it when the tab is hidden or closed, as gtag's own
 * user_engagement does.
 */
let bankedMs = 0;
let visibleSince: number | null = null;
let clockStarted = false;

function startEngagementClock(): void {
  if (clockStarted || typeof document === 'undefined') return;
  clockStarted = true;
  visibleSince = document.visibilityState === 'visible' ? Date.now() : null;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (visibleSince !== null) bankedMs += Date.now() - visibleSince;
      visibleSince = null;
      if (bankedMs >= 1000) track(GA_EVENTS.pageEngagement);
    } else {
      visibleSince = Date.now();
    }
  });
}

function takeEngagement(): number {
  const now = Date.now();
  const ms = bankedMs + (visibleSince !== null ? now - visibleSince : 0);
  bankedMs = 0;
  if (visibleSince !== null) visibleSince = now;
  return Math.max(1, Math.min(ms, SESSION_TIMEOUT_MS));
}

/**
 * The site the visit came from, as an origin (`https://www.google.com/`),
 * never its path or query, and nothing for a move within this site.
 */
function externalReferrer(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const url = new URL(document.referrer);
    if (url.hostname === window.location.hostname) return undefined;
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return undefined;
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
 * front of the thing the player asked for. For the same reason nothing in
 * here may throw into the caller.
 */
export function track(event: GaEvent, params: EventParams = {}): void {
  if (!analyticsEnabled()) return;
  if (readConsent() !== 'granted') return;
  try {
    send(event, params);
  } catch {
    // A measurement is never worth breaking the page for.
  }
}

function send(event: GaEvent, params: EventParams): void {
  startEngagementClock();

  const client = clientId();
  const session = sessionId();
  const base = {
    clientId: client.id,
    sessionId: session.id,
    // Redacted here and again on the server.
    path: redactUrl(window.location.pathname + window.location.search),
    // Only on a visit's first event: that is where it came from. `entry`
    // tells the server to name the visit's channel, direct included.
    referrer: session.fresh ? externalReferrer() : undefined,
    entry: session.fresh || undefined
  };

  if (client.fresh) post({ ...base, name: GA_EVENTS.newVisitor, params: {}, engagementMs: 1 });
  post({ ...base, name: event, params, engagementMs: takeEngagement() });
}

function post(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);

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
