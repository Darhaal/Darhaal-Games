import { useEffect, useRef } from 'react';
import type { WikilerArticleRef, WikilerPlayer, WikilerRoundResult, WikilerState } from '@/types/wikiler';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { requireGame, roomCapacity } from '@/games/registry';
import { newWikilerPlayer } from '@/games/initialState';
import { recordMatch, matchKey, matchSeconds } from '@/lib/matchRecords';
import { pushNotice, leftTheGame } from '@/lib/notifications';
import { newSeed, pickArticle } from '@/lib/wikiler/pick';
import { languagesNeeded, readingVersion, type WikilerLang } from '@/lib/gameLogic/wikiler';

/**
 * Wikiler's shared state — docs/wikiler-spec.md, sections 2 and 8.
 *
 * What a player has opened lives in their browser (`useWikilerRound`); this
 * hook carries only what the table needs: attempts, who is done, round results
 * once everyone is, and the next article, which the host draws while the
 * others read the results.
 */

const GAME = requireGame('wikiler');

// Module-level helper: sidesteps the react-compiler purity heuristic
// (Date.now inside event handlers is a legitimate use)
const now = () => Date.now();
const clone = (s: WikilerState): WikilerState => JSON.parse(JSON.stringify(s));

/** Time to load the article before guessing opens. */
const START_DELAY_MS = 3000;
/** The results wait this long for "next" before the next round starts anyway. */
export const WIKILER_BETWEEN_ROUNDS_SECONDS = 60;
/** How far past its end anyone may close a round for a player who vanished. */
const STALLED_ROUND_GRACE_MS = 10_000;

/** A round that ended without an answer. */
export const unsolved = (title: string, attempts: number, misses: number): WikilerRoundResult => ({
  title, score: 0, solved: false, attempts, by: null, misses, lastTry: false
});

/** Clears what a round keeps, for the start of the next one. */
function resetForRound(p: WikilerPlayer): WikilerPlayer {
  return { ...p, attempts: 0, done: false, result: null, isReadyForNextRound: false };
}

/** Closes the round once every player is done: results into history, scores added up. */
function closeRoundIfDone(state: WikilerState) {
  if (state.status !== 'playing' || !state.round || state.players.length === 0) return;
  if (!state.players.every((p) => p.done)) return;
  const title = state.round.title;
  state.players = state.players.map((p) => {
    const result = p.result ?? unsolved(title, p.attempts, 0);
    return { ...p, history: [...p.history, result], score: p.score + result.score };
  });
  state.status = 'round_end';
  state.roundEndedAt = now();
}

function startRound(state: WikilerState, ref: WikilerArticleRef, index: number) {
  state.status = 'playing';
  state.round = { ...ref, seed: newSeed(), startTime: now() + START_DELAY_MS };
  state.roundIndex = index;
  state.next = null;
  state.played = [...state.played, ref.title];
  state.roundEndedAt = undefined;
  state.players = state.players.map(resetForRound);
}

/** Starts the next round — or ends the match — once everyone is ready and the article is drawn. */
function advanceIfAllReady(state: WikilerState) {
  if (state.status !== 'round_end' || state.players.length === 0) return;
  if (!state.players.every((p) => p.isReadyForNextRound)) return;
  if (state.roundIndex + 1 >= state.settings.rounds) {
    state.status = 'finished';
    return;
  }
  if (state.next) startRound(state, state.next, state.roundIndex + 1);
}

