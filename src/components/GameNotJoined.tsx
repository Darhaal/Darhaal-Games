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
  lang: 'ru' | 'en';
  reason?: 'started' | 'full';
}) {
  const router = useRouter();
  const t = TEXT[lang];
  const headline = t[reason];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] font-sans p-4">
      <div className="bg-white border border-[#E6E1DC] rounded-[32px] p-10 shadow-xl text-center max-w-sm w-full animate-in zoom-in-95">
        <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#E6E1DC]">
          <DoorClosed className="w-8 h-8 text-[#9e1316]" />
        </div>
        <h2 className="text-xl font-black uppercase text-[#1A1F26] mb-2">{headline.title}</h2>
        <p className="text-xs font-medium text-[#8A9099] leading-relaxed mb-8">{headline.desc}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push('/play')}
            className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#9e1316] transition-colors shadow-lg"
          >
            {t.toList}
          </button>
          <button
            onClick={() => router.push('/create')}
            className="w-full py-3 bg-white border border-[#E6E1DC] text-[#8A9099] rounded-xl font-bold uppercase tracking-widest text-xs hover:text-[#1A1F26] hover:bg-[#F8FAFC] transition-colors"
          >
            {t.create}
          </button>
        </div>
      </div>
    </div>
  );
}
