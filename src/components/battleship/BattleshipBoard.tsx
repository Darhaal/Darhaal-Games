'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useBattleshipGame } from '@/hooks/useBattleshipGame';
import { Lang } from '@/types/battleship';
import UniversalLobby, { LobbyPlayer } from '@/components/UniversalLobby';
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
      // Mapping fix: handle both 'id' and 'userId' for safety
      const playersList: LobbyPlayer[] = Object.values(gameState.players).map((p: any) => ({
          id: p.id || p.userId,
          name: p.name || 'Unknown',
          avatarUrl: p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id || p.userId}`,
          isHost: p.isHost,
          isReady: p.isReady
      }));

      return (
        <UniversalLobby
          roomCode={roomMeta?.code || ''}
          roomName={roomMeta?.name || 'Battleship'}
          gameType="battleship"
          players={playersList}
          currentUserId={user.id}
          minPlayers={2}
          maxPlayers={2}
          onStart={startGame}
          onLeave={handleLeave}
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
      placeShipManual={placeShipManual}
      removeShip={removeShip}
      submitShips={submitShips}
      fireShot={fireShot}
      leaveGame={handleLeave}
      lang={lang}
    />
  );
}