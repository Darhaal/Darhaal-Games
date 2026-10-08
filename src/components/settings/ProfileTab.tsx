'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Images, Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { defaultAvatar } from '@/constants/app';
import type { UiUser } from '@/types/user';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL } from '@/components/game/ui';
import { FormNote, INPUT } from './controls';
import type { SettingsText } from './text';

const AVATAR_SEEDS = ['Felix', 'Aneka', 'Zack', 'Midnight', 'Luna', 'Shadow', 'Gamer', 'Pro', 'Sky', 'River', 'Ember', 'Bear', 'Fox', 'Wolf'];

/** Saves a name through the profile row first: its trigger is what refuses a registered player's name. */
export async function saveUsername(userId: string, name: string): Promise<'saved' | 'taken'> {
  const { data: taken } = await supabase.rpc('username_taken', { p_username: name });
  if (taken) return 'taken';
  const { error } = await supabase.from('profiles').update({ username: name }).eq('id', userId);
  if (error) {
    if (error.code === '23505') return 'taken';
    throw error;
  }
  await supabase.auth.updateUser({ data: { username: name } });
  return 'saved';
}

export default function ProfileTab({ t, user, onProfileUpdate }: {
  t: SettingsText;
  user: UiUser;
  onProfileUpdate: (updates: { name?: string; avatarUrl?: string }) => void;
}) {
  const [username, setUsername] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [customAvatars, setCustomAvatars] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCustomAvatars = useCallback(async () => {
    if (user.isAnonymous) return;
    const { data, error } = await supabase.storage.from('avatars').list('', { search: user.id });
    if (!error && data) {
      // created_at is nullable on a storage object. `new Date(null)` silently
      // becomes the epoch, which would bury an undated upload at the bottom of
      // the list instead of treating it as unknown — so guard it explicitly.
      const uploadedAt = (file: { created_at: string | null }) =>
        file.created_at ? new Date(file.created_at).getTime() : 0;
      const sorted = [...data].sort((a, b) => uploadedAt(b) - uploadedAt(a));
      setCustomAvatars(sorted.map(file => supabase.storage.from('avatars').getPublicUrl(file.name).data.publicUrl));
    }
  }, [user.id, user.isAnonymous]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchCustomAvatars is async; its setState runs after the storage call resolves, not synchronously
    fetchCustomAvatars();
  }, [fetchCustomAvatars]);

  const trimmedName = username.trim();
  const nameChanged = trimmedName.length > 0 && trimmedName !== user.name;

  const handleSaveName = async () => {
    if (!nameChanged || savingName) return;
    if (trimmedName.length < 2) { setNameError(t.nameShort); return; }
    setSavingName(true);
    setNameError(null);
    try {
      if (await saveUsername(user.id, trimmedName) === 'taken') {
        setNameError(t.nameTaken);
        return;
      }
      onProfileUpdate({ name: trimmedName });
      setUsername(trimmedName);
    } catch (e: unknown) {
      showToast(`${t.saveError}: ${errorMessage(e)}`, 'error');
    } finally {
      setSavingName(false);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || user.isAnonymous) return;
    const file = e.target.files[0];
    // Let the same file be picked again after a failure or a delete
    e.target.value = '';
    if (file.size > 2 * 1024 * 1024) {
      showToast(t.fileTooLarge, 'error');
      return;
    }
    setUploading(true);
    const fileName = `${user.id}-${Date.now()}.${file.name.split('.').pop()}`;
    try {
      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await fetchCustomAvatars();
      await saveAvatar(data.publicUrl);
    } catch (err: unknown) {
      showToast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteAvatar = async () => {
    const url = pendingDelete;
    setPendingDelete(null);
    const fileName = url?.split('/').pop();
    if (!url || !fileName) return;
    await supabase.storage.from('avatars').remove([fileName]);
    await fetchCustomAvatars();
    if (user.avatarUrl === url) saveAvatar(defaultAvatar(user.id));
  };

  /** One avatar in a grid: ringed in ink when it is the current one. */
  const avatarTile = (url: string, alt: string) => {
    const selected = user.avatarUrl === url;
    return (
      <button
        type="button"
        onClick={() => saveAvatar(url)}
        aria-pressed={selected}
        aria-label={alt}
        className={`relative w-full aspect-square rounded-xl overflow-hidden border bg-page transition-all ${
          selected
            ? 'border-ink ring-2 ring-ink ring-offset-2 ring-offset-surface'
            : 'border-line hover:border-accent/30 hover:-translate-y-0.5 hover:shadow-sm'
        }`}
      >
        <Image src={url} alt="" width={96} height={96} className="w-full h-full object-cover" />
        {selected && (
          <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-ink text-on-ink flex items-center justify-center">
            <Check className="w-2.5 h-2.5" strokeWidth={4} />
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <section className="flex items-start gap-4 sm:gap-5">
        <div className="relative shrink-0">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-line bg-page overflow-hidden shadow-sm">
            <Image src={user.avatarUrl || '/logo512.png'} alt="" width={160} height={160} className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-surface/80 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            )}
          </div>
          {!user.isAnonymous && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label={t.uploadPhoto}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-ink text-on-ink border-2 border-surface shadow-md flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-60"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 pt-1">
          <label htmlFor="settings-name" className={`${LABEL} block mb-1.5`}>{t.nickname}</label>
          <div className="flex gap-2">
            <input
              id="settings-name"
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setNameError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
              maxLength={16}
              autoComplete="nickname"
              spellCheck={false}
              className={INPUT}
            />
            {nameChanged && (
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName}
                aria-label={t.save}
                className={`${BUTTON_PRIMARY} shrink-0 px-3 sm:px-4 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200`}
              >
                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span className="hidden sm:inline">{t.save}</span>
              </button>
            )}
          </div>
          {nameError
            ? <FormNote tone="error">{nameError}</FormNote>
            : <p className="mt-2 text-xs font-medium text-muted truncate">{user.isAnonymous ? t.guestBadge : user.email}</p>}
        </div>
      </section>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className={`${LABEL} flex items-center gap-2`}>
            <Images className="w-3.5 h-3.5" /> {t.avatar}
          </h3>
          {!user.isAnonymous && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`${BUTTON_SECONDARY} group px-3 py-1.5 rounded-lg text-2xs flex items-center gap-1.5`}
            >
              <Upload className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" /> {t.upload}
            </button>
          )}
        </div>

        {customAvatars.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-muted mb-2">{t.myAvatars}</p>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2.5">
              {customAvatars.map((url) => (
                <div key={url} className="relative group">
                  {avatarTile(url, t.myAvatars)}
                  <button
                    type="button"
                    onClick={() => setPendingDelete(url)}
                    aria-label={t.deleteAvatar}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-lg bg-surface border border-line text-muted shadow-sm flex items-center justify-center hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs font-bold text-muted mb-2">{t.basicAvatars}</p>
        <div className="grid grid-cols-5 sm:grid-cols-7 gap-2.5">
          {AVATAR_SEEDS.map((seed) => (
            <React.Fragment key={seed}>{avatarTile(defaultAvatar(seed), seed)}</React.Fragment>
          ))}
        </div>
      </section>

      {pendingDelete && (
        <ConfirmDialog
          title={t.deleteConfirmTitle}
          description={t.deleteConfirmDesc}
          cancel={t.cancel}
          confirm={t.confirmDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDeleteAvatar}
        />
      )}
    </>
  );
}

/**
 * The in-app confirmation, above the settings. Portalled to <body>: the tab
 * content animates in with a transform, which would otherwise become the
 * containing block of a fixed overlay.
 */
export function ConfirmDialog({ title, description, cancel, confirm, onCancel, onConfirm, busy, disabled, children }: {
  title: string;
  description: React.ReactNode;
  cancel: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  // Escape closes this dialog only — caught before the settings' own handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-scrim/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-surface p-6 rounded-[24px] w-full max-w-sm text-center shadow-2xl border border-line animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mx-auto mb-4 border border-red-100">
          <Trash2 className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-black text-ink mb-1">{title}</h3>
        <div className="text-sm font-medium text-muted mb-5 leading-snug">{description}</div>
        {children}
        <div className="flex gap-2.5">
          <button type="button" onClick={onCancel} className={`${BUTTON_SECONDARY} flex-1 py-3`}>
            {cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || disabled}
            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black uppercase text-xs tracking-wide hover:bg-red-600 transition-colors disabled:opacity-40 disabled:hover:bg-red-500 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
