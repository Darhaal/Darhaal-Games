'use client';

import { useEffect, useRef } from 'react';
import { isForTheBoard } from '@/lib/keys';

/**
 * Listens for a board's keys while `active`, skipping anything typed into a
 * field or a dialog (see `isForTheBoard`).
 *
 * The handler returns true for a key it used, and only then is the browser's
 * default prevented — so Space and the arrows stop scrolling the page when
 * they move something, and keep scrolling it when they do not.
 */
export function useGameKeys(active: boolean, onKey: (e: KeyboardEvent) => boolean | void) {
  const handler = useRef(onKey);
  useEffect(() => {
    handler.current = onKey;
  });

  useEffect(() => {
    if (!active) return;
    const listener = (e: KeyboardEvent) => {
      if (!isForTheBoard(e)) return;
      // A modal on top — the rules, a confirmation — owns the keyboard even
      // when focus is still on the button that opened it; otherwise an arrow
      // key would move a pawn nobody can see.
      if (document.querySelector('[aria-modal="true"]')) return;
      if (handler.current(e) === true) e.preventDefault();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [active]);
}
