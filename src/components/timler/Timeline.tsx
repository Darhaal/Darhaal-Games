'use client';

import React from 'react';
import Image from 'next/image';
import { along, stackRows, timelineAxis, toYears, type TimlerDate } from '@/lib/gameLogic/timler';
import { formatReleaseDate } from '@/constants/version';

/**
 * The results timeline — docs/timler-spec.md, section 5: a scale wide enough
 * for every answer and the right date, each answer a bubble in its player's
 * colour with their avatar inside, close answers stacked rather than covering
 * each other, the right date a red line. The bubbles drop in one by one, the
 * furthest first, so the closest lands last.
 */

export interface TimelineGuess {
  id: string;
  name: string;
  avatarUrl: string;
  color: string;
  date: TimlerDate;
  /** Closest this round — ringed. */
  best: boolean;
}

const MONTHS = {
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};

/** How a date reads under the photo: "1 сентября 1939", or the year alone. */
export function formatDate(d: TimlerDate, lang: 'ru' | 'en'): string {
  if (d.month === undefined || d.day === undefined) return String(d.year);
  return formatReleaseDate(`${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`, lang);
}

function tickLabel(at: number, step: number, lang: 'ru' | 'en'): string {
  if (step >= 1) return String(Math.round(at));
  const year = Math.floor(at + 1e-9);
  const month = Math.round((at - year) * 12) % 12;
  return `${MONTHS[lang][month]} ${year}`;
}

/** Bubble diameter, and the share of the width two bubbles in a row keep apart. */
const BUBBLE = 36;
const GAP = 0.08;
const ROW = BUBBLE + 6;

export default function Timeline({ answer, guesses, lang }: {
  answer: TimlerDate;
  guesses: TimelineGuess[];
  lang: 'ru' | 'en';
}) {
  const answerAt = toYears(answer);
  const points = [
    { at: answerAt, day: answer.day !== undefined },
    ...guesses.map((g) => ({ at: toYears(g.date), day: g.date.day !== undefined }))
  ];
  const axis = timelineAxis(points);
  const xs = guesses.map((g) => along(axis, toYears(g.date)));
  const rows = stackRows(xs, GAP);
  const height = (Math.max(0, ...rows) + 1) * ROW + 14;
  // Furthest first: the order the bubbles drop in.
  const order = guesses
    .map((g, i) => ({ i, off: Math.abs(toYears(g.date) - answerAt) }))
    .sort((a, b) => b.off - a.off)
    .map((o, rank) => [o.i, rank] as const);
  const delay = new Map(order);

  return (
    <div className="select-none" aria-label={formatDate(answer, lang)}>
      <div className="relative mx-5" style={{ height: height + 34 }}>
        {/* The right date */}
        <div
          className="absolute top-0 bottom-6 w-0.5 bg-[#9e1316] -translate-x-1/2"
          style={{ left: `${along(axis, answerAt) * 100}%` }}
          aria-hidden
        />

        {/* The answers */}
        {guesses.map((g, i) => (
          <div
            key={g.id}
            className="absolute -translate-x-1/2 flex flex-col items-center animate-bubble-in motion-reduce:animate-none"
            style={{
              left: `${xs[i] * 100}%`,
              bottom: 34,
              height: rows[i] * ROW + BUBBLE + 8,
              animationDelay: `${(delay.get(i) ?? 0) * 220}ms`
            }}
            title={`${g.name}: ${formatDate(g.date, lang)}`}
          >
            <div
              className={`rounded-full overflow-hidden bg-white shrink-0 ${g.best ? 'ring-2 ring-offset-2 ring-[#9e1316]' : ''}`}
              style={{ width: BUBBLE, height: BUBBLE, border: `3px solid ${g.color}` }}
            >
              <Image src={g.avatarUrl} alt={g.name} width={BUBBLE} height={BUBBLE} className="w-full h-full object-cover" unoptimized />
            </div>
            <div className="flex-1 w-0.5" style={{ backgroundColor: g.color }} aria-hidden />
          </div>
        ))}

        {/* The scale */}
        <div className="absolute left-0 right-0 h-0.5 bg-[#1A1F26] rounded-full" style={{ bottom: 32 }} aria-hidden />
        {axis.ticks.map((tick) => (
          <div
            key={tick}
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${along(axis, tick) * 100}%`, bottom: 0 }}
          >
            <div className="w-px h-2 bg-[#1A1F26] mb-1" aria-hidden />
            <span className="text-2xs font-bold text-[#8A9099] tabular-nums whitespace-nowrap">{tickLabel(tick, axis.step, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
