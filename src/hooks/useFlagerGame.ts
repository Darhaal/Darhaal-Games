import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { FlagerState, FlagerPlayerState } from '@/types/flager';
import { COUNTRY_CODES } from '@/data/flager/countries';

const generateFlags = (count: number): string[] => {
  const shuffled = [...COUNTRY_CODES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export function useFlagerGame(lobbyId: string | null, userId: string | undefined) {
  const [gameState, setGameState] = useState<FlagerState | null>(null);
  const [roomMeta, setRoomMeta] = useState<{ name: string; code: string; isHost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lobbyDeleted, setLobbyDeleted] = useState(false);

  const stateRef = useRef<{ lobbyId: string | null; userId: string | undefined; gameState: FlagerState | null }>({
    lobbyId, userId, gameState: null
  });

  useEffect(() => {
    stateRef.current = { lobbyId, userId, gameState };
  }, [lobbyId, userId, gameState]);

  // --- SYNC ---
  const fetchLobbyState = useCallback(async () => {
    if (!lobbyId) return;
    try {
      const { data } = await supabase.from('lobbies').select('name, code, host_id, game_state').eq('id', lobbyId).single();
      if (data) {
        setRoomMeta({ name: data.name, code: data.code, isHost: data.host_id === userId });
        if (data.game_state) setGameState(data.game_state);
      } else {
        setGameState(null);
        setLobbyDeleted(true);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [lobbyId, userId]);

  useEffect(() => {
    if (!lobbyId) return;
    fetchLobbyState();

    const ch = supabase.channel(`lobby-flager:${lobbyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => {
          if (payload.new.game_state) {
            setGameState(prev => {
                if (payload.new.status === 'waiting') return payload.new.game_state;
                if (prev && (payload.new.game_state.version || 0) < (prev.version || 0)) return prev;
                return payload.new.game_state;
            });
          }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
      () => {
          setGameState(null);
          setLobbyDeleted(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [lobbyId, fetchLobbyState]);

  const updateState = async (newState: FlagerState) => {
    newState.version = (newState.version || 0) + 1;
    newState.lastActionTime = Date.now();
    setGameState(newState);
    if (stateRef.current.lobbyId) {
       await supabase.from('lobbies').update({
           game_state: newState,
           status: newState.status
       }).eq('id', stateRef.current.lobbyId);
    }
  };

  // --- ACTIONS ---

  const initGame = async (userProfile: { name: string; avatarUrl: string }) => {
    if (!userId || !stateRef.current.gameState) return;
    const currentState = stateRef.current.gameState;

    if (!currentState.players.find(p => p.id === userId)) {
      if (currentState.status !== 'waiting') return;

      const newState = JSON.parse(JSON.stringify(currentState)) as FlagerState;
      const isFirst = newState.players.length === 0;

      newState.players.push({
          id: userId,
          name: userProfile.name,
          avatarUrl: userProfile.avatarUrl,
          isHost: isFirst,
          score: 0,
          guesses: [],
          hasFinishedRound: false,
          roundScore: 0
      });

      await updateState(newState);
    }
  };

  const startGame = async () => {
    const currentGs = stateRef.current.gameState;
    if (!currentGs) return;

    const rounds = currentGs.settings.totalRounds || 5;
    const flags = generateFlags(rounds);

    const newState: FlagerState = {
      ...currentGs,
      status: 'playing',
      targetChain: flags,
      currentRoundIndex: 0,
      roundStartTime: Date.now(),
      version: 1,
      players: currentGs.players.map(p => ({
          ...p,
          guesses: [],
          hasFinishedRound: false,
          roundScore: 0,
          score: 0
      }))
    };
    await updateState(newState);
  };

  const makeGuess = async (guessCode: string) => {
    const currentGs = stateRef.current.gameState;
    if (!currentGs || !userId || currentGs.status !== 'playing') return;

    const player = currentGs.players.find(p => p.id === userId);
    if (!player || player.hasFinishedRound) return;

    const targetFlag = currentGs.targetChain[currentGs.currentRoundIndex];
    const newState: FlagerState = JSON.parse(JSON.stringify(currentGs));
    const pIndex = newState.players.findIndex(p => p.id === userId);
    const pState = newState.players[pIndex];

    if (!pState.guesses.includes(guessCode)) {
        pState.guesses.push(guessCode);
    }

    const isCorrect = guessCode === targetFlag;
    const attemptsUsed = pState.guesses.length;

    if (isCorrect) {
        // SCORING:
        // Base: 1000
        // Penalty per guess: -50
        // Penalty per second: -5
        const timeTaken = (Date.now() - (currentGs.roundStartTime || Date.now())) / 1000;
        const baseScore = 1000;
        const guessPenalty = (attemptsUsed - 1) * 50;
        const timePenalty = Math.floor(timeTaken * 5);

        const points = Math.max(10, baseScore - guessPenalty - timePenalty);

        pState.score += points;
        pState.roundScore = points;
        pState.hasFinishedRound = true;
    }

    // Check if ALL players finished
    const allFinished = newState.players.every(p => p.hasFinishedRound);

    if (allFinished) {
        if (newState.currentRoundIndex >= newState.targetChain.length - 1) {
            newState.status = 'finished';
        } else {
            // Next round
            newState.currentRoundIndex++;
            newState.roundStartTime = Date.now(); // Reset timer for next round
            newState.players.forEach(p => {
                p.guesses = [];
                p.hasFinishedRound = false;
                p.roundScore = 0;
            });
        }
    }

    await updateState(newState);
  };

  const leaveGame = async () => {
     const currentGs = stateRef.current.gameState;
     if (!lobbyId || !userId || !currentGs) return;

     const newState = JSON.parse(JSON.stringify(currentGs));
     const wasHost = newState.players.find((p: FlagerPlayerState) => p.id === userId)?.isHost;

     newState.players = newState.players.filter((p: FlagerPlayerState) => p.id !== userId);

     if (newState.players.length === 0) {
         await supabase.from('lobbies').delete().eq('id', lobbyId);
     } else {
         if (wasHost && newState.players.length > 0) {
            newState.players[0].isHost = true;
         }
         // If everyone remaining has finished, proceed
         const allFinished = newState.players.every((p: FlagerPlayerState) => p.hasFinishedRound);
         if (allFinished && newState.status === 'playing') {
             if (newState.currentRoundIndex >= newState.targetChain.length - 1) {
                newState.status = 'finished';
             } else {
                newState.currentRoundIndex++;
                newState.roundStartTime = Date.now();
                newState.players.forEach((p: FlagerPlayerState) => {
                    p.guesses = [];
                    p.hasFinishedRound = false;
                    p.roundScore = 0;
                });
             }
         }

         await updateState(newState);
     }
  };

  return {
      gameState, roomMeta, loading, lobbyDeleted,
      initGame, startGame, makeGuess, leaveGame
  };
}