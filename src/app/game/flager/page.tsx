'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/hooks/useLang';
import { Loader2 } from 'lucide-react';
import UniversalLobby, { LobbyPlayer } from '@/components/UniversalLobby';
import { useFlagerGame } from '@/hooks/useFlagerGame';
import { useRematchRedirect } from '@/hooks/useRematchRedirect';
import FlagerGame from '@/components/FlagerGame';
import GameNotJoined from '@/components/GameNotJoined';
import { requireGame, roomCapacity } from '@/games/registry';

/** Player limits come from the registry; the room's own cap still wins. */
const GAME = requireGame('flager');

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

function FlagerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);

  const [isLeaving, setIsLeaving] = useState(false);
  const { lang } = useLang();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
          setUserId(data.user.id);
          setUserName(data.user.user_metadata?.username || 'Player');
          setUserAvatar(data.user.user_metadata?.avatar_url || '');
      } else {
          const currentPath = window.location.pathname + window.location.search;
          router.push(`/?returnUrl=${encodeURIComponent(currentPath)}`);
      }
      setAuthLoading(false);
    };
    checkUser();

  }, [router]);

  const {
    gameState, roomMeta, loading, lobbyDeleted,
    initGame, startGame, makeGuess, leaveGame, readyNextRound, handleTimeout,
    forceRoundEnd
  } = useFlagerGame(lobbyId, userId);

  // An old link to this room follows "play again" into its successor.
  useRematchRedirect('flager', gameState, userId);

  useEffect(() => {
      if (userId && gameState && gameState.status === 'waiting'
          && !gameState.players.find(p => p.id === userId)
          && gameState.players.length < roomCapacity(GAME, gameState.settings?.maxPlayers)) {
          initGame({ name: userName, avatarUrl: userAvatar });
      }
  }, [userId, gameState, initGame, userName, userAvatar]);

  const handleLeave = async () => {
      if (isLeaving) return;
      setIsLeaving(true);
      await leaveGame();
      router.push('/play');
  };

  const t = UI_TEXT[lang];

  if (authLoading || loading || isLeaving) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316] w-8 h-8" /></div>;

  if (!userId) return null;

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

  if (!gameState) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">{t.lobbyNotFound}</div>;

  // Late visitor: the game is already running and we are not part of it
  if (gameState.status !== 'waiting' && !gameState.players.find(p => p.id === userId)) {
      return <GameNotJoined lang={lang} />;
  }

  // The invite link bypasses the lobby list, so the room's own cap has to
  // be enforced here too — otherwise a shared link seated any number of
  // players in a room the host had limited.
  if (!gameState.players.find(p => p.id === userId) && gameState.players.length >= roomCapacity(GAME, gameState.settings?.maxPlayers)) {
      return <GameNotJoined lang={lang} reason="full" />;
  }

  if (gameState.status === 'waiting') {
      const playersList: LobbyPlayer[] = gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          isHost: p.isHost,
          isReady: true
      }));

      return (
        <UniversalLobby
          lobbyId={lobbyId}
          roomCode={roomMeta?.code || ''}
          roomName={roomMeta?.name || 'Flager'}
          gameType="flager"
          players={playersList}
          currentUserId={userId}
          minPlayers={GAME.players.min}
          maxPlayers={roomCapacity(GAME, gameState.settings?.maxPlayers)}
          onStart={startGame}
          onLeave={handleLeave}
          lang={lang}
        />
      );
  }

  return (
    <FlagerGame
      gameState={gameState}
      userId={userId}
      makeGuess={makeGuess}
      handleTimeout={handleTimeout}
      forceRoundEnd={forceRoundEnd}
      readyNextRound={readyNextRound}
      leaveGame={handleLeave}
      lang={lang}
    />
  );
}

export default function FlagerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316] w-8 h-8" /></div>}>
      <FlagerContent />
    </Suspense>
  );
}