import { useEffect } from 'react';
import type { Cell, Wall, WallRushPlayer, WallRushState } from '@/types/wallrush';
import { updatePlayerStats } from '@/lib/playerStats';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { requireGame, roomCapacity } from '@/games/registry';
import { randomOf } from '@/lib/turnOrder';
import {
  BOARD_FOR_MODE, GOAL_FOR_MODE, WALLS_FOR_MODE, seatsForMode, teamOf,
  startCell, isGoal, canPlaceWall, legalMoves, sameCell
} from '@/lib/gameLogic/wallrush';

const GAME = requireGame('wallrush');

// Module-level helper: sidesteps the react-compiler purity heuristic
// (Date.now inside event handlers is a legitimate use)
const now = () => Date.now();

const clone = (state: WallRushState): WallRushState => JSON.parse(JSON.stringify(state));

/** Seats in play, in turn order. */
const seated = (state: WallRushState): WallRushPlayer[] =>
  [...state.players].sort((a, b) => a.seat - b.seat);

/** Which edge a player started on, and therefore which edge they must reach. */
export const sideOf = (state: WallRushState, player: WallRushPlayer) =>
  seatsForMode(state.settings.mode)[player.seat];

/** Opposite edge in the duel and the team game; the middle square in a four. */
export const goalOf = (state: WallRushState) => GOAL_FOR_MODE[state.settings.mode];

/**
 * Only the four-player table lets a pawn clear two in a line — the duel and
 * the team game keep the single hop.
 */
export const doubleJumpAllowed = (state: WallRushState) => state.settings.mode === 'ffa';

/** Pawns still on the board, in the shape the rules functions want. */
const pawnsOnBoard = (state: WallRushState) =>
  state.players
    .filter((p) => state.pawns[p.id])
    .map((p) => ({ cell: state.pawns[p.id], side: sideOf(state, p) }));

/** Everyone else's pawn — the ones a move has to jump over or go around. */
const otherPawns = (state: WallRushState, exceptId: string): Cell[] =>
  state.players.filter((p) => p.id !== exceptId && state.pawns[p.id]).map((p) => state.pawns[p.id]);

/** The next seat round the table, skipping anyone who has left. */
function advanceTurn(state: WallRushState): void {
  const order = seated(state);
  if (order.length === 0) {
    state.turnPlayerId = null;
    return;
  }

  const current = order.findIndex((p) => p.id === state.turnPlayerId);
  const next = order[(current + 1) % order.length];
  state.turnPlayerId = next.id;
  state.turnDeadline = now() + state.settings.turnDuration * 1000;
}

/**
 * Declares the winner. In `teams` a partnership wins together, so both ids go
 * in — the scoreboard and the statistics both read this list rather than
 * re-deriving who was allied with whom.
 */
function finish(state: WallRushState, winner: WallRushPlayer): WallRushState {
  const partners = state.settings.mode === 'teams'
    ? state.players.filter((p) => teamOf(p.seat) === teamOf(winner.seat))
    : [winner];

  state.status = 'finished';
  state.winnerIds = partners.map((p) => p.id);
  state.turnPlayerId = null;
  state.turnDeadline = undefined;
  state.players = state.players.map((p) =>
    state.winnerIds.includes(p.id) ? { ...p, score: (p.score || 0) + 1 } : p
  );

  return state;
}

/** Ends the match when only one side is left standing. */
function finishIfUncontested(state: WallRushState): WallRushState | null {
  const remaining = state.players.filter((p) => state.pawns[p.id]);
  if (remaining.length === 0) return null;

  const sidesLeft = state.settings.mode === 'teams'
    ? new Set(remaining.map((p) => teamOf(p.seat))).size
    : remaining.length;

  return sidesLeft <= 1 ? finish(state, remaining[0]) : null;
}

