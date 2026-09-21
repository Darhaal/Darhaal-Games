'use client';

import Image from 'next/image';
import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/hooks/useLang';
import { COPYRIGHT } from '@/constants/app';
import SettingsButton from '@/components/SettingsButton';
import type { User as AuthUser } from '@supabase/supabase-js';
import {
  ArrowLeft, Calendar, Trophy, Skull,
  Gamepad2, Medal, Clock, TrendingUp, Loader2, User, Star, Zap
} from 'lucide-react';
import { GAMES, type GameId, type Locale } from '@/games/registry';
import { GAME_ICONS } from '@/games/icons';

// Base stats of a single category
type BaseStats = {
    wins: number;
    lost: number;
    time: number; // in minutes
    extra?: number; // Extra metric (mines/flags)
};

// Game data: either flat or split by mode
type GameStatsData = BaseStats | {
    single?: BaseStats;
    multi?: BaseStats;
    // For backward compatibility with the legacy format
    wins?: number;
    lost?: number;
    time?: number;
    extra?: number;
};

// Full structure as stored in the DB
type UserStats = {
    total_games: number;
    /**
     * One entry per game. Games with a solo mode store `{ single, multi }`,
     * the rest store a flat BaseStats — see `src/lib/playerStats.ts`.
     */
    details: Partial<Record<GameId, GameStatsData>>;
};


// --- Hoisted to module scope (components must not be declared during render) ---

interface TDict {
    wins: string; losses: string; playTime: string; noStats: string;
    modes: { single: string; multi: string };
    locale: Locale;
}

