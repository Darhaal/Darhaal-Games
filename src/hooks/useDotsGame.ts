import { useEffect } from 'react';
import type { DotsPlayer, DotsState, Edge } from '@/types/dots';
import { updatePlayerStats } from '@/lib/playerStats';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { requireGame, roomCapacity } from '@/games/registry';
import { randomOf } from '@/lib/turnOrder';
import { emptyBoard, drawEdge, isBoardFull, leaders, boxTally } from '@/lib/gameLogic/dots';
import { pushNotice, leftTheGame } from '@/lib/notifications';

const GAME = requireGame('dots');

// Module-level helper: sidesteps the react-compiler purity heuristic
// (Date.now inside event handlers is a legitimate use)
const now = () => Date.now();

const clone = (state: DotsState): DotsState => JSON.parse(JSON.stringify(state));

const seated = (state: DotsState): DotsPlayer[] =>
  [...state.players].sort((a, b) => a.seat - b.seat);

/** The next seat round the table, skipping anyone who has left. */
function advanceTurn(state: DotsState): void {
  const order = seated(state);
  if (order.length === 0) {
    state.turnPlayerId = null;
    return;
  }

  const current = order.findIndex((p) => p.id === state.turnPlayerId);
  state.turnPlayerId = order[(current + 1) % order.length].id;
  state.turnDeadline = now() + state.settings.turnDuration * 1000;
}

/** Settles the match once every line is drawn. */
function finishIfDone(state: DotsState): DotsState | null {
  if (!isBoardFull(state)) return null;

  return {
    ...state,
    status: 'finished',
    turnPlayerId: null,
    turnDeadline: undefined,
    winnerIds: leaders(state)
  };
}

export function useDotsGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<DotsState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-dots'
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
      if (current.players.length < GAME.players.min) return null;

      const next = clone(current);
      const size = next.settings.size;

      next.size = size;
      Object.assign(next, emptyBoard(size));
      next.players = seated(next).map((p, index) => ({ ...p, seat: index, score: 0 }));
      next.status = 'playing';
      next.winnerIds = [];
      next.startTime = now();
      // A random seat opens, so the host does not always draw first.
      next.turnPlayerId = randomOf(next.players)!.id;
      next.turnDeadline = now() + next.settings.turnDuration * 1000;
      next.notifications = [];

      return next;
    });
  };

  /**
   * Draws a line, and keeps the turn when it closes a box.
   *
   * The "go again" is why the turn is advanced here rather than by the rules
   * module: closing a box is the one move that does not end your turn, and a
   * chain of them can run for a dozen lines.
   */
  const drawLine = async (edge: Edge) => {
    if (!userId) return;

    await updateState((current) => {
      if (current.status !== 'playing' || current.turnPlayerId !== userId) return null;

      const result = drawEdge(current, edge, userId);
      if (!result) return null; // already drawn, or off the board

      const next = result.state;
      next.lastEdge = edge;
      if (result.claimed === 0) advanceTurn(next);
      else next.turnDeadline = now() + next.settings.turnDuration * 1000;

      return finishIfDone(next) ?? next;
    });
  };

  /**
   * Passes an expired turn on. Callable by anyone: the deadline decides, not
   * the caller, so a player who closed their tab cannot stop the match.
   *
   * A missed turn is simply lost rather than played automatically — drawing a
   * line for someone can hand their rival a whole chain, which is too large a
   * consequence for a bot to choose.
   */
  const handleTimeout = async () => {
    await updateState((current) => {
      if (current.status !== 'playing') return null;
      if (!current.turnDeadline || Date.now() < current.turnDeadline) return null;

      const next = clone(current);
      advanceTurn(next);
      return next;
    });
  };

  const leaveGame = async () => {
    if (!lobbyId || !userId) return;

    // A finished match is a record, not live state: leaving must not rewrite
    // the results the other players are still looking at.
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
      const wasTheirTurn = next.turnPlayerId === userId;

      next.players = next.players.filter((p) => p.id !== userId);
      if (next.players.length === 0) return null;
      if (leaving.isHost) next.players[0].isHost = true;

      pushNotice(next, leftTheGame(leaving.name), 'leave');

      if (next.status === 'playing') {
        // Boxes they already closed stay theirs on the board, but with one
        // side left there is nobody to play against.
        if (next.players.length < GAME.players.min) {
          return {
            ...next,
            status: 'finished',
            turnPlayerId: null,
            turnDeadline: undefined,
            winnerIds: leaders(next)
          };
        }

        // Their turn dies with them, so hand it straight on rather than
        // leaving the table waiting on an empty seat.
        if (wasTheirTurn) {
          next.turnPlayerId = leaving.id;
          advanceTurn(next);
        }
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
          : 300;

        updatePlayerStats(userId, {
          gameType: 'dots',
          result: gameState.winnerIds.includes(userId) ? 'win' : 'loss',
          durationSeconds: duration,
          extraCount: boxTally(gameState)[userId] || 0
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the match finishes; adding gameState.players would re-record stats
  }, [gameState?.status, userId, lobbyDeleted]);

  return {
    gameState, roomMeta, loading, lobbyDeleted,
    initGame, startGame, drawLine, handleTimeout, leaveGame
  };
}
