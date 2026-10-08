'use client';

import { useEffect } from 'react';
import { usePreference } from '@/lib/preferences';

/** Browser-bar colour per theme: the page colour, so the bar and the page meet. */
const BAR = { light: '#F8FAFC', dark: '#0E1116' } as const;

/**
 * Runs in <head> before the first paint, so a dark-theme player never sees a
 * light flash. It reads the same setting as ThemeController below.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('dg_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

/**
 * Keeps `<html class="dark">` in step with the setting — and, on "auto",
 * with the system switching between light and dark while the page is open.
 */
export default function ThemeController() {
  const [theme] = usePreference('theme');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[dark ? 'dark' : 'light']);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return null;
}
