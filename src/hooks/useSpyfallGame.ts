import { useEffect } from 'react';
import { SpyfallState } from '@/types/spyfall';
import { SPYFALL_PACKS } from '@/data/spyfall/locations';
import { updatePlayerStats } from '@/lib/playerStats';
import { useLobbySync } from '@/hooks/core/useLobbySync';

// Module-level helper: sidesteps the react-compiler purity heuristic
// (Date.now inside event handlers is a legitimate use)
const now = () => Date.now();

const clone = (state: SpyfallState): SpyfallState => JSON.parse(JSON.stringify(state));

/** Fewest players a round can continue with. */
const MIN_PLAYERS = 3;

/**
 * How long a vote stays open. The round clock is frozen while it runs, so
 * nothing else could end it: one player closing their tab mid-vote left the
 * room in `voting` permanently, with no auto-kick (that only runs in the
 * waiting lobby) and no way out but everyone leaving.
 */
export const VOTE_DURATION_SECONDS = 60;

type WinReason = SpyfallState['winReason'];

/**
 * Sends the room back to the round with the accusation dropped — pure, so the
 * rejected-vote path and the timed-out-vote path cannot drift apart.
 */
function rejectNomination(next: SpyfallState, message: { ru: string; en: string }): SpyfallState {
  const startedAt = next.nomination?.startTime ?? Date.now();
  next.status = 'playing';
  // Compensate the pause: shift the round start by the voting duration
  // so voting does not eat into the round timer
  next.startTime += Math.max(0, Date.now() - startedAt);
  next.nomination = null;
  next.notifications.push({ id: Date.now(), message, type: 'info' });
  return next;
}

/**
 * Ends the round and awards points — pure, so it can run inside a retried
 * update.
 *
 * It used to be an async action that wrote on its own, which meant the paths
 * that ended a round (the last vote, the spy walking out) had to write twice:
 * once for their own change and once through here. If the first write lost a
 * race, the second still landed, and the round ended on a state that had
 * already been overwritten.
 */
function finishRound(
  state: SpyfallState,
  winner: 'spy' | 'locals',
  reason?: WinReason
): SpyfallState {
  const next = clone(state);
  next.status = 'finished';
  next.winner = winner;
  next.winReason = reason;

  next.players = next.players.map((p) => {
    let points = p.score || 0;

    if (winner === 'spy') {
      // Spy won: +5 to the spy
      if (p.isSpy) points += 5;
    } else if (!p.isSpy) {
      // Locals won: +1 to every local
      points += 1;
      // Bonus for a successful accusation: +1 to the nomination author
      if (reason === 'spy_caught' && next.nomination?.authorId === p.id) points += 1;
    }

    return { ...p, score: points };
  });

  return next;
}

