'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/hooks/useLang';
import { MATCH_RECORDED_EVENT } from '@/lib/matchRecords';
import { loadProgress, syncUnlocks } from '@/achievements/load';
import { TIER_STYLE, unlockOf } from '@/achievements/tiers';
import { pluralEn, pluralRu } from '@/lib/plural';
import { playSfx } from '@/lib/sound';

/**
 * "Achievement unlocked", shown when a recorded match reaches something new.
 *
 * Mounted once in the layout. It listens for a match being recorded, loads
 * the player's progress, stores what has newly been reached and shows it —
 * over the result dialog, since that is where the player is looking.
 */

const SHOW_MS = 6000;

export default function AchievementToaster() {
  const { lang } = useLang();
  const [fresh, setFresh] = useState<{ at: number; ids: string[] } | null>(null);

  useEffect(() => {
    const onRecorded = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const ids = await syncUnlocks(await loadProgress(user.id));
        if (ids.length > 0) {
          setFresh({ at: Date.now(), ids });
          playSfx('success');
        }
      } catch (e) {
        console.error('Could not check achievements:', e);
      }
    };
    window.addEventListener(MATCH_RECORDED_EVENT, onRecorded);
    return () => window.removeEventListener(MATCH_RECORDED_EVENT, onRecorded);
  }, []);

  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setFresh(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [fresh]);

  if (!fresh) return null;
  return <AchievementToast key={fresh.at} ids={fresh.ids} lang={lang} onClose={() => setFresh(null)} />;
}

/** The toast itself: the best of what was reached leads, the rest are counted. */
export function AchievementToast({ ids, lang, onClose }: {
  ids: string[];
  lang: 'ru' | 'en' | 'uk';
  onClose: () => void;
}) {
  const order = { gold: 0, silver: 1, bronze: 2 } as const;
  const unlocked = ids
    .map(unlockOf)
    .filter((u): u is NonNullable<ReturnType<typeof unlockOf>> => u !== null)
    .sort((a, b) => order[a.tier] - order[b.tier]);
  if (unlocked.length === 0) return null;

  const lead = unlocked[0];
  const style = TIER_STYLE[lead.tier];
  const Icon = lead.achievement.icon;
  const more = unlocked.length - 1;
  const t = {
    ru: {
      label: 'Достижение получено',
      more: `и ещё ${more} ${pluralRu(more, ['достижение', 'достижения', 'достижений'])}`,
      open: 'Открыть прогресс',
      close: 'Закрыть'
    },
    en: {
      label: 'Achievement unlocked',
      more: `and ${more} more ${pluralEn(more, 'achievement', 'achievements')}`,
      open: 'Open progress',
      close: 'Close'
    },
    uk: {
      label: 'Досягнення отримано',
      more: `і ще ${more} ${pluralRu(more, ['досягнення', 'досягнення', 'досягнень'])}`,
      open: 'Відкрити прогрес',
      close: 'Закрити'
    }
  }[lang];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="bg-surface border border-line rounded-2xl shadow-2xl shadow-shade/10 p-4 flex items-center gap-4">
        <div className={`w-12 h-12 shrink-0 rounded-xl border flex items-center justify-center ${style.well}`}>
          <Icon className={`w-6 h-6 ${style.icon}`} />
        </div>
        <Link href="/achievements" className="min-w-0 flex-1 group" onClick={onClose}>
          <div className="text-2xs font-black uppercase tracking-widest text-muted">
            {t.label} · {style.name[lang]}
          </div>
          <div className="text-sm font-black text-ink truncate group-hover:text-accent transition-colors">
            {lead.achievement.title[lang]}
          </div>
          <div className="text-xs font-medium text-muted truncate">
            {more > 0 ? t.more : t.open}
          </div>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-page transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
