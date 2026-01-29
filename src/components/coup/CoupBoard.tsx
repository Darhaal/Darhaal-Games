'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useCoupGame } from '@/hooks/useCoupGame';
import { Lang } from '@/types/coup';
import UniversalLobby, { LobbyPlayer } from '@/components/UniversalLobby';
import CoupGame from './CoupGame';

export default function CoupBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [lang, setLang] = useState<Lang>('ru');
  const [isLeaving, setIsLeaving] = useState(false);

  const {
    gameState,
    roomMeta,
    loading,
    performAction,
    startGame,
    leaveGame,
    pass,
    challenge,
    block,
    resolveLoss,
    resolveExchange
  } = useCoupGame(lobbyId, userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang === 'en' || savedLang === 'ru') setLang(savedLang);
  }, []);

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

  if (loading || isLeaving) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316] w-8 h-8" /></div>;

  if (!gameState) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">LOBBY NOT FOUND</div>;

  if (gameState.status === 'waiting') {
      const playersList: LobbyPlayer[] = (gameState.players || []).map(p => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          isHost: p.isHost,
          isReady: p.isReady
      }));

      return (
        <UniversalLobby
          roomCode={roomMeta?.code || ''}
          roomName={roomMeta?.name || 'Coup'}
          gameType="coup"
          players={playersList}
          currentUserId={userId}
          minPlayers={2}
          maxPlayers={6}
          onStart={startGame}
          onLeave={handleLeave}
          lang={lang}
        />
      );
  }

  return (
    <CoupGame
      gameState={gameState}
      userId={userId}
      performAction={performAction}
      challenge={challenge}
      block={block}
      pass={pass}
      resolveLoss={resolveLoss}
      resolveExchange={resolveExchange}
      leaveGame={handleLeave}
      skipTurn={() => performAction('income')} // Simple skip for now
      lang={lang}
    />
  );
}