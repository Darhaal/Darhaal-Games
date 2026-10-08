'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, Ghost, Loader2, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang, type Lang } from '@/hooks/useLang';
import { errorMessage } from '@/lib/errors';
import { SITE_URL, defaultAvatar } from '@/constants/app';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL } from '@/components/game/ui';
import GoogleMark from '@/components/GoogleMark';
import { LANGUAGE_LINKS } from '@/lib/locale';

const translations = {
  ru: {
    titleLogin: 'Вход',
    titleSignup: 'Регистрация',
    subLogin: 'Войдите, чтобы играть с друзьями',
    subSignup: 'Аккаунт хранит статистику, достижения и аватарки',
    identifierLabel: 'Имя или email',
    usernameLabel: 'Имя пользователя',
    emailLabel: 'Email',
    passLabel: 'Пароль',
    btnLogin: 'Войти',
    btnSignup: 'Создать аккаунт',
    btnGoogle: 'Войти через Google',
    btnGuest: 'Играть как гость',
    or: 'или',
    noAccount: 'Нет аккаунта?',
    createOne: 'Создать',
    haveAccount: 'Уже есть аккаунт?',
    signIn: 'Войти',
    guestInfo: 'Прогресс гостя не сохраняется',
    successReg: 'Проверьте почту, чтобы подтвердить аккаунт',
    errorUserNotFound: 'Такой игрок не найден',
    usernameTaken: 'Имя занято',
    guestDisabled: 'Гостевой вход сейчас недоступен',
    wrongCredentials: 'Неверное имя или пароль',
    emailNotConfirmed: 'Подтвердите почту — ссылка в письме',
    alreadyRegistered: 'Этот email уже зарегистрирован',
    shortPassword: 'Пароль — не короче 6 символов',
    forgotPass: 'Забыли пароль?',
    resetSent: 'Ссылка для сброса отправлена на почту',
    enterIdentifier: 'Введите имя или email выше',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    language: 'Язык',
  },
  en: {
    titleLogin: 'Sign in',
    titleSignup: 'Create account',
    subLogin: 'Sign in to play with your friends',
    subSignup: 'An account keeps your stats, achievements and avatars',
    identifierLabel: 'Username or email',
    usernameLabel: 'Username',
    emailLabel: 'Email',
    passLabel: 'Password',
    btnLogin: 'Sign in',
    btnSignup: 'Create account',
    btnGoogle: 'Continue with Google',
    btnGuest: 'Play as guest',
    or: 'or',
    noAccount: 'No account?',
    createOne: 'Create one',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    guestInfo: 'Guest progress is not saved',
    successReg: 'Check your email to confirm the account',
    errorUserNotFound: 'No such player',
    usernameTaken: 'Username taken',
    guestDisabled: 'Guest sign-in is unavailable right now',
    wrongCredentials: 'Wrong username or password',
    emailNotConfirmed: 'Confirm your email first — the link is in the message',
    alreadyRegistered: 'This email is already registered',
    shortPassword: 'The password needs at least 6 characters',
    forgotPass: 'Forgot password?',
    resetSent: 'Reset link sent to your email',
    enterIdentifier: 'Enter your username or email above',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    language: 'Language',
  },
  uk: {
    titleLogin: 'Вхід',
    titleSignup: 'Реєстрація',
    subLogin: 'Увійдіть, щоб грати з друзями',
    subSignup: 'Акаунт зберігає статистику, досягнення й аватарки',
    identifierLabel: 'Ім’я або email',
    usernameLabel: 'Ім’я користувача',
    emailLabel: 'Email',
    passLabel: 'Пароль',
    btnLogin: 'Увійти',
    btnSignup: 'Створити акаунт',
    btnGoogle: 'Увійти через Google',
    btnGuest: 'Грати як гість',
    or: 'або',
    noAccount: 'Немає акаунта?',
    createOne: 'Створити',
    haveAccount: 'Уже є акаунт?',
    signIn: 'Увійти',
    guestInfo: 'Прогрес гостя не зберігається',
    successReg: 'Перевірте пошту, щоб підтвердити акаунт',
    errorUserNotFound: 'Такого гравця не знайдено',
    usernameTaken: 'Ім’я зайняте',
    guestDisabled: 'Гостьовий вхід зараз недоступний',
    wrongCredentials: 'Неправильне ім’я або пароль',
    emailNotConfirmed: 'Підтвердьте пошту — посилання в листі',
    alreadyRegistered: 'Цей email уже зареєстровано',
    shortPassword: 'Пароль — не коротший за 6 символів',
    forgotPass: 'Забули пароль?',
    resetSent: 'Посилання для скидання надіслано на пошту',
    enterIdentifier: 'Введіть ім’я або email вище',
    showPassword: 'Показати пароль',
    hidePassword: 'Сховати пароль',
    language: 'Мова',
  }
};

