'use client';

import React from 'react';
import Image from 'next/image';
import { Trophy } from 'lucide-react';
import PlayerToken from '../PlayerToken';
import RematchButton from '../RematchButton';
import { useEscape } from '@/hooks/useEscape';
import type { GameId } from '@/games/registry';
import type { GameStateByType } from '@/games/initialState';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_OVERLAY, DIALOG_PANEL, LABEL } from './ui';

const T = {
  ru: { over: 'Партия окончена', menu: 'В меню', viewBoard: 'Посмотреть доску' },
  en: { over: 'Match over', menu: 'Main menu', viewBoard: 'View the board' }
};

export interface ResultWinner {
  id: string;
  name: string;
  token?: { color: string; seat: number };
  avatarUrl?: string;
}

/**
 * The end of a match, the same in every game.
 *
 * It can be put aside — "View the board" or Escape — to study the final
 * position; the game's Turn or Status card brings it back. Anything a game
 * wants to add (a results table, a list of rounds) goes in as children, and
 * `wide` makes room for it.
 */
export default function ResultDialog<T extends GameId>({
  lang, open, onHide, won, title, note, winners, gameId, parentState, onMenu, wide = false, children
}: {
  lang: 'ru' | 'en';
  open: boolean;
  onHide: () => void;
  won: boolean;
  title: string;
  /** A line under the title — why it ended, when that is worth saying. */
  note?: string;
  winners: ResultWinner[];
  gameId: T;
  parentState: GameStateByType[T];
  onMenu: () => void;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  const t = T[lang];
  useEscape(open, onHide);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={t.over} className={DIALOG_OVERLAY}>
      <div className={`${DIALOG_PANEL} ${wide ? 'max-w-lg' : 'max-w-sm'} text-center max-h-[90vh] overflow-y-auto`}>
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
            won ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-[#F8FAFC] text-[#1A1F26] border-[#E6E1DC]'
          }`}
        >
          <Trophy className="w-7 h-7" />
        </div>

        <div className={`${LABEL} mb-1`}>{t.over}</div>
        <h3 className="text-2xl font-black text-[#1A1F26]">{title}</h3>
        {note && <p className="mt-1 text-sm font-medium text-[#8A9099] leading-snug">{note}</p>}

        {winners.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {winners.map((w) => (
              <span key={w.id} className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E6E1DC] rounded-xl px-3 py-2">
                {w.token ? (
                  <PlayerToken className="w-5 h-5" color={w.token.color} seat={w.token.seat} />
                ) : w.avatarUrl ? (
                  <Image src={w.avatarUrl} alt="" width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
                ) : null}
                <span className="text-sm font-bold text-[#1A1F26]">{w.name}</span>
              </span>
            ))}
          </div>
        )}

        {children && <div className="mt-5 text-left">{children}</div>}

        <div className="flex gap-3 mt-6">
          <button onClick={onMenu} className={`flex-1 py-3 ${BUTTON_SECONDARY}`}>{t.menu}</button>
          {/* Whoever presses second joins the room the first one opened. */}
          <RematchButton gameId={gameId} parentState={parentState} lang={lang} className={`flex-1 py-3 ${BUTTON_PRIMARY}`} />
        </div>

        <button
          onClick={onHide}
          className="mt-4 text-2xs font-bold uppercase tracking-widest text-[#8A9099] hover:text-[#9e1316] transition-colors"
        >
          {t.viewBoard}
        </button>
      </div>
    </div>
  );
}
