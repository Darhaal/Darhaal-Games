'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { Loader2, CheckCircle, AlertCircle, ArrowLeft, Lock } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('error');
        setMsg('Link is invalid or expired.');
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');

    if (password.length < 6) {
      setMsg('Min 6 characters required');
      setStatus('error');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: password });
      if (error) throw error;

      setStatus('success');
      setMsg('Password updated successfully!');
      setTimeout(() => router.push('/'), 2000);
    } catch (error: unknown) {
      setStatus('error');
      setMsg(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center p-4 font-sans text-ink relative overflow-hidden">

      {/* Texture & Ambient */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-50 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      <div className="w-full max-w-md bg-surface border border-line p-10 rounded-[32px] shadow-2xl shadow-accent/5 relative z-10 animate-in zoom-in-95 duration-500">

        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
             <div className="relative w-20 h-20 bg-warm rounded-2xl flex items-center justify-center border border-line shadow-inner p-4 group">
                <Lock className="w-8 h-8 text-accent" />
             </div>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink mb-2 font-space">
            New Password
          </h1>
          <p className="text-sm text-muted font-bold uppercase tracking-wider">
            Create a secure password
          </p>
        </div>

        {status === 'success' ? (
          <div className="flex flex-col items-center justify-center py-6 animate-in fade-in zoom-in duration-300">
            <CheckCircle className="w-16 h-16 text-emerald-500 mb-4 drop-shadow-md" />
            <p className="text-lg font-bold text-ink text-center">{msg}</p>
            <p className="text-xs font-bold text-muted mt-2 uppercase tracking-wider">Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
             {status === 'error' && (
              <div className="flex items-center gap-3 bg-accent/5 border border-accent/20 text-accent p-4 rounded-xl text-xs font-bold uppercase tracking-wide">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {msg}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-2xs font-bold text-muted uppercase tracking-wider ml-1">
                Enter new password
              </label>
              <div className="relative group">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-warm border border-line rounded-xl py-3 px-4 text-ink font-bold focus:outline-none focus:border-accent focus:bg-surface focus:ring-0 transition-all placeholder:text-muted/50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink hover:bg-accent text-on-ink font-bold py-4 rounded-xl transition-all shadow-xl shadow-shade/20 active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2 text-xs uppercase tracking-widest hover:shadow-accent/30"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Password'}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-line text-center">
           <button
             onClick={() => router.push('/')}
             className="text-muted hover:text-accent text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors group"
           >
             <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Home
           </button>
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-accent" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}