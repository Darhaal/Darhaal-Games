'use client';

import Image from 'next/image';
import React, { useState, useEffect, useLayoutEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Gamepad2,
  Plus,
  Settings as SettingsIcon,
  Trophy,
  User,
  LogOut,
  Loader2,
  Sparkles,
  GitCommit,
  Clock,
  Play
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User as AuthUser } from '@supabase/supabase-js';
import AuthForm from '@/components/AuthForm';
import Settings from '@/components/Settings';
import WelcomeSetup, { needsWelcomeSetup } from '@/components/WelcomeSetup';
import { APP_VERSION, VERSION_HISTORY, VersionType } from '@/constants/version';
import { useLang } from '@/hooks/useLang';
import { COPYRIGHT } from '@/constants/app';
import type { UiUser } from '@/types/user';

/**
 * True when a Supabase session is already stored locally.
 *
 * Read synchronously so a returning player never sees the marketing landing
 * flash before the app appears. It is only a hint — the real check is
 * `getSession()` below; this just decides what to paint in the meantime.
 */
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) return true;
    }
  } catch {
    // Private mode or blocked storage — fall back to showing the landing.
  }
  return false;
}

function HomeContent({ landing }: { landing: React.ReactNode }) {
  const router = useRouter();
  /**
   * Whether to skip the landing while auth resolves. Starts false so the
   * server and the first client render agree; useLayoutEffect flips it before
   * the browser paints, so the swap is never visible.
   */
  const [sessionHint, setSessionHint] = useState(false);
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setting state before paint is the entire point here: it swaps the landing for a spinner without the returning player ever seeing the landing
    if (hasStoredSession()) setSessionHint(true);
  }, []);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UiUser | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  /** Hides the first-run prompt for the rest of the session once answered. */
  const [setupDone, setSetupDone] = useState(false);
  const { lang, setLang } = useLang();

  const t = {
    ru: {
      welcome: 'С возвращением,',
      status: 'ОНЛАЙН',
      menu: {
        play: { title: 'ИГРАТЬ', sub: 'Поиск матча', desc: 'Начать битву' },
        create: { title: 'СОЗДАТЬ', sub: 'Свои правила', desc: 'Новое лобби' },
        achievements: { title: 'ПРОГРЕСС', sub: 'Статистика', desc: 'Твой путь' },
        settings: { title: 'СИСТЕМА', sub: 'Настройки', desc: 'Опции' }
      },
      footer: COPYRIGHT,
      changelog: 'Хронология',
      catalogue: 'Все игры и правила',
      latest: 'Последнее'
    },
    en: {
      welcome: 'Welcome back,',
      status: 'ONLINE',
      menu: {
        play: { title: 'PLAY', sub: 'Find Match', desc: 'Start Battle' },
        create: { title: 'CREATE', sub: 'Custom Rules', desc: 'New Lobby' },
        achievements: { title: 'PROGRESS', sub: 'Stats', desc: 'Your Path' },
        settings: { title: 'SYSTEM', sub: 'Settings', desc: 'Options' }
      },
      footer: COPYRIGHT,
      changelog: 'Timeline',
      catalogue: 'All games and rules',
      latest: 'Latest'
    }
  }[lang];

  const updateLocalUser = (authUser: AuthUser) => {
      const name = authUser.user_metadata?.username || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Player';
      const avatar = authUser.user_metadata?.avatar_url || null;
      setUser({
        id: authUser.id,
        email: authUser.email,
        name: name,
        avatarUrl: avatar,
        isAnonymous: authUser.is_anonymous,
        user_metadata: authUser.user_metadata,
        created_at: authUser.created_at
      });
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        updateLocalUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) updateLocalUser(session.user);
      else setUser(null);
    });

    return () => subscription.unsubscribe();
     
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleProfileUpdate = (updates: { name?: string; avatarUrl?: string }) => {
    if (!user) return;
    setUser((prev) => prev && ({
      ...prev,
      name: updates.name || prev.name,
      avatarUrl: updates.avatarUrl || prev.avatarUrl,
      user_metadata: {
        ...prev.user_metadata,
        username: updates.name || prev.user_metadata?.username,
        avatar_url: updates.avatarUrl || prev.user_metadata?.avatar_url
      }
    }));
  };

  const getVerColor = (type: VersionType) => {
      switch(type) {
          case 'init': return 'bg-purple-500 shadow-purple-500/50';
          case 'major': return 'bg-[#9e1316] shadow-[#9e1316]/50';
          case 'minor': return 'bg-blue-500 shadow-blue-500/50';
          case 'patch': return 'bg-emerald-500 shadow-emerald-500/50';
          default: return 'bg-gray-400';
      }
  };

  if (loading) {
    // A known-returning player gets a spinner; everyone else — including every
    // crawler, which never runs the effect — gets the server-rendered landing.
    return sessionHint ? (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" />
      </div>
    ) : (
      <>{landing}</>
    );
  }

  if (!user) {
    return (
      <>
      <main className="min-h-screen bg-[#F8FAFC] text-gray-900 flex flex-col items-center justify-center relative overflow-hidden font-sans p-4">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none" />
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-[#9e1316]/5 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] animate-pulse pointer-events-none delay-1000" />

        <div className="relative z-10 w-full flex justify-center scale-100 transition-transform">
           {/* AuthForm reads useSearchParams, so it needs its own boundary.
               Wrapping the whole screen instead made the landing render twice:
               once as the fallback and once as the resolved content. */}
           <Suspense fallback={<div className="w-full max-w-[360px] h-[520px]" />}>
             <AuthForm />
           </Suspense>
        </div>

        <div className="absolute bottom-8 flex flex-col items-center gap-3">
           <Link
             href="/games"
             className="text-2xs font-bold uppercase tracking-widest text-gray-400 hover:text-[#9e1316] transition-colors"
           >
             {t.catalogue}
           </Link>
           <div className="text-gray-400 text-2xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
             <GitCommit className="w-3 h-3" /> v{APP_VERSION} Stable
           </div>
        </div>
      </main>

      {/* The same server-rendered content sits below the sign-in card, so a
          visitor can read what this is before deciding to create an account. */}
      {landing}
      </>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-gray-900 flex flex-col items-center relative overflow-hidden font-sans selection:bg-[#9e1316] selection:text-white">

      {/* --- BACKGROUND FX --- */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none z-0" />
      <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-white via-white/80 to-transparent pointer-events-none z-0" />

      <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-[#9e1316]/5 rounded-full blur-[100px] pointer-events-none" />

      {!setupDone && needsWelcomeSetup(user) && (
        <WelcomeSetup
          user={user}
          onDone={(updates) => {
            if (updates.name || updates.avatarUrl) handleProfileUpdate(updates);
            setSetupDone(true);
          }}
        />
      )}

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        currentLang={lang}
        setLang={setLang}
        onProfileUpdate={handleProfileUpdate}
      />

      {/* --- HEADER --- */}
      <header className="w-full max-w-7xl px-4 py-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 z-20 relative">

        {/* BRANDING (LEFT) */}
        <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
               <Image src="/logo512.png" alt="Logo" width={24} height={24} className="w-6 h-6 object-contain" />
            </div>
            <div className="flex flex-col">
               <span className="text-xl font-black tracking-tighter leading-none text-gray-900">
                 Darhaal <span className="text-[#9e1316]">Games</span>
               </span>
               <span className="text-3xs font-bold text-gray-400 uppercase tracking-[0.3em] pl-0.5">Platform</span>
            </div>
        </div>

        {/* ACTIONS (RIGHT) */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
             {/* Profile Pill */}
            <button
                onClick={() => setShowSettings(true)}
                className="group flex items-center gap-2 md:gap-3 bg-white/60 backdrop-blur-xl border border-gray-200 p-1.5 pr-4 rounded-full hover:border-[#9e1316]/30 hover:bg-white hover:shadow-lg hover:shadow-[#9e1316]/5 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-50 border-2 border-white rounded-full flex items-center justify-center overflow-hidden relative shadow-sm group-hover:scale-105 transition-transform z-10">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="Avatar" width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div className="flex flex-col items-start z-10 max-w-[100px] md:max-w-none">
                <span className="font-black text-xs text-gray-900 group-hover:text-[#9e1316] transition-colors tracking-tight truncate w-full">
                    {user.name}
                </span>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-3xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
                      {t.status}
                    </span>
                </div>
              </div>
            </button>

            <div className="h-8 w-px bg-gray-200 mx-1" />

            <button
              onClick={handleLogout}
              className="p-2.5 bg-white/60 backdrop-blur-xl border border-gray-200 text-gray-400 hover:text-[#9e1316] hover:border-[#9e1316]/30 hover:bg-red-50 rounded-full transition-all shadow-sm group"
            >
              <LogOut className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl px-4 md:px-6 z-10 py-4 pb-20">

        {/* Welcome Block */}
        <div className="text-center mb-10 md:mb-14 animate-in slide-in-from-bottom-8 duration-700 fade-in w-full">
          <h1 className="text-4xl md:text-7xl font-black mb-4 tracking-tighter text-gray-900 leading-none drop-shadow-sm">
            {t.welcome} <br className="md:hidden" />
            <span className="text-[#9e1316] relative inline-block">
                {user.name}
                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-[#9e1316] absolute -top-2 -right-6 md:-right-8 animate-pulse opacity-50" />
            </span>
          </h1>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 w-full h-auto md:h-[450px]">

          {/* PLAY BUTTON (Light & Premium Red Accent) */}
          <button
            onClick={() => router.push('/play')}
            className="group md:col-span-5 relative flex flex-col justify-between p-6 md:p-8 rounded-[32px] md:rounded-[40px] overflow-hidden shadow-xl shadow-gray-200/50 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl bg-white border-4 border-[#F8FAFC] hover:border-[#9e1316]/10 min-h-[200px] md:min-h-0"
          >
             {/* Background Texture */}
             <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-50 mix-blend-overlay" />
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#9e1316]/5 rounded-full blur-[80px] group-hover:bg-[#9e1316]/10 transition-colors duration-700" />

             {/* Icon */}
             <div className="w-fit p-4 bg-gray-50 text-[#9e1316] rounded-3xl shadow-sm border border-gray-100 group-hover:rotate-6 group-hover:scale-110 transition-all duration-500 mb-8 md:mb-0 group-hover:bg-[#9e1316] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[#9e1316]/30">
                 <Gamepad2 className="w-8 h-8" />
             </div>

             <div className="relative z-20 text-left mt-auto">
                 <div className="flex items-center gap-2 mb-2">
                     <span className="w-2 h-2 bg-[#9e1316] rounded-full animate-pulse" />
                     <span className="text-[#9e1316] text-2xs font-black uppercase tracking-widest">{t.menu.play.sub}</span>
                 </div>
                 <h3 className="text-4xl md:text-5xl font-black text-gray-900 mb-2 tracking-tighter group-hover:translate-x-1 transition-transform">{t.menu.play.title}</h3>
                 <div className="flex items-center justify-between mt-4">
                     <p className="text-gray-400 text-sm font-bold tracking-wide group-hover:text-gray-900 transition-colors">{t.menu.play.desc}</p>
                     <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-[#9e1316] group-hover:text-white transition-all duration-300">
                        <Play className="w-4 h-4 fill-current" />
                     </div>
                 </div>
             </div>
          </button>

          {/* CREATE & ACHIEVEMENTS */}
          <div className="md:col-span-4 flex flex-col gap-4 md:gap-5">
             <button
                onClick={() => router.push('/create')}
                className="group flex-1 bg-white border border-gray-200 rounded-[24px] md:rounded-[32px] p-6 text-left relative overflow-hidden transition-all duration-300 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 min-h-[140px]"
             >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[100px] transition-colors group-hover:bg-blue-100/50" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className="p-3 bg-white border border-blue-100 text-blue-600 w-fit rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                        <Plus className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-blue-500 transition-colors">{t.menu.create.sub}</div>
                        <h3 className="text-2xl font-black text-gray-900">{t.menu.create.title}</h3>
                    </div>
                </div>
             </button>

             <button
                onClick={() => router.push('/achievements')}
                className="group flex-1 bg-white border border-gray-200 rounded-[24px] md:rounded-[32px] p-6 text-left relative overflow-hidden transition-all duration-300 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-500/5 hover:-translate-y-1 min-h-[140px]"
             >
                 <div className="absolute bottom-0 right-0 w-24 h-24 bg-amber-50 rounded-tl-[100px] group-hover:bg-amber-100/50 transition-colors" />
                 <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className="flex justify-between items-start">
                        <div className="p-3 bg-white border border-amber-100 text-amber-600 w-fit rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                            <Trophy className="w-6 h-6" />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-amber-600 transition-colors">{t.menu.achievements.sub}</div>
                        <h3 className="text-2xl font-black text-gray-900">{t.menu.achievements.title}</h3>
                    </div>
                </div>
             </button>
          </div>

          {/* SETTINGS */}
          <button
            onClick={() => setShowSettings(true)}
            className="md:col-span-3 bg-white border border-gray-200 rounded-[24px] md:rounded-[32px] p-6 flex flex-col justify-between group relative overflow-hidden transition-all duration-300 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-600/5 hover:-translate-y-1 min-h-[140px]"
          >
             <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[100px] transition-colors group-hover:bg-emerald-100/50" />
             <div className="relative z-10 w-full flex justify-end">
                 <div className="p-3 bg-white border border-emerald-100 text-emerald-600 w-fit rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                    <SettingsIcon className="w-6 h-6 group-hover:rotate-90 transition-all duration-700 ease-out" />
                 </div>
             </div>
             <div className="relative z-10 text-left">
                 <div className="text-2xs font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-emerald-600 transition-colors">{t.menu.settings.sub}</div>
                 <h3 className="text-xl font-black text-gray-900">{t.menu.settings.title}</h3>
             </div>
          </button>

        </div>
      </div>

      {/* VERSION & FOOTER */}
      <footer className="w-full p-6 text-center z-10 mt-auto flex flex-col items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">

        {/* Version Badge with Tooltip */}
        <div className="relative group/version">
             <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/50 backdrop-blur-md border border-gray-200 rounded-full cursor-help hover:border-[#9e1316]/30 transition-colors">
                <GitCommit className="w-3 h-3 text-[#9e1316]" />
                <span className="text-3xs font-black tracking-widest uppercase text-gray-900">v{APP_VERSION}</span>
             </div>

             {/* Timeline Popover */}
             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 bg-white/95 backdrop-blur-2xl border border-gray-200 rounded-2xl shadow-2xl p-0 opacity-0 invisible group-hover/version:opacity-100 group-hover/version:visible transition-all duration-300 transform group-hover/version:translate-y-0 translate-y-2 z-50 text-left overflow-hidden pointer-events-none group-hover/version:pointer-events-auto">
                 <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                     <h4 className="text-2xs font-black uppercase text-gray-900 tracking-[0.2em]">{t.changelog}</h4>
                     <Clock className="w-3 h-3 text-[#9e1316]" />
                 </div>
                 <div className="max-h-[250px] overflow-y-auto custom-scrollbar p-4 space-y-4">
                    {VERSION_HISTORY.map((log, i) => (
                        <div key={i} className="relative pl-4 border-l-2 border-gray-100 last:border-transparent pb-1">
                           <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${getVerColor(log.type)} ring-4 ring-white shadow-sm`} />
                           <div className="flex justify-between items-center mb-1">
                               <span className="text-3xs font-black text-gray-900 bg-gray-50 px-1.5 py-0.5 rounded">{log.ver}</span>
                               <span className="text-3xs font-bold text-gray-400 uppercase tracking-wide">{log.date}</span>
                           </div>
                           <div className="text-2xs text-gray-500 leading-snug font-medium">
                               {log.desc?.[lang]}
                           </div>
                        </div>
                    ))}
                 </div>
             </div>
        </div>

        <p className="text-gray-900 text-2xs font-black tracking-[0.3em] cursor-default flex items-center justify-center gap-2">
            <Image src="/logo512.png" alt="Logo" width={16} height={16} className="w-4 h-4 object-contain" /> {t.footer}
        </p>
      </footer>
    </main>
  );
}

export default function HomeClient({ landing }: { landing: React.ReactNode }) {
  return <HomeContent landing={landing} />;
}