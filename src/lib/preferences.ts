'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Per-device preferences from the settings, kept in localStorage.
 *
 * Read with `usePreference` in components (useSyncExternalStore: the server
 * snapshot is the default, every component and tab stays in sync) or with
 * `readPreference` in plain modules that run outside React.
 */
export interface Preferences {
  /** Flash the tab title and chime when it is your turn or a match starts while the tab is hidden. */
  alerts: 'on' | 'off';
  /** Also show a system notification (needs the browser's permission). */
  notify: 'on' | 'off';
  /** The room chat button. */
  chat: 'on' | 'off';
  theme: 'light' | 'dark' | 'system';
}

export type PreferenceKey = keyof Preferences;

const STORAGE_KEY: Record<PreferenceKey, string> = {
  alerts: 'dg_alerts',
  notify: 'dg_notify',
  chat: 'dg_chat',
  theme: 'dg_theme',
};

export const PREFERENCE_DEFAULTS: Preferences = {
  alerts: 'on',
  notify: 'off',
  chat: 'on',
  theme: 'system',
};

const ALLOWED: { [K in PreferenceKey]: readonly Preferences[K][] } = {
  alerts: ['on', 'off'],
  notify: ['on', 'off'],
  chat: ['on', 'off'],
  theme: ['light', 'dark', 'system'],
};

const EVENT = 'dg:preferences';

export function readPreference<K extends PreferenceKey>(key: K): Preferences[K] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY[key]);
    return (ALLOWED[key] as readonly string[]).includes(stored ?? '')
      ? (stored as Preferences[K])
      : PREFERENCE_DEFAULTS[key];
  } catch {
    return PREFERENCE_DEFAULTS[key];
  }
}

export function writePreference<K extends PreferenceKey>(key: K, value: Preferences[K]) {
  try {
    localStorage.setItem(STORAGE_KEY[key], value);
  } catch {
    // Private mode: the choice lasts until the page is closed
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(EVENT, cb);
  };
};

export function usePreference<K extends PreferenceKey>(key: K) {
  const value = useSyncExternalStore<Preferences[K]>(
    subscribe,
    () => readPreference(key),
    () => PREFERENCE_DEFAULTS[key]
  );
  const set = useCallback((v: Preferences[K]) => writePreference(key, v), [key]);
  return [value, set] as const;
}
