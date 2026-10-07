import { useEffect, useRef } from 'react';
import type { SonglerPlayer, SonglerSong, SonglerState } from '@/types/songler';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { requireGame, roomCapacity } from '@/games/registry';
import { newSonglerPlayer } from '@/games/initialState';
import { recordMatch, matchKey, matchSeconds } from '@/lib/matchRecords';
import { pushNotice, leftTheGame } from '@/lib/notifications';
import { pickSong } from '@/lib/songler/pool';
import { isDone, matchDetails, scoreRound, verdictOf } from '@/lib/gameLogic/songler';

/**
 * Songler's shared state — docs/songler-spec.md, sections 2 and 10.
 *
 * A try is written as it is made, so the others see how many each player has
 * used; what they named stays on screen only for them until the round ends.
 * Whoever closes the round — the last to finish, or anyone once time is up —
 * scores it for everybody, because the places need every result at once.
 */

const GAME = requireGame('songler');

// Module-level helper: sidesteps the react-compiler purity heuristic
// (Date.now inside event handlers is a legitimate use)
const now = () => Date.now();
const clone = (s: SonglerState): SonglerState => JSON.parse(JSON.stringify(s));

/** Time to load the audio before guessing opens. */
const START_DELAY_MS = 3000;
/** The results wait this long for "next" before the next round starts anyway. */
export const SONGLER_BETWEEN_ROUNDS_SECONDS = 60;
/** A try may land this long after the clock, for a press at the last second. */
const LATE_MS = 1500;

function resetForRound(p: SonglerPlayer): SonglerPlayer {
  return { ...p, attempts: [], isReadyForNextRound: false };
}

/** Scores the round from everyone's tries and closes it (section 4). */
export function closeRound(state: SonglerState) {
  if (state.status !== 'playing' || !state.round || state.players.length === 0) return;
  const results = scoreRound(state.players, state.round.song, state.settings.roundDuration * 1000);
  state.players = state.players.map((p) => {
    const result = results.get(p.id)!;
    return { ...p, history: [...p.history, result], score: p.score + result.score };
  });
  state.status = 'round_end';
  state.roundEndedAt = now();
}

function closeIfAllDone(state: SonglerState) {
  if (state.status === 'playing' && state.players.length > 0 && state.players.every((p) => isDone(p.attempts))) closeRound(state);
}

function startRound(state: SonglerState, song: SonglerSong, index: number) {
  state.status = 'playing';
  state.round = { song, startTime: now() + START_DELAY_MS };
  state.roundIndex = index;
  state.next = null;
  state.played = [...state.played, song.id];
  state.roundEndedAt = undefined;
  state.players = state.players.map(resetForRound);
}

/** Starts the next round — or ends the match — once everyone is ready and the song is drawn. */
function advanceIfAllReady(state: SonglerState) {
  if (state.status !== 'round_end' || state.players.length === 0) return;
  if (!state.players.every((p) => p.isReadyForNextRound)) return;
  if (state.roundIndex + 1 >= state.settings.rounds) {
    state.status = 'finished';
    return;
  }
  if (state.next) startRound(state, state.next, state.roundIndex + 1);
}

