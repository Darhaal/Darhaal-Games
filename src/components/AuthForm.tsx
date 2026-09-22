'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; 
import { Mail, Lock, User, LogIn, Ghost, Globe, Loader2, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/hooks/useLang';
import { errorMessage } from '@/lib/errors';
import { SITE_URL, defaultAvatar } from '@/constants/app';

const translations = {
  ru: {
    titleLogin: 'Вход',
    titleSignup: 'Регистрация',
    usernameLabel: 'Имя пользователя',
    emailLabel: 'Email',
    passLabel: 'Пароль',
    btnLogin: 'Войти',
    btnSignup: 'Создать аккаунт',
    btnGoogle: 'Google',
    btnGuest: 'Гость',
    switchSignup: 'Создать аккаунт',
    switchLogin: 'Уже есть аккаунт?',
    guestInfo: 'Прогресс гостя не сохраняется',
    successReg: 'Проверьте почту',
    errorUserNotFound: 'Не найдено',
    forgotPass: 'Забыли пароль?',
    resetSent: 'Ссылка для сброса отправлена на почту',
    enterIdentifier: 'Введите имя или email выше',
  },
  en: {
    titleLogin: 'Sign In',
    titleSignup: 'Create Account',
    usernameLabel: 'Username',
    emailLabel: 'Email',
    passLabel: 'Password',
    btnLogin: 'Sign In',
    btnSignup: 'Sign Up',
    btnGoogle: 'Google',
    btnGuest: 'Guest',
    switchSignup: 'No account? Create one',
    switchLogin: 'Already have an account? Sign in',
    guestInfo: 'Guest progress not saved',
    successReg: 'Check your email',
    errorUserNotFound: 'Not found',
    forgotPass: 'Forgot password?',
    resetSent: 'Reset link sent to your email',
    enterIdentifier: 'Enter your username or email above',
  }
};

export default function AuthForm() {
  const router = useRouter(); 
  const searchParams = useSearchParams(); 
  const returnUrl = searchParams.get('returnUrl');

  const { lang, setLang } = useLang('en');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const t = translations[lang];

  const changeLang = setLang;

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
        const { data: existingUser } = await supabase.from('profiles').select('username').eq('username', username).single();
        if (existingUser) throw new Error(lang === 'ru' ? 'Имя занято' : 'Username taken');

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
      setErrorMsg(errorMessage(error));
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
      setErrorMsg(errorMessage(error));
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
    } catch { setErrorMsg("Guest disabled"); setLoading(false); }
  };

  return (
    <div className="w-full max-w-[360px] mx-auto bg-white border border-[#E6E1DC] p-6 sm:p-10 rounded-[32px] sm:rounded-[40px] shadow-2xl shadow-[#1A1F26]/5 relative font-sans transition-all hover:shadow-[#9e1316]/5">

      <button
        onClick={() => changeLang(lang === 'ru' ? 'en' : 'ru')}
        className="absolute top-6 right-6 sm:top-8 sm:right-8 p-2 rounded-full hover:bg-[#F5F5F0] text-[#8A9099] hover:text-[#1A1F26] transition-colors flex items-center gap-1 text-2xs font-bold uppercase tracking-widest z-10"
      >
        <Globe className="w-4 h-4" />
        {lang.toUpperCase()}
      </button>

      <div className="mb-8 sm:mb-10">
        <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#1A1F26]/10 border border-[#E6E1DC] overflow-hidden p-1.5 sm:p-1">
             <Image src="/logo512.png" alt="DG Logo" width={48} height={48} className="w-full h-full object-contain" />
           </div>
           <h1 className="text-xl sm:text-2xl font-black text-[#1A1F26] tracking-tight leading-none">
             Darhaal<br/><span className="text-[#9e1316]">Games</span>
           </h1>
        </div>
        <p className="text-xs font-bold text-[#8A9099] uppercase tracking-wider pl-1">{isSignUp ? t.titleSignup : t.titleLogin}</p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4 sm:space-y-5">
        <div className="space-y-2">
          <label className="text-2xs font-bold text-[#8A9099] uppercase tracking-wider ml-1">
             {isSignUp ? t.usernameLabel : (lang === 'ru' ? 'Имя или Email' : 'Username or Email')}
          </label>
          <div className="relative group">
            <User className="absolute left-4 top-3.5 w-5 h-5 text-[#8A9099] group-focus-within:text-[#9e1316] transition-colors" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E6E1DC] rounded-2xl py-3 pl-12 pr-4 text-[#1A1F26] font-bold text-sm focus:outline-none focus:bg-white focus:border-[#9e1316] focus:ring-4 focus:ring-[#9e1316]/5 transition-all placeholder:text-[#8A9099]/50"
              required
            />
          </div>
        </div>

        {isSignUp && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
            <label className="text-2xs font-bold text-[#8A9099] uppercase tracking-wider ml-1">{t.emailLabel}</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 w-5 h-5 text-[#8A9099] group-focus-within:text-[#9e1316] transition-colors" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E6E1DC] rounded-2xl py-3 pl-12 pr-4 text-[#1A1F26] font-bold text-sm focus:outline-none focus:bg-white focus:border-[#9e1316] focus:ring-4 focus:ring-[#9e1316]/5 transition-all placeholder:text-[#8A9099]/50"
                required={isSignUp}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-2xs font-bold text-[#8A9099] uppercase tracking-wider ml-1">{t.passLabel}</label>
          <div className="relative group">
            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-[#8A9099] group-focus-within:text-[#9e1316] transition-colors" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E6E1DC] rounded-2xl py-3 pl-12 pr-10 text-[#1A1F26] font-bold text-sm focus:outline-none focus:bg-white focus:border-[#9e1316] focus:ring-4 focus:ring-[#9e1316]/5 transition-all placeholder:text-[#8A9099]/50"
              required
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-[#8A9099] hover:text-[#1A1F26] transition-colors"
            >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="text-[#9e1316] text-xs bg-[#9e1316]/5 border border-[#9e1316]/20 p-4 rounded-xl flex items-center gap-3 font-bold animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="text-emerald-600 text-xs bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 font-bold animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {successMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1A1F26] hover:bg-[#9e1316] text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-[#1A1F26]/20 hover:shadow-[#9e1316]/30 active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2 text-xs uppercase tracking-widest mt-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? t.btnSignup : t.btnLogin)}
        </button>

        {!isSignUp && (
          <div className="text-center -mt-1">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="text-2xs font-bold text-[#8A9099] hover:text-[#9e1316] uppercase tracking-widest transition-colors hover:underline underline-offset-4 disabled:opacity-50"
            >
              {t.forgotPass}
            </button>
          </div>
        )}
      </form>

      <div className="my-6 sm:my-8 flex items-center gap-4">
        <div className="h-px bg-[#E6E1DC] flex-1" />
        <span className="text-[#8A9099] text-2xs uppercase font-bold tracking-widest">OR</span>
        <div className="h-px bg-[#E6E1DC] flex-1" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button onClick={handleGoogleLogin} disabled={loading} className="bg-white hover:bg-[#F5F5F0] border border-[#E6E1DC] text-[#8A9099] hover:text-[#1A1F26] py-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-2xs font-bold uppercase tracking-wide">
            {/* lucide v1 dropped its brand icons; the label carries the meaning */}
            <LogIn className="w-4 h-4" />
            <span>Google</span>
        </button>

        <button onClick={handleGuestLogin} disabled={loading} className="bg-white hover:bg-[#F5F5F0] border border-dashed border-[#E6E1DC] text-[#8A9099] hover:text-[#1A1F26] py-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-2xs font-bold uppercase tracking-wide">
            <Ghost className="w-4 h-4" />
            <span>{t.btnGuest}</span>
        </button>
      </div>

      <p className="mt-6 sm:mt-8 text-center text-xs text-[#8A9099] font-medium border-t border-[#E6E1DC] pt-6">
        <button
          onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(null); setSuccessMsg(null); }}
          className="text-[#9e1316] hover:text-[#7a0f11] transition-colors flex items-center justify-center gap-2 mx-auto hover:underline decoration-2 underline-offset-4 font-bold uppercase tracking-wide"
        >
          {isSignUp ? t.switchLogin : t.switchSignup} <ArrowRight className="w-3 h-3" />
        </button>
      </p>

      {!isSignUp && (
         <div className="mt-4 text-center">
             <span className="text-2xs text-[#8A9099] font-bold uppercase tracking-widest">{t.guestInfo}</span>
         </div>
      )}
    </div>
  );
}