export function useWikilerGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<WikilerState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-wikiler'
  });

  /**
   * Seat the player. Retryable on purpose: an invite link posted in a group
   * chat gets opened by everyone at once.
   */
  const initGame = async (profile: { name: string; avatarUrl: string; lang: WikilerLang }) => {
    if (!userId || !lobbyId) return;
    await updateState((current) => {
      if (current.players.some((p) => p.id === userId)) return null;
      if (current.status !== 'waiting') return null;
      if (current.players.length >= roomCapacity(GAME, current.settings?.maxPlayers)) return null;
      const next = clone(current);
      next.players.push(newWikilerPlayer({
        id: userId, name: profile.name, avatarUrl: profile.avatarUrl, isHost: next.players.length === 0, lang: profile.lang
      }));
      return next;
    });
  };

  /**
   * The player switched the interface language. Taken between rounds only:
   * the article they are reading stays theirs until the round is over.
   */
  const setLang = async (lang: WikilerLang) => {
    if (!userId || !lobbyId) return;
    await updateState((current) => {
      if (current.status === 'playing' || current.status === 'finished') return null;
      const mine = current.players.find((p) => p.id === userId);
      if (!mine || mine.lang === lang) return null;
      const next = clone(current);
      next.players.find((p) => p.id === userId)!.lang = lang;
      return next;
    });
  };

  /** The host draws the first article, then opens the match. `false` if Wikipedia could not be reached. */
  const startGame = async (): Promise<boolean> => {
    const snapshot = gameStateRef.current;
    if (!snapshot || snapshot.status !== 'waiting') return false;
    const ref = await pickArticle(snapshot.settings.lang, snapshot.settings.topic, new Set(),
      languagesNeeded(snapshot.settings, snapshot.players), snapshot.settings.difficulty ?? 'any');
    if (!ref) return false;
    await updateState((current) => {
      if (current.status !== 'waiting') return null;
      const next = clone(current);
      next.played = [];
      next.startTime = now();
      next.players = next.players.map((p) => ({ ...resetForRound(p), score: 0, history: [], tabLeaves: 0 }));
      startRound(next, ref, 0);
      return next;
    });
    return true;
  };

  /** Attempts and tab leaves as they stand — the component throttles these. */
  const reportProgress = async (attempts: number, tabLeaves: number) => {
    if (!userId) return;
    await updateState((current) => {
      if (current.status !== 'playing') return null;
      const me = current.players.find((p) => p.id === userId);
      if (!me || me.done || (me.attempts === attempts && me.tabLeaves === tabLeaves)) return null;
      const next = clone(current);
      const mine = next.players.find((p) => p.id === userId)!;
      mine.attempts = attempts;
      mine.tabLeaves = tabLeaves;
      return next;
    });
  };

  /** This player is done with the round: solved, out of attempts, or out of time. */
  const finishRound = async (result: WikilerRoundResult, tabLeaves: number) => {
    if (!userId) return;
    await updateState((current) => {
      if (current.status !== 'playing' || current.round?.title !== result.title) return null;
      const me = current.players.find((p) => p.id === userId);
      if (!me || me.done) return null;
      const next = clone(current);
      const mine = next.players.find((p) => p.id === userId)!;
      mine.done = true;
      mine.result = result;
      mine.attempts = result.attempts;
      mine.tabLeaves = tabLeaves;
      closeRoundIfDone(next);
      return next;
    });
  };

  /**
   * Backstop for a player who vanished mid-round: each player finishes their
   * own round, so a closed tab would hold everyone else for good. Once the
   * round is well over, whoever is still here closes it.
   */
  const forceRoundEnd = async () => {
    await updateState((current) => {
      if (current.status !== 'playing' || !current.round) return null;
      const end = current.round.startTime + current.settings.roundDuration * 1000;
      if (now() - end < STALLED_ROUND_GRACE_MS) return null;
      if (current.players.every((p) => p.done)) return null;
      const next = clone(current);
      const title = next.round!.title;
      next.players = next.players.map((p) => (p.done ? p : { ...p, done: true, result: unsolved(title, p.attempts, 0) }));
      closeRoundIfDone(next);
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
      if (now() - current.roundEndedAt < WIKILER_BETWEEN_ROUNDS_SECONDS * 1000) return null;
      // Already forced: the round starts when the host's draw lands.
      if (current.players.every((p) => p.isReadyForNextRound)) return null;
      const next = clone(current);
      next.players = next.players.map((p) => ({ ...p, isReadyForNextRound: true }));
      advanceIfAllReady(next);
      return next;
    });
  };

  // The host draws the next article while everyone reads the results, so
  // "next" does not wait on Wikipedia. A host who leaves hands this on with
  // the host role.
  const drawing = useRef<string | null>(null);
  const isHost = !!gameState?.players.find((p) => p.id === userId)?.isHost;
  const needsDraw = gameState?.status === 'round_end' && !gameState.next &&
    gameState.roundIndex + 1 < gameState.settings.rounds && isHost;
  const drawKey = needsDraw ? `${gameState!.round?.seed}` : null;
  useEffect(() => {
    if (!drawKey || drawing.current === drawKey) return;
    drawing.current = drawKey;
    const snapshot = gameStateRef.current;
    if (!snapshot) return;
    (async () => {
      const ref = await pickArticle(snapshot.settings.lang, snapshot.settings.topic, new Set(snapshot.played),
        languagesNeeded(snapshot.settings, snapshot.players), snapshot.settings.difficulty ?? 'any');
      if (!ref) {
        drawing.current = null; // try again on the next render
        return;
      }
      await updateState((current) => {
        if (current.status !== 'round_end' || current.next) return null;
        const next = clone(current);
        next.next = ref;
        advanceIfAllReady(next);
        return next;
      });
    })();
  }, [drawKey, gameStateRef, updateState]);

  /**
   * Records this player's match. Keyed by the match, so the finish, a reload
   * of the results and a leave racing the finish all count it once.
   */
  const record = (state: WikilerState, left = false) => {
    const me = state.players.find((p) => p.id === userId);
    if (!lobbyId || !me || !state.startTime) return Promise.resolve(false);
    const rounds = me.history.length;
    const solved = me.history.filter((h) => h.solved);
    const byTitle = solved.filter((h) => h.by === 'title');
    const timed = solved.flatMap((h) => (typeof h.seconds === 'number' ? [h.seconds] : []));
    const solo = state.players.length === 1;
    const top = Math.max(...state.players.map((p) => p.score));
    const won = !left && (solo ? solved.length * 2 > Math.max(1, rounds) : me.score >= top);
    return recordMatch({
      game: 'wikiler',
      key: matchKey(lobbyId, state.startTime),
      result: won ? 'win' : 'loss',
      mode: solo ? 'single' : 'multi',
      durationSeconds: matchSeconds(state.startTime, left ? now() : state.lastActionTime,
        state.settings.rounds * state.settings.roundDuration),
      score: me.score,
      details: {
        rounds,
        solved: solved.length,
        byTitle: byTitle.length,
        attempts: me.history.reduce((n, h) => n + h.attempts, 0),
        ...(byTitle.length ? { quickTitle: Math.min(...byTitle.map((h) => h.attempts)) } : {}),
        bestRound: Math.max(0, ...me.history.map((h) => h.score)),
        cleanRounds: solved.filter((h) => h.misses === 0).length,
        lastTry: solved.filter((h) => h.lastTry).length,
        ...(timed.length ? { fastestSolve: Math.min(...timed) } : {}),
        lang: state.round ? readingVersion(state.round, state.settings, me.lang).lang : state.settings.lang,
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
      // The round waits for everyone done and the next for everyone ready:
      // without the leaver, it may be time for either.
      closeRoundIfDone(next);
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
    initGame, setLang, startGame, reportProgress, finishRound, forceRoundEnd,
    readyNextRound, forceNextRound, leaveGame
  };
}