export function useSonglerGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<SonglerState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-songler'
  });

  /**
   * Seat the player. Retryable on purpose: an invite link posted in a group
   * chat gets opened by everyone at once.
   */
  const initGame = async (profile: { name: string; avatarUrl: string }) => {
    if (!userId || !lobbyId) return;
    await updateState((current) => {
      if (current.players.some((p) => p.id === userId)) return null;
      if (current.status !== 'waiting') return null;
      if (current.players.length >= roomCapacity(GAME, current.settings?.maxPlayers)) return null;
      const next = clone(current);
      next.players.push(newSonglerPlayer({
        id: userId, name: profile.name, avatarUrl: profile.avatarUrl, isHost: next.players.length === 0
      }));
      return next;
    });
  };

  /** The host draws the first song, then opens the match. `false` if the pool could not be loaded. */
  const startGame = async (): Promise<boolean> => {
    const snapshot = gameStateRef.current;
    if (!snapshot || snapshot.status !== 'waiting') return false;
    const song = await pickSong(snapshot.settings, new Set());
    if (!song) return false;
    await updateState((current) => {
      if (current.status !== 'waiting') return null;
      const next = clone(current);
      next.played = [];
      next.startTime = now();
      next.players = next.players.map((p) => ({ ...resetForRound(p), score: 0, history: [] }));
      startRound(next, song, 0);
      return next;
    });
    return true;
  };

  /** One try: a song named from the suggestions, or `null` to skip and hear more. */
  const attempt = async (guess: { id: number; title: string; artist: string } | null) => {
    if (!userId) return;
    await updateState((current) => {
      if (current.status !== 'playing' || !current.round) return null;
      const at = now() - current.round.startTime;
      if (at < 0 || at > current.settings.roundDuration * 1000 + LATE_MS) return null;
      const me = current.players.find((p) => p.id === userId);
      if (!me || isDone(me.attempts)) return null;
      // The same wrong name twice is not a try.
      if (guess && me.attempts.some((a) => a.guess?.id === guess.id)) return null;
      const next = clone(current);
      next.players.find((p) => p.id === userId)!.attempts.push({
        verdict: verdictOf(guess, current.round.song),
        ...(guess ? { guess: { id: guess.id, title: guess.title, artist: guess.artist } } : {}),
        at
      });
      closeIfAllDone(next);
      return next;
    });
  };

  /**
   * Time is up: the round closes with the tries it has. Anyone still here
   * may close it, so a closed tab cannot hold the table.
   */
  const forceRoundEnd = async () => {
    await updateState((current) => {
      if (current.status !== 'playing' || !current.round) return null;
      const end = current.round.startTime + current.settings.roundDuration * 1000;
      if (now() - end < LATE_MS) return null;
      const next = clone(current);
      closeRound(next);
      return next;
    });
  };

  const readyNextRound = async () => {
    if (!userId) return;
    await updateState((current) => {
      if (current.status !== 'round_end') return null;
      const me = current.players.find((p) => p.id === userId);
      if (!me || me.isReadyForNextRound) return null;
      const next = clone(current);
      next.players.find((p) => p.id === userId)!.isReadyForNextRound = true;
      advanceIfAllReady(next);
      return next;
    });
  };

  /** A minute after a round, the next starts for everyone — a closed tab cannot hold it back. */
  const forceNextRound = async () => {
    await updateState((current) => {
      if (current.status !== 'round_end' || !current.roundEndedAt) return null;
      if (now() - current.roundEndedAt < SONGLER_BETWEEN_ROUNDS_SECONDS * 1000) return null;
      if (current.players.every((p) => p.isReadyForNextRound)) return null;
      const next = clone(current);
      next.players = next.players.map((p) => ({ ...p, isReadyForNextRound: true }));
      advanceIfAllReady(next);
      return next;
    });
  };

  // The host draws the next song while everyone looks at the results, so
  // "next" does not wait on the pool. A host who leaves hands this on with
  // the host role.
  const drawing = useRef<string | null>(null);
  const isHost = !!gameState?.players.find((p) => p.id === userId)?.isHost;
  const needsDraw = gameState?.status === 'round_end' && !gameState.next &&
    gameState.roundIndex + 1 < gameState.settings.rounds && isHost;
  const drawKey = needsDraw ? `${gameState!.roundIndex}:${gameState!.round?.song.id}` : null;
  useEffect(() => {
    if (!drawKey || drawing.current === drawKey) return;
    drawing.current = drawKey;
    const snapshot = gameStateRef.current;
    if (!snapshot) return;
    (async () => {
      const song = await pickSong(snapshot.settings, new Set(snapshot.played));
      if (!song) {
        drawing.current = null; // try again on the next render
        return;
      }
      await updateState((current) => {
        if (current.status !== 'round_end' || current.next) return null;
        const next = clone(current);
        next.next = song;
        advanceIfAllReady(next);
        return next;
      });
    })();
  }, [drawKey, gameStateRef, updateState]);

  /**
   * Records this player's match. Keyed by the match, so the finish, a reload
   * of the results and a leave racing the finish all count it once.
   */
  const record = (state: SonglerState, left = false) => {
    const me = state.players.find((p) => p.id === userId);
    if (!lobbyId || !me || !state.startTime) return Promise.resolve(false);
    const details = matchDetails(me.history);
    const solo = state.players.length === 1;
    const top = Math.max(...state.players.map((p) => p.score));
    // Alone, a match is won by naming more than half the songs.
    const won = !left && (solo ? details.solved * 2 > Math.max(1, details.rounds) : me.score >= top);
    return recordMatch({
      game: 'songler',
      key: matchKey(lobbyId, state.startTime),
      result: won ? 'win' : 'loss',
      mode: solo ? 'single' : 'multi',
      durationSeconds: matchSeconds(state.startTime, left ? now() : state.lastActionTime,
        state.settings.rounds * state.settings.roundDuration),
      score: me.score,
      details: {
        ...details,
        category: state.settings.category,
        difficulty: state.settings.difficulty,
        ...(left ? { left: true } : {})
      }
    });
  };

  const leaveGame = async () => {
    if (!lobbyId || !userId) return;

    // A finished match is a record, not live state: leaving must not rewrite
    // the results the others are still looking at.
    const snapshot = gameStateRef.current;
    if (!snapshot || snapshot.status === 'finished') return;

    // Walking out of a match in progress is losing it.
    if (snapshot.status === 'playing' || snapshot.status === 'round_end') await record(snapshot, true);

    const others = snapshot.players.filter((p) => p.id !== userId);
    if (others.length === 0) {
      await deleteLobby();
      return;
    }

    await updateState((current) => {
      if (current.status === 'finished') return null;
      const leaving = current.players.find((p) => p.id === userId);
      if (!leaving) return null;
      const next = clone(current);
      next.players = next.players.filter((p) => p.id !== userId);
      if (next.players.length === 0) return null;
      if (leaving.isHost) next.players[0].isHost = true;
      pushNotice(next, leftTheGame(leaving.name), 'leave');
      // The round waits for everyone to finish and the next for everyone
      // ready: without the leaver, it may be time for either.
      closeIfAllDone(next);
      advanceIfAllReady(next);
      return next;
    });
  };

  // The finished match, recorded once for this player (see `record`).
  useEffect(() => {
    if (gameState?.status !== 'finished' || !userId || lobbyDeleted) return;
    record(gameState);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per finished match; the key makes a repeat harmless
  }, [gameState?.status, userId, lobbyDeleted]);

  return {
    gameState, roomMeta, loading, lobbyDeleted,
    initGame, startGame, attempt, forceRoundEnd,
    readyNextRound, forceNextRound, leaveGame
  };
}
