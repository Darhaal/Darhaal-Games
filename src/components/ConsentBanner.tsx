'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/hooks/useLang';
import { writeConsent } from '@/lib/analytics';
import { publishConsentChange, useConsent } from '@/hooks/useConsent';
import type { ConsentChoice } from '@/constants/analytics';
import { localeFromPath, localizedPath } from '@/lib/locale';

const T = {
  ru: {
    text: 'Мы хотим собирать обезличенную статистику посещений, чтобы понимать, во что играют и что ломается.',
    detail: 'Без неё сайт работает точно так же.',
    accept: 'Разрешить',
    decline: 'Отказаться',
    policy: 'Политика конфиденциальности',
    short: 'Собирать обезличенную статистику?',
    more: 'Подробнее',
    yes: 'Да',
    no: 'Нет'
  },
  en: {
    text: 'We would like to collect anonymous usage statistics, to see what people play and what breaks.',
    detail: 'The site works exactly the same without it.',
    accept: 'Allow',
    decline: 'Decline',
    policy: 'Privacy policy',
    short: 'Collect anonymous usage stats?',
    more: 'Details',
    yes: 'Yes',
    no: 'No'
  },
  uk: {
    text: 'Ми хочемо збирати знеособлену статистику відвідувань, щоб розуміти, у що грають і що ламається.',
    detail: 'Без неї сайт працює так само.',
    accept: 'Дозволити',
    decline: 'Відмовитися',
    policy: 'Політика конфіденційності',
    short: 'Збирати знеособлену статистику?',
    more: 'Докладніше',
    yes: 'Так',
    no: 'Ні'
  }
} as const;

/**
 * Asks before anything is collected.
 *
 * Both answers are the same size, the same weight and the same colour. A
 * decline button styled to be missed is a dark pattern, and a consent banner
 * that nudges is worth less than no banner at all — the point is an answer
 * that means something.
 *
 * Nothing is loaded while this is on screen: `Analytics` keeps gtag.js off
 * the page until the answer is yes.
 *
 * On a phone it is one short line with two small buttons: the full card
 * covered the first paragraph of every page (SEO audit, 2026-11-09). It
 * speaks the page's language on /ru and /uk to someone who has not picked
 * one yet, rather than English.
 */
export default function ConsentBanner() {
  const consent = useConsent();
  const pathname = usePathname();
  const { lang } = useLang(localeFromPath(pathname ?? '/'));
  const t = T[lang];

  const answer = (choice: ConsentChoice) => {
    writeConsent(choice);
    // The store this component reads is the one it just wrote to.
    publishConsentChange();
  };

  // 'unavailable' is the server, and any host that is not production.
  if (consent !== 'undecided') return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] sm:p-4 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="mx-auto max-w-3xl bg-surface border-t sm:border border-line sm:rounded-2xl shadow-xl px-4 py-2.5 sm:p-5 flex items-center gap-3 sm:gap-4">
        <p className="flex-1 min-w-0 text-xs sm:text-sm text-ink/80 leading-snug sm:leading-relaxed">
          <span className="sm:hidden">{t.short}</span>
          <span className="hidden sm:inline">
            {t.text} <span className="text-muted">{t.detail}</span>
          </span>{' '}
          <Link
            href={localizedPath(lang, '/privacy')}
            className="font-bold text-ink underline underline-offset-2 hover:text-accent transition-colors whitespace-nowrap"
          >
            <span className="sm:hidden">{t.more}</span>
            <span className="hidden sm:inline">{t.policy}</span>
          </Link>
        </p>

        {/* Equal weight on purpose — see the note above. */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => answer('denied')}
            aria-label={t.decline}
            className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-line text-ink font-bold uppercase text-2xs tracking-widest hover:bg-warm transition-colors"
          >
            <span className="sm:hidden">{t.no}</span>
            <span className="hidden sm:inline">{t.decline}</span>
          </button>
          <button
            onClick={() => answer('granted')}
            aria-label={t.accept}
            className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-ink bg-ink text-on-ink font-bold uppercase text-2xs tracking-widest hover:opacity-90 transition-opacity"
          >
            <span className="sm:hidden">{t.yes}</span>
            <span className="hidden sm:inline">{t.accept}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
