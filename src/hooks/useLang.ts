'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Lang = 'ru' | 'en';

const LANG_KEY = 'dg_lang';
const LANG_EVENT = 'dg:lang';

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  window.addEventListener(LANG_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(LANG_EVENT, cb);
  };
};

/**
 * UI language synced with localStorage.
 *
 * English until the player picks a language in the settings: someone who
 * does not read Russian has to be able to find that setting in the first
 * place, while a Russian speaker can read "Settings" well enough to switch.
 *
 * useSyncExternalStore instead of useState+useEffect: no setState inside effects
 * (cascading re-renders), no hydration issues (server snapshot = default),
 * plus instant sync across tabs and components.
 */
export function useLang(defaultLang: Lang = 'en') {
  const lang = useSyncExternalStore<Lang>(
    subscribe,
    () => {
      const v = localStorage.getItem(LANG_KEY);
      return v === 'en' || v === 'ru' ? v : defaultLang;
    },
    () => defaultLang
  );

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    window.dispatchEvent(new Event(LANG_EVENT));
  }, []);

  return { lang, setLang };
}