type AuthText = typeof translations.en;

/** Supabase answers in English; the common cases get the player's language. */
function authError(message: string, t: AuthText): string {
  if (message === 'Invalid login credentials') return t.wrongCredentials;
  if (message === 'Email not confirmed') return t.emailNotConfirmed;
  if (message === 'User already registered') return t.alreadyRegistered;
  if (message.startsWith('Password should be at least')) return t.shortPassword;
  return message;
}

const INPUT =
  'w-full bg-page border border-gray-200 focus:bg-surface focus:border-ink rounded-xl py-3 pl-11 pr-4 font-bold text-ink outline-none transition-all placeholder:text-gray-400 text-base sm:text-sm';
const INPUT_ICON =
  'absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-ink transition-colors pointer-events-none';

/**
 * The sign-in card. `defaultLang` is the language of the page it sits on, so
 * /ru greets a newcomer in Russian; a language picked here or in the settings
 * wins over it.
 */
export default function AuthForm({ defaultLang = 'en' }: { defaultLang?: Lang }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const { lang, setLang } = useLang(defaultLang);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const t = translations[lang];

  const getRedirectUrl = () => {
    // Always return to the origin we signed in from (works on any port/domain)
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return SITE_URL;
  };

  const handleSuccessLogin = () => {
      if (returnUrl) {
          router.push(returnUrl);
      } else {
          window.location.reload();
      }
  };

  // Username -> email through the server-side RPC. profiles.email is not
  // readable by clients, so there is no client-side alternative.
  const resolveEmail = async (identifier: string): Promise<string> => {
      if (identifier.includes('@')) return identifier;

      const { data: rpcEmail, error: rpcError } = await supabase.rpc('get_login_email', { p_username: identifier });
      if (!rpcError && rpcEmail) return rpcEmail as string;

      // No fallback on purpose: profiles.email is not readable by clients, so
      // the RPC is the only way to resolve a username.
      throw new Error(t.errorUserNotFound);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        // Registered players only, any case — guests share names like "Player"
        const { data: taken } = await supabase.rpc('username_taken', { p_username: username.trim() });
        if (taken) throw new Error(t.usernameTaken);

        const randomAvatar = defaultAvatar(Math.random().toString(36).substring(7));

        const { error } = await supabase.auth.signUp({
          email, password, options: {
            data: { username, avatar_url: randomAvatar },
            emailRedirectTo: getRedirectUrl()
          }
        });
        if (error) throw error;
        setSuccessMsg(t.successReg);
        setTimeout(() => setIsSignUp(false), 2000);
      } else {
        // In sign-in mode the input (username) holds "Username or Email"
        const loginEmail = await resolveEmail(username);

        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;

        handleSuccessLogin();
      }
    } catch (error: unknown) {
      setErrorMsg(authError(errorMessage(error), t));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getRedirectUrl() },
    });
    if (error) { setErrorMsg(error.message); setLoading(false); }
  };

  const handleForgotPassword = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // The login field holds a username or an email
    if (!username.trim()) {
      setErrorMsg(t.enterIdentifier);
      return;
    }

    setLoading(true);
    try {
      const resetEmail = await resolveEmail(username);

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${getRedirectUrl()}/reset-password`
      });
      if (error) throw error;
      setSuccessMsg(t.resetSent);
    } catch (error: unknown) {
      setErrorMsg(authError(errorMessage(error), t));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;

      // Seed the guest's metadata with the SAME deterministic avatar the signup
      // trigger already wrote into profiles — a random seed here would leave
      // the two disagreeing, which is how guests ended up looking avatar-less.
      if (data.user) {
          await supabase.auth.updateUser({
              data: {
                  username: 'Player',
                  avatar_url: defaultAvatar(data.user.id)
              }
          });
      }

      handleSuccessLogin();
    } catch { setErrorMsg(t.guestDisabled); setLoading(false); }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="w-full max-w-[400px] mx-auto font-sans">

      {/* Brand, as the main menu header draws it — one line at any width */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="w-11 h-11 bg-surface border border-line rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <Image src="/logo512.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
        </div>
        <span className="text-2xl font-black tracking-tighter leading-none text-ink whitespace-nowrap">
          Darhaal <span className="text-accent">Games</span>
        </span>
      </div>

      <div className="bg-surface border border-line rounded-3xl shadow-2xl shadow-shade/5 p-6 sm:p-8">

        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-2xl font-black text-ink tracking-tight leading-tight">
            {isSignUp ? t.titleSignup : t.titleLogin}
          </h2>

          <div role="group" aria-label={t.language} className="flex shrink-0 p-0.5 bg-page border border-line rounded-lg">
            {LANGUAGE_LINKS.map(({ locale: code, short, name }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                aria-label={name}
                title={name}
                className={`px-2 py-1 rounded-md text-2xs font-black uppercase tracking-widest transition-all ${
                  lang === code ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {short}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1.5 mb-6 text-sm font-medium text-muted leading-snug">
          {isSignUp ? t.subSignup : t.subLogin}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="auth-identifier" className={`${LABEL} block`}>
              {isSignUp ? t.usernameLabel : t.identifierLabel}
            </label>
            <div className="relative group">
              <User className={INPUT_ICON} />
              <input
                id="auth-identifier"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={INPUT}
                required
              />
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label htmlFor="auth-email" className={`${LABEL} block`}>{t.emailLabel}</label>
              <div className="relative group">
                <Mail className={INPUT_ICON} />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={INPUT}
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="auth-password" className={LABEL}>{t.passLabel}</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs font-bold text-muted hover:text-accent transition-colors disabled:opacity-50"
                >
                  {t.forgotPass}
                </button>
              )}
            </div>
            <div className="relative group">
              <Lock className={INPUT_ICON} />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className={`${INPUT} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-ink transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div role="alert" className="text-accent text-xs bg-accent/5 border border-accent/20 px-4 py-3 rounded-xl flex items-center gap-3 font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div role="status" className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl flex items-center gap-3 font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`${BUTTON_PRIMARY} w-full py-3.5 flex justify-center items-center gap-2 hover:shadow-lg active:scale-[0.98]`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? t.btnSignup : t.btnLogin)}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px bg-divider flex-1" />
          <span className={LABEL}>{t.or}</span>
          <div className="h-px bg-divider flex-1" />
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`${BUTTON_SECONDARY} w-full py-3 flex items-center justify-center gap-2.5 active:scale-[0.98]`}
          >
            <GoogleMark />
            {t.btnGoogle}
          </button>

          {!isSignUp && (
            <>
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={loading}
                className={`${BUTTON_SECONDARY} group w-full py-3 flex items-center justify-center gap-2.5 active:scale-[0.98]`}
              >
                <Ghost className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
                {t.btnGuest}
              </button>
              <p className="text-center text-xs font-medium text-muted">{t.guestInfo}</p>
            </>
          )}
        </div>

        <p className="mt-6 pt-5 border-t border-divider text-center text-sm font-medium text-muted">
          {isSignUp ? t.haveAccount : t.noAccount}{' '}
          <button
            type="button"
            onClick={switchMode}
            className="inline-flex items-center gap-1 font-black text-ink hover:text-accent transition-colors"
          >
            {isSignUp ? t.signIn : t.createOne} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </p>
      </div>
    </div>
  );
}
