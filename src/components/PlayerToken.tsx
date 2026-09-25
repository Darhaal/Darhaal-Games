'use client';

import React from 'react';

/**
 * A player's piece: a disc in their colour with their own shape inside.
 *
 * The shape is not decoration. On a four-player board colour alone is hard to
 * track, and for anyone who cannot separate red from green it carries nothing
 * at all — so every seat gets a mark, and the Players card repeats it beside
 * the name. The order here must match `src/games/palette.ts`.
 */
const SEAT_MARKS = [
  'rounded-full',        // circle
  'rounded-[2px]',       // square
  '',                    // triangle, via clipPath below
  'rounded-[2px] rotate-45' // diamond
] as const;

const markStyle = (seat: number): React.CSSProperties =>
  seat % 4 === 2 ? { clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' } : {};

export default function PlayerToken({
  color, seat, mine, className = '', markClassName = 'bg-white/85'
}: {
  color: string;
  seat: number;
  /** Rings the piece so you can find yourself at a glance. */
  mine?: boolean;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span
      // Position comes from the caller — a board places these absolutely, a
      // legend inline. Setting `relative` here collapsed the board's piece to
      // nothing, because `inset` does nothing without absolute positioning.
      className={`rounded-full flex items-center justify-center shrink-0 ${className}`}
      style={{
        backgroundColor: color,
        boxShadow: mine ? '0 0 0 2px #FFFFFF, 0 0 0 4px #1A1F26' : 'none'
      }}
    >
      <span
        className={`w-[42%] h-[42%] ${markClassName} ${SEAT_MARKS[seat % 4]}`}
        style={markStyle(seat)}
      />
    </span>
  );
}
