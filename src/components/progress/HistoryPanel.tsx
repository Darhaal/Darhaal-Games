'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { requireGame } from '@/games/registry';
import { GAME_ICONS } from '@/games/icons';
import type { Progress } from '@/achievements/progress';
import { formatClock, formatDate, type ProgressStrings } from './strings';

/**
 * The player's matches, newest first. Only matches since history was kept
 * (2.11.0) can be listed; the older ones are counted in a line at the end.
 */

const PAGE = 30;

export default function HistoryPanel({ progress, lang, t }: {
  progress: Progress;
  lang: 'ru' | 'en';
  t: ProgressStrings;
}) {
  const [shown, setShown] = useState(PAGE);
  const rows = progress.history.slice(0, shown);

  if (progress.history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center border-2 border-dashed border-[#E6E1DC] rounded-3xl bg-white/50">
        <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
          <History className="w-6 h-6 text-[#8A9099]" />
        </div>
        <div className="text-base font-black text-[#1A1F26]">{t.historyEmpty}</div>
        <p className="text-sm font-medium text-[#8A9099] mt-1 max-w-sm">{t.historyEmptyNote}</p>
        {progress.baselineMatches > 0 && (
          <p className="text-xs font-medium text-[#8A9099] mt-4 max-w-sm">{t.earlier(progress.baselineMatches)}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <ul className="bg-white rounded-2xl border border-[#E6E1DC] shadow-sm divide-y divide-[#F1F5F9] overflow-hidden">
        {rows.map((row, i) => {
          const Icon = GAME_ICONS[row.game];
          const game = requireGame(row.game);
          const won = row.result === 'win';
          return (
            <li key={`${row.playedAt}-${i}`} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-[#F8FAFC] border border-[#E6E1DC] text-[#1A1F26] flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[#1A1F26] truncate">
                  {game.name[lang]}
                  {row.mode === 'single' && <span className="ml-2 text-3xs font-black uppercase tracking-wider text-[#8A9099]">{t.soloChip}</span>}
                </div>
                <div className="text-xs font-medium text-[#8A9099] tabular-nums">
                  {formatDate(row.playedAt, lang, true)} · {formatClock(row.durationSeconds)}
                  {typeof row.score === 'number' && game.bestScore ? ` · ${row.score}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className={`inline-block text-2xs font-black uppercase tracking-wider px-2 py-1 rounded-md ${
                  won ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F8FAFC] text-[#8A9099] border border-[#E6E1DC]'
                }`}>
                  {won ? t.win : t.loss}
                </span>
                {row.details.left === true && (
                  <div className="text-3xs font-bold uppercase tracking-wider text-[#8A9099] mt-1">{t.left}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {progress.history.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-3 w-full py-3 bg-white border border-[#E6E1DC] rounded-xl text-xs font-black uppercase tracking-wide text-[#1A1F26] hover:border-[#9e1316]/30 transition-all"
        >
          {t.showMore}
        </button>
      )}

      {progress.baselineMatches > 0 && (
        <p className="text-xs font-medium text-[#8A9099] mt-4 text-center">{t.earlier(progress.baselineMatches)}</p>
      )}
    </div>
  );
}