const StatCard = ({ label, value, icon: Icon, color }: {
    label: string; value: string | number; icon: React.ElementType; color: string;
}) => (
    <div className="bg-white p-5 rounded-3xl border border-[#E6E1DC] shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow group">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} text-white shadow-md group-hover:scale-110 transition-transform`}>
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <div className="text-[10px] font-bold text-[#8A9099] tracking-wider uppercase">{label}</div>
            <div className="text-xl font-black text-[#1A1F26]">{value}</div>
        </div>
    </div>
);

const GameStatCard = ({ data, modeLabel, gameId, t }: {
    data: BaseStats; modeLabel?: string; gameId: GameId; t: TDict;
}) => {
    const total = data.wins + data.lost;
    const wr = total > 0 ? Math.round((data.wins / total) * 100) : 0;

    // Name, extra-counter label and icon all come from the registry, so a new
    // game shows up here complete instead of unlabelled.
    const game = GAMES.find((g) => g.id === gameId)!;
    const title = game.name[t.locale];
    const extraLabel = game.extraStat?.[t.locale];
    const GameIcon = GAME_ICONS[gameId];

    return (
      <div className="bg-white rounded-[32px] p-6 border border-[#E6E1DC] shadow-lg hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-gray-100 to-transparent rounded-bl-[100px] pointer-events-none group-hover:from-[#9e1316]/5 transition-colors" />

          <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                  <h3 className="text-xl font-black text-[#1A1F26] flex items-center gap-2">
                      <GameIcon className="w-5 h-5 text-[#9e1316]"/>
                      {title}
                  </h3>
                  {modeLabel && (
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider mt-1 inline-block ${modeLabel === t.modes.single ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                          {modeLabel}
                      </span>
                  )}
              </div>
              {total === 0 && <span className="text-[10px] font-bold bg-[#F5F5F0] text-[#8A9099] px-3 py-1 rounded-full tracking-wider">{t.noStats}</span>}
          </div>

          <div className={`grid grid-cols-2 gap-y-4 gap-x-2 relative z-10 ${total === 0 ? 'opacity-40 grayscale' : ''}`}>
              <div>
                  <div className="text-[10px] font-bold text-[#8A9099] mb-1 uppercase tracking-wider">{t.wins}</div>
                  <div className="text-xl font-black text-emerald-600 flex items-center gap-1">
                      {data.wins} <Trophy className="w-3 h-3" />
                  </div>
              </div>
              <div>
                  <div className="text-[10px] font-bold text-[#8A9099] mb-1 uppercase tracking-wider">{t.losses}</div>
                  <div className="text-xl font-black text-red-500 flex items-center gap-1">
                      {data.lost} <Skull className="w-3 h-3" />
                  </div>
              </div>
              <div>
                  <div className="text-[10px] font-bold text-[#8A9099] mb-1 uppercase tracking-wider">{t.playTime}</div>
                  <div className="text-xl font-black text-[#1A1F26] flex items-center gap-1">
                      {Math.round(data.time)}m
                  </div>
              </div>

              {extraLabel && (
                  <div>
                      <div className="text-[10px] font-bold text-[#8A9099] mb-1 uppercase tracking-wider">{extraLabel}</div>
                      <div className="text-xl font-black text-[#1A1F26] flex items-center gap-1">
                          {data.extra || 0}
                          <GameIcon className="w-3 h-3 text-[#9e1316]" />
                      </div>
                  </div>
              )}
          </div>

          {total > 0 && (
              <div className="mt-6 relative z-10">
                  <div className="flex justify-between text-[9px] font-bold text-[#8A9099] mb-2">
                      <span>Winrate</span>
                      <span>{wr}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#F5F5F0] rounded-full overflow-hidden">
                      <div
                          className="h-full bg-gradient-to-r from-[#9e1316] to-orange-500 transition-all duration-1000"
                          style={{ width: `${wr}%` }}
                      />
                  </div>
              </div>
          )}
      </div>
    );
};

function AchievementsContent() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useLang();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
          // Remember the current path
          const currentPath = window.location.pathname + window.location.search;
          // Redirect to home with a returnUrl
          router.push(`/?returnUrl=${encodeURIComponent(currentPath)}`);
          return;
      }
      setUser(user);

      const { data: statsData } = await supabase
          .from('player_stats')
          .select('*')
          .eq('user_id', user.id)
          .single();

      if (statsData) {
          setStats(statsData);
      } else {
          // Initialize with zeros when no record exists
          setStats({
              total_games: 0,
              details: Object.fromEntries(
                  GAMES.map((g) => [g.id, { wins: 0, lost: 0, time: 0 }])
              )
          });
      }
      setLoading(false);
    };
    fetchData();
  }, [router]);

  const t = {
    ru: {
      headerTitle: 'Прогресс',
      headerSub: 'Ваша статистика',
      back: 'Назад',
      profile: 'Статистика игрока',
      regDate: 'Дата регистрации',
      totalGames: 'Матчей',
      winRate: 'Винрейт',
      games: 'Дисциплины',
      wins: 'Побед',
      losses: 'Поражений',
      playTime: 'В игре',
      guest: 'Гость',
      guestDesc: 'Статистика не сохраняется',
      noStats: 'Нет данных',
      footer: COPYRIGHT,
      modes: {
          single: 'Одиночный',
          multi: 'Мультиплеер'
      },
      locale: 'ru' as const
    },
    en: {
      headerTitle: 'Progress',
      headerSub: 'Your Statistics',
      back: 'Back',
      profile: 'Player Statistics',
      regDate: 'Registered',
      totalGames: 'Matches',
      winRate: 'Win Rate',
      games: 'Disciplines',
      wins: 'Wins',
      losses: 'Losses',
      playTime: 'Play Time',
      guest: 'Guest',
      guestDesc: 'Stats not saved',
      noStats: 'No data',
      footer: COPYRIGHT,
      modes: {
          single: 'Solo',
          multi: 'Multiplayer'
      },
      locale: 'en' as const
    }
  }[lang];

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="w-8 h-8 animate-spin text-[#9e1316]" /></div>;

  const regDate = new Date(user.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
  });

  // --- Helpers for Aggregation ---

  const getAggregatedStats = (data: GameStatsData | undefined): BaseStats => {
      if (!data) return { wins: 0, lost: 0, time: 0 };
      const gameData = data as { single?: BaseStats; multi?: BaseStats } & Partial<BaseStats>;

      // New split-by-mode format
      if (gameData.single || gameData.multi) {
          const s = gameData.single || { wins: 0, lost: 0, time: 0 };
          const m = gameData.multi || { wins: 0, lost: 0, time: 0 };
          return {
              wins: (s.wins || 0) + (m.wins || 0),
              lost: (s.lost || 0) + (m.lost || 0),
              time: (s.time || 0) + (m.time || 0)
          };
      }

      // Legacy flat format
      return {
          wins: gameData.wins || 0,
          lost: gameData.lost || 0,
          time: gameData.time || 0
      };
  };

  let totalWins = 0;
  let totalLost = 0;
  let totalTime = 0;

  if (stats?.details) {
      Object.values(stats.details).forEach((g) => {
          const agg = getAggregatedStats(g);
          totalWins += agg.wins;
          totalLost += agg.lost;
          totalTime += agg.time;
      });
  }

  const globalWinRate = totalWins + totalLost > 0 ? Math.round((totalWins / (totalWins + totalLost)) * 100) : 0;
  const hoursPlayed = Math.floor(totalTime / 60);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#1A1F26] overflow-x-hidden selection:bg-[#9e1316] selection:text-white flex flex-col">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none fixed" />

      {/* HEADER: STICKY */}
      <header className="sticky top-0 z-30 w-full bg-[#F8FAFC]/90 backdrop-blur-xl border-b border-[#E6E1DC] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <button onClick={() => router.push('/')} className="group p-2.5 md:p-3 bg-white border border-[#E6E1DC] rounded-xl hover:border-[#9e1316]/30 hover:shadow-sm transition-all">
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-[#8A9099] group-hover:text-[#9e1316]" />
            </button>
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-bold text-[#1A1F26] tracking-tight leading-none">{t.headerTitle}</h1>
                <p className="text-xs text-[#8A9099] font-medium hidden sm:block">{t.headerSub}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <SettingsButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 pb-20 relative z-10 flex-1">
          {/* Header Profile */}
          <div className="flex flex-col md:flex-row items-center gap-8 mb-12 animate-in slide-in-from-bottom-8 duration-500">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-[#F5F5F0] relative group ring-4 ring-[#E6E1DC]/50">
                  {user.user_metadata?.avatar_url ? (
                      <Image src={user.user_metadata.avatar_url} alt="Avatar" width={160} height={160} className="w-full h-full object-cover" />
                  ) : (
                      <User className="w-16 h-16 text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  )}
                  {user.is_anonymous && (
                      <div className="absolute bottom-0 left-0 right-0 bg-[#1A1F26] text-white text-[9px] font-bold text-center py-1 tracking-wider">{t.guest}</div>
                  )}
              </div>
              <div className="text-center md:text-left">
                  <div className="text-[10px] font-black text-[#9e1316] tracking-[0.2em] mb-2 flex items-center justify-center md:justify-start gap-2 uppercase">
                    <Star className="w-3 h-3 fill-current" /> {t.profile}
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-[#1A1F26] tracking-tighter leading-none mb-4">
                      {user.user_metadata?.username || user.email?.split('@')[0] || 'Player'}
                  </h1>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#8A9099] bg-white px-4 py-2 rounded-xl border border-[#E6E1DC] shadow-sm">
                          <Calendar className="w-4 h-4" /> {t.regDate}: <span className="text-[#1A1F26]">{regDate}</span>
                      </div>
                      {user.is_anonymous && (
                          <div className="flex items-center gap-2 text-xs font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                              <User className="w-4 h-4" /> {t.guestDesc}
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Global Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 animate-in slide-in-from-bottom-10 duration-700 delay-100">
              <StatCard label={t.totalGames} value={totalWins + totalLost} icon={Gamepad2} color="bg-[#9e1316]" />
              <StatCard label={t.winRate} value={`${globalWinRate}%`} icon={TrendingUp} color="bg-emerald-600" />
              <StatCard label={t.playTime} value={`${hoursPlayed}h`} icon={Clock} color="bg-blue-600" />
              <StatCard label={t.wins} value={totalWins} icon={Trophy} color="bg-yellow-500" />
          </div>

          {/* Games Grid */}
          <h2 className="text-xl font-black text-[#1A1F26] tracking-tight mb-6 flex items-center gap-3">
              <Medal className="w-6 h-6 text-[#9e1316]" /> {t.games}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-12 duration-700 delay-200">
              {GAMES.map((game) => {
                  const empty: BaseStats = { wins: 0, lost: 0, time: 0 };
                  const data = stats?.details?.[game.id] as (BaseStats & { single?: BaseStats; multi?: BaseStats }) | undefined;

                  if (!data) return <GameStatCard key={game.id} data={empty} gameId={game.id} t={t} />;

                  // Solo-capable games keep two records; the rest keep one.
                  // Checked against the stored shape rather than the registry
                  // alone, so a game that changes its mind still renders the
                  // rows a player already has.
                  if (data.single || data.multi) {
                      return (
                          <React.Fragment key={game.id}>
                              <GameStatCard modeLabel={t.modes.single} data={data.single || empty} gameId={game.id} t={t} />
                              <GameStatCard modeLabel={t.modes.multi} data={data.multi || empty} gameId={game.id} t={t} />
                          </React.Fragment>
                      );
                  }

                  return <GameStatCard key={game.id} data={data} gameId={game.id} t={t} />;
              })}
          </div>
      </main>

      <footer className="w-full p-8 text-center z-10 mt-auto opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[#1A1F26] text-[10px] font-black tracking-[0.3em] cursor-default flex items-center justify-center gap-2">
            <Zap className="w-3 h-3 text-[#9e1316]" /> {t.footer}
        </p>
      </footer>
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" /></div>}>
       <AchievementsContent />
    </Suspense>
  );
}