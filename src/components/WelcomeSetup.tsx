'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { defaultAvatar } from '@/constants/app';
import { errorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { useLang } from '@/hooks/useLang';
import type { UiUser } from '@/types/user';

/**
 * First-run prompt: pick a nickname and an avatar.
 *
 * Guests arrive as "Player" with whatever avatar the signup trigger generated,
 * and some OAuth accounts land with a provider display name nobody recognises
 * in a lobby. Rather than silently leaving them like that, offer the choice
 * once — and let it be skipped, since nothing here is required to play.
 *
 * Shown at most once per account: completing it or skipping it both set the
 * `onboarded` metadata flag. See `needsWelcomeSetup` for the trigger rule.
 */

const T = {
  ru: {
    title: 'Как вас звать?',
    lead: 'Это имя увидят другие игроки в лобби. Его можно поменять в любой момент в настройках.',
    placeholder: 'Ваш никнейм',
    reroll: 'Другая аватарка',
    save: 'Сохранить',
    skip: 'Пропустить',
    taken: 'Имя занято',
    tooShort: 'Минимум 2 символа',
    saved: 'Готово!'
  },
  en: {
    title: 'What should we call you?',
    lead: 'This is the name other players see in the lobby. You can change it any time in settings.',
    placeholder: 'Your nickname',
    reroll: 'Another avatar',
    save: 'Save',
    skip: 'Skip',
    taken: 'Username taken',
    tooShort: 'At least 2 characters',
    saved: 'All set!'
  }
} as const;

/**
 * Whether this account should be offered the setup.
 *
 * `Player` is the placeholder the signup trigger writes when no name came from
 * the provider, so it counts as "not chosen". A real user who deliberately
 * picks "Player" simply sees the prompt once and can skip it.
 */
export function needsWelcomeSetup(user: UiUser | null): boolean {
  if (!user) return false;
  if (user.user_metadata?.onboarded) return false;
  const name = (user.user_metadata?.username || '').trim();
  return name === '' || name === 'Player';
}

export default function WelcomeSetup({
  user,
  onDone
}: {
  user: UiUser;
  onDone: (updates: { name?: string; avatarUrl?: string }) => void;
}) {
  const { lang } = useLang();
  const t = T[lang];

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(user.avatarUrl || defaultAvatar(user.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reroll = () => setAvatar(defaultAvatar(Math.random().toString(36).slice(2)));

  /** Mark the prompt as answered so it never appears for this account again. */
  const markOnboarded = (extra: Record<string, unknown> = {}) =>
    supabase.auth.updateUser({ data: { onboarded: true, ...extra } });

  const handleSkip = async () => {
    setSaving(true);
    try {
      // The avatar is kept even on skip — it is already on screen, and leaving
      // the account without one is the problem this prompt exists to avoid.
      await markOnboarded({ avatar_url: avatar });
      await supabase.from('profiles').update({ avatar_url: avatar }).eq('id', user.id);
      onDone({ avatarUrl: avatar });
    } catch {
      onDone({});
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t.tooShort);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Same uniqueness check the sign-up form performs.
      const { data: taken } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmed)
        .neq('id', user.id)
        .maybeSingle();

      if (taken) {
        setError(t.taken);
        setSaving(false);
        return;
      }

      await markOnboarded({ username: trimmed, avatar_url: avatar });
      await supabase
        .from('profiles')
        .update({ username: trimmed, avatar_url: avatar })
        .eq('id', user.id);

      showToast(t.saved, 'success');
      onDone({ name: trimmed, avatarUrl: avatar });
    } catch (e: unknown) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1A1F26]/40 backdrop-blur-sm">
      <div className="w-full max-w-[380px] bg-white border border-[#E6E1DC] rounded-[32px] shadow-2xl p-8 relative">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#F8FAFC] border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
              <Image src={avatar} alt="" width={96} height={96} className="w-full h-full object-cover" unoptimized />
            </div>
            <Sparkles className="w-5 h-5 text-[#9e1316] absolute -top-1 -right-1 animate-pulse" />
          </div>

          <button
            type="button"
            onClick={reroll}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-[#8A9099] hover:text-[#9e1316] transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" /> {t.reroll}
          </button>

          <h2 className="mt-5 text-2xl font-black tracking-tighter text-[#1A1F26]">{t.title}</h2>
          <p className="mt-2 text-sm text-[#8A9099] font-medium leading-relaxed">{t.lead}</p>
        </div>

        <div className="mt-6">
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saving) handleSave();
            }}
            maxLength={20}
            placeholder={t.placeholder}
            disabled={saving}
            className="w-full bg-[#F8FAFC] border border-[#E6E1DC] rounded-2xl px-4 py-3.5 text-center text-base font-bold text-[#1A1F26] placeholder:text-[#8A9099]/60 placeholder:font-medium focus:outline-none focus:border-[#9e1316]/40 focus:bg-white transition-colors disabled:opacity-60"
          />
          {error && (
            <p className="mt-2 text-center text-xs font-bold text-[#9e1316]">{error}</p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full bg-[#1A1F26] text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#9e1316] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t.save}
        </button>

        <button
          onClick={handleSkip}
          disabled={saving}
          className="mt-2 w-full py-2 text-2xs font-bold uppercase tracking-widest text-[#8A9099] hover:text-[#1A1F26] transition-colors disabled:opacity-50"
        >
          {t.skip}
        </button>
      </div>
    </div>
  );
}
