'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Award, Calendar, Clock, Flame, Gamepad2, History, LayoutGrid, Trophy, User } from 'lucide-react';
import type { LoadedProgress } from '@/achievements/load';
import { winRate } from '@/achievements/progress';
import AchievementsPanel from './AchievementsPanel';
import GamesPanel from './GamesPanel';
import HistoryPanel from './HistoryPanel';
import { formatDate, formatDuration, STRINGS } from './strings';

/**
 * The progress page's body: who the player is and their level, four totals,
 * then achievements, per-game statistics and match history under tabs.
 *
 * Takes everything as props — the page loads it — so it renders the same for
 * a real account and for a preview.
 */

export interface ProgressUser {
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
  isGuest: boolean;
}

export type ProgressTab = 'achievements' | 'games' | 'history';
export const PROGRESS_TABS: readonly ProgressTab[] = ['achievements', 'games', 'history'];

const LABEL = 'text-2xs font-black text-[#8A9099] uppercase tracking-widest';
const CARD = 'bg-white rounded-2xl border border-[#E6E1DC] shadow-sm';

function Stat({ icon: Icon, label, value, note }: {
  icon: React.ElementType; label: string; value: string | number; note?: string;
}) {
  return (
    <div className={`${CARD} p-4 md:p-5`}>
      <div className={`${LABEL} flex items-center gap-1.5`}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-xl sm:text-2xl md:text-3xl font-black text-[#1A1F26] tabular-nums mt-2 leading-none whitespace-nowrap">{value}</div>
      {note && <div className="text-xs font-medium text-[#8A9099] mt-1.5">{note}</div>}
    </div>
  );
}

export default function ProgressView({ user, loaded, lang, initialTab = 'achievements' }: {
  user: ProgressUser;
  loaded: LoadedProgress;
  lang: 'ru' | 'en';
  /** From the address, `?tab=history`, so a link can open the right tab. */
  initialTab?: ProgressTab;
}) {
  const t = STRINGS[lang];
  const [tab, setTab] = useState<ProgressTab>(initialTab);
  const { progress, statuses, unlocks, xp, level } = loaded;

  const stepsTotal = statuses.reduce((n, s) => n + (s.achievement.kind === 'ladder' ? 3 : 1), 0);
  const stepsDone = statuses.reduce((n, s) => n + s.reachedIds.length, 0);
  const levelShare = level.span > 0 ? Math.round((level.into / level.span) * 100) : 0;

  const tabs: Array<{ id: ProgressTab; icon: React.ElementType; label: string; count?: string }> = [
    { id: 'achievements', icon: Award, label: t.tabs.achievements, count: `${stepsDone}/${stepsTotal}` },
    { id: 'games', icon: LayoutGrid, label: t.tabs.games },
    { id: 'history', icon: History, label: t.tabs.history, count: progress.history.length ? String(progress.history.length) : undefined }
  ];

  return (
    <div className="space-y-6">
      {/* Who, and how far along */}
      <section className={`${CARD} p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5 md:gap-8`}>
        <div className="flex items-center gap-4 md:gap-5 min-w-0">
          <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-full overflow-hidden bg-[#F1F5F9] border border-[#E6E1DC]">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <User className="w-8 h-8 text-[#8A9099] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-black text-[#1A1F26] tracking-tight leading-none truncate">{user.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 bg-[#F8FAFC] px-2 py-1 rounded-md text-xs font-medium text-[#8A9099]">
                <Calendar className="w-3.5 h-3.5" /> {t.registered} {formatDate(user.createdAt, lang)}
              </span>
              {user.isGuest && (
                <span className="text-xs font-bold text-white bg-[#1A1F26] px-2 py-0.5 rounded">{t.guest}</span>
              )}
            </div>
          </div>
        </div>

        <div className="md:ml-auto md:w-72 shrink-0">
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className={LABEL}>{t.level}</div>
              <div className="text-4xl font-black text-[#1A1F26] tabular-nums leading-none mt-1">{level.level}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-[#1A1F26] tabular-nums">{xp.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB')} {t.xp}</div>
              <div className="text-xs font-medium text-[#8A9099] tabular-nums">{t.toNext(level.span - level.into, level.level + 1)}</div>
            </div>
          </div>
          <div
            className="h-2 w-full bg-[#F1F5F9] rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={level.span}
            aria-valuenow={level.into}
            aria-label={`${t.level} ${level.level}`}
          >
            <div className="h-full bg-[#9e1316] rounded-full transition-all duration-700" style={{ width: `${levelShare}%` }} />
          </div>
        </div>
      </section>

      {user.isGuest && (
        <p className="text-xs font-medium text-[#8A9099] -mt-3 px-1">{t.guestNote}</p>
      )}

      {/* Totals */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Stat icon={Gamepad2} label={t.matches} value={progress.matches} note={`${t.losses}: ${progress.losses}`} />
        {/* The rate is against other players only — a solo game beats nobody. */}
        <Stat
          icon={Trophy}
          label={t.wins}
          value={progress.wins}
          note={progress.rated.matches > 0 ? t.vsOthers(winRate(progress.rated.wins, progress.rated.matches)) : t.soloOnly}
        />
        <Stat icon={Clock} label={t.time} value={formatDuration(progress.seconds, lang)} />
        <Stat icon={Flame} label={t.streak} value={progress.streak.best} note={t.streakNow(progress.streak.current)} />
      </section>

      {/* Tabs */}
      <div className={`${CARD} p-1.5 flex gap-1`} role="tablist">
        {tabs.map(({ id, icon: Icon, label, count }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
                selected ? 'bg-[#1A1F26] text-white shadow-sm' : 'text-[#5B6470] hover:bg-[#F8FAFC]'
              }`}
            >
              <Icon className="w-4 h-4 hidden sm:block" />
              {label}
              {count && (
                <span className={`text-2xs font-black tabular-nums px-1.5 py-0.5 rounded ${selected ? 'bg-white/15' : 'bg-[#F1F5F9] text-[#8A9099]'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="animate-in fade-in duration-300" key={tab}>
        {tab === 'achievements' && <AchievementsPanel statuses={statuses} unlocks={unlocks} lang={lang} t={t} />}
        {tab === 'games' && <GamesPanel progress={progress} lang={lang} t={t} />}
        {tab === 'history' && <HistoryPanel progress={progress} lang={lang} t={t} />}
      </div>
    </div>
  );
}
