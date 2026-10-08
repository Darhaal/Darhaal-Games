'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, LogIn, LogOut, Mail, Save, Shield, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import type { UiUser } from '@/types/user';
import { BUTTON_DANGER_QUIET, BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL } from '@/components/game/ui';
import { FormNote, INPUT, PasswordInput, SectionLabel } from './controls';
import { ConfirmDialog, saveUsername } from './ProfileTab';
import type { SettingsText } from './text';
import GoogleMark from '@/components/GoogleMark';

interface AuthDetails {
  providers: string[];
  /** An email change (or a guest's first email) waiting for its link. */
  pendingEmail: string | null;
  /** A former guest who confirmed an email and has no password yet. */
  needsPassword: boolean;
}

const origin = () => window.location.origin;

export default function AccountTab({ t, user, onProfileUpdate }: {
  t: SettingsText;
  user: UiUser;
  onProfileUpdate: (updates: { name?: string; avatarUrl?: string }) => void;
}) {
  const [details, setDetails] = useState<AuthDetails | null>(null);

  useEffect(() => {
    let live = true;
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!live || !u) return;
      setDetails({
        providers: [...new Set((u.identities ?? []).map((i) => i.provider))],
        pendingEmail: u.new_email ?? null,
        needsPassword: !u.is_anonymous && !!u.user_metadata?.set_password,
      });
    });
    return () => { live = false; };
  }, []);

  return (
    <>
      {user.isAnonymous
        ? <GuestUpgrade t={t} user={user} pendingEmail={details?.pendingEmail ?? null} onProfileUpdate={onProfileUpdate} />
        : (
          <>
            <SignInSection t={t} user={user} details={details} />
            <PasswordSection
              t={t}
              user={user}
              needsPassword={!!details?.needsPassword}
              onPasswordSet={() => setDetails((d) => d && { ...d, needsPassword: false })}
            />
            <div className="pt-1">
              <button
                type="button"
                onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                className={`${BUTTON_DANGER_QUIET} w-full py-3 flex items-center justify-center gap-2 shadow-sm`}
              >
                <LogOut className="w-4 h-4" /> {t.logout}
              </button>
            </div>
          </>
        )}
      <DeleteAccount t={t} user={user} />
    </>
  );
}

/** How this player signs in, and their email with a way to change it. */
function SignInSection({ t, user, details }: { t: SettingsText; user: UiUser; details: AuthDetails | null }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const pending = note?.tone === 'ok' ? email.trim() : details?.pendingEmail;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = email.trim();
    if (!next || next === user.email) return;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: origin() });
    setBusy(false);
    if (error) {
      setNote({ tone: 'error', text: /already been registered/i.test(error.message) ? t.emailTaken : error.message });
      return;
    }
    setNote({ tone: 'ok', text: t.emailChangeSent });
    setEditing(false);
  };

  const providers = details?.providers ?? [];

  return (
    <section>
      <SectionLabel icon={LogIn}>{t.signIn}</SectionLabel>
      <div className="bg-surface border border-line rounded-2xl shadow-sm divide-y divide-divider">
        {providers.length > 0 && (
          <div className="flex flex-wrap gap-2 p-4">
            {providers.includes('email') && (
              <span className="inline-flex items-center gap-1.5 bg-page border border-line px-2.5 py-1 rounded-lg text-xs font-bold text-ink">
                <Mail className="w-3.5 h-3.5 text-muted" /> {t.methodEmail}
              </span>
            )}
            {providers.includes('google') && (
              <span className="inline-flex items-center gap-1.5 bg-page border border-line px-2.5 py-1 rounded-lg text-xs font-bold text-ink">
                <GoogleMark /> {t.methodGoogle}
              </span>
            )}
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className={LABEL}>{t.email}</div>
              <div className="mt-1 text-sm font-bold text-ink truncate">{user.email}</div>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => { setEditing(true); setNote(null); setEmail(''); }}
                className={`${BUTTON_SECONDARY} shrink-0 px-3 py-2 rounded-lg text-2xs`}
              >
                {t.change}
              </button>
            )}
          </div>

          {editing && (
            <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.newEmail}
                aria-label={t.newEmail}
                autoComplete="email"
                autoFocus
                required
                className={INPUT}
              />
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => setEditing(false)} className={`${BUTTON_SECONDARY} flex-1 sm:flex-none px-4 py-2.5`}>
                  {t.cancel}
                </button>
                <button type="submit" disabled={busy} className={`${BUTTON_PRIMARY} flex-1 sm:flex-none px-4 py-2.5 flex items-center justify-center gap-2`}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} {t.send}
                </button>
              </div>
            </form>
          )}

          {note && <FormNote tone={note.tone}>{note.text}</FormNote>}
          {!note && pending && (
            <p className="mt-2 text-xs font-medium text-muted truncate">{t.pendingEmail} <span className="font-bold text-ink">{pending}</span></p>
          )}
        </div>
      </div>
    </section>
  );
}

