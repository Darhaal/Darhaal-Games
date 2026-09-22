import {
  CONSENT_KEY, REDACTED_PARAMS,
  type ConsentChoice, type GaEvent
} from '@/constants/analytics';
import { SITE_URL } from '@/constants/app';

/**
 * The app's side of Google Analytics.
 *
 * Three rules hold here, and the rest of the app should not have to think
 * about them:
 *
 *   1. Nothing is sent before the visitor says yes. Consent Mode starts at
 *      `denied` and gtag is not even loaded until a choice is made.
 *   2. No identifiers leave the app. Not the Supabase user id, not a
 *      nickname, not an email — and not a room id, because a room link is an
 *      invitation and a private room's link is the only thing keeping
 *      strangers out.
 *   3. Nothing is sent from anywhere but production. A developer reloading
 *      localhost should not move the numbers.
 */

type GtagArgs =
  | ['js', Date]
  | ['set', string, unknown]
  | ['set', Record<string, unknown>]
  | ['config', string, Record<string, unknown>?]
  | ['event', string, Record<string, unknown>?]
  | ['consent', 'default' | 'update', Record<string, string>];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

/** Analytics runs on the real site only. */
export const analyticsEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.location.hostname === new URL(SITE_URL).hostname;
  } catch {
    return false;
  }
};

/**
 * A URL with the parts that identify a room or a session taken out.
 *
 * Exported for its own test: this is the function standing between a private
 * room's invite link and a third party's logs.
 */
export function redactUrl(input: string): string {
  try {
    const url = new URL(input, SITE_URL);
    for (const key of REDACTED_PARAMS) {
      if (url.searchParams.has(key)) url.searchParams.set(key, 'redacted');
    }
    return url.pathname + url.search + url.hash;
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
  const collapsed = withoutUrls.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, 120) || 'unknown';
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    // Private browsing, blocked storage: treat as undecided rather than
    // assuming a yes.
    return null;
  }
}

export function writeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Not being able to remember the answer is not a reason to ignore it for
    // this visit; the caller has already applied it.
  }
}

/** Pushes to the queue whether or not the script has loaded yet. */
function gtag(...args: GtagArgs): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads `arguments`, so the array form is what it expects.
  window.dataLayer.push(args);
}

/** Consent Mode v2 defaults. Called before gtag.js is on the page. */
export function initConsentDefaults(): void {
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted'
  });
}

export function applyConsent(choice: ConsentChoice): void {
  gtag('consent', 'update', {
    // Only analytics is ever asked for. Advertising storage stays denied
    // because the site does not advertise and has no business collecting it.
    analytics_storage: choice,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
}

/** Values safe to attach to an event: no free text, no identifiers. */
export type EventParams = Record<string, string | number | boolean>;

/**
 * Pins the address gtag reports to the redacted one.
 *
 * gtag fills `dl` from `document.location` on every hit unless told
 * otherwise, and most of the ways to tell it do not work. Measured against
 * the live library, only the two-argument `set` does:
 *
 *   gtag('set', 'page_location', …)   →  dl is the value given        ✓
 *   gtag('set', { page_location: … }) →  dl is still document.location
 *   gtag('event', …, { page_location: … }) →  same
 *   gtag('config', id, { page_location: … }) →  same
 *
 * The object form is the one the documentation suggests and the one that
 * silently does nothing, which is how a fix for this shipped once already
 * without fixing anything. Called before every hit, not only on navigation,
 * so a room id cannot ride out on an event fired between page views.
 */
function pinLocation(): void {
  const clean = redactUrl(window.location.pathname + window.location.search);
  gtag('set', 'page_location', `${SITE_URL}${clean}`);
  gtag('set', 'page_path', clean);
}

/**
 * Reports an event, if the visitor allowed it.
 *
 * Callers pass categories and counts — which game, how many players, how long
 * a match ran. Anything that names a person or a room is the caller's bug,
 * and `tests/analytics.test.ts` guards the shape.
 */
export function track(event: GaEvent, params: EventParams = {}): void {
  if (!analyticsEnabled()) return;
  if (readConsent() !== 'granted') return;

  pinLocation();
  gtag('event', event, params);
}

/** A page view with the room id taken out of the URL. */
export function trackPageView(path: string): void {
  if (!analyticsEnabled()) return;
  if (readConsent() !== 'granted') return;

  const clean = redactUrl(path);

  // Pin the address first, then send the view. A repeated `config` is the
  // obvious way to do this and leaves `dl` as the browser's real URL.
  pinLocation();
  gtag('event', 'page_view', { page_path: clean });
}
