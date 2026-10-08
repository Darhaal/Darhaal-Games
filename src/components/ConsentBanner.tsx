'use client';

import Link from 'next/link';
import { useLang } from '@/hooks/useLang';
import { writeConsent } from '@/lib/analytics';
import { publishConsentChange, useConsent } from '@/hooks/useConsent';
import type { ConsentChoice } from '@/constants/analytics';
import { localizedPath } from '@/lib/locale';

const T = {
  ru: {
    text: 'Мы хотим собирать обезличенную статистику посещений, чтобы понимать, во что играют и что ломается.',
    detail: 'Без неё сайт работает точно так же.',
    accept: 'Разрешить',
    decline: 'Отказаться',
    policy: 'Политика конфиденциальности'
  },
  en: {
    text: 'We would like to collect anonymous usage statistics, to see what people play and what breaks.',
    detail: 'The site works exactly the same without it.',
    accept: 'Allow',
    decline: 'Decline',
    policy: 'Privacy policy'
  },
  uk: {
    text: 'Ми хочемо збирати знеособлену статистику відвідувань, щоб розуміти, у що грають і що ламається.',
    detail: 'Без неї сайт працює так само.',
    accept: 'Дозволити',
    decline: 'Відмовитися',
    policy: 'Політика конфіденційності'
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
 */
export default function ConsentBanner() {
  const consent = useConsent();
  const { lang } = useLang();
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
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="mx-auto max-w-3xl bg-surface border border-line rounded-2xl shadow-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-xs sm:text-sm text-ink/80 leading-relaxed">
          {t.text}{' '}
          <span className="text-muted">{t.detail}</span>{' '}
          <Link
            href={localizedPath(lang, '/privacy')}
            className="font-bold text-ink underline underline-offset-2 hover:text-accent transition-colors whitespace-nowrap"
          >
            {t.policy}
          </Link>
        </p>

        {/* Equal weight on purpose — see the note above. */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => answer('denied')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-line text-ink font-bold uppercase text-2xs tracking-widest hover:bg-warm transition-colors"
          >
            {t.decline}
          </button>
          <button
            onClick={() => answer('granted')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-ink bg-ink text-on-ink font-bold uppercase text-2xs tracking-widest hover:opacity-90 transition-opacity"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
