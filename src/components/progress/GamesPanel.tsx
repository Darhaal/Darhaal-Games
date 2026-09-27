'use client';

import { GAMES } from '@/games/registry';
import { GAME_ICONS } from '@/games/icons';
import { winRate, type Progress } from '@/achievements/progress';
import { formatClock, formatDate, formatDuration, type ProgressStrings } from './strings';

/**
 * One card per game: matches, the win/loss split, time, and the personal
 * records the history makes possible — fastest win, best score, and for games
 * that can be played alone, solo against together.
 */

const LABEL = 'text-2xs font-black text-[#8A9099] uppercase tracking-widest';

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className={LABEL}>{label}</div>
      <div className="text-lg font-black text-[#1A1F26] tabular-nums leading-tight mt-0.5">{value}</div>
    </div>
  );
}

export default function GamesPanel({ progress, lang, t }: {
  progress: Progress;
  lang: 'ru' | 'en';
  t: ProgressStrings;
}) {
  // Most played first; games not tried yet at the end, in registry order.
  const games = [...GAMES].sort((a, b) => progress.games[b.id].matches - progress.games[a.id].matches);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {games.map((game) => {
        const g = progress.games[game.id];
        const Icon = GAME_ICONS[game.id];
        const rate = winRate(g.wins, g.matches);
        const empty = g.matches === 0;
        const showModes = game.hasSoloMode && g.modes.single.matches > 0;

        return (
          <div key={game.id} className={`bg-white p-5 rounded-2xl border border-[#E6E1DC] shadow-sm ${empty ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-[#F8FAFC] border border-[#E6E1DC] text-[#1A1F26] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-black text-[#1A1F26] truncate">{game.name[lang]}</div>
                  <div className="text-xs font-medium text-[#8A9099]">
                    {empty ? t.noMatches : g.lastPlayedAt ? `${t.lastPlayed}: ${formatDate(g.lastPlayedAt, lang)}` : `${g.matches}`}
                  </div>
                </div>
              </div>
              {!empty && (
                <div className="text-right shrink-0">
                  <div className="text-xl font-black text-[#1A1F26] tabular-nums leading-none">{rate}%</div>
                  <div className="text-3xs font-bold uppercase tracking-wider text-[#8A9099] mt-1">{t.winRate}</div>
                </div>
              )}
            </div>

            {!empty && (
              <>
                <div className="h-1.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-[#1A1F26] rounded-full" style={{ width: `${rate}%` }} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Figure label={t.matches} value={g.matches} />
                  <Figure label={t.wins} value={g.wins} />
                  <Figure label={t.time} value={formatDuration(g.seconds, lang)} />
                </div>

                {(g.fastestWin !== null || (game.bestScore && g.bestScore !== null) || showModes) && (
                  <div className="mt-4 pt-4 border-t border-[#F1F5F9] grid grid-cols-2 gap-3">
                    {g.fastestWin !== null && <Figure label={t.fastestWin} value={formatClock(g.fastestWin)} />}
                    {game.bestScore && g.bestScore !== null && <Figure label={game.bestScore[lang]} value={g.bestScore} />}
                    {showModes && (
                      <>
                        <Figure label={t.solo} value={`${g.modes.single.wins}/${g.modes.single.matches}`} />
                        <Figure label={t.together} value={`${g.modes.multi.wins}/${g.modes.multi.matches}`} />
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
