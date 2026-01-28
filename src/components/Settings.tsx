'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Volume2, Music, Globe, Shield, User, Mail, Upload, Loader2, Trash2, Check, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Lang = 'ru' | 'en';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  currentLang: Lang;
  setLang: (lang: Lang) => void;
  onProfileUpdate: (updates: { name?: string; avatarUrl?: string }) => void;
}

const AVATAR_SEEDS = ['Felix', 'Aneka', 'Zack', 'Midnight', 'Luna', 'Shadow', 'Gamer', 'Pro', 'Sky', 'River', 'Ember'];

export default function Settings({ isOpen, onClose, user, currentLang, setLang, onProfileUpdate }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'profile' | 'security'>('general');
  const [volume, setVolume] = useState(80);
  const [music, setMusic] = useState(50);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [customAvatars, setCustomAvatars] = useState<string[]>([]);

  // Никнейм
  const [username, setUsername] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // Синхронизация локального стейта
  useEffect(() => {
    if (user && user.name) {
      setUsername(user.name);
    }
  }, [user]);

  const fetchCustomAvatars = useCallback(async () => {
    if (!user || user.isAnonymous) return;
    const { data, error } = await supabase.storage.from('avatars').list('', { search: user.id });
    if (!error && data) {
      const urls = data.map(file => supabase.storage.from('avatars').getPublicUrl(file.name).data.publicUrl);
      setCustomAvatars(urls);
    }
  }, [user]);

  useEffect(() => { if (isOpen) fetchCustomAvatars(); }, [isOpen, fetchCustomAvatars]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resetCooldown > 0) interval = setInterval(() => setResetCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [resetCooldown]);

  if (!isOpen) return null;

  const t = {
    ru: {
      title: 'Система',
      tabs: { general: 'Общие', profile: 'Профиль', security: 'Доступ' },
      lang: 'Язык',
      sound: 'Звук',
      music: 'Музыка',
      upload: 'Загрузить фото',
      deleteHint: 'ПКМ — удалить',
      changePass: 'Смена пароля',
      passDesc: 'Мы отправим ссылку для сброса на вашу почту.',
      sendReset: 'Сбросить',
      resetSent: 'Письмо отправлено',
      guest: 'Недоступно для гостей',
      wait: 'Ждите',
      sec: 'с',
      myAvatars: 'Загруженные',
      basicAvatars: 'Стандартные',
      nickname: 'Имя в игре',
      save: 'Сохранить',
      cancel: 'Отмена'
    },
    en: {
      title: 'Settings',
      tabs: { general: 'General', profile: 'Profile', security: 'Account' },
      lang: 'Language',
      sound: 'Sound',
      music: 'Music',
      upload: 'Upload Photo',
      deleteHint: 'Right click to delete',
      changePass: 'Change Password',
      passDesc: 'We will send a reset link to your email.',
      sendReset: 'Reset',
      resetSent: 'Email sent',
      guest: 'Not available for guests',
      wait: 'Wait',
      sec: 's',
      myAvatars: 'Uploaded',
      basicAvatars: 'Standard',
      nickname: 'Display Name',
      save: 'Save',
      cancel: 'Cancel'
    }
  }[currentLang];

  const handleLangChange = (lang: Lang) => {
    setLang(lang);
    localStorage.setItem('dg_lang', lang);
  };

  const handleSaveName = async () => {
    if (!username.trim() || user.isAnonymous) return;
    if (username === user.name) {
        setIsEditingName(false);
        return;
    }

    setSavingName(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ data: { username: username } });
      if (authError) throw authError;

      await supabase.from('profiles').update({ username: username }).eq('id', user.id);

      onProfileUpdate({ name: username });
      setIsEditingName(false);
    } catch (e: any) {
      alert('Error updating name: ' + e.message);
    } finally {
      setSavingName(false);
    }
  };

  const saveAvatar = async (url: string) => {
    if (user.isAnonymous) return;
    try {
      onProfileUpdate({ avatarUrl: url });
      await Promise.all([
        supabase.auth.updateUser({ data: { avatar_url: url } }),
        supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
      ]);
    } catch (error) {
      console.error('Save failed', error);
    }
  };

  const handlePresetSelect = (seed: string) => {
    saveAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=transparent`);
  };

  const handleCustomSelect = (url: string) => saveAvatar(url);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    const file = e.target.files[0];
    const fileName = `${user.id}-${Date.now()}.${file.name.split('.').pop()}`;
    try {
      await supabase.storage.from('avatars').upload(fileName, file);
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await fetchCustomAvatars();
      await saveAvatar(data.publicUrl);
    } catch (e: any) { alert(e.message); } finally { setUploading(false); }
  };

  const handleDeleteCustomAvatar = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    if (!confirm(currentLang === 'ru' ? 'Удалить этот аватар?' : 'Delete this avatar?')) return;
    const fileName = url.split('/').pop();
    if (!fileName) return;
    await supabase.storage.from('avatars').remove([fileName]);
    await fetchCustomAvatars();
    if (user.avatarUrl === url) saveAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}&backgroundColor=transparent`);
  };

  const handleEmailReset = async () => {
    if (!user.email || resetCooldown > 0) return;
    setLoading(true);

    const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : 'https://online-games-phi.vercel.app';
    const redirectTo = `${baseUrl}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });

    if (error) alert(error.message);
    else { alert(t.resetSent); setResetCooldown(60); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="w-full max-w-3xl bg-white rounded-[32px] shadow-2xl shadow-[#1A1F26]/20 overflow-hidden flex flex-col md:flex-row h-[600px] text-[#1A1F26] border border-[#E6E1DC]">

        {/* Sidebar */}
        <div className="w-full md:w-64 bg-[#F5F5F0] p-8 border-b md:border-b-0 md:border-r border-[#E6E1DC] flex flex-row md:flex-col gap-3">
          <div className="hidden md:flex items-center gap-2 text-lg font-black text-[#1A1F26] mb-8 px-2 tracking-tight">
            <img src="/logo512.png" alt="Logo" className="w-6 h-6 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            Darhaal<span className="text-[#9e1316]">System</span>
          </div>

          {[
            { id: 'general', icon: Volume2, label: t.tabs.general },
            { id: 'profile', icon: User, label: t.tabs.profile },
            { id: 'security', icon: Shield, label: t.tabs.security },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 md:flex-none p-3 rounded-xl flex items-center gap-3 transition-all text-left text-xs font-bold uppercase tracking-wider
                ${activeTab === tab.id
                  ? 'bg-white text-[#9e1316] shadow-md shadow-[#9e1316]/5 ring-1 ring-[#E6E1DC]'
                  : 'text-[#8A9099] hover:bg-white/60 hover:text-[#1A1F26]'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-10 relative overflow-y-auto custom-scrollbar">
          <button onClick={onClose} className="absolute top-8 right-8 p-2 text-[#8A9099] hover:text-[#9e1316] hover:bg-[#F5F5F0] rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-3xl font-black text-[#1A1F26] mb-8 tracking-tight">{t.tabs[activeTab]}</h2>

          {/* GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4">
                <label className="text-xs font-bold text-[#8A9099] uppercase tracking-wider flex items-center gap-2">
                  <Globe className="w-4 h-4" /> {t.lang}
                </label>
                <div className="flex gap-4">
                  <button onClick={() => handleLangChange('en')} className={`px-6 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${currentLang === 'en' ? 'bg-[#1A1F26] text-white border-[#1A1F26] shadow-lg shadow-[#1A1F26]/20' : 'bg-white text-[#8A9099] border-[#E6E1DC] hover:border-[#1A1F26] hover:text-[#1A1F26]'}`}>
                    English
                  </button>
                  <button onClick={() => handleLangChange('ru')} className={`px-6 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${currentLang === 'ru' ? 'bg-[#1A1F26] text-white border-[#1A1F26] shadow-lg shadow-[#1A1F26]/20' : 'bg-white text-[#8A9099] border-[#E6E1DC] hover:border-[#1A1F26] hover:text-[#1A1F26]'}`}>
                    Русский
                  </button>
                </div>
              </div>

              <div className="space-y-8 pt-8 border-t border-[#F5F5F0]">
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-bold text-[#8A9099] uppercase tracking-wider">
                    <span className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> {t.sound}</span>
                    <span className="text-[#1A1F26] font-black text-sm">{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full h-2 bg-[#F5F5F0] rounded-full appearance-none cursor-pointer accent-[#9e1316]"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-bold text-[#8A9099] uppercase tracking-wider">
                    <span className="flex items-center gap-2"><Music className="w-4 h-4" /> {t.music}</span>
                    <span className="text-[#1A1F26] font-black text-sm">{music}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={music}
                    onChange={(e) => setMusic(Number(e.target.value))}
                    className="w-full h-2 bg-[#F5F5F0] rounded-full appearance-none cursor-pointer accent-[#9e1316]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              {!user.isAnonymous && (
                <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-[#E6E1DC] flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#8A9099] uppercase tracking-wider">{t.nickname}</label>
                    {!isEditingName && (
                      <button onClick={() => setIsEditingName(true)} className="text-[#9e1316] hover:text-[#7a0f11] transition-colors p-1">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isEditingName ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="flex-1 bg-white border border-[#E6E1DC] rounded-xl px-4 py-2 text-sm font-bold text-[#1A1F26] focus:outline-none focus:border-[#9e1316] focus:ring-2 focus:ring-[#9e1316]/10 transition-all"
                        placeholder="New nickname"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={savingName || !username.trim()}
                        className="bg-[#1A1F26] hover:bg-[#9e1316] text-white p-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                      >
                        {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { setIsEditingName(false); setUsername(user.name); }}
                        className="bg-white border border-[#E6E1DC] hover:border-[#8A9099] text-[#8A9099] hover:text-[#1A1F26] p-2.5 rounded-xl transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-xl font-black text-[#1A1F26] tracking-tight">{user.name}</div>
                  )}
                </div>
              )}

              {/* ... (остальной код аватаров) ... */}
              {!user.isAnonymous && (
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs text-[#8A9099] font-bold uppercase tracking-wider pl-1">{t.deleteHint}</span>
                  <label className="flex items-center gap-2 bg-[#1A1F26] hover:bg-[#9e1316] text-white px-6 py-3 rounded-xl cursor-pointer transition-all text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#1A1F26]/20 hover:shadow-[#9e1316]/30 transform active:scale-95">
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {t.upload}
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                  </label>
                </div>
              )}

              {customAvatars.length > 0 && (
                <div>
                   <h3 className="text-xs font-bold text-[#8A9099] uppercase tracking-wider mb-4 flex items-center gap-2">
                      {t.myAvatars} <span className="bg-[#F5F5F0] text-[#1A1F26] px-2 py-0.5 rounded-md text-[10px]">{customAvatars.length}</span>
                   </h3>
                   <div className="grid grid-cols-5 gap-4">
                      {customAvatars.map((url, idx) => (
                        <div key={`custom-${idx}`} className="relative group aspect-square">
                          <button
                            onClick={() => handleCustomSelect(url)}
                            onContextMenu={(e) => handleDeleteCustomAvatar(e, url)}
                            className={`w-full h-full rounded-2xl overflow-hidden border-2 transition-all duration-300 ${user.avatarUrl === url ? 'border-[#9e1316] shadow-xl shadow-[#9e1316]/20 scale-105' : 'border-[#F5F5F0] hover:border-[#1A1F26] hover:scale-105'}`}
                          >
                            <img src={url} alt="Custom" className="w-full h-full object-cover" />
                          </button>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              <div>
                 <h3 className="text-xs font-bold text-[#8A9099] uppercase tracking-wider mb-4 border-t border-[#F5F5F0] pt-6">
                    {t.basicAvatars}
                 </h3>
                 <div className="grid grid-cols-5 gap-4">
                    {AVATAR_SEEDS.map((seed) => {
                      const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=transparent`;
                      return (
                        <button
                          key={seed}
                          onClick={() => handlePresetSelect(seed)}
                          disabled={user.isAnonymous}
                          className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 ${user.avatarUrl === url ? 'border-[#9e1316] shadow-xl shadow-[#9e1316]/20 scale-105' : 'border-[#F5F5F0] hover:border-[#1A1F26] hover:scale-105'} ${user.isAnonymous ? 'opacity-50 grayscale' : ''}`}
                        >
                          <img src={url} alt={seed} className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                 </div>
              </div>

              {user.isAnonymous && (
                 <p className="text-xs font-bold text-[#9e1316] bg-[#9e1316]/5 p-4 rounded-xl border border-[#9e1316]/20 text-center uppercase tracking-wide">
                    {t.guest}
                 </p>
              )}
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              {user.isAnonymous ? (
                <div className="p-10 rounded-3xl bg-[#F5F5F0] border border-[#E6E1DC] text-[#8A9099] flex flex-col items-center text-center gap-4">
                  <Shield className="w-12 h-12 opacity-20" />
                  <p className="font-bold uppercase tracking-widest text-sm">{t.guest}</p>
                </div>
              ) : (
                <>
                  <div className="p-6 rounded-3xl bg-[#F5F5F0] border border-[#E6E1DC] flex items-center gap-5">
                    <div className="w-12 h-12 rounded-full bg-white border border-[#E6E1DC] flex items-center justify-center text-[#8A9099] shadow-sm">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8A9099] uppercase font-bold tracking-wider mb-1">Email</div>
                      <div className="text-[#1A1F26] font-bold text-lg">{user.email}</div>
                    </div>
                  </div>

                  <div className="space-y-6 pt-8 border-t border-[#F5F5F0]">
                    <h3 className="text-sm font-bold text-[#1A1F26] flex items-center gap-2 uppercase tracking-wide">
                      <Shield className="w-4 h-4 text-[#9e1316]" /> {t.changePass}
                    </h3>

                    <div className="bg-white p-8 rounded-3xl border border-[#E6E1DC] space-y-6 shadow-sm">
                      <p className="text-sm text-[#8A9099] font-medium leading-relaxed">
                        {t.passDesc}
                      </p>

                      <button
                          onClick={handleEmailReset}
                          disabled={loading || resetCooldown > 0}
                          className="w-full py-4 bg-white hover:bg-[#F5F5F0] text-[#1A1F26] rounded-xl border border-[#E6E1DC] shadow-sm hover:shadow-md hover:border-[#9e1316] transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none"
                      >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#9e1316]" /> : <Mail className="w-4 h-4 text-[#8A9099]" />}
                          {resetCooldown > 0
                            ? `${t.wait} ${resetCooldown} ${t.sec}`
                            : t.sendReset}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}