'use client';

import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Settings from '@/components/Settings';
import { useLang } from '@/hooks/useLang';
import { defaultAvatar } from '@/constants/app';
import type { UiUser } from '@/types/user';

/**
 * Self-contained settings entry point for secondary pages (/play, /create,
 * /achievements). Renders a gear button and opens the shared Settings modal
 * (which portals to document.body, so it is never clipped by the blurred
 * sticky headers these pages use).
 */
export default function SettingsButton() {
  const [user, setUser] = useState<UiUser | null>(null);
  const [open, setOpen] = useState(false);
  const { lang, setLang } = useLang();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setUser({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.username || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Player',
        avatarUrl: u.user_metadata?.avatar_url || defaultAvatar(u.id),
        isAnonymous: u.is_anonymous,
        user_metadata: u.user_metadata,
        created_at: u.created_at
      });
    });
  }, []);

  const handleProfileUpdate = (updates: { name?: string; avatarUrl?: string }) => {
    setUser(prev => prev && ({
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

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group p-2.5 md:p-3 bg-surface border border-line rounded-xl hover:border-accent/30 hover:shadow-sm transition-all"
        title="Settings"
        aria-label="Settings"
      >
        <SettingsIcon className="w-4 h-4 md:w-5 md:h-5 text-muted group-hover:text-accent group-hover:rotate-90 transition-all duration-500" />
      </button>

      <Settings
        isOpen={open}
        onClose={() => setOpen(false)}
        user={user}
        currentLang={lang}
        setLang={setLang}
        onProfileUpdate={handleProfileUpdate}
      />
    </>
  );
}
