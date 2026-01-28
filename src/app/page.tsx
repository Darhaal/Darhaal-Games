'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gamepad2,
  Plus,
  Settings as SettingsIcon,
  Trophy,
  User,
  LogOut,
  Loader2,
  LayoutGrid
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthForm from '@/components/AuthForm';
import Settings from '@/components/Settings';

type Lang = 'ru' | 'en';

function HomeContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lang, setLang] = useState<Lang>('ru');

  useEffect(() => {
    // Load lang from local storage
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);
  }, []);

  const t = {
    ru: {
      welcome: 'Привет,',
      menu: {
        play: { title: 'Играть', sub: 'Найти игру' },
        create: { title: 'Создать', sub: 'Новая комната' },
        achievements: { title: 'Достижения', sub: 'Твой прогресс' },
        settings: { title: 'Настройки', sub: 'Профиль и опции' }
      },
      footer: '© 2026 Darhaal Games'
    },
    en: {
      welcome: 'Hello,',
      menu: {
        play: { title: 'Play', sub: 'Find Game' },
        create: { title: 'Create', sub: 'New Room' },
        achievements: { title: 'Achievements', sub: 'Your Progress' },
        settings: { title: 'Settings', sub: 'Profile & Options' }
      },
      footer: '© 2026 Darhaal Games'
    }
  }[lang];

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) updateLocalUser(session.user);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) updateLocalUser(session.user);
      else setUser(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateLocalUser = (authUser: any) => {
      const name = authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'Player';
      const avatar = authUser.user_metadata?.avatar_url || null;
      setUser({
        id: authUser.id,
        email: authUser.email,
        name: name,
        avatarUrl: avatar,
        isAnonymous: authUser.is_anonymous
      });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const menuItems = [
    {
      title: t.menu.play.title,
      subtitle: t.menu.play.sub,
      icon: <Gamepad2 className="w-8 h-8 mb-4 text-[#8A9099] group-hover:text-[#9e1316] transition-colors duration-300" />,
      action: () => router.push('/play'),
    },
    {
      title: t.menu.create.title,
      subtitle: t.menu.create.sub,
      icon: <Plus className="w-8 h-8 mb-4 text-[#8A9099] group-hover:text-[#9e1316] transition-colors duration-300" />,
      action: () => router.push('/create'),
    },
    {
      title: t.menu.achievements.title,
      subtitle: t.menu.achievements.sub,
      icon: <Trophy className="w-8 h-8 mb-4 text-[#8A9099] group-hover:text-[#9e1316] transition-colors duration-300" />,
      action: () => router.push('/achievements'),
    },
    {
      title: t.menu.settings.title,
      subtitle: t.menu.settings.sub,
      icon: <SettingsIcon className="w-8 h-8 mb-4 text-[#8A9099] group-hover:text-[#9e1316] transition-colors duration-300" />,
      action: () => setShowSettings(true),
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-[#8A9099]">
        <Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-white text-[#1A1F26] flex flex-col items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>
        <div className="relative z-10 w-full px-4 flex justify-center">
           <AuthForm />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#1A1F26] flex flex-col items-center relative overflow-hidden font-sans selection:bg-[#9e1316] selection:text-white">

      {/* Texture & Ambient */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#9e1316]/5 rounded-full blur-[120px] pointer-events-none" />

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        currentLang={lang}
        setLang={setLang}
        updateUserAvatar={(url) => setUser({...user, avatarUrl: url})}
      />

      <header className="w-full max-w-7xl p-6 flex justify-between items-center z-10 relative mt-4">

        {/* Профиль */}
        <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-4 bg-white/80 backdrop-blur-md border border-[#E6E1DC] p-2 pr-6 rounded-full hover:border-[#9e1316]/50 hover:shadow-lg hover:shadow-[#9e1316]/5 transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 bg-[#F5F5F0] border border-[#E6E1DC] rounded-full flex items-center justify-center overflow-hidden relative">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            ) : (
              <User className="w-5 h-5 text-[#8A9099]" />
            )}
          </div>
          <div className="flex flex-col items-start">
            <span className="font-bold text-sm text-[#1A1F26] group-hover:text-[#9e1316] transition-colors tracking-wide">
                {user.name}
            </span>
            <span className="text-[10px] font-medium text-[#8A9099] uppercase tracking-wider">
              {user.isAnonymous ? 'Guest' : `ID: ${user.id.slice(0,4)}`}
            </span>
          </div>
        </button>

        {/* Логотип */}
        <div className="hidden md:flex flex-col items-center absolute left-1/2 -translate-x-1/2">
           <div className="flex items-center gap-3 opacity-90 hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-sm px-6 py-2 rounded-full border border-transparent hover:border-[#E6E1DC]">
             <img src="/logo512.png" alt="Logo" className="w-8 h-8 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
             <span className="text-xl font-black tracking-widest font-sans text-[#1A1F26]">DARHAAL</span>
           </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-3 bg-white/80 backdrop-blur-md border border-[#E6E1DC] text-[#8A9099] hover:text-[#9e1316] hover:border-[#9e1316]/50 hover:bg-[#9e1316]/5 rounded-full transition-all shadow-sm"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl px-4 z-10 mt-[-60px]">
        <div className="text-center mb-16 animate-in slide-in-from-bottom-8 duration-700 fade-in">
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight text-[#1A1F26]">
            {t.welcome} <span className="text-[#9e1316]">{user.name}</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className={`
                group relative flex flex-col items-center justify-center h-72
                bg-white border border-[#E6E1DC] rounded-[32px] shadow-sm
                transition-all duration-300 hover:border-[#9e1316]/50 hover:-translate-y-2 hover:shadow-2xl hover:shadow-[#9e1316]/10
              `}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#9e1316]/0 group-hover:to-[#9e1316]/5 rounded-[32px] transition-all duration-300" />

              <div className="mb-8 p-5 bg-[#F5F5F0] border border-[#E6E1DC] rounded-2xl group-hover:border-[#9e1316]/30 group-hover:bg-white transition-all duration-300 relative z-10 shadow-inner">
                 {item.icon}
              </div>

              <h3 className="text-xl font-bold text-[#1A1F26] mb-2 group-hover:text-[#9e1316] tracking-tight relative z-10 transition-colors">{item.title}</h3>
              <p className="text-xs font-semibold text-[#8A9099] uppercase tracking-wider relative z-10">{item.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      <footer className="w-full p-8 text-center z-10 mb-4 opacity-60">
        <p className="text-[#8A9099] text-xs font-bold uppercase tracking-[0.2em] hover:text-[#9e1316] transition-colors cursor-default">
          {t.footer}
        </p>
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" /></div>}>
      <HomeContent />
    </Suspense>
  );
}