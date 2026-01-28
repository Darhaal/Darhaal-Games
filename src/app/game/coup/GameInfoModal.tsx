'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { CARD_COLORS } from './CoupGameClient';

const ROLES = {
  duke: {
    ru: { name: 'Герцог', desc: 'Берёт 3 монеты. Блокирует помощь.' },
    en: { name: 'Duke', desc: 'Take 3 coins. Blocks foreign aid.' },
  },
  assassin: {
    ru: { name: 'Ассасин', desc: 'Платит 3 монеты — убивает влияние.' },
    en: { name: 'Assassin', desc: 'Pay 3 coins to assassinate.' },
  },
  captain: {
    ru: { name: 'Капитан', desc: 'Крадёт 2 монеты. Блокирует кражу.' },
    en: { name: 'Captain', desc: 'Steal 2 coins. Blocks stealing.' },
  },
  ambassador: {
    ru: { name: 'Посол', desc: 'Меняет карты. Блокирует кражу.' },
    en: { name: 'Ambassador', desc: 'Exchange cards. Blocks stealing.' },
  },
  contessa: {
    ru: { name: 'Графиня', desc: 'Блокирует убийство.' },
    en: { name: 'Contessa', desc: 'Blocks assassination.' },
  },
};

export default function GameInfoModal({
  lang,
  onClose,
}: {
  lang: 'ru' | 'en';
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'rules' | 'cards'>('rules');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full relative">

        <button onClick={onClose} className="absolute top-4 right-4">
          <X />
        </button>

        {/* Tabs */}
        <div className="flex mb-4 border-b">
          <button
            onClick={() => setTab('rules')}
            className={`flex-1 py-2 font-bold ${tab === 'rules' && 'border-b-2 border-black'}`}
          >
            {lang === 'ru' ? 'Правила' : 'Rules'}
          </button>
          <button
            onClick={() => setTab('cards')}
            className={`flex-1 py-2 font-bold ${tab === 'cards' && 'border-b-2 border-black'}`}
          >
            {lang === 'ru' ? 'Карты' : 'Cards'}
          </button>
        </div>

        {tab === 'rules' && (
          <div className="text-sm space-y-2 text-gray-600">
            <p>• Каждый игрок имеет 2 влияния</p>
            <p>• Потерял оба — выбыл</p>
            <p>• При 10+ монетах переворот обязателен</p>
          </div>
        )}

        {tab === 'cards' && (
          <div className="space-y-3">
            {Object.entries(ROLES).map(([key, val]) => (
              <div
                key={key}
                className="p-3 rounded-xl text-white"
                style={{ backgroundColor: CARD_COLORS[key as keyof typeof CARD_COLORS] }}
              >
                <div className="font-black">
                  {val[lang].name}
                </div>
                <div className="text-sm opacity-90">
                  {val[lang].desc}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
