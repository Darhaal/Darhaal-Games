'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useBattleshipGame } from '@/hooks/useBattleshipGame';
import { Lang } from '@/types/battleship';
import BattleshipLobby from './BattleshipLobby';
import BattleshipGame from './BattleshipGame';

export default function BattleshipBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lobbyId = searchParams.get('id');

  const [userId, setUserId] = useState<string>();
  const [lang, setLang] = useState<Lang>('ru');
  const [isLeaving, setIsLeaving] = useState(false);

  // Используем наш хук для морского боя
  const {
      gameState,
      roomMeta,
      loading,
      initGame,
      startGame, // Нужно будет добавить в хук для перевода status в 'playing'
      leaveGame,
      autoPlaceShips,
      clearShips,
      placeShipManual,
      removeShip,
      submitShips,
      fireShot,
      myShips
  } = useBattleshipGame(lobbyId, userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
    const savedLang = localStorage.getItem('dg_lang') as Lang;
    if (savedLang === 'en' || savedLang === 'ru') setLang(savedLang);
  }, []);

  // Инициализация игрока в лобби
  useEffect(() => {
    if (userId && gameState && !gameState.players?.[userId]) {
        initGame();
    }
  }, [userId, gameState, initGame]);

  const handleLeave = async () => {
      if (isLeaving) return;
      setIsLeaving(true);
      await leaveGame();
      router.push('/play');
  };

  // Обработка закрытия вкладки
  useEffect(() => {
    const handlePopState = async () => {
        await leaveGame();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [leaveGame]);

  if (loading || isLeaving) {
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

  // Если игра еще в режиме ожидания — показываем лобби
  if (gameState.status === 'waiting') {
      return (
        <BattleshipLobby
          gameState={gameState}
          roomMeta={roomMeta}
          userId={userId}
          startGame={startGame}
          leaveGame={handleLeave}
          lang={lang}
        />
      );
  }

  // Основной экран игры (Расстановка или Бой)
  return (
    <BattleshipGame
      gameState={gameState}
      userId={userId}
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
}'use client';

 import React, { useState, useEffect } from 'react';
 import { useSearchParams, useRouter } from 'next/navigation';
 import { supabase } from '@/lib/supabase';
 import { Loader2 } from 'lucide-react';
 import { useBattleshipGame } from '@/hooks/useBattleshipGame';
 import { Lang } from '@/types/battleship';
 import BattleshipLobby from './BattleshipLobby';
 import BattleshipGame from './BattleshipGame';

 export default function BattleshipBoard() {
   const searchParams = useSearchParams();
   const router = useRouter();
   const lobbyId = searchParams.get('id');

   const [userId, setUserId] = useState<string>();
   const [lang, setLang] = useState<Lang>('ru');
   const [isLeaving, setIsLeaving] = useState(false);

   // Используем наш хук для морского боя
   const {
       gameState,
       roomMeta,
       loading,
       initGame,
       startGame, // Нужно будет добавить в хук для перевода status в 'playing'
       leaveGame,
       autoPlaceShips,
       clearShips,
       placeShipManual,
       removeShip,
       submitShips,
       fireShot,
       myShips
   } = useBattleshipGame(lobbyId, userId);

   useEffect(() => {
     supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
     const savedLang = localStorage.getItem('dg_lang') as Lang;
     if (savedLang === 'en' || savedLang === 'ru') setLang(savedLang);
   }, []);

   // Инициализация игрока в лобби
   useEffect(() => {
     if (userId && gameState && !gameState.players?.[userId]) {
         initGame();
     }
   }, [userId, gameState, initGame]);

   const handleLeave = async () => {
       if (isLeaving) return;
       setIsLeaving(true);
       await leaveGame();
       router.push('/play');
   };

   // Обработка закрытия вкладки
   useEffect(() => {
     const handlePopState = async () => {
         await leaveGame();
     };
     window.addEventListener('popstate', handlePopState);
     return () => {
         window.removeEventListener('popstate', handlePopState);
     };
   }, [leaveGame]);

   if (loading || isLeaving) {
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

   // Если игра еще в режиме ожидания — показываем лобби
   if (gameState.status === 'waiting') {
       return (
         <BattleshipLobby
           gameState={gameState}
           roomMeta={roomMeta}
           userId={userId}
           startGame={startGame}
           leaveGame={handleLeave}
           lang={lang}
         />
       );
   }

   // Основной экран игры (Расстановка или Бой)
   return (
     <BattleshipGame
       gameState={gameState}
       userId={userId}
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