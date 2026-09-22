import { useSyncExternalStore } from 'react';
import { analyticsEnabled, readConsent } from '@/lib/analytics';
import type { ConsentChoice } from '@/constants/analytics';

/**
 * The visitor's answer about analytics, as an external store.
 *
 * It really is one: the value lives in `localStorage`, is written by a
 * different component, and can change in another tab. Reading it in an effect
 * and calling `setState` would be the usual way and the wrong one — it
 * renders once with the wrong answer and then again with the right one, which
 * for this particular flag means a frame where the banner is wrong.
 *
 * `unavailable` covers the server and any host that is not production;
 * `undecided` means nothing has been stored yet. Keeping them apart matters:
 * one must show the banner, the other must not.
 */
export type ConsentState = ConsentChoice | 'undecided' | 'unavailable';

function subscribe(onChange: () => void): () => void {
  // `storage` only fires in *other* tabs, so the banner announces its own
  // answer to this one.
  window.addEventListener('darhaal:consent', onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener('darhaal:consent', onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): ConsentState {
  if (!analyticsEnabled()) return 'unavailable';
  return readConsent() ?? 'undecided';
}

/** During hydration nothing is known yet, so nothing renders and nothing loads. */
const getServerSnapshot = (): ConsentState => 'unavailable';

export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Announces a change to this tab; other tabs get it through `storage`. */
export function publishConsentChange(): void {
  window.dispatchEvent(new Event('darhaal:consent'));
}
