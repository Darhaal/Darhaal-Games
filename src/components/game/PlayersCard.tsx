'use client';

import React from 'react';
import Image from 'next/image';
import { Crown, Trophy } from 'lucide-react';
import PlayerToken from '../PlayerToken';
import GameCard from './GameCard';
import { defaultAvatar } from '@/constants/app';

const T = {
  ru: { players: 'Игроки', you: 'вы' },
  en: { players: 'Players', you: 'you' }
};

export interface PlayerRow {
  id: string;
  name: string;
  avatarUrl?: string;
  isHost?: boolean;
  isMe?: boolean;
  /** Seat colour and shape, for games with pieces on a board. */
  token?: { color: string; seat: number };
  /** On the move right now. */
  active?: boolean;
  /** Out of the game: resigned, eliminated, left. */
  out?: boolean;
  /** Won the match. */
  won?: boolean;
  /** One line of game stats under the name — pips, a count, a status. */
  stat?: React.ReactNode;
  /** Something for the right edge — a score. */
  aside?: React.ReactNode;
}

/**
 * The players at the table, one row each — and the legend for the board: an
 * avatar carries the same piece the player has on it, so no separate key is
 * needed.
 */
export default function PlayersCard({
  lang, rows, label
}: {
  lang: 'ru' | 'en';
  rows: PlayerRow[];
  label?: string;
}) {
  const t = T[lang];

  return (
    <GameCard label={label ?? t.players}>
      <div className="space-y-1.5">
        {rows.map((p) => (
          <div
            key={p.id}
            className={`relative flex items-center gap-3 py-2.5 pl-3.5 pr-3 rounded-xl border transition-colors ${
              p.active ? 'bg-[#F8FAFC] border-[#E6E1DC]' : 'border-transparent'
            }`}
          >
            {p.active && (
              <span
                aria-hidden
                className="absolute left-1 top-3 bottom-3 w-1 rounded-full"
                style={{ backgroundColor: p.token?.color ?? '#1A1F26' }}
              />
            )}

            <span className="relative w-9 h-9 shrink-0">
              <Image
                src={p.avatarUrl || defaultAvatar(p.id)}
                alt=""
                width={36}
                height={36}
                className={`w-full h-full object-cover rounded-full bg-[#F8FAFC] ${p.out ? 'grayscale opacity-60' : ''}`}
              />
              {p.token && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-[2px]">
                  <PlayerToken className="w-4 h-4" color={p.token.color} seat={p.token.seat} />
                </span>
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold truncate ${p.out ? 'text-[#B5B3AD] line-through' : ''}`}>{p.name}</span>
                {p.isMe && (
                  <span className="text-3xs font-bold uppercase tracking-wider text-[#8A9099] shrink-0">{t.you}</span>
                )}
                {p.isHost && <Crown className="w-3 h-3 text-amber-500 fill-current shrink-0" />}
                {p.won && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              </div>
              {p.stat && <div className="flex items-center gap-2 mt-1 min-h-3 text-2xs font-bold text-[#8A9099]">{p.stat}</div>}
            </div>

            {p.aside && <div className="shrink-0 text-2xs font-bold text-[#8A9099] tabular-nums">{p.aside}</div>}
          </div>
        ))}
      </div>
    </GameCard>
  );
}
