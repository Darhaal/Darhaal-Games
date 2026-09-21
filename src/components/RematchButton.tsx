'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';
import { startRematch, rematchIdOf } from '@/lib/rematch';
import type { GameStateByType } from '@/games/initialState';
import type { GameId } from '@/games/registry';

const TEXT = {
  ru: { again: 'Ещё раз', join: 'Присоединиться' },
  en: { again: 'Play again', join: 'Join rematch' }
};

/**
 * "Play again" for every game.
 *
 * It opens a new room instead of resetting the finished one and sends this
 * player there; everyone else presses the same button and lands in the same
 * room, because the server hands out the successor the first press created.
 * See `src/lib/rematch.ts` for why that has to happen server-side.
 *
 * The lobby id comes from the query string rather than a prop: every game
 * lives at `/game/<id>?id=<lobby>`, so there is nothing to thread through six
 * component trees and nothing that can be passed wrong.
 */
export default function RematchButton<T extends GameId>({
  gameId, parentState, lang, className = ''
}: {
  gameId: T;
  parentState: GameStateByType[T];
  lang: 'ru' | 'en';
  className?: string;
}) {
  const router = useRouter();
  const lobbyId = useSearchParams().get('id');
  const [pending, setPending] = useState(false);
  const t = TEXT[lang];

  if (!lobbyId) return null;

  const alreadyOpen = !!rematchIdOf(parentState);

  const go = async () => {
    if (pending) return;
    setPending(true);
    const next = await startRematch(lobbyId, gameId, parentState);
    if (next) {
      router.push(`/game/${gameId}?id=${next}`);
      return;
    }
    setPending(false);
  };

  return (
    <button
      onClick={go}
      disabled={pending}
      className={`flex items-center justify-center gap-2 disabled:opacity-60 ${className}`}
    >
      {pending
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <RotateCcw className="w-4 h-4" />}
      {alreadyOpen ? t.join : t.again}
    </button>
  );
}
