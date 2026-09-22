'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Volume2, Globe, Shield, User, Mail, Loader2, Check, Edit2,
  Camera, LogOut, Monitor, Zap, Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import type { UiUser } from '@/types/user';
import { defaultAvatar } from '@/constants/app';
import { useEscape } from '@/hooks/useEscape';

type Lang = 'ru' | 'en';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  user: UiUser;
  currentLang: Lang;
  setLang: (lang: Lang) => void;
  onProfileUpdate: (updates: { name?: string; avatarUrl?: string }) => void;
}

const AVATAR_SEEDS = ['Felix', 'Aneka', 'Zack', 'Midnight', 'Luna', 'Shadow', 'Gamer', 'Pro', 'Sky', 'River', 'Ember', 'Bear', 'Fox', 'Wolf'];

export default function Settings({ isOpen, onClose, user, currentLang, setLang, onProfileUpdate }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'general' | 'account'>('profile');
  const [volume, setVolume] = useState(80);

  // Load the saved volume
  useEffect(() => {
    const saved = localStorage.getItem('dg_volume');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage does not exist during SSR, so this cannot move into a lazy useState initializer
    if (saved !== null && !isNaN(Number(saved))) setVolume(Number(saved));
  }, []);

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    localStorage.setItem('dg_volume', String(v));
  };
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [customAvatars, setCustomAvatars] = useState<string[]>([]);
  const [username, setUsername] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape (the delete-confirm sub-dialog takes priority when open)
  useEscape(isOpen && !pendingDelete, onClose);
  useEscape(!!pendingDelete, () => setPendingDelete(null));

  useEffect(() => {
    if (user && user.name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds the editable name field from the loaded profile
      setUsername(user.name);
    }
  }, [user]);

  const fetchCustomAvatars = useCallback(async () => {
    if (!user || user.isAnonymous) return;
    const { data, error } = await supabase.storage.from('avatars').list('', { search: user.id });
    if (!error && data) {
      // created_at is nullable on a storage object. `new Date(null)` silently
      // becomes the epoch, which would bury an undated upload at the bottom of
      // the list instead of treating it as unknown — so guard it explicitly.
      const uploadedAt = (file: { created_at: string | null }) =>
        file.created_at ? new Date(file.created_at).getTime() : 0;
      const sorted = [...data].sort((a, b) => uploadedAt(b) - uploadedAt(a));
      const urls = sorted.map(file => supabase.storage.from('avatars').getPublicUrl(file.name).data.publicUrl);
      setCustomAvatars(urls);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchCustomAvatars is async; its setState runs after the storage call resolves, not synchronously
    if (isOpen) fetchCustomAvatars();
  }, [isOpen, fetchCustomAvatars]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resetCooldown > 0) interval = setInterval(() => setResetCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [resetCooldown]);

  if (!isOpen) return null;

  const t = {
    ru: {
      title: 'Настройки',
      tabs: { general: 'Система', profile: 'Профиль', account: 'Аккаунт' },
      lang: 'Язык',
      sound: 'Звук',
      upload: 'Загрузить',
      changePass: 'Пароль',
      passDesc: 'Сброс пароля через Email',
      sendReset: 'Отправить ссылку',
      resetSent: 'Проверьте почту',
      guest: 'Гостевой режим',
      guestDesc: 'Зарегистрируйтесь, чтобы сохранять прогресс и загружать свои аватарки.',
      wait: 'Ждите',
      sec: 'с',
      myAvatars: 'Мои загрузки',
      basicAvatars: 'Коллекция',
      nickname: 'Имя пользователя',
      save: 'Сохранить',
      cancel: 'Отмена',
      logout: 'Выйти',
      deleteAvatar: 'Удалить',
      deleteConfirmTitle: 'Удалить аватар?',
      deleteConfirmDesc: 'Это действие нельзя отменить.',
      cancelDelete: 'Отмена',
      confirmDelete: 'Удалить',
      clickToEdit: 'Нажмите, чтобы изменить'
    },
    en: {
      title: 'Settings',
      tabs: { general: 'System', profile: 'Profile', account: 'Account' },
      lang: 'Language',
      sound: 'Sound',
      upload: 'Upload',
      changePass: 'Password',
      passDesc: 'Reset password via Email',
      sendReset: 'Send Link',
      resetSent: 'Check email',
      guest: 'Guest Mode',
      guestDesc: 'Sign up to save progress and upload custom avatars.',
      wait: 'Wait',
      sec: 's',
      myAvatars: 'My Uploads',
      basicAvatars: 'Collection',
      nickname: 'Username',
      save: 'Save',
      cancel: 'Cancel',
      logout: 'Logout',
      deleteAvatar: 'Delete',
      deleteConfirmTitle: 'Delete avatar?',
      deleteConfirmDesc: 'This action cannot be undone.',
      cancelDelete: 'Cancel',
      confirmDelete: 'Delete',
      clickToEdit: 'Click to edit'
    }
  }[currentLang];

  const handleLangChange = (lang: Lang) => {
    setLang(lang);
    localStorage.setItem('dg_lang', lang);
  };

  const handleSaveName = async () => {
    if (!username.trim()) return;
    if (username === user.name) {
        setIsEditingName(false);
        return;
    }
    try {
      await supabase.auth.updateUser({ data: { username: username } });
      // Guests own their profile row as well (RLS checks auth.uid() = id);
      // skipping them here is what left guest profiles stale.
      await supabase.from('profiles').update({ username: username }).eq('id', user.id);
      onProfileUpdate({ name: username });
      setIsEditingName(false);
    } catch (e: unknown) {
      showToast('Error: ' + errorMessage(e), 'error');
    }
  };

  const saveAvatar = async (url: string) => {
    try {
      onProfileUpdate({ avatarUrl: url });
      await supabase.auth.updateUser({ data: { avatar_url: url } });
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    } catch (error) {
      console.error('Save failed', error);
    }
  };

  
  const handlePresetSelect = (seed: string) => {
    saveAvatar(defaultAvatar(seed));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    if (user.isAnonymous) return;
    setUploading(true);
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) {
        showToast('File too large (max 2MB)', 'error');
        setUploading(false);
        return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    try {
      await supabase.storage.from('avatars').upload(fileName, file);
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await fetchCustomAvatars();
      await saveAvatar(data.publicUrl);
    } catch (e: unknown) { showToast(errorMessage(e), 'error'); } finally { setUploading(false); }
  };

  const confirmDeleteAvatar = async () => {
    const url = pendingDelete;
    setPendingDelete(null);
    if (!url) return;
    const fileName = url.split('/').pop();
    if (!fileName) return;
    await supabase.storage.from('avatars').remove([fileName]);
    await fetchCustomAvatars();
    if (user.avatarUrl === url) {
        saveAvatar(defaultAvatar(user.id));
    }
  };

  const handleEmailReset = async () => {
    if (!user.email || resetCooldown > 0) return;
    setLoading(true);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = `${baseUrl}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
    if (error) showToast(error.message, 'error');
    else { showToast(t.resetSent, 'success'); setResetCooldown(60); }
    setLoading(false);
  };

  // Portal to <body>: the trigger lives inside blurred sticky headers whose
  // backdrop-filter creates a containing block for position:fixed, which would
  // otherwise clip this modal. document.body only exists on the client.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#1A1F26]/40 backdrop-blur-xl animate-in fade-in duration-300 font-sans" onClick={onClose}>
      <div
        className="w-full max-w-5xl bg-white rounded-[40px] shadow-2xl shadow-black/20 border border-[#E6E1DC] overflow-hidden flex flex-col md:flex-row h-[680px] relative animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2.5 bg-[#F8FAFC] hover:bg-[#E6E1DC] rounded-full text-[#8A9099] hover:text-[#1A1F26] transition-all z-50 group"
        >
            <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>

        {/* SIDEBAR */}
        <div className="w-full md:w-72 bg-[#F8FAFC] p-8 border-b md:border-b-0 md:border-r border-[#E6E1DC] flex flex-col shrink-0">
          <div className="flex items-center gap-3 mb-10">
             <div className="w-11 h-11 bg-white border border-[#E6E1DC] rounded-xl flex items-center justify-center shadow-sm">
                <Zap className="w-6 h-6 text-[#9e1316] fill-current" />
             </div>
             <div>
                <span className="font-black text-xl text-[#1A1F26] tracking-tight block leading-none">Darhaal Games</span>
                <span className="text-2xs font-bold text-[#8A9099] uppercase tracking-[0.2em]">Settings</span>
             </div>
          </div>

          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible no-scrollbar">
            {[
              { id: 'profile', icon: User, label: t.tabs.profile },
              { id: 'general', icon: Monitor, label: t.tabs.general },
              { id: 'account', icon: Shield, label: t.tabs.account },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'profile' | 'general' | 'account')}
                className={`
                  flex items-center gap-3 p-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap relative group
                  ${activeTab === tab.id
                    ? 'bg-white text-[#1A1F26] shadow-md ring-1 ring-[#E6E1DC]'
                    : 'text-[#8A9099] hover:bg-white/60 hover:text-[#1A1F26]'}
                `}
              >
                <tab.icon className={`w-4 h-4 relative z-10 transition-colors ${activeTab === tab.id ? 'text-[#9e1316]' : 'group-hover:text-[#1A1F26]'}`} />
                <span className="relative z-10">{tab.label}</span>
                {activeTab === tab.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#9e1316] rounded-r-full" />}
              </button>
            ))}
          </nav>

          <div className="mt-auto hidden md:block">
             <div className="p-4 rounded-2xl bg-white border border-[#E6E1DC] flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-[#F8FAFC] border border-[#E6E1DC] overflow-hidden shrink-0">
                      <Image src={user.avatarUrl || "/logo512.png"} alt="Avatar" width={160} height={160} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                      <div className="text-xs font-black text-[#1A1F26] truncate">{user.name}</div>
                      <div className="text-3xs font-bold text-[#8A9099] truncate uppercase tracking-wide">
                        {user.isAnonymous ? 'Guest' : 'Member'}
                      </div>
                  </div>
              </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">

                <h2 className="text-3xl font-black text-[#1A1F26] mb-8 tracking-tighter">{t.tabs[activeTab]}</h2>

                {/* PROFILE SETTINGS */}
                {activeTab === 'profile' && (
                    <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Hero Section */}
                        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                            <div className="relative group cursor-pointer" onClick={() => !user.isAnonymous && fileInputRef.current?.click()}>
                                <div className="w-32 h-32 md:w-40 md:h-40 rounded-[40px] border-4 border-[#F8FAFC] shadow-2xl overflow-hidden bg-[#F8FAFC] relative transition-transform group-hover:scale-[1.02]">
                                    <Image src={user.avatarUrl || "/logo512.png"} alt="Avatar" width={160} height={160} className="w-full h-full object-cover" />
                                    {/* Overlay for upload */}
                                    {!user.isAnonymous && (
                                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                          <Camera className="w-8 h-8 text-white drop-shadow-md" />
                                      </div>
                                    )}
                                    {uploading && (
                                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-[#9e1316] animate-spin" />
                                        </div>
                                    )}
                                </div>
                                {!user.isAnonymous && (
                                  <div className="absolute -bottom-3 -right-3 p-3 bg-[#1A1F26] text-white rounded-2xl shadow-lg border-4 border-white">
                                      <Edit2 className="w-4 h-4" />
                                  </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            <div className="flex flex-col items-center md:items-start gap-1 flex-1">
                                <label className="text-2xs font-bold text-[#8A9099] uppercase tracking-widest pl-1">{t.nickname}</label>
                                {isEditingName ? (
                                    <div className="flex gap-3 w-full max-w-sm animate-in fade-in slide-in-from-left-2">
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="flex-1 bg-[#F8FAFC] border-2 border-[#E6E1DC] focus:border-[#9e1316] rounded-xl px-5 py-3 text-lg font-black text-[#1A1F26] outline-none transition-all placeholder:text-gray-300"
                                            autoFocus
                                            placeholder="Nickname"
                                            maxLength={16}
                                        />
                                        <button onClick={handleSaveName} className="p-4 bg-[#1A1F26] text-white rounded-xl hover:bg-[#9e1316] transition-colors shadow-lg active:scale-95">
                                            <Check className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsEditingName(true)}
                                        className="group flex items-center gap-3 px-2 py-1 -ml-2 rounded-xl hover:bg-[#F8FAFC] transition-all"
                                        title={t.clickToEdit}
                                    >
                                        <span className="text-4xl md:text-5xl font-black text-[#1A1F26] tracking-tighter">{user.name}</span>
                                        <Edit2 className="w-5 h-5 text-[#8A9099] opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                )}
                                <p className="text-xs font-medium text-[#8A9099] mt-1">
                                  {user.isAnonymous ? t.guestDesc : user.email}
                                </p>
                            </div>
                        </div>

                        {/* Avatars Section */}
                        <div className="space-y-8">
                            {customAvatars.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-[#1A1F26] uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#9e1316]"/> {t.myAvatars}
                                    </h3>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 md:gap-4">
                                        {customAvatars.map((url, idx) => (
                                            <div key={idx} className="relative group">
                                                <button
                                                    onClick={() => saveAvatar(url)}
                                                    className={`w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 ${user.avatarUrl === url ? 'border-[#9e1316] ring-4 ring-[#9e1316]/10 scale-105' : 'border-transparent hover:border-[#E6E1DC] hover:scale-105 shadow-sm'}`}
                                                >
                                                    <Image src={url} alt="Custom avatar" width={96} height={96} className="w-full h-full object-cover" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPendingDelete(url); }}
                                                    className="absolute -top-2 -right-2 p-1.5 bg-white text-red-500 border border-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-red-50 transform hover:scale-110"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-[#1A1F26] uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#E6E1DC]"/> {t.basicAvatars}
                                </h3>
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3 md:gap-4">
                                    {AVATAR_SEEDS.map((seed) => {
                                        const url = defaultAvatar(seed);
                                        const isSelected = user.avatarUrl === url;
                                        return (
                                            <button
                                                key={seed}
                                                onClick={() => handlePresetSelect(seed)}
                                                className={`w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 ${isSelected ? 'border-[#9e1316] bg-white ring-4 ring-[#9e1316]/10 scale-105 shadow-lg' : 'border-[#F8FAFC] bg-[#F8FAFC] hover:border-[#E6E1DC] hover:bg-white hover:scale-105'}`}
                                            >
                                                <Image src={url} alt={seed} width={96} height={96} className="w-full h-full object-cover" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* GENERAL SETTINGS */}
                {activeTab === 'general' && (
                    <div className="max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                         {/* Language */}
                         <div className="space-y-4">
                             <h3 className="text-sm font-bold text-[#1A1F26] uppercase tracking-wide flex items-center gap-2">
                                 <Globe className="w-4 h-4 text-[#8A9099]" /> {t.lang}
                             </h3>
                             <div className="grid grid-cols-2 gap-4">
                                 <button
                                    onClick={() => handleLangChange('en')}
                                    className={`relative p-5 rounded-2xl border-2 transition-all text-left overflow-hidden group ${currentLang === 'en' ? 'bg-white border-[#9e1316] text-[#1A1F26] shadow-xl ring-4 ring-[#9e1316]/5' : 'bg-[#F8FAFC] border-[#E6E1DC] text-[#8A9099] hover:border-[#E6E1DC] hover:text-[#1A1F26]'}`}
                                 >
                                     <span className="text-xs font-black uppercase tracking-wider relative z-10">English</span>
                                     {currentLang === 'en' && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#9e1316] rounded-full shadow-[0_0_8px_#9e1316]" />}
                                 </button>
                                 <button
                                    onClick={() => handleLangChange('ru')}
                                    className={`relative p-5 rounded-2xl border-2 transition-all text-left overflow-hidden group ${currentLang === 'ru' ? 'bg-white border-[#9e1316] text-[#1A1F26] shadow-xl ring-4 ring-[#9e1316]/5' : 'bg-[#F8FAFC] border-[#E6E1DC] text-[#8A9099] hover:border-[#E6E1DC] hover:text-[#1A1F26]'}`}
                                 >
                                     <span className="text-xs font-black uppercase tracking-wider relative z-10">Русский</span>
                                     {currentLang === 'ru' && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#9e1316] rounded-full shadow-[0_0_8px_#9e1316]" />}
                                 </button>
                             </div>
                         </div>

                         {/* Sound */}
                         <div className="space-y-4">
                             <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-[#1A1F26] uppercase tracking-wide flex items-center gap-2">
                                    <Volume2 className="w-4 h-4 text-[#8A9099]" /> {t.sound}
                                </h3>
                                <span className="text-xs font-black text-[#1A1F26] bg-[#F8FAFC] px-2 py-1 rounded-lg border border-[#E6E1DC]">{volume}%</span>
                             </div>
                             <div className="h-10 bg-[#F8FAFC] rounded-2xl border border-[#E6E1DC] flex items-center px-4 relative">
                                 <div className="absolute left-4 right-4 h-1.5 bg-[#E6E1DC] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#1A1F26] rounded-full" style={{ width: `${volume}%` }} />
                                 </div>
                                 <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={volume}
                                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                    className="w-full h-full opacity-0 cursor-pointer z-10"
                                 />
                             </div>
                         </div>
                    </div>
                )}

                {/* ACCOUNT SETTINGS */}
                {activeTab === 'account' && (
                    <div className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                         {!user.isAnonymous ? (
                             <>
                                <div className="bg-[#F8FAFC] p-6 rounded-3xl border border-[#E6E1DC] flex items-center gap-5">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-[#E6E1DC] text-[#1A1F26] shadow-sm">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-2xs font-bold text-[#8A9099] uppercase tracking-wider mb-1">Email Address</div>
                                        <div className="text-lg font-bold text-[#1A1F26]">{user.email}</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-[#1A1F26] uppercase tracking-wide flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-[#8A9099]" /> {t.changePass}
                                    </h3>
                                    <button
                                        onClick={handleEmailReset}
                                        disabled={loading || resetCooldown > 0}
                                        className="w-full py-5 bg-white hover:bg-[#F8FAFC] text-[#1A1F26] rounded-2xl border border-[#E6E1DC] shadow-sm hover:shadow-md hover:border-[#9e1316]/30 transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 group"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#9e1316]" /> : <Mail className="w-4 h-4 text-[#8A9099] group-hover:text-[#9e1316] transition-colors" />}
                                        {resetCooldown > 0 ? `${t.wait} ${resetCooldown} ${t.sec}` : t.sendReset}
                                    </button>
                                </div>

                                <div className="pt-8 border-t border-[#F1F5F9]">
                                    <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} className="w-full py-4 text-[#8A9099] font-bold text-xs uppercase tracking-widest hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all flex items-center justify-center gap-2">
                                        <LogOut className="w-4 h-4" /> {t.logout}
                                    </button>
                                </div>
                             </>
                         ) : (
                             <div className="flex flex-col items-center justify-center h-full py-10 text-center space-y-6 opacity-80">
                                 <div className="w-24 h-24 bg-[#F8FAFC] rounded-full flex items-center justify-center border-2 border-dashed border-[#E6E1DC]">
                                     <User className="w-10 h-10 text-[#8A9099]" />
                                 </div>
                                 <div>
                                     <h3 className="text-xl font-black text-[#1A1F26] mb-2">{t.guest}</h3>
                                     <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto leading-relaxed">{t.guestDesc}</p>
                                 </div>
                                 <button onClick={onClose} className="px-10 py-4 bg-[#1A1F26] text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg">OK</button>
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>

        {/* Delete-avatar confirmation (replaces the native confirm dialog) */}
        {pendingDelete && (
          <div
            className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A1F26]/50 backdrop-blur-sm animate-in fade-in duration-200 rounded-[40px]"
            onClick={() => setPendingDelete(null)}
          >
            <div
              className="bg-white p-7 rounded-3xl w-full max-w-xs text-center shadow-2xl border border-[#E6E1DC] animate-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#1A1F26] uppercase mb-1">{t.deleteConfirmTitle}</h3>
              <p className="text-xs font-bold text-[#8A9099] mb-6">{t.deleteConfirmDesc}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 py-3 bg-[#F8FAFC] text-[#1A1F26] border border-[#E6E1DC] rounded-xl font-bold uppercase text-xs hover:bg-[#E6E1DC] transition-colors"
                >
                  {t.cancelDelete}
                </button>
                <button
                  onClick={confirmDeleteAvatar}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold uppercase text-xs hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  {t.confirmDelete}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}