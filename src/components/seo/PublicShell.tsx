import Image from 'next/image';
import Link from 'next/link';
import { APP_NAME, COPYRIGHT } from '@/constants/app';
import type { Locale } from '@/content/games';
import { localizedPath } from '@/lib/seo';

/**
 * Chrome for the public, crawlable pages.
 *
 * A server component on purpose: this layer must render fully in the initial
 * HTML. It shares the visual language of the app but none of its client state
 * — no auth, no Supabase, no hooks.
 *
 * The root element carries `lang` so the English subtree is correctly tagged
 * even though the document element is `ru` (see the note in app/layout.tsx).
 */

const T = {
  ru: {
    nav: 'Игры',
    play: 'Играть',
    switch: 'English',
    tagline: 'Играйте с друзьями прямо в браузере',
    rights: 'Все права защищены.'
  },
  en: {
    nav: 'Games',
    play: 'Play',
    switch: 'Русский',
    tagline: 'Play with friends right in your browser',
    rights: 'All rights reserved.'
  }
} as const;

export default function PublicShell({
  locale,
  children
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = T[locale];
  const other: Locale = locale === 'ru' ? 'en' : 'ru';

  return (
    <div lang={locale} className="min-h-screen bg-[#F8FAFC] text-gray-900 flex flex-col font-sans">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none" />

      <header className="w-full border-b border-gray-200 bg-white/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href={localizedPath(locale, '/games')} className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
              <Image src="/logo512.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain" />
            </div>
            <span className="text-lg font-black tracking-tighter leading-none text-gray-900">
              Darhaal <span className="text-[#9e1316]">Games</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 md:gap-4">
            <Link
              href={localizedPath(locale, '/games')}
              className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-[#9e1316] transition-colors px-2 py-1"
            >
              {t.nav}
            </Link>
            <Link
              href={localizedPath(other, '/games')}
              hrefLang={other}
              className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-[#9e1316] transition-colors px-2 py-1"
            >
              {t.switch}
            </Link>
            <Link
              href="/"
              className="bg-[#1A1F26] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-full hover:bg-[#9e1316] transition-colors"
            >
              {t.play}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full relative z-10">{children}</main>

      <footer className="w-full border-t border-gray-200 bg-white/60 mt-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-2xs font-black tracking-[0.2em] uppercase text-gray-500">
            <Image src="/logo512.png" alt="" width={16} height={16} className="w-4 h-4 object-contain" />
            {COPYRIGHT}
          </div>
          <p className="text-2xs font-bold uppercase tracking-wider text-gray-400">
            {APP_NAME} — {t.tagline}
          </p>
        </div>
      </footer>
    </div>
  );
}
