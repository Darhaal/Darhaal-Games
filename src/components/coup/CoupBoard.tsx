'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useCoupGame } from '@/hooks/useCoupGame';
import { Lang } from '@/types/coup';
import CoupLobby from './CoupLobby';
import CoupGame from './CoupGame';

export default function CoupBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [lang, setLang] = useState<Lang>('ru');
  const [isLeaving, setIsLeaving] = useState(false);

  const { gameState, roomMeta, loading, performAction, startGame, leaveGame, pass, challenge, block, resolveLoss, resolveExchange } = useCoupGame(lobbyId, userId);

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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
    };
    const handlePopState = async () => {
        await leaveGame();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
    };
  }, [leaveGame]);

  if (loading || isLeaving) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316]" /></div>;
  if (!gameState) return <div className="min-h-screen flex items-center justify-center">Lobby not found</div>;

  if (gameState.status === 'waiting') {

      return (
        <UniversalLobby
          roomCode={roomMeta?.code || ''}
          roomName={roomMeta?.name || 'Coup'}
          gameType="coup"
          players={playersList}
          currentUserId={user.id}
          minPlayers={2}
          maxPlayers={6}
          onStart={startGame}
          onLeave={handleLeave}
          lang={lang}
        />
      );

  return <CoupGame
    gameState={gameState}
    userId={userId}
    performAction={performAction}
    challenge={challenge}
    block={block}
    pass={pass}
    resolveLoss={resolveLoss}
    resolveExchange={resolveExchange}
    leaveGame={handleLeave}
    lang={lang}
  />;
}