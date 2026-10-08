'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { DoorClosed } from 'lucide-react';

const TEXT = {
  ru: {
    started: {
      title: 'Игра уже началась',
      desc: 'Присоединиться к идущему матчу нельзя. Дождитесь следующей игры или создайте свою.'
    },
    full: {
      title: 'В комнате нет мест',
      desc: 'Все места уже заняты. Попросите хозяина комнаты открыть новую или создайте свою.'
    },
    toList: 'К списку игр',
    create: 'Создать игру'
  },
  en: {
    started: {
      title: 'Game already in progress',
      desc: 'You cannot join a match that has already started. Wait for the next game or create your own.'
    },
    full: {
      title: 'Room is full',
      desc: 'Every seat is taken. Ask the host to open another room, or create your own.'
    },
    toList: 'Browse games',
    create: 'Create game'
  },
  uk: {
    started: {
      title: 'Гра вже почалася',
      desc: 'Приєднатися до матчу, що триває, не можна. Дочекайтеся наступної гри або створіть свою.'
    },
    full: {
      title: 'У кімнаті немає місць',
      desc: 'Усі місця вже зайняті. Попросіть господаря кімнати відкрити нову або створіть свою.'
    },
    toList: 'До списку ігор',
    create: 'Створити гру'
  }
};

/**
 * Screen for a visitor who cannot take a seat: the match is already running,
 * or the room is at capacity. The invite link does not check either, so both
 * end up here.
 */
export default function GameNotJoined({
  lang,
  reason = 'started'
}: {
  lang: 'ru' | 'en' | 'uk';
  reason?: 'started' | 'full';
}) {
  const router = useRouter();
  const t = TEXT[lang];
  const headline = t[reason];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-page font-sans p-4">
      <div className="bg-surface border border-line rounded-[32px] p-10 shadow-xl text-center max-w-sm w-full animate-in zoom-in-95">
        <div className="w-16 h-16 bg-warm rounded-2xl flex items-center justify-center mx-auto mb-6 border border-line">
          <DoorClosed className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-xl font-black uppercase text-ink mb-2">{headline.title}</h2>
        <p className="text-xs font-medium text-muted leading-relaxed mb-8">{headline.desc}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push('/play')}
            className="w-full py-4 bg-ink text-on-ink rounded-xl font-black uppercase tracking-widest text-xs hover:bg-accent transition-colors shadow-lg"
          >
            {t.toList}
          </button>
          <button
            onClick={() => router.push('/create')}
            className="w-full py-3 bg-surface border border-line text-muted rounded-xl font-bold uppercase tracking-widest text-xs hover:text-ink hover:bg-page transition-colors"
          >
            {t.create}
          </button>
        </div>
      </div>
    </div>
  );
}