/** A reset link for everyone; a password form for a former guest who has none yet. */
function PasswordSection({ t, user, needsPassword, onPasswordSet }: {
  t: SettingsText;
  user: UiUser;
  needsPassword: boolean;
  onPasswordSet: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendReset = async () => {
    if (!user.email || cooldown > 0) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${origin()}/reset-password` });
    setLoading(false);
    if (error) showToast(error.message, 'error');
    else { showToast(t.resetSent, 'success'); setCooldown(60); }
  };

  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setNote({ tone: 'error', text: t.shortPassword }); return; }
    setLoading(true);
    setNote(null);
    const { error } = await supabase.auth.updateUser({ password, data: { set_password: null } });
    setLoading(false);
    if (error) { setNote({ tone: 'error', text: errorMessage(error) }); return; }
    setPassword('');
    showToast(t.passSaved, 'success');
    onPasswordSet();
  };

  return (
    <section>
      <SectionLabel icon={Shield}>{t.changePass}</SectionLabel>
      {needsPassword ? (
        <form onSubmit={setNewPassword} className="bg-surface border border-accent/20 rounded-2xl shadow-sm p-4">
          <div className="text-sm font-black text-ink">{t.setPassTitle}</div>
          <p className="mt-0.5 mb-3 text-xs font-medium text-muted leading-snug">{t.setPassDesc}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0">
              <PasswordInput
                id="settings-new-password"
                value={password}
                onChange={(v) => { setPassword(v); setNote(null); }}
                autoComplete="new-password"
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
              />
            </div>
            <button type="submit" disabled={loading} className={`${BUTTON_PRIMARY} shrink-0 px-4 py-2.5 flex items-center justify-center gap-2`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} {t.setPass}
            </button>
          </div>
          {note && <FormNote tone={note.tone}>{note.text}</FormNote>}
        </form>
      ) : (
        <div className="bg-surface border border-line rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="flex-1 text-sm font-medium text-muted leading-snug">{t.passDesc}</p>
          <button
            type="button"
            onClick={sendReset}
            disabled={loading || cooldown > 0}
            className={`${BUTTON_SECONDARY} group shrink-0 px-4 py-2.5 flex items-center justify-center gap-2 tabular-nums`}
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin text-accent" />
              : <Mail className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />}
            {cooldown > 0 ? `${t.wait} ${cooldown} ${t.sec}` : t.sendReset}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * A guest keeps everything by adding an email (the same account, now with a
 * confirmed address) or by linking Google. Supabase sets the password only
 * after the email is confirmed, so the account remembers to ask for it.
 */
function GuestUpgrade({ t, user, pendingEmail, onProfileUpdate }: {
  t: SettingsText;
  user: UiUser;
  pendingEmail: string | null;
  onProfileUpdate: (updates: { name?: string }) => void;
}) {
  const [name, setName] = useState(user.name === 'Player' ? '' : user.name);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const waitingFor = sentTo ?? pendingEmail;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const address = email.trim();
    if (trimmed.length < 2) { setError(t.nameShort); return; }
    setBusy('email');
    setError(null);
    try {
      if (trimmed !== user.name) {
        if (await saveUsername(user.id, trimmed) === 'taken') { setError(t.nameTaken); return; }
        onProfileUpdate({ name: trimmed });
      }
      const { error: updateError } = await supabase.auth.updateUser(
        { email: address, data: { username: trimmed, set_password: true } },
        { emailRedirectTo: origin() }
      );
      if (updateError) {
        setError(/already been registered/i.test(updateError.message) ? t.emailTaken : updateError.message);
        return;
      }
      setSentTo(address);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const linkGoogle = async () => {
    setBusy('google');
    setError(null);
    const { error: linkError } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: origin() } });
    if (linkError) {
      setBusy(null);
      setError(/manual linking/i.test(linkError.message) ? t.linkUnavailable
        : /already/i.test(linkError.message) ? t.identityTaken : linkError.message);
    }
  };

  return (
    <section>
      <SectionLabel icon={Save}>{t.keepTitle}</SectionLabel>
      <div className="bg-surface border border-accent/20 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm font-medium text-muted leading-snug mb-4">{t.keepDesc}</p>

        {waitingFor ? (
          <div role="status" className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm font-bold text-emerald-700 leading-snug">
            <Mail className="w-4 h-4 shrink-0 mt-0.5" /> {t.keepSent(waitingFor)}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label htmlFor="upgrade-name" className={`${LABEL} block mb-1.5`}>{t.nickname}</label>
              <input
                id="upgrade-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                maxLength={16}
                autoComplete="nickname"
                spellCheck={false}
                required
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="upgrade-email" className={`${LABEL} block mb-1.5`}>{t.email}</label>
              <input
                id="upgrade-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                autoComplete="email"
                required
                className={INPUT}
              />
            </div>
            <button type="submit" disabled={!!busy} className={`${BUTTON_PRIMARY} w-full py-3 flex items-center justify-center gap-2 active:scale-[0.98]`}>
              {busy === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} {t.keepButton}
            </button>
          </form>
        )}

        <div className="my-4 flex items-center gap-3">
          <div className="h-px bg-divider flex-1" />
          <span className={LABEL}>{t.or}</span>
          <div className="h-px bg-divider flex-1" />
        </div>

        <button
          type="button"
          onClick={linkGoogle}
          disabled={!!busy}
          className={`${BUTTON_SECONDARY} w-full py-3 flex items-center justify-center gap-2.5 active:scale-[0.98]`}
        >
          {busy === 'google' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleMark />} {t.linkGoogle}
        </button>

        {error && <FormNote tone="error">{error}</FormNote>}
      </div>
    </section>
  );
}

/** Deleting the account: uploads first (SQL cannot reach storage), then the account itself. */
function DeleteAccount({ t, user }: { t: SettingsText; user: UiUser }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim().toLowerCase() === user.name.trim().toLowerCase();

  const remove = async () => {
    if (!confirmed) return;
    setBusy(true);
    try {
      const { data: files } = await supabase.storage.from('avatars').list('', { search: user.id });
      const own = (files ?? []).map((f) => f.name).filter((n) => n.startsWith(user.id));
      if (own.length) await supabase.storage.from('avatars').remove(own);

      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      // The account is gone on the server; only the local session is left to drop
      await supabase.auth.signOut({ scope: 'local' });
      // A full load, not router.push: nothing of the deleted account may stay in memory
      window.location.replace(window.location.origin);
    } catch (err: unknown) {
      showToast(`${t.deleteFailed}: ${errorMessage(err)}`, 'error');
      setBusy(false);
    }
  };

  return (
    <section className="pt-6 border-t border-divider">
      <SectionLabel icon={Trash2}>{t.danger}</SectionLabel>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="flex-1 text-xs font-medium text-muted leading-snug">{t.deleteAccountDesc}</p>
        <button
          type="button"
          onClick={() => { setTyped(''); setOpen(true); }}
          className={`${BUTTON_DANGER_QUIET} shrink-0 px-4 py-2.5 flex items-center justify-center gap-2`}
        >
          <Trash2 className="w-4 h-4" /> {user.isAnonymous ? t.deleteGuest : t.deleteAccount}
        </button>
      </div>

      {open && (
        <ConfirmDialog
          title={t.deleteConfirm}
          description={t.deleteAccountDesc}
          cancel={t.cancel}
          confirm={t.deleteForever}
          onCancel={() => setOpen(false)}
          onConfirm={remove}
          busy={busy}
          disabled={!confirmed}
        >
          <label htmlFor="delete-confirm-name" className="block text-left text-xs font-bold text-muted mb-1.5">
            {t.typeName} <span className="text-ink">{user.name}</span>
          </label>
          <input
            id="delete-confirm-name"
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className={`${INPUT} mb-4`}
          />
        </ConfirmDialog>
      )}
    </section>
  );
}
