'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import UniversalLobby, { LobbyPlayer } from '@/components/UniversalLobby';
import { useFlagerGame } from '@/hooks/useFlagerGame';
import FlagerGame from '@/components/FlagerGame';

function FlagerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [isLeaving, setIsLeaving] = useState(false);

  const {
    gameState, roomMeta, loading, lobbyDeleted,
    initGame, startGame, makeGuess, leaveGame
  } = useFlagerGame(lobbyId, userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
            setUserId(data.user.id);
            setUserName(data.user.user_metadata?.username || 'Player');
            setUserAvatar(data.user.user_metadata?.avatar_url || '');
        }
    });
  }, []);

  useEffect(() => {
      if (userId && gameState && !gameState.players.find(p => p.id === userId)) {
          initGame({ name: userName, avatarUrl: userAvatar });
      }
  }, [userId, gameState, initGame, userName, userAvatar]);

  const handleLeave = async () => {
      if (isLeaving) return;
      setIsLeaving(true);
      await leaveGame();
      router.push('/play');
  };

  if (loading || isLeaving) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316] w-8 h-8" /></div>;

  if (lobbyDeleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-bold text-gray-400 bg-[#F8FAFC]">
          <span className="mb-4 text-xl text-[#1A1F26]">ХОСТ ПОКИНУЛ ИГРУ</span>
          <button onClick={() => router.push('/play')} className="px-6 py-3 bg-[#1A1F26] text-white rounded-xl font-bold uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg">
              В меню
          </button>
      </div>
    );
  }

  if (!gameState) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">LOBBY NOT FOUND</div>;

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
          roomCode={roomMeta?.code || ''}
          roomName={roomMeta?.name || 'Flager'}
          gameType="flager"
          players={playersList}
          currentUserId={userId}
          minPlayers={1}
          maxPlayers={4}
          onStart={startGame}
          onLeave={handleLeave}
          lang={'ru'}
        />
      );
  }

  if (userId) {
      return (
        <FlagerGame
          gameState={gameState}
          userId={userId}
          makeGuess={makeGuess}
          leaveGame={handleLeave}
        />
      );
  }
  return null;
}

export default function FlagerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316] w-8 h-8" /></div>}>
      <FlagerContent />
    </Suspense>
  );
}