'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ghost, Loader2, LogIn, X } from 'lucide-react';
import AuthForm from '@/components/AuthForm';
import { BUTTON_SECONDARY } from '@/components/game/ui';
import { useEscape } from '@/hooks/useEscape';
import { adoptLang } from '@/hooks/useLang';
import { signInAsGuest } from '@/lib/guest';
import { safeReturnUrl } from '@/lib/returnUrl';
import type { Locale } from '@/lib/locale';

// The landing's one red button (the game screens' primary is ink): the page
// is text in black and grey, and its way in should be the first thing seen.
const BUTTON_ACCENT =
  'bg-accent text-white rounded-xl font-black uppercase text-xs tracking-wide shadow-lg shadow-accent/20 hover:bg-ink hover:text-on-ink transition-colors disabled:opacity-40';

const T = {
  ru: {
    guest: 'Играть как гость',
    signIn: 'Войти',
    note: 'Без регистрации — аккаунт можно завести потом',
    failed: 'Гостевой вход сейчас недоступен — войдите с аккаунтом',
    dialog: 'Вход',
    close: 'Закрыть'
  },
  en: {
    guest: 'Play as guest',
    signIn: 'Sign in',
    note: 'No sign-up needed — you can make an account later',
    failed: 'Guest sign-in is unavailable right now — sign in with an account',
    dialog: 'Sign in',
    close: 'Close'
  },
  uk: {
    guest: 'Грати як гість',
    signIn: 'Увійти',
    note: 'Без реєстрації — акаунт можна завести потім',
    failed: 'Гостьовий вхід зараз недоступний — увійдіть з акаунтом',
    dialog: 'Вхід',
    close: 'Закрити'
  }
} as const;

/**
 * The landing's way in: play as a guest, or sign in in a dialog. The landing
 * stays the page — a full-screen sign-in card in front of it was what Google
 * rendered and indexed the home page as (the SEO audit of 2026-11-09).
 */
export default function LandingActions({ locale }: { locale: Locale }) {
  const router = useRouter();
  const t = T[locale];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Sent here by a game page's "Play" (?returnUrl=/create?game=…): they came
  // to play, so the way in is already open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the query is only known in the browser; opening it on the server would put a dialog into every crawler's copy of the page
    if (safeReturnUrl(window.location.search)) setOpen(true);
  }, []);

  // Whoever starts playing from this page plays in its language, unless they chose one before.
  useEffect(() => {
    if (open) adoptLang(locale);
  }, [open, locale]);

  useEscape(open, () => setOpen(false));

  const playAsGuest = async () => {
    setBusy(true);
    setFailed(false);
    adoptLang(locale);
    try {
      await signInAsGuest();
      const next = safeReturnUrl(window.location.search);
      if (next) router.push(next);
      else window.location.reload();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 w-full max-w-sm sm:max-w-none">
        <button
          type="button"
          onClick={playAsGuest}
          disabled={busy}
          className={`${BUTTON_ACCENT} px-8 py-4 flex items-center justify-center gap-2.5 active:scale-[0.98]`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ghost className="w-4 h-4" />}
          {t.guest}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${BUTTON_SECONDARY} group px-8 py-4 flex items-center justify-center gap-2.5 active:scale-[0.98]`}
        >
          <LogIn className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
          {t.signIn}
        </button>
      </div>
      <p className={`text-xs font-medium ${failed ? 'text-accent' : 'text-muted'}`} role={failed ? 'alert' : undefined}>
        {failed ? t.failed : t.note}
      </p>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.dialog}
          className="fixed inset-0 z-[60] overflow-y-auto bg-scrim/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="min-h-full flex items-center justify-center p-4 py-10" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className="relative w-full max-w-[400px] animate-in zoom-in-95">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="absolute -top-2 right-0 p-2.5 bg-surface border border-line rounded-xl text-muted hover:text-accent hover:border-accent/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {/* AuthForm reads useSearchParams, so it needs its own boundary. */}
              <Suspense fallback={<div className="h-[600px]" />}>
                <AuthForm defaultLang={locale} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
