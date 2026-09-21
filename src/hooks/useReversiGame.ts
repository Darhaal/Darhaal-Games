import { useEffect } from 'react';
import type { ReversiPlayer, ReversiState } from '@/types/reversi';
import { updatePlayerStats } from '@/lib/playerStats';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { requireGame, roomCapacity } from '@/games/registry';
import {
  BOARD_SIZE, startingBoard, applyMove, hasMove, leaders, tally
} from '@/lib/gameLogic/reversi';

const GAME = requireGame('reversi');

// Module-level helper: sidesteps the react-compiler purity heuristic
// (Date.now inside event handlers is a legitimate use)
const now = () => Date.now();

const clone = (state: ReversiState): ReversiState => JSON.parse(JSON.stringify(state));

const seated = (state: ReversiState): ReversiPlayer[] =>
  [...state.players].sort((a, b) => a.seat - b.seat);

const seatsOf = (state: ReversiState): number[] => state.players.map((p) => p.seat);

/**
 * Hands the turn to whoever can actually play.
 *
 * Reversi passes automatically: a player with no legal move does not choose to
 * skip, they simply have no move, and the turn goes back. Two passes in a row
 * means nobody can play and the match is over — which is the only way Reversi
 * ends before the board fills, and the case most home-made versions hang on.
 */
function passTurnTo(state: ReversiState, fromSeat: number): void {
  const order = seated(state);
  if (order.length === 0) {
    state.turnPlayerId = null;
    return;
  }

  const fromIndex = order.findIndex((p) => p.seat === fromSeat);

  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(fromIndex + step) % order.length];
    if (hasMove(state.board, state.size, candidate.seat)) {
      state.turnPlayerId = candidate.id;
      state.turnDeadline = now() + state.settings.turnDuration * 1000;
      state.passes = step - 1;
      return;
    }
  }

  // Nobody, including the player who just moved, has a legal reply.
  state.status = 'finished';
  state.turnPlayerId = null;
  state.turnDeadline = undefined;
  state.passes = order.length;
  state.winnerIds = state.players
    .filter((p) => leaders(state.board, seatsOf(state)).includes(p.seat))
    .map((p) => p.id);
}

export function useReversiGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<ReversiState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-reversi'
  });

  // Every action takes the functional form of `updateState`: on a version
  // conflict the updater re-runs against freshly fetched state. See
  // docs/business-logic.md — a plain write here would drop a move.

  const initGame = async (userProfile: { name: string; avatarUrl: string }) => {
    if (!userId || !lobbyId) return;

    await updateState((current) => {
      if (!Array.isArray(current.players)) return null;
      if (current.players.find((p) => p.id === userId)) return null; // already seated
      if (current.status !== 'waiting') return null;
      if (current.players.length >= roomCapacity(GAME, current.settings?.maxPlayers)) return null;

      const next = clone(current);
      const taken = new Set(next.players.map((p) => p.seat));
      let seat = 0;
      while (taken.has(seat)) seat++;

      next.players.push({
        id: userId,
        name: userProfile.name,
        avatarUrl: userProfile.avatarUrl,
        isHost: next.players.length === 0,
        seat,
        score: 0
      });

      return next;
    });
  };

  const startGame = async () => {
    await updateState((current) => {
      if (current.status !== 'waiting') return null;
      if (current.players.length !== 2) return null; // one colour each

      const next = clone(current);
      next.size = BOARD_SIZE;
      next.board = startingBoard(BOARD_SIZE);
      next.players = seated(next).map((p, index) => ({ ...p, seat: index, score: 0 }));
      next.status = 'playing';
      next.passes = 0;
      next.winnerIds = [];
      next.startTime = now();
      // Dark opens, as the game has always been played.
      next.turnPlayerId = next.players[0].id;
      next.turnDeadline = now() + next.settings.turnDuration * 1000;
      next.notifications = [];

      return next;
    });
  };

  const placeDisc = async (index: number) => {
    if (!userId) return;

    await updateState((current) => {
      if (current.status !== 'playing' || current.turnPlayerId !== userId) return null;

      const me = current.players.find((p) => p.id === userId);
      if (!me) return null;

      const board = applyMove(current.board, current.size, index, me.seat);
      if (!board) return null; // traps nothing, so not a move

      const next = clone(current);
      next.board = board;
      passTurnTo(next, me.seat);
      return next;
    });
  };

  /**
   * Passes an expired turn on. Callable by anyone: the deadline decides, not
   * the caller, so a player who closed their tab cannot stop the match.
   *
   * A missed turn is lost rather than played automatically — in Reversi a
   * single disc can flip a whole board, which is far too large a consequence
   * for a bot to choose on someone's behalf.
   */
  const handleTimeout = async () => {
    await updateState((current) => {
      if (current.status !== 'playing') return null;
      if (!current.turnDeadline || Date.now() < current.turnDeadline) return null;

      const onTurn = current.players.find((p) => p.id === current.turnPlayerId);
      if (!onTurn) return null;

      const next = clone(current);
      passTurnTo(next, onTurn.seat);
      return next;
    });
  };

  const leaveGame = async () => {
    if (!lobbyId || !userId) return;

    // A finished match is a record, not live state: leaving must not rewrite
    // the results the other player is still looking at.
    const snapshot = gameStateRef.current;
    if (!snapshot || snapshot.status === 'finished') return;

    const others = (snapshot.players || []).filter((p) => p.id !== userId);
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

      if (!next.notifications) next.notifications = [];
      next.notifications.push({
        id: now(),
        message: {
          ru: `${leaving.name} покинул игру`,
          en: `${leaving.name} left the game`
        },
        type: 'leave'
      });

      // Reversi is one colour each, so a departure ends the match there and
      // then — the player left behind takes it.
      if (next.status === 'playing') {
        next.status = 'finished';
        next.turnPlayerId = null;
        next.turnDeadline = undefined;
        next.winnerIds = [next.players[0].id];
      }

      return next;
    });
  };

  useEffect(() => {
    if (gameState?.status === 'finished' && userId && !lobbyDeleted && gameState.winnerIds.length > 0) {
      const me = gameState.players.find((p) => p.id === userId);
      if (me) {
        const duration = gameState.startTime
          ? Math.max(1, Math.round((now() - gameState.startTime) / 1000))
          : 600;

        updatePlayerStats(userId, {
          gameType: 'reversi',
          result: gameState.winnerIds.includes(userId) ? 'win' : 'loss',
          durationSeconds: duration,
          extraCount: tally(gameState.board)[me.seat] || 0
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the match finishes; adding gameState.players would re-record stats
  }, [gameState?.status, userId, lobbyDeleted]);

  return {
    gameState, roomMeta, loading, lobbyDeleted,
    initGame, startGame, placeDisc, handleTimeout, leaveGame
  };
}
