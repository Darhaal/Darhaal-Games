'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/hooks/useLang';
import { defaultAvatar } from '@/constants/app';
import { Loader2 } from 'lucide-react';
import { useBattleshipGame } from '@/hooks/useBattleshipGame';
import UniversalLobby, { LobbyPlayer } from '@/components/UniversalLobby';
import BattleshipGame from '@/components/BattleshipGame';
import GameNotJoined from '@/components/GameNotJoined';
import { requireGame, roomCapacity } from '@/games/registry';

/** Player limits come from the registry; the room's own cap still wins. */
const GAME = requireGame('battleship');

interface UserProfile {
    id: string;
    name: string;
    avatarUrl: string;
}

const UI_TEXT = {
  ru: {
    lobbyNotFound: 'Лобби не найдено',
    gameFinished: 'Игра завершена',
    toMenu: 'В меню',
    loading: 'Загрузка...',
  },
  en: {
    lobbyNotFound: 'LOBBY NOT FOUND',
    gameFinished: 'Game Finished',
    toMenu: 'Main Menu',
    loading: 'Loading...',
  }
};

function BattleshipContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { lang } = useLang();
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
            setUser({
                id: authUser.id,
                name: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'Admiral',
                avatarUrl: authUser.user_metadata?.avatar_url || defaultAvatar(authUser.id)
            });
        } else {
            const currentPath = window.location.pathname + window.location.search;
            router.push(`/?returnUrl=${encodeURIComponent(currentPath)}`);
        }
        setAuthLoading(false);
    };
    fetchUser();
  }, [router]);

  const {
      gameState, roomMeta, loading, lobbyDeleted, initGame, startGame, leaveGame,
      autoPlaceShips, clearShips, submitShips, fireShot, myShips, placeShipManual, removeShip, handleTimeout
  } = useBattleshipGame(lobbyId, user);

  useEffect(() => {
    if (user && gameState && gameState.status === 'waiting'
        && !gameState.players?.[user.id]
        && Object.keys(gameState.players ?? {}).length < roomCapacity(GAME, gameState.settings?.maxPlayers)) {
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
    const handlePopState = async () => { await leaveGame(); };
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [leaveGame]);

  const t = UI_TEXT[lang];

  if (authLoading || loading || isLeaving) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
            <Loader2 className="animate-spin text-[#9e1316] w-8 h-8" />
        </div>
      );
  }

  if (!user) return null;

  if (lobbyDeleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-bold text-gray-400 bg-[#F8FAFC]">
          <span className="mb-4 text-xl text-[#1A1F26] uppercase">{t.gameFinished}</span>
          <button onClick={() => router.push('/play')} className="px-6 py-3 bg-[#1A1F26] text-white rounded-xl font-bold uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg">
              {t.toMenu}
          </button>
      </div>
    );
  }

  if (!gameState) {
      return (
        <div className="min-h-screen flex items-center justify-center font-bold text-gray-400 uppercase tracking-widest">
            {t.lobbyNotFound}
        </div>
      );
  }

  // Late visitor: the game is already running and we are not part of it
  if (gameState.status !== 'waiting' && !gameState.players?.[user.id]) {
      return <GameNotJoined lang={lang} />;
  }

  // The invite link bypasses the lobby list, so the room's own cap has to
  // be enforced here too — otherwise a shared link seated any number of
  // players in a room the host had limited.
  if (!gameState.players?.[user.id] && Object.keys(gameState.players ?? {}).length >= roomCapacity(GAME, gameState.settings?.maxPlayers)) {
      return <GameNotJoined lang={lang} reason="full" />;
  }

  if (gameState.status === 'waiting') {
      const playersList: LobbyPlayer[] = Object.values(gameState.players).map((p) => ({
          id: p.id,
          name: p.name || 'Unknown',
          avatarUrl: p.avatarUrl || defaultAvatar(p.id || ''),
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
          minPlayers={GAME.players.min}
          maxPlayers={roomCapacity(GAME, gameState.settings?.maxPlayers)}
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
      handleTimeout={handleTimeout}
      lang={lang}
    />
  );
}

export default function BattleshipPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316] w-8 h-8" /></div>}>
      <BattleshipContent />
    </Suspense>
  );
}