'use client';

import { useState } from 'react';
import { Lock, Star } from 'lucide-react';
import { GAMES, type GameId } from '@/games/registry';
import { GAME_ICONS } from '@/games/icons';
import { GROUPS, TIERS, type AchievementGroup } from '@/achievements/definitions';
import type { AchievementStatus } from '@/achievements/evaluate';
import { TIER_STYLE } from '@/achievements/tiers';
import { formatDate, type ProgressStrings } from './strings';

/**
 * Every achievement, grouped: general first, then each game. A card shows
 * where the player stands — the tier reached, the next step and how far off
 * it is — rather than only whether it is done.
 */

const LABEL = 'text-2xs font-black text-[#8A9099] uppercase tracking-widest';

function AchievementCard({ status, unlocks, lang, t }: {
  status: AchievementStatus;
  unlocks: Record<string, string>;
  lang: 'ru' | 'en';
  t: ProgressStrings;
}) {
  const { achievement, tier, value, target, complete } = status;
  const Icon = achievement.icon;
  const style = tier ? TIER_STYLE[tier] : null;

  const description = achievement.kind === 'ladder'
    ? achievement.describe(target ?? achievement.steps[2])[lang]
    : achievement.description[lang];

  // The date the latest step reached was first seen.
  const latest = status.reachedIds.map((id) => unlocks[id]).filter(Boolean).sort().at(-1);

  // Hours are the one ladder counted in fractions.
  const shown = (Math.floor(value * 10) / 10).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB');
  const share = target === null ? 1 : Math.min(1, value / target);

  return (
    <div className={`bg-white p-4 rounded-2xl border shadow-sm flex gap-4 transition-all ${tier ? 'border-[#E6E1DC]' : 'border-[#EEF0F2]'}`}>
      <div className={`w-12 h-12 shrink-0 rounded-xl border flex items-center justify-center ${style ? style.well : 'bg-[#F8FAFC] border-[#E6E1DC]'}`}>
        {tier ? <Icon className={`w-6 h-6 ${style!.icon}`} /> : <Icon className="w-6 h-6 text-[#C5CAD1]" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className={`text-sm font-black leading-tight ${tier ? 'text-[#1A1F26]' : 'text-[#5B6470]'}`}>
            {achievement.title[lang]}
          </div>
          {achievement.kind === 'ladder' ? (
            <div className="flex gap-1 pt-1 shrink-0" aria-hidden>
              {TIERS.map((step, i) => (
                <span
                  key={step}
                  title={TIER_STYLE[step].name[lang]}
                  className={`w-2 h-2 rounded-full ${value >= achievement.steps[i] ? TIER_STYLE[step].dot : 'bg-[#E6E1DC]'}`}
                />
              ))}
            </div>
          ) : (
            <span className={`shrink-0 text-3xs font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${tier ? `${TIER_STYLE[achievement.tier].well} ${TIER_STYLE[achievement.tier].icon} border` : 'bg-[#F8FAFC] text-[#8A9099]'}`}>
              {TIER_STYLE[achievement.tier].name[lang]}
            </span>
          )}
        </div>

        <p className="text-xs font-medium text-[#8A9099] mt-1 leading-snug">{description}</p>

        {achievement.kind === 'ladder' && !complete && (
          <div className="mt-2.5">
            <div className="h-1.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${style ? style.bar : 'bg-[#1A1F26]'}`}
                style={{ width: `${Math.round(share * 100)}%` }}
              />
            </div>
            <div className="text-3xs font-bold text-[#8A9099] mt-1 tabular-nums">
              {t.progressOf(shown, target!)}
            </div>
          </div>
        )}

        <div className="text-3xs font-bold uppercase tracking-wider mt-2 flex items-center gap-1 text-[#8A9099]">
          {complete ? (
            <><Star className="w-3 h-3" /> {achievement.kind === 'ladder' ? t.complete : t.reached}{latest ? ` · ${formatDate(latest, lang)}` : ''}</>
          ) : tier && latest ? (
            <>{t.reached} · {formatDate(latest, lang)}</>
          ) : !tier ? (
            <><Lock className="w-3 h-3" /> {t.notYet}</>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AchievementsPanel({ statuses, unlocks, lang, t }: {
  statuses: AchievementStatus[];
  unlocks: Record<string, string>;
  lang: 'ru' | 'en';
  t: ProgressStrings;
}) {
  const [filter, setFilter] = useState<AchievementGroup | 'all'>('all');

  const groups = GROUPS.filter((g) => filter === 'all' || g === filter);
  const steps = (group: AchievementGroup) => {
    const own = statuses.filter((s) => s.achievement.group === group);
    const total = own.reduce((n, s) => n + (s.achievement.kind === 'ladder' ? 3 : 1), 0);
    const done = own.reduce((n, s) => n + s.reachedIds.length, 0);
    return { own, total, done };
  };

  const groupName = (group: AchievementGroup) =>
    group === 'general' ? t.general : GAMES.find((g) => g.id === group)!.name[lang];

  return (
    <div>
      {/* Filter: all, general, then a chip per game. */}
      <div className="flex gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible pb-2 mb-4 -mx-1 px-1" role="tablist">
        {(['all', ...GROUPS] as const).map((g) => {
          const selected = filter === g;
          const GameIcon = g !== 'all' && g !== 'general' ? GAME_ICONS[g as GameId] : null;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(g)}
              className={`shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                selected ? 'bg-[#1A1F26] text-white border-[#1A1F26]' : 'bg-white text-[#5B6470] border-[#E6E1DC] hover:border-[#9e1316]/30'
              }`}
            >
              {GameIcon && <GameIcon className="w-3.5 h-3.5" />}
              {g === 'all' ? t.all : groupName(g)}
            </button>
          );
        })}
      </div>

      <div className="space-y-8">
        {groups.map((group) => {
          const { own, total, done } = steps(group);
          const GameIcon = group === 'general' ? null : GAME_ICONS[group];
          return (
            <section key={group}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`${LABEL} flex items-center gap-2`}>
                  {GameIcon && <GameIcon className="w-3.5 h-3.5" />}
                  {groupName(group)}
                </h3>
                <span className="text-xs font-bold text-[#8A9099] tabular-nums">{done}/{total}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {own.map((s) => (
                  <AchievementCard key={s.achievement.id} status={s} unlocks={unlocks} lang={lang} t={t} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
