'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/hooks/useLang';
import { Loader2 } from 'lucide-react';
import UniversalLobby, { LobbyPlayer } from '@/components/UniversalLobby';
import { useWikilerGame } from '@/hooks/useWikilerGame';
import { useRematchRedirect } from '@/hooks/useRematchRedirect';
import WikilerGame from '@/components/WikilerGame';
import GameNotJoined from '@/components/GameNotJoined';
import LobbyChat from '@/components/LobbyChat';
import { requireGame, roomCapacity } from '@/games/registry';
import { seriesNamesOf, seriesWinsOf } from '@/lib/series';
import { showToast } from '@/lib/toast';

/** Player limits come from the registry; the room's own cap still wins. */
const GAME = requireGame('wikiler');

const UI_TEXT = {
  ru: {
    lobbyNotFound: 'Лобби не найдено',
    gameFinished: 'Игра завершена',
    toMenu: 'В меню',
    choosing: 'Выбираем статью…',
    noArticle: 'Википедия не ответила — попробуйте начать ещё раз'
  },
  en: {
    lobbyNotFound: 'LOBBY NOT FOUND',
    gameFinished: 'Game Finished',
    toMenu: 'Main Menu',
    choosing: 'Choosing an article…',
    noArticle: 'Wikipedia did not answer — try starting again'
  },
  uk: {
    lobbyNotFound: 'Лобі не знайдено',
    gameFinished: 'Гру завершено',
    toMenu: 'У меню',
    choosing: 'Обираємо статтю…',
    noArticle: 'Вікіпедія не відповіла — спробуйте почати ще раз'
  }
};

const Spinner = ({ label }: { label?: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-page">
    <Loader2 className="animate-spin text-accent w-8 h-8" />
    {label && <span className="text-sm font-bold text-muted">{label}</span>}
  </div>
);

function WikilerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const { lang } = useLang();
  // Every interface language has its Wikipedia: the reader's article is in it
  const wikiLang = lang;

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
    initGame, setLang, startGame, reportProgress, finishRound, forceRoundEnd,
    readyNextRound, forceNextRound, leaveGame
  } = useWikilerGame(lobbyId, userId);

  // An old link to this room follows "play again" into its successor.
  useRematchRedirect('wikiler', gameState, userId);

  useEffect(() => {
    if (userId && gameState && gameState.status === 'waiting'
      && !gameState.players.find(p => p.id === userId)
      && gameState.players.length < roomCapacity(GAME, gameState.settings?.maxPlayers)) {
      initGame({ name: userName, avatarUrl: userAvatar, lang: wikiLang });
    }
  }, [userId, gameState, initGame, userName, userAvatar, wikiLang]);

  // The article comes in the reader's language: a switch of the interface
  // language reaches the table, and the next round's article follows it.
  const mine = gameState?.players.find(p => p.id === userId);
  const langBehind = !!mine && mine.lang !== wikiLang
    && (gameState?.status === 'waiting' || gameState?.status === 'round_end');
  useEffect(() => {
    if (langBehind) setLang(wikiLang);
  }, [langBehind, wikiLang, setLang]);

  const t = UI_TEXT[lang];

  const handleLeave = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    await leaveGame();
    router.push('/play');
  };

  // Drawing the first article asks Wikipedia and takes a moment.
  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    const ok = await startGame();
    setStarting(false);
    if (!ok) showToast(t.noArticle, 'error');
  };

  if (authLoading || loading || isLeaving) return <Spinner />;
  if (!userId || !lobbyId) return null;

  if (lobbyDeleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-bold text-gray-400 bg-page">
        <span className="mb-4 text-xl text-ink uppercase">{t.gameFinished}</span>
        <button onClick={() => router.push('/play')} className="px-6 py-3 bg-ink text-on-ink rounded-xl font-bold uppercase tracking-widest hover:bg-accent transition-colors shadow-lg">
          {t.toMenu}
        </button>
      </div>
    );
  }

  if (!gameState) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">{t.lobbyNotFound}</div>;

  const seated = !!gameState.players.find(p => p.id === userId);

  // Late visitor: the game is already running and we are not part of it.
  if (gameState.status !== 'waiting' && !seated) return <GameNotJoined lang={lang} />;

  // The invite link bypasses the lobby list, so the room's own cap is enforced here too.
  if (!seated && gameState.players.length >= roomCapacity(GAME, gameState.settings?.maxPlayers)) {
    return <GameNotJoined lang={lang} reason="full" />;
  }

  if (gameState.status === 'waiting') {
    if (starting) return <Spinner label={t.choosing} />;
    const playersList: LobbyPlayer[] = gameState.players.map(p => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      isHost: p.isHost,
      isReady: true
    }));

    return (
      <>
        <UniversalLobby
          seriesWins={seriesWinsOf(gameState)}
          seriesNames={seriesNamesOf(gameState)}
          lobbyId={lobbyId}
          roomCode={roomMeta?.code || ''}
          roomName={roomMeta?.name || 'Wikiler'}
          gameType="wikiler"
          players={playersList}
          currentUserId={userId}
          minPlayers={GAME.players.min}
          maxPlayers={roomCapacity(GAME, gameState.settings?.maxPlayers)}
          onStart={handleStart}
          onLeave={handleLeave}
          lang={lang}
        />
        {seated && <LobbyChat lobbyId={lobbyId} userId={userId} lang={lang} />}
      </>
    );
  }

  return (
    <>
      <WikilerGame
        gameState={gameState}
        userId={userId}
        lobbyId={lobbyId}
        lang={lang}
        reportProgress={reportProgress}
        finishRound={finishRound}
        forceRoundEnd={forceRoundEnd}
        readyNextRound={readyNextRound}
        forceNextRound={forceNextRound}
        leaveGame={handleLeave}
      />
      {/* The results pin "play again" and "menu" to the bottom edge, and on a
          phone the guess bar is pinned there during a round. */}
      {seated && (
        <LobbyChat
          lobbyId={lobbyId}
          userId={userId}
          lang={lang}
          anchor={gameState.status === 'finished' ? 'top' : gameState.status === 'playing' ? 'top-below-lg' : 'bottom'}
        />
      )}
    </>
  );
}

export default function WikilerPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <WikilerContent />
    </Suspense>
  );
}
