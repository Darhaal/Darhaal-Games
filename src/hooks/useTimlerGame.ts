import { useEffect, useRef } from 'react';
import type { TimlerPhoto, TimlerPlayer, TimlerState } from '@/types/timler';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { requireGame, roomCapacity } from '@/games/registry';
import { newTimlerPlayer } from '@/games/initialState';
import { recordMatch, matchKey, matchSeconds } from '@/lib/matchRecords';
import { pushNotice, leftTheGame } from '@/lib/notifications';
import { pickPhoto } from '@/lib/timler/pool';
import { hasDay, matchDetails, parseDate, scoreRound, validDay, type TimlerDate } from '@/lib/gameLogic/timler';

/**
 * Timler's shared state — docs/timler-spec.md, sections 2 and 10.
 *
 * A player's answer is written once, when they press "Answer"; the others
 * see only that they have answered until the round closes. Whoever closes
 * the round — the last to answer, or anyone once time is up — scores it for
 * everybody, because the places need every answer at once.
 */

const GAME = requireGame('timler');

// Module-level helper: sidesteps the react-compiler purity heuristic
// (Date.now inside event handlers is a legitimate use)
const now = () => Date.now();
const clone = (s: TimlerState): TimlerState => JSON.parse(JSON.stringify(s));

/** Time to load the photo before answering opens. */
const START_DELAY_MS = 3000;
/** The results wait this long for "next" before the next round starts anyway. */
export const TIMLER_BETWEEN_ROUNDS_SECONDS = 60;
/** An answer may land this long after the clock, for a press at the last second. */
const LATE_ANSWER_MS = 1500;

function resetForRound(p: TimlerPlayer): TimlerPlayer {
  return { ...p, guess: null, isReadyForNextRound: false };
}

/** Scores the round from every answer and closes it (section 4). */
export function closeRound(state: TimlerState) {
  if (state.status !== 'playing' || !state.round || state.players.length === 0) return;
  const results = scoreRound(state.players, state.round.photo, state.settings.roundDuration * 1000);
  if (results.size === 0) return;
  state.players = state.players.map((p) => {
    const result = results.get(p.id)!;
    return { ...p, history: [...p.history, result], score: p.score + result.score };
  });
  state.status = 'round_end';
  state.roundEndedAt = now();
}

const stripAt = ({ year, month, day }: TimlerDate & { at?: number }): TimlerDate =>
  month !== undefined && day !== undefined ? { year, month, day } : { year };

function closeIfAllAnswered(state: TimlerState) {
  if (state.status === 'playing' && state.players.length > 0 && state.players.every((p) => p.guess)) closeRound(state);
}

function startRound(state: TimlerState, photo: TimlerPhoto, index: number) {
  state.status = 'playing';
  state.round = { photo, startTime: now() + START_DELAY_MS };
  state.roundIndex = index;
  state.next = null;
  state.played = [...state.played, photo.file];
  state.roundEndedAt = undefined;
  state.players = state.players.map(resetForRound);
}

/** Starts the next round — or ends the match — once everyone is ready and the photo is drawn. */
function advanceIfAllReady(state: TimlerState) {
  if (state.status !== 'round_end' || state.players.length === 0) return;
  if (!state.players.every((p) => p.isReadyForNextRound)) return;
  if (state.roundIndex + 1 >= state.settings.rounds) {
    state.status = 'finished';
    return;
  }
  if (state.next) startRound(state, state.next, state.roundIndex + 1);
}

