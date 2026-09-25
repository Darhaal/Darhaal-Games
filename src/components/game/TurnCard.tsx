'use client';

import React from 'react';
import Image from 'next/image';
import { Trophy } from 'lucide-react';
import PlayerToken from '../PlayerToken';
import GameCard from './GameCard';
import { HURRY_SECONDS, softTone } from './ui';

const T = {
  ru: { turn: 'Ход', yourTurn: 'Ваш ход', over: 'Партия окончена', results: 'Итоги' },
  en: { turn: 'Turn', yourTurn: 'Your turn', over: 'Match over', results: 'Results' }
};

export interface TurnHolder {
  name: string;
  isMe: boolean;
  /** Seat colour and shape, for games with pieces on a board. */
  color?: string;
  seat?: number;
  /** Otherwise the avatar stands in for the piece. */
  avatarUrl?: string;
}

/**
 * Whose move it is, what can be done, and how much of the turn is left.
 *
 * The header carries the clock's digits; this bar shows at a glance how much
 * is gone, in the colour of whoever is on the move, and turns red with the
 * digits under `HURRY_SECONDS`. Once the match is over the same card says so
 * and can bring the result back after it was put aside.
 *
 * Games without turns (Spyfall, Flager) use it as their Status card: a
 * `label` and `title` of their own instead of the player on the move.
 */
export default function TurnCard({
  lang, label, title, who, hint, secondsLeft, turnSeconds, result
}: {
  lang: 'ru' | 'en';
  /** Replaces «Ход» — «Раунд», for a Status card. */
  label?: string;
  /** Replaces the player's name — what is going on right now. */
  title?: string;
  who?: TurnHolder | null;
  hint?: React.ReactNode;
  secondsLeft?: number;
  turnSeconds?: number;
  result?: {
    won: boolean;
    title: string;
    detail?: string;
    hidden: boolean;
    onShow: () => void;
  };
}) {
  const t = T[lang];

  if (result) {
    return (
      <GameCard label={t.over}>
        <div className="flex items-center gap-3">
          <span
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
              result.won ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-[#F8FAFC] text-[#1A1F26] border-[#E6E1DC]'
            }`}
          >
            <Trophy className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black leading-tight truncate">{result.title}</div>
            {result.detail && <div className="text-xs font-medium text-[#8A9099] mt-0.5 leading-snug">{result.detail}</div>}
          </div>
          {result.hidden && (
            <button
              onClick={result.onShow}
              className="px-3 py-2 bg-[#1A1F26] text-white rounded-lg font-bold text-2xs uppercase tracking-wide hover:bg-[#9e1316] transition-colors shrink-0"
            >
              {t.results}
            </button>
          )}
        </div>
      </GameCard>
    );
  }

  const color = who?.color ?? '#1A1F26';
  const share = secondsLeft !== undefined && turnSeconds
    ? Math.max(0, Math.min(1, secondsLeft / turnSeconds))
    : null;
  const hurry = secondsLeft !== undefined && secondsLeft < HURRY_SECONDS;

  return (
    <GameCard label={label ?? t.turn}>
      <div className="flex items-center gap-3">
        {who && (who.color !== undefined && who.seat !== undefined ? (
          <PlayerToken className="w-9 h-9" color={who.color} seat={who.seat} mine={who.isMe} />
        ) : who.avatarUrl ? (
          <Image
            src={who.avatarUrl}
            alt=""
            width={36}
            height={36}
            className="w-9 h-9 rounded-full object-cover bg-[#F8FAFC] shrink-0"
          />
        ) : null)}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black leading-tight truncate">
            {title ?? (who ? (who.isMe ? t.yourTurn : who.name) : '')}
          </div>
          {hint && <div className="text-xs font-medium text-[#8A9099] mt-0.5 leading-snug">{hint}</div>}
        </div>
      </div>

      {share !== null && (
        <div className="mt-4 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${share * 100}%`, backgroundColor: hurry ? '#9e1316' : softTone(color) }}
          />
        </div>
      )}
    </GameCard>
  );
}
