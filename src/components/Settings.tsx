'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import React, { useEffect, useState } from 'react';
import { X, User, Shield, SlidersHorizontal, Settings as SettingsIcon } from 'lucide-react';
import type { UiUser } from '@/types/user';
import { useEscape } from '@/hooks/useEscape';
import { SETTINGS_TEXT } from '@/components/settings/text';
import ProfileTab from '@/components/settings/ProfileTab';
import GeneralTab from '@/components/settings/GeneralTab';
import AccountTab from '@/components/settings/AccountTab';

type Lang = 'ru' | 'en' | 'uk';
type Tab = 'profile' | 'general' | 'account';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  user: UiUser;
  currentLang: Lang;
  setLang: (lang: Lang) => void;
  onProfileUpdate: (updates: { name?: string; avatarUrl?: string }) => void;
}

const TABS: { id: Tab; icon: typeof User }[] = [
  { id: 'profile', icon: User },
  { id: 'general', icon: SlidersHorizontal },
  { id: 'account', icon: Shield },
];

export default function Settings({ isOpen, onClose, user, currentLang, setLang, onProfileUpdate }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Sub-dialogs catch Escape first (capture phase), so this only closes the panel
  useEscape(isOpen, onClose);

  // The page behind a modal does not scroll — on a phone it otherwise moves
  // under the sheet as soon as a swipe overshoots the content.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  // Portal to <body>: the trigger lives inside blurred sticky headers whose
  // backdrop-filter creates a containing block for position:fixed, which would
  // otherwise clip this modal. document.body only exists on the client.
  if (!isOpen || typeof document === 'undefined') return null;

  const t = SETTINGS_TEXT[currentLang];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4 bg-scrim/50 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
      onClick={onClose}
    >
      {/* A sheet from the bottom on a phone, a centred panel from sm up */}
      <div
        className="relative w-full sm:max-w-3xl h-[92svh] sm:h-[min(640px,calc(100svh_-_2rem))] bg-surface rounded-t-3xl sm:rounded-3xl border border-line shadow-2xl shadow-shade/5 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-divider shrink-0">
          <div className="w-10 h-10 rounded-xl bg-page border border-line text-ink flex items-center justify-center shrink-0">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-ink tracking-tight leading-none">{t.title}</h2>
            <p className="mt-1 text-xs font-medium text-muted truncate">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="group p-2.5 bg-surface border border-line rounded-xl hover:border-accent/30 hover:shadow-sm transition-all shrink-0"
          >
            <X className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* TABS — a segmented row on a phone, a side list from sm up */}
          <nav className="shrink-0 px-5 pt-4 sm:p-4 sm:w-56 sm:bg-page sm:border-r sm:border-divider flex flex-col">
            <div
              role="tablist"
              aria-label={t.title}
              className="grid grid-cols-3 gap-1 p-1 bg-page border border-line rounded-xl sm:flex sm:flex-col sm:p-0 sm:bg-transparent sm:border-0"
            >
              {TABS.map(({ id, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(id)}
                    className={`group flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border text-xs font-bold transition-all min-w-0 ${
                      active
                        ? 'bg-surface text-ink border-line shadow-sm'
                        : 'border-transparent text-muted hover:text-ink sm:hover:bg-surface/70'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-accent' : ''}`} />
                    <span className="truncate">{t.tabs[id]}</span>
                  </button>
                );
              })}
            </div>

            {/* Who is signed in — the phone shows it on the Profile tab instead */}
            <div className="mt-auto hidden sm:flex items-center gap-3 p-3 rounded-2xl bg-surface border border-line shadow-sm">
              <div className="w-9 h-9 rounded-full bg-page border border-line overflow-hidden shrink-0">
                <Image src={user.avatarUrl || '/logo512.png'} alt="" width={72} height={72} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-ink truncate">{user.name}</div>
                <div className="text-3xs font-bold text-muted uppercase tracking-widest truncate">
                  {user.isAnonymous ? t.guestBadge : t.member}
                </div>
              </div>
            </div>
          </nav>

          {/* CONTENT */}
          <div role="tabpanel" aria-label={t.tabs[activeTab]} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 sm:px-8 py-5 sm:py-7">
            <div key={activeTab} className="max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {activeTab === 'profile' && <ProfileTab t={t} user={user} onProfileUpdate={onProfileUpdate} />}
              {activeTab === 'general' && <GeneralTab t={t} currentLang={currentLang} setLang={setLang} />}
              {activeTab === 'account' && <AccountTab t={t} user={user} onProfileUpdate={onProfileUpdate} />}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
