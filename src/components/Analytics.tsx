'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { GA_EVENTS, GA_MEASUREMENT_ID } from '@/constants/analytics';
import { applyConsent, initConsentDefaults, shortReason, track, trackPageView } from '@/lib/analytics';
import { useConsent } from '@/hooks/useConsent';

/**
 * Loads Google Analytics, and only once it is allowed to.
 *
 * gtag.js is not merely told to store nothing — it is not put on the page at
 * all until the visitor has said yes. A script that is never fetched cannot
 * set a cookie, read one, or phone home, which is a stronger promise than
 * Consent Mode alone and a much easier one to check: open the network tab
 * and there is nothing there.
 *
 * Consent Mode defaults are still declared first, so that an answer arriving
 * later in the same session finds the library already expecting it.
 */
export default function Analytics() {
  const consent = useConsent();
  const granted = consent === 'granted';

  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (consent === 'unavailable') return;
    initConsentDefaults();
  }, [consent]);

  useEffect(() => {
    if (consent === 'granted' || consent === 'denied') applyConsent(consent);
  }, [consent]);

  /**
   * Crashes, counted.
   *
   * Hooked to the real thing — an uncaught exception or a rejected promise
   * nobody handled — rather than to the toast layer, which also carries
   * ordinary refusals like a wrong room password. Those are the app working,
   * not the app breaking, and mixing them would make the number useless.
   *
   * Only the message reaches Google, trimmed and with nothing appended: a
   * stack trace can carry a URL, and a URL here can carry a room id.
   */
  useEffect(() => {
    if (!granted) return;

    const onError = (e: ErrorEvent) => {
      track(GA_EVENTS.appError, { where: 'uncaught', reason: shortReason(e.message) });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      track(GA_EVENTS.appError, { where: 'unhandled_rejection', reason: shortReason(String(e.reason)) });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [granted]);

  /**
   * One view per navigation. `send_page_view` is off in the config below, so
   * this is the only place a view is reported — otherwise the first one would
   * carry the raw URL, room id and all.
   */
  useEffect(() => {
    if (!granted || !pathname) return;
    const query = searchParams?.toString();
    trackPageView(query ? `${pathname}?${query}` : pathname);
  }, [granted, pathname, searchParams]);

  if (!granted) return null;

  return (
    <>
      <Script
        id="ga-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            send_page_view: false,
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
