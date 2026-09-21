'use client';

import React, { useState, useEffect } from 'react';
import { Info, UserMinus, UserPlus, TriangleAlert } from 'lucide-react';
import type { GameNotification } from '@/types/notification';

/**
 * The floating in-match notice, shared by every game that posts one.
 *
 * Lifted out of FlagerGame, which was the only screen that rendered these —
 * Spyfall wrote the same kind of notice into its state and then dropped it on
 * the floor.
 */

const ICONS = {
  info: Info,
  join: UserPlus,
  leave: UserMinus,
  alert: TriangleAlert
} as const;

const TONES = {
  info: 'bg-blue-100 text-blue-600',
  join: 'bg-emerald-100 text-emerald-600',
  leave: 'bg-red-100 text-red-600',
  alert: 'bg-amber-100 text-amber-600'
} as const;

export default function GameNotificationToast({
  notifications,
  lang
}: {
  notifications: GameNotification[];
  lang: 'ru' | 'en';
}) {
  // The visible note is derived: the latest one that is not dismissed yet
  const [hiddenUpToId, setHiddenUpToId] = useState(0);
  const latest = notifications && notifications.length > 0
    ? notifications[notifications.length - 1]
    : null;
  const visibleNote = latest && latest.id > hiddenUpToId ? latest : null;

  useEffect(() => {
    if (!visibleNote) return;
    const timer = setTimeout(() => setHiddenUpToId(visibleNote.id), 4000);
    return () => clearTimeout(timer);
  }, [visibleNote]);

  if (!visibleNote) return null;

  const Icon = ICONS[visibleNote.type] ?? Info;
  const tone = TONES[visibleNote.type] ?? TONES.info;

  return (
    <div
      className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top-5 fade-in duration-300"
      role="status"
      aria-live="polite"
    >
      <div className="bg-white/90 backdrop-blur-md border border-[#E6E1DC] shadow-xl rounded-full px-6 py-3 flex items-center gap-3">
        <div className={`${tone} p-1.5 rounded-full`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#1A1F26]">
          {visibleNote.message[lang]}
        </span>
      </div>
    </div>
  );
}
