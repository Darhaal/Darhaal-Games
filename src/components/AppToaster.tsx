'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { TOAST_EVENT_NAME, ToastPayload, ToastType } from '@/lib/toast';
import { SYNC_CONFLICT_EVENT } from '@/lib/gameStateSync';
import { useLang } from '@/hooks/useLang';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType | 'sync';
}

const ICONS: Record<ToastItem['type'], React.ElementType> = {
  info: Info,
  error: AlertCircle,
  success: CheckCircle2,
  sync: RefreshCw,
};

const STYLES: Record<ToastItem['type'], string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  error: 'bg-red-50 border-red-200 text-red-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  sync: 'bg-amber-50 border-amber-200 text-amber-700',
};

const SYNC_MSG = {
  ru: 'Действие не применилось — состояние обновлено',
  en: 'Action did not apply — state re-synced',
};

/**
 * Global toasts. Mounted once in the layout.
 * Sources: showToast() from lib/toast and the CAS write-conflict event from gameStateSync.
 */
export default function AppToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { lang } = useLang();

  useEffect(() => {
    let counter = 0;

    const push = (msg: string, type: ToastItem['type']) => {
      const id = Date.now() * 100 + (counter++ % 100);
      setToasts(prev => [...prev.slice(-2), { id, msg, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const onToast = (e: Event) => {
      const { msg, type } = (e as CustomEvent<ToastPayload>).detail;
      push(msg, type);
    };
    // The reader's language from useLang, which starts in English; reading
    // the stored choice here fell back to Russian for anyone yet to pick one.
    const onSyncConflict = () => push(SYNC_MSG[lang], 'sync');

    window.addEventListener(TOAST_EVENT_NAME, onToast);
    window.addEventListener(SYNC_CONFLICT_EVENT, onSyncConflict);
    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, onToast);
      window.removeEventListener(SYNC_CONFLICT_EVENT, onSyncConflict);
    };
     
  }, [lang]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold uppercase tracking-wider animate-in slide-in-from-bottom-4 fade-in duration-300 ${STYLES[t.type]}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}