export function useTimlerGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<TimlerState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-timler'
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
      next.players.push(newTimlerPlayer({
        id: userId, name: profile.name, avatarUrl: profile.avatarUrl, isHost: next.players.length === 0
      }));
      return next;
    });
  };

  /** The host draws the first photo, then opens the match. `false` if the pool could not be loaded. */
  const startGame = async (): Promise<boolean> => {
    const snapshot = gameStateRef.current;
    if (!snapshot || snapshot.status !== 'waiting') return false;
    const photo = await pickPhoto(snapshot.settings, new Set());
    if (!photo) return false;
    await updateState((current) => {
      if (current.status !== 'waiting') return null;
      const next = clone(current);
      next.played = [];
      next.startTime = now();
      next.players = next.players.map((p) => ({ ...resetForRound(p), score: 0, history: [] }));
      startRound(next, photo, 0);
      return next;
    });
    return true;
  };

  /** This player's answer: a year, or a whole date if the photo has one. Final once written. */
  const answer = async (guess: TimlerDate) => {
    if (!userId || !validDay(guess)) return;
    await updateState((current) => {
      if (current.status !== 'playing' || !current.round) return null;
      const at = now() - current.round.startTime;
      if (at < 0 || at > current.settings.roundDuration * 1000 + LATE_ANSWER_MS) return null;
      const me = current.players.find((p) => p.id === userId);
      if (!me || me.guess) return null;
      const photoDate = parseDate(current.round.photo.date);
      // A day and month only count where the photo has them.
      const kept = photoDate && hasDay(photoDate) ? stripAt(guess) : { year: guess.year };
      const next = clone(current);
      next.players.find((p) => p.id === userId)!.guess = { ...kept, at };
      closeIfAllAnswered(next);
      return next;
    });
  };

  /**
   * Time is up: the round closes with the answers it has. Anyone still here
   * may close it, so a closed tab cannot hold the table.
   */
  const forceRoundEnd = async () => {
    await updateState((current) => {
      if (current.status !== 'playing' || !current.round) return null;
      const end = current.round.startTime + current.settings.roundDuration * 1000;
      if (now() - end < LATE_ANSWER_MS) return null;
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
      if (now() - current.roundEndedAt < TIMLER_BETWEEN_ROUNDS_SECONDS * 1000) return null;
      // Already forced: the round starts when the host's draw lands.
      if (current.players.every((p) => p.isReadyForNextRound)) return null;
      const next = clone(current);
      next.players = next.players.map((p) => ({ ...p, isReadyForNextRound: true }));
      advanceIfAllReady(next);
      return next;
    });
  };

  // The host draws the next photo while everyone looks at the results, so
  // "next" does not wait on the pool. A host who leaves hands this on with
  // the host role.
  const drawing = useRef<string | null>(null);
  const isHost = !!gameState?.players.find((p) => p.id === userId)?.isHost;
  const needsDraw = gameState?.status === 'round_end' && !gameState.next &&
    gameState.roundIndex + 1 < gameState.settings.rounds && isHost;
  const drawKey = needsDraw ? `${gameState!.roundIndex}:${gameState!.round?.photo.file}` : null;
  useEffect(() => {
    if (!drawKey || drawing.current === drawKey) return;
    drawing.current = drawKey;
    const snapshot = gameStateRef.current;
    if (!snapshot) return;
    (async () => {
      const photo = await pickPhoto(snapshot.settings, new Set(snapshot.played));
      if (!photo) {
        drawing.current = null; // try again on the next render
        return;
      }
      await updateState((current) => {
        if (current.status !== 'round_end' || current.next) return null;
        const next = clone(current);
        next.next = photo;
        advanceIfAllReady(next);
        return next;
      });
    })();
  }, [drawKey, gameStateRef, updateState]);

  /**
   * Records this player's match. Keyed by the match, so the finish, a reload
   * of the results and a leave racing the finish all count it once.
   */
  const record = (state: TimlerState, left = false) => {
    const me = state.players.find((p) => p.id === userId);
    if (!lobbyId || !me || !state.startTime) return Promise.resolve(false);
    const details = matchDetails(me.history);
    const solo = state.players.length === 1;
    const top = Math.max(...state.players.map((p) => p.score));
    // Alone, a match is won with more than half the rounds within five years.
    const close = me.history.filter((h) => {
      const a = parseDate(h.answer);
      return a && h.guess && Math.abs(h.guess.year - a.year) <= 5;
    }).length;
    const won = !left && (solo ? close * 2 > Math.max(1, details.rounds) : me.score >= top);
    return recordMatch({
      game: 'timler',
      key: matchKey(lobbyId, state.startTime),
      result: won ? 'win' : 'loss',
      mode: solo ? 'single' : 'multi',
      durationSeconds: matchSeconds(state.startTime, left ? now() : state.lastActionTime,
        state.settings.rounds * state.settings.roundDuration),
      score: me.score,
      details: { ...details, medium: state.settings.medium ?? 'photos', era: state.settings.era, ...(left ? { left: true } : {}) }
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
      // The round waits for every answer and the next for everyone ready:
      // without the leaver, it may be time for either.
      closeIfAllAnswered(next);
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
    initGame, startGame, answer, forceRoundEnd,
    readyNextRound, forceNextRound, leaveGame
  };
}
