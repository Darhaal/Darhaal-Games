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

const LABEL = 'text-2xs font-black text-muted uppercase tracking-widest';

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className={LABEL}>{label}</div>
      <div className="text-lg font-black text-ink tabular-nums leading-tight mt-0.5">{value}</div>
    </div>
  );
}

export default function GamesPanel({ progress, lang, t }: {
  progress: Progress;
  lang: 'ru' | 'en' | 'uk';
  t: ProgressStrings;
}) {
  // Most played first; games not tried yet at the end, in registry order.
  const games = [...GAMES].sort((a, b) => progress.games[b.id].matches - progress.games[a.id].matches);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {games.map((game) => {
        const g = progress.games[game.id];
        const Icon = GAME_ICONS[game.id];
        // Against other players only; a game played only alone has no rate.
        const rated = g.rated.matches > 0;
        const rate = winRate(g.rated.wins, g.rated.matches);
        const empty = g.matches === 0;
        const showModes = game.hasSoloMode && g.modes.single.matches > 0;
        // No rate: either every recorded match was solo, or all there is are the
        // old totals, which do not say which matches had rivals.
        const unratedCaption = g.modes.single.matches > 0 ? t.soloOnly : t.unrated;

        return (
          <div key={game.id} className={`bg-surface p-5 rounded-2xl border border-line shadow-sm ${empty ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-page border border-line text-ink flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-black text-ink truncate">{game.name[lang]}</div>
                  <div className="text-xs font-medium text-muted">
                    {empty ? t.noMatches : g.lastPlayedAt ? `${t.lastPlayed}: ${formatDate(g.lastPlayedAt, lang)}` : t.beforeHistory}
                  </div>
                </div>
              </div>
              {!empty && (
                <div className="text-right shrink-0">
                  <div className="text-xl font-black text-ink tabular-nums leading-none">{rated ? `${rate}%` : '—'}</div>
                  <div className="text-3xs font-bold uppercase tracking-wider text-muted mt-1">{rated ? t.winRate : unratedCaption}</div>
                </div>
              )}
            </div>

            {!empty && (
              <>
                <div className="h-1.5 w-full bg-divider rounded-full overflow-hidden mb-4">
                  {rated && <div className="h-full bg-ink rounded-full" style={{ width: `${rate}%` }} />}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Figure label={t.matches} value={g.matches} />
                  <Figure label={t.wins} value={g.wins} />
                  <Figure label={t.time} value={formatDuration(g.seconds, lang)} />
                </div>

                {(g.fastestWin !== null || (game.bestScore && g.bestScore !== null) || showModes) && (
                  <div className="mt-4 pt-4 border-t border-divider grid grid-cols-2 gap-3">
                    {g.fastestWin !== null && <Figure label={t.fastestWin} value={formatClock(g.fastestWin)} />}
                    {game.bestScore && g.bestScore !== null && <Figure label={game.bestScore[lang]} value={g.bestScore} />}
                    {showModes && (
                      <>
                        <Figure label={t.solo} value={`${g.modes.single.wins}/${g.modes.single.matches}`} />
                        {g.modes.multi.matches > 0 && (
                          <Figure label={t.together} value={`${g.modes.multi.wins}/${g.modes.multi.matches}`} />
                        )}
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
