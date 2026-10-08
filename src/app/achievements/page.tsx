'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/hooks/useLang';
import SettingsButton from '@/components/SettingsButton';
import ProgressView, { PROGRESS_TABS, type ProgressTab, type ProgressUser } from '@/components/progress/ProgressView';
import { STRINGS } from '@/components/progress/strings';
import { loadProgress, syncUnlocks, type LoadedProgress } from '@/achievements/load';

/**
 * Progress: statistics, achievements and match history.
 *
 * Everything shown is computed from the match history plus the totals kept
 * before it (see src/achievements/). Opening the page also stores any
 * achievement the numbers say is reached but that was never recorded — the
 * first visit after 2.11 dates the ones earned by earlier play.
 */

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-page">
    <Loader2 className="w-8 h-8 animate-spin text-accent" />
  </div>
);

function ProgressContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get('tab') as ProgressTab | null;
  const initialTab = tabParam && PROGRESS_TABS.includes(tabParam) ? tabParam : undefined;
  const { lang } = useLang();
  const t = STRINGS[lang];
  const [user, setUser] = useState<(ProgressUser & { id: string }) | null>(null);
  const [loaded, setLoaded] = useState<LoadedProgress | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (userId: string) => {
    setFailed(false);
    try {
      const data = await loadProgress(userId);
      await syncUnlocks(data);
      setLoaded(data);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user: auth } } = await supabase.auth.getUser();
      if (!auth) {
        const here = window.location.pathname + window.location.search;
        router.push(`/?returnUrl=${encodeURIComponent(here)}`);
        return;
      }
      setUser({
        id: auth.id,
        name: auth.user_metadata?.username || auth.email?.split('@')[0] || 'Player',
        avatarUrl: auth.user_metadata?.avatar_url ?? null,
        createdAt: auth.created_at,
        isGuest: !!auth.is_anonymous
      });
      await load(auth.id);
    })();
  }, [router, load]);

  if (!user || (!loaded && !failed)) return <Spinner />;

  return (
    <div className="min-h-screen bg-page font-sans text-ink overflow-x-clip flex flex-col relative">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none fixed" />
      <div className="absolute -top-32 right-0 w-[28rem] h-[28rem] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="sticky top-0 z-30 w-full bg-page/90 backdrop-blur-xl border-b border-line shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <button
              onClick={() => router.push('/')}
              aria-label={t.back}
              className="group p-2.5 bg-surface border border-line rounded-xl hover:border-accent/30 hover:shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-muted group-hover:text-accent" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-ink tracking-tight leading-none">{t.title}</h1>
              <p className="text-xs text-muted font-medium hidden sm:block mt-1">{t.subtitle}</p>
            </div>
          </div>
          <SettingsButton />
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-4 md:px-6 py-6 md:py-8 pb-20 relative z-10 flex-1">
        {loaded ? (
          <ProgressView user={user} loaded={loaded} lang={lang} initialTab={initialTab} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-line rounded-3xl bg-surface/50 text-center px-6">
            <div className="text-base font-black text-ink">{t.loadError}</div>
            <button
              onClick={() => load(user.id)}
              className="mt-4 px-4 py-2 bg-ink text-on-ink rounded-lg font-bold text-xs uppercase tracking-wide hover:bg-accent transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t.retry}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ProgressContent />
    </Suspense>
  );
}
