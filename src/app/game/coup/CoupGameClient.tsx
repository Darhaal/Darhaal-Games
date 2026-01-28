'use client';

import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Info, Globe, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import GameInfoModal from './GameInfoModal';

// 🔴 ЦВЕТА КАРТОЧЕК (новые, но стиль сохранён)
export const CARD_COLORS = {
  duke: '#1E3A8A',        // Royal Blue
  assassin: '#7C2D12',   // Dark Rust
  captain: '#064E3B',    // Emerald Dark
  ambassador: '#78350F', // Bronze
  contessa: '#4C1D95',   // Royal Purple
};

export default function CoupGameClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyId = searchParams.get('id');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [showInfo, setShowInfo] = useState(false);

  // 🔁 Загрузка пользователя
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-red-600" />
      </div>
    );
  }

  if (!lobbyId) {
    router.push('/play');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* HEADER */}
      <header className="flex justify-between items-center p-4 border-b bg-white">
        <h1 className="font-black text-xl">COUP</h1>

        <div className="flex gap-2">
          <button onClick={() => setLang(l => l === 'ru' ? 'en' : 'ru')}>
            <Globe />
          </button>
          <button onClick={() => setShowInfo(true)}>
            <Info />
          </button>
        </div>
      </header>

      {/* ⬇️ ТУТ ВСТАВЛЯЕТСЯ ТВОЯ ОСНОВНАЯ ИГРА (players, cards, actions, realtime) */}
      {/* НИЧЕГО из логики Supabase ты не теряешь */}

      {showInfo && (
        <GameInfoModal lang={lang} onClose={() => setShowInfo(false)} />
      )}
    </div>
  );
}
