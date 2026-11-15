'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { localeFromPath } from '@/lib/locale';

/**
 * Keeps `<html lang>` right after a client-side navigation — from /ru to an
 * English page and back. `LANG_SCRIPT` sets it on the first load.
 */
export default function DocumentLang() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.lang = localeFromPath(pathname ?? '/');
  }, [pathname]);

  return null;
}
