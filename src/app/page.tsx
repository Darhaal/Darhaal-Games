'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Gamepad2, Plus, LogOut, Settings as SettingsIcon, Trophy, User } from 'lucide-react';
import AuthForm from '@/components/AuthForm';
import Settings from '@/components/Settings';

type Lang = 'ru' | 'en';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [lang, setLang] = useState<Lang>('ru');

  // Загрузка языка
  useEffect(() => {
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang) setLang(savedLang);
  }, []);

  // Проверка авторизации
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

  // Парсинг данных пользователя
  const updateLocalUser = (authUser: any) => {
      const name = authUser.user_metadata?.username || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Player';
      const avatar = authUser.user_metadata?.avatar_url || null;
      setUser({
        id: authUser.id,
        email: authUser.email,
        name: name,
        avatarUrl: avatar,
        isAnonymous: authUser.is_anonymous,
        user_metadata: authUser.user_metadata // Сохраняем все метаданные
      });
  };

  // Callback для обновления данных из Настроек без перезагрузки
  const handleProfileUpdate = (updates: { name?: string; avatarUrl?: string }) => {
    if (!user) return;
    setUser((prev: any) => ({
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

  const t = {
    ru: { play: 'Найти Игру', list: 'Список лобби', create: 'Создать', new: 'Новая комната', footer: '© 2026 Darhaal Games' },
    en: { play: 'Find Game', list: 'Lobby list', create: 'Create', new: 'New Room', footer: '© 2026 Darhaal Games' }
  }[lang];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" />
      </div>
    );
  }

  // Если не вошел — показываем форму входа
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none"></div>
        <div className="w-full max-w-md p-4 relative z-10">
            <AuthForm />
        </div>
      </div>
    );
  }

  // Главное меню
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans relative overflow-hidden text-[#1A1F26]">
       <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

       <Settings
         isOpen={showSettings}
         onClose={() => setShowSettings(false)}
         user={user}
         currentLang={lang}
         setLang={setLang}
         onProfileUpdate={handleProfileUpdate}
       />

       <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-3 group cursor-pointer bg-white/50 backdrop-blur-sm p-2 pr-4 rounded-full border border-[#E6E1DC] hover:border-[#9e1316]/30 transition-all"
          >
            <div className="w-10 h-10 bg-white rounded-full border border-[#E6E1DC] flex items-center justify-center overflow-hidden group-hover:border-[#9e1316] transition-colors relative">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-[#8A9099]" />
                )}
            </div>
            <div className="flex flex-col items-start">
                <span className="font-bold text-sm text-[#1A1F26] group-hover:text-[#9e1316] transition-colors max-w-[120px] truncate">{user.name}</span>
                <span className="text-[10px] text-[#8A9099] font-bold uppercase tracking-wider">{user.isAnonymous ? 'Guest' : 'Online'}</span>
            </div>
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 bg-white rounded-full border border-[#E6E1DC] text-[#8A9099] hover:text-[#9e1316] hover:border-[#9e1316] transition-all shadow-sm"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-3 bg-white rounded-full border border-[#E6E1DC] text-[#8A9099] hover:text-[#9e1316] hover:border-[#9e1316] transition-all shadow-sm"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
       </header>

       <div className="z-10 text-center space-y-12 animate-in slide-in-from-bottom-8 duration-700 w-full max-w-4xl px-4">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter cursor-default select-none drop-shadow-sm">
            DARHAAL<span className="text-[#9e1316]">GAMES</span>
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
             <button onClick={() => router.push('/play')} className="group h-72 bg-white border border-[#E6E1DC] rounded-[40px] p-8 flex flex-col items-center justify-center hover:border-[#9e1316]/50 hover:shadow-2xl hover:shadow-[#9e1316]/10 hover:-translate-y-2 transition-all relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#9e1316]/0 group-hover:to-[#9e1316]/5 transition-all duration-500" />
                <div className="w-20 h-20 bg-[#F5F5F0] rounded-3xl border border-[#E6E1DC] flex items-center justify-center group-hover:bg-white group-hover:border-[#9e1316]/20 group-hover:scale-110 transition-all duration-300 mb-8 shadow-inner">
                  <Gamepad2 className="w-10 h-10 text-[#8A9099] group-hover:text-[#9e1316] transition-colors" />
                </div>
                <span className="text-2xl font-black uppercase tracking-tight text-[#1A1F26] group-hover:text-[#9e1316] transition-colors">{t.play}</span>
                <span className="text-xs font-bold text-[#8A9099] uppercase tracking-widest mt-2 group-hover:text-[#1A1F26] transition-colors">{t.list}</span>
             </button>

             <button onClick={() => router.push('/create')} className="group h-72 bg-white border border-[#E6E1DC] rounded-[40px] p-8 flex flex-col items-center justify-center hover:border-[#9e1316]/50 hover:shadow-2xl hover:shadow-[#9e1316]/10 hover:-translate-y-2 transition-all relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#9e1316]/0 group-hover:to-[#9e1316]/5 transition-all duration-500" />
                <div className="w-20 h-20 bg-[#F5F5F0] rounded-3xl border border-[#E6E1DC] flex items-center justify-center group-hover:bg-white group-hover:border-[#9e1316]/20 group-hover:scale-110 transition-all duration-300 mb-8 shadow-inner">
                  <Plus className="w-10 h-10 text-[#8A9099] group-hover:text-[#9e1316] transition-colors" />
                </div>
                <span className="text-2xl font-black uppercase tracking-tight text-[#1A1F26] group-hover:text-[#9e1316] transition-colors">{t.create}</span>
                <span className="text-xs font-bold text-[#8A9099] uppercase tracking-widest mt-2 group-hover:text-[#1A1F26] transition-colors">{t.new}</span>
             </button>
          </div>
       </div>

       <footer className="absolute bottom-6 text-[10px] font-bold text-[#8A9099] uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition-opacity cursor-default">
          {t.footer}
       </footer>
    </div>
  );
}