export function useWallRushGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<WallRushState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-wallrush'
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
      // Seats are handed out in arrival order and frozen at the start; in
      // `teams` that is what puts partners opposite each other.
      const taken = new Set(next.players.map((p) => p.seat));
      let seat = 0;
      while (taken.has(seat)) seat++;

      next.players.push({
        id: userId,
        name: userProfile.name,
        avatarUrl: userProfile.avatarUrl,
        isHost: next.players.length === 0,
        seat,
        wallsLeft: WALLS_FOR_MODE[next.settings.mode],
        score: 0
      });

      return next;
    });
  };

  const startGame = async () => {
    await updateState((current) => {
      if (current.status !== 'waiting') return null;
      // Every mode wants an exact table: a duel is two, the rest are four.
      if (current.players.length !== current.settings.maxPlayers) return null;

      const next = clone(current);
      const sides = seatsForMode(next.settings.mode);

      next.size = BOARD_FOR_MODE[next.settings.mode];
      next.players = seated(next).map((p, index) => ({
        ...p,
        seat: index,
        wallsLeft: WALLS_FOR_MODE[next.settings.mode]
      }));

      next.pawns = {};
      next.players.forEach((p) => {
        next.pawns[p.id] = startCell(sides[p.seat], next.size);
      });

      next.walls = [];
      next.status = 'playing';
      next.winnerIds = [];
      next.startTime = now();
      // A random seat opens. Seats still decide sides and teams, so this
      // changes who moves first and nothing else.
      next.turnPlayerId = randomOf(next.players)!.id;
      next.turnDeadline = now() + next.settings.turnDuration * 1000;
      next.notifications = [];

      return next;
    });
  };

  const movePawn = async (target: Cell) => {
    if (!userId) return;

    await updateState((current) => {
      if (current.status !== 'playing' || current.turnPlayerId !== userId) return null;

      const me = current.players.find((p) => p.id === userId);
      const from = current.pawns[userId];
      if (!me || !from) return null;

      const legal = legalMoves(
        current.walls, from, otherPawns(current, userId), current.size, doubleJumpAllowed(current)
      );
      if (!legal.some((c) => sameCell(c, target))) return null;

      const next = clone(current);
      next.pawns[userId] = { ...target };

      if (isGoal(sideOf(next, me), target, next.size, goalOf(next))) return finish(next, me);

      advanceTurn(next);
      return next;
    });
  };

  const placeWall = async (wall: Wall) => {
    if (!userId) return;

    await updateState((current) => {
      if (current.status !== 'playing' || current.turnPlayerId !== userId) return null;

      const me = current.players.find((p) => p.id === userId);
      if (!me || me.wallsLeft <= 0) return null;

      // The expensive rule, and the one that makes the game a game: this
      // rejects any wall that would leave someone with no route home.
      if (!canPlaceWall(current.walls, wall, pawnsOnBoard(current), current.size, goalOf(current))) {
        return null;
      }

      const next = clone(current);
      // Stamped with the placer so the board can colour it; the rules ignore it.
      next.walls.push({ ...wall, by: userId });
      next.players = next.players.map((p) =>
        p.id === userId ? { ...p, wallsLeft: p.wallsLeft - 1 } : p
      );

      advanceTurn(next);
      return next;
    });
  };

  /**
   * Passes an expired turn on. Callable by anyone: the deadline decides, not
   * the caller, so a player who closed their tab cannot stop the match — see
   * docs/business-logic.md.
   *
   * A missed turn is simply lost. Moving the pawn automatically would be a bot
   * playing someone's race for them, and standing still is already the natural
   * penalty for being away.
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
      delete next.pawns[userId];
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
      if (next.notifications.length > 3) next.notifications.shift();

      if (next.status === 'playing') {
        const over = finishIfUncontested(next);
        if (over) return over;
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
          gameType: 'wallrush',
          result: gameState.winnerIds.includes(userId) ? 'win' : 'loss',
          durationSeconds: duration
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the match finishes; adding gameState.players would re-record stats
  }, [gameState?.status, userId, lobbyDeleted]);

  return {
    gameState, roomMeta, loading, lobbyDeleted,
    initGame, startGame, movePawn, placeWall, handleTimeout, leaveGame
  };
}
