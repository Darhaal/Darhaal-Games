import Image from 'next/image';
import Link from 'next/link';
import { APP_NAME, AUTHOR, COPYRIGHT, SOURCE_URL } from '@/constants/app';
import type { Locale } from '@/content/games';
import { localizedPath } from '@/lib/seo';
import { LANGUAGE_LINKS } from '@/lib/locale';

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
    tagline: 'Играйте с друзьями прямо в браузере',
    rights: 'Все права защищены.',
    privacy: 'Конфиденциальность',
    changelog: 'История изменений'
  },
  en: {
    nav: 'Games',
    play: 'Play',
    tagline: 'Play with friends right in your browser',
    rights: 'All rights reserved.',
    privacy: 'Privacy',
    changelog: 'Changelog'
  },
  uk: {
    nav: 'Ігри',
    play: 'Грати',
    tagline: 'Грайте з друзями просто в браузері',
    rights: 'Усі права захищено.',
    privacy: 'Конфіденційність',
    changelog: 'Історія змін'
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

  return (
    <div lang={locale} className="min-h-screen bg-page text-gray-900 flex flex-col font-sans">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none" />

      <header className="w-full border-b border-gray-200 bg-surface/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href={localizedPath(locale, '/games')} className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-surface border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
              <Image src="/logo512.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain" />
            </div>
            <span className="text-lg font-black tracking-tighter leading-none text-gray-900">
              Darhaal <span className="text-accent">Games</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 md:gap-4">
            <Link
              href={localizedPath(locale, '/games')}
              className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-accent transition-colors px-2 py-1"
            >
              {t.nav}
            </Link>
            {LANGUAGE_LINKS.filter((l) => l.locale !== locale).map((l) => (
              <Link
                key={l.locale}
                href={localizedPath(l.locale, '/games')}
                hrefLang={l.locale}
                title={l.name}
                aria-label={l.name}
                className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-accent transition-colors px-1.5 py-1"
              >
                {l.short}
              </Link>
            ))}
            <Link
              href={localizedPath(locale, '/')}
              className="bg-ink text-on-ink text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-full hover:bg-accent transition-colors"
            >
              {t.play}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full relative z-10">{children}</main>

      <footer className="w-full border-t border-gray-200 bg-surface/60 mt-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-2xs font-black tracking-[0.2em] uppercase text-gray-500">
            <Image src="/logo512.png" alt="" width={16} height={16} className="w-4 h-4 object-contain" />
            {COPYRIGHT}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <a
              href={AUTHOR.url}
              rel="author"
              className="text-2xs font-bold uppercase tracking-wider text-gray-500 hover:text-accent transition-colors"
            >
              {AUTHOR.name[locale]}
            </a>
            <a
              href={SOURCE_URL}
              className="text-2xs font-bold uppercase tracking-wider text-gray-500 hover:text-accent transition-colors"
            >
              GitHub
            </a>
            <Link
              href={localizedPath(locale, '/changelog')}
              className="text-2xs font-bold uppercase tracking-wider text-gray-500 hover:text-accent transition-colors"
            >
              {t.changelog}
            </Link>
            <Link
              href={localizedPath(locale, '/privacy')}
              className="text-2xs font-bold uppercase tracking-wider text-gray-500 hover:text-accent transition-colors"
            >
              {t.privacy}
            </Link>
            <p className="text-2xs font-bold uppercase tracking-wider text-gray-400">
              {APP_NAME} — {t.tagline}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