export function useSpyfallGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<SpyfallState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-spyfall',
    touchLastAction: false
  });

  // --- LOGIC ---
  //
  // Every action below uses the functional form of `updateState`: on a version
  // conflict the updater is re-run against freshly fetched state instead of
  // the caller's snapshot. In this game that is not an optimisation — voting is
  // simultaneous by design, so in a full room several writes always collide.

  const startGame = async () => {
    await updateState((current) => {
      if (current.status !== 'waiting') return null;
      if (current.players.length < MIN_PLAYERS) return null;

      const next = clone(current);

      // 1. Take locations from the selected pack
      const packId = next.settings.packId || 'standard';
      const selectedPack = SPYFALL_PACKS.find((p) => p.id === packId) || SPYFALL_PACKS[0];
      const availableLocations = selectedPack.locations;

      // 2. Pick a location
      const location = availableLocations[Math.floor(Math.random() * availableLocations.length)];
      next.currentLocationId = location.id;
      next.locationList = availableLocations.map((l) => l.id);

      // 3. Pick the spy
      const indices = next.players.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const spyRealIndex = indices[0];

      // 4. Roles
      const rolesShuffled = [...location.roles].sort(() => 0.5 - Math.random());

      next.players = next.players.map((p, idx) => {
        const isSpy = idx === spyRealIndex;
        const roleObj = rolesShuffled[idx % rolesShuffled.length];

        return {
          ...p,
          isSpy,
          role: isSpy ? null : JSON.stringify(roleObj.name),
          isReady: false,
          hasNominated: false
        };
      });

      next.status = 'playing';
      next.startTime = now();
      next.winner = null;
      next.winReason = undefined;
      next.nomination = null;
      next.notifications = [];

      return next;
    });
  };

  const startNomination = async (targetId: string) => {
    if (!userId) return;

    await updateState((current) => {
      // Two players accusing within the same second used to both write, and
      // the second nomination replaced the first — along with any votes
      // already cast on it. Whoever gets there first now owns the vote.
      if (current.status !== 'playing') return null;

      const next = clone(current);
      const target = next.players.find((p) => p.id === targetId);
      const author = next.players.find((p) => p.id === userId);

      if (!target || !author || author.hasNominated) return null;

      author.hasNominated = true;
      next.status = 'voting';
      next.nomination = {
        authorId: userId,
        targetId,
        votes: { [userId]: true },
        startTime: now()
      };

      return next;
    });
  };

  const vote = async (agree: boolean) => {
    if (!userId) return;

    await updateState((current) => {
      if (current.status !== 'voting' || !current.nomination) return null;
      // Already counted — a double tap must not re-open a decided vote.
      if (current.nomination.votes[userId] !== undefined) return null;

      const next = clone(current);
      const nomination = next.nomination!;
      nomination.votes[userId] = agree;

      const voters = next.players.filter((p) => p.id !== nomination.targetId);
      // Count only ballots from players still in the room: someone leaving
      // mid-vote would otherwise keep the tally waiting on a vote that can
      // never arrive.
      const voterIds = new Set(voters.map((p) => p.id));
      const cast = Object.entries(nomination.votes).filter(([id]) => voterIds.has(id));

      if (cast.length < voters.length) return next;

      const unanimous = cast.every(([, v]) => v === true);

      if (unanimous) {
        const target = next.players.find((p) => p.id === nomination.targetId);
        return target?.isSpy
          ? finishRound(next, 'locals', 'spy_caught')
          : finishRound(next, 'spy', 'innocent_killed');
      }

      return rejectNomination(next, {
        ru: 'Голосование отклонено',
        en: 'Accusation rejected'
      });
    });
  };

  /**
   * Closes a vote nobody finished. Any client may call it once the deadline
   * has passed; the deadline check makes a second caller a no-op, so the
   * players left in the room are not relying on the absent one coming back.
   *
   * An unanswered ballot is a "no": conviction needs every other player to
   * agree, so a missing vote already means the accusation fails.
   */
  const resolveVoteTimeout = async () => {
    await updateState((current) => {
      if (current.status !== 'voting' || !current.nomination) return null;
      if (now() - current.nomination.startTime < VOTE_DURATION_SECONDS * 1000) return null;

      return rejectNomination(clone(current), {
        ru: 'Время голосования вышло',
        en: 'Voting time ran out'
      });
    });
  };

  const endGame = async (winner: 'spy' | 'locals', reason?: string) => {
    await updateState((current) => {
      // The round timer fires on the host's clock, and the spy's guess can
      // arrive at the same moment; whichever lands first decides it.
      if (current.status === 'finished') return null;
      return finishRound(current, winner, reason as WinReason);
    });
  };

  const leaveGame = async () => {
    if (!lobbyId || !userId) return;

    // A finished match is a record, not live state: leaving must not rewrite
    // the results the other players are still looking at. Just walk away —
    // the page navigates us out.
    if (gameStateRef.current?.status === 'finished') return;

    // Last one out switches off the lights. Checked against the local snapshot
    // because the RPC itself re-checks server-side and refuses while anyone
    // else is still in the room.
    const solo = (gameStateRef.current?.players.length ?? 0) <= 1;
    if (solo) {
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

      if (current.status === 'playing' || current.status === 'voting') {
        if (leaving.isSpy) {
          // The spy walked out — the locals take it.
          return finishRound(next, 'locals', 'spy_left');
        }

        next.notifications.push({
          id: now(),
          message: {
            ru: `${leaving.name} покинул игру`,
            en: `${leaving.name} left the game`
          },
          type: 'leave'
        });
        if (next.notifications.length > 3) next.notifications.shift();

        if (next.players.length < MIN_PLAYERS) {
          // Too few left to carry on: a technical win for the spy.
          return finishRound(next, 'spy', 'innocent_killed');
        }

        // A vote in progress may now be complete, or impossible to complete.
        if (next.status === 'voting' && next.nomination) {
          const voters = next.players.filter((p) => p.id !== next.nomination!.targetId);
          const voterIds = new Set(voters.map((p) => p.id));
          const cast = Object.entries(next.nomination.votes).filter(([id]) => voterIds.has(id));

          if (cast.length >= voters.length) {
            const unanimous = cast.length > 0 && cast.every(([, v]) => v === true);
            if (unanimous) {
              const target = next.players.find((p) => p.id === next.nomination!.targetId);
              return target?.isSpy
                ? finishRound(next, 'locals', 'spy_caught')
                : finishRound(next, 'spy', 'innocent_killed');
            }
            next.status = 'playing';
            next.nomination = null;
          }
        }
      }

      return next;
    });
  };

  const initGame = async (userProfile: { name: string; avatarUrl: string }) => {
    if (!userId || !lobbyId) return;

    await updateState((current) => {
      if (current.players.find((p) => p.id === userId)) {
        // Already seated. Nothing to write — the sync hook's own fetch put
        // this state here.
        return null;
      }
      if (current.status !== 'waiting') return null;
      if (current.players.length >= current.settings.maxPlayers) return null;

      const next = clone(current);
      next.players.push({
        id: userId,
        name: userProfile.name,
        avatarUrl: userProfile.avatarUrl,
        isHost: next.players.length === 0,
        isSpy: false,
        role: null,
        isReady: true,
        hasNominated: false,
        score: 0
      });

      return next;
    });
  };

  // Record statistics when the round finishes:
  // a local wins when locals win, the spy wins when the spy side wins
  useEffect(() => {
      if (gameState?.status === 'finished' && userId && !lobbyDeleted && gameState.winner) {
          const me = gameState.players.find(p => p.id === userId);
          if (me) {
              const isWinner = (gameState.winner === 'spy' && me.isSpy) ||
                               (gameState.winner === 'locals' && !me.isSpy);
              const duration = gameState.startTime
                  ? Math.max(1, Math.round((now() - gameState.startTime) / 1000))
                  : (gameState.settings.roundDuration || 480);

              updatePlayerStats(userId, {
                  gameType: 'spyfall',
                  result: isWinner ? 'win' : 'loss',
                  durationSeconds: duration
              });
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the match finishes; adding gameState.players would re-record stats
  }, [gameState?.status, gameState?.winner, userId, lobbyDeleted]);

  return {
      gameState, roomMeta, loading, lobbyDeleted,
      initGame, startGame, endGame, leaveGame,
      startNomination, vote, resolveVoteTimeout
  };
}
