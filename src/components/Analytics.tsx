'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { GA_EVENTS } from '@/constants/analytics';
import { shortReason, track, trackPageView } from '@/lib/analytics';
import { useConsent } from '@/hooks/useConsent';

/**
 * Reports page views and crashes.
 *
 * There is no script here to load. Google's library is not on the page at
 * all — events go to this site's own route handler, which forwards them. So
 * a refusal is not a library told to stay quiet; it is nothing happening.
 */
export default function Analytics() {
  const consent = useConsent();
  const granted = consent === 'granted';

  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Crashes, counted.
   *
   * Hooked to the real thing — an uncaught exception or a rejected promise
   * nobody handled — rather than to the toast layer, which also carries
   * ordinary refusals like a wrong room password. Those are the app working,
   * not the app breaking, and mixing them would make the number useless.
   *
   * Only a trimmed message is reported: a stack trace can carry a URL, and a
   * URL here can carry a room id.
   */
  useEffect(() => {
    if (!granted) return;

    const onError = (e: ErrorEvent) => {
      track(GA_EVENTS.appError, { where: 'uncaught', reason: shortReason(e.message) });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      track(GA_EVENTS.appError, {
        where: 'unhandled_rejection',
        reason: shortReason(String(e.reason))
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [granted]);

  /** One view per navigation, with the room id taken out of the path. */
  useEffect(() => {
    if (!granted || !pathname) return;
    const query = searchParams?.toString();
    trackPageView(query ? `${pathname}?${query}` : pathname);
  }, [granted, pathname, searchParams]);

  return null;
}
