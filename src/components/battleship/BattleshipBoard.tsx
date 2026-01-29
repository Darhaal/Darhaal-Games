'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useBattleshipGame } from '@/hooks/useBattleshipGame';
import { Lang } from '@/types/battleship';
import BattleshipLobby from './BattleshipLobby';
import BattleshipGame from './BattleshipGame';

interface UserProfile {
    id: string;
    name: string;
    avatarUrl: string;
}

export default function BattleshipBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [lang, setLang] = useState<Lang>('ru');
  const [isLeaving, setIsLeaving] = useState(false);

  // Получаем данные пользователя
  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
            setUser({
                id: authUser.id,
                name: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'Admiral',
                avatarUrl: authUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.id}`
            });
        }
    };
    fetchUser();
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang === 'en' || savedLang === 'ru') setLang(savedLang);
  }, []);

  // Передаем весь объект user в хук
  const {
      gameState, roomMeta, loading, initGame, startGame, leaveGame,
      autoPlaceShips, clearShips, submitShips, fireShot, myShips, placeShipManual, removeShip
  } = useBattleshipGame(lobbyId, user);

  useEffect(() => {
    if (user && gameState && !gameState.players?.[user.id]) {
        initGame();
    }
  }, [user, gameState, initGame]);

  const handleLeave = async () => {
      if (isLeaving) return;
      setIsLeaving(true);
      await leaveGame();
      router.push('/play');
  };

  useEffect(() => {
    const handlePopState = async () => {
        await leaveGame();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [leaveGame]);

  if (loading || isLeaving || !user) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
            <Loader2 className="animate-spin text-[#9e1316] w-8 h-8" />
        </div>
      );
  }

  if (!gameState) {
      return (
        <div className="min-h-screen flex items-center justify-center font-bold text-gray-400 uppercase tracking-widest">
            Лобби не найдено
        </div>
      );
  }

  if (gameState.status === 'waiting') {
      return (
        <BattleshipLobby
          gameState={gameState}
          roomMeta={roomMeta}
          userId={user.id}
          startGame={startGame}
          leaveGame={handleLeave}
          lang={lang}
        />
      );
  }

  return (
    <BattleshipGame
      gameState={gameState}
      userId={user.id}
      myShips={myShips}
      autoPlaceShips={autoPlaceShips}
      clearShips={clearShips}
      placeShipManual={placeShipManual} // Важно! передаем функцию
      removeShip={removeShip}
      submitShips={submitShips}
      fireShot={fireShot}
      leaveGame={handleLeave}
      lang={lang}
    />
  );
}