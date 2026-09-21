import { MinesweeperState, MinesweeperPlayer } from '@/types/minesweeper';
import { requireGame, roomCapacity } from '@/games/registry';
import { updatePlayerStats } from '@/lib/playerStats';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { generateEmptyBoard, placeMines, openCellIterative, chordCell as chordCellLogic } from '@/lib/gameLogic/minesweeper';

const GAME = requireGame('minesweeper');

/**
 * How far past the time limit any remaining player may close the match out on
 * behalf of someone who never answered. Long enough that it never beats a
 * player's own timeout on a slow connection.
 */
const STALLED_MATCH_GRACE_MS = 10_000;

const countMoves = (p: MinesweeperPlayer) => {
    let moves = 0;
    for (const r of p.board) for (const c of r) if (c.isOpen || c.isFlagged) moves++;
    return moves;
};

export function useMinesweeperGame(lobbyId: string | null, userId: string | undefined) {
  const {
    gameState, gameStateRef,
    roomMeta, loading, lobbyDeleted,
    updateState, deleteLobby
  } = useLobbySync<MinesweeperState>({
    lobbyId,
    userId,
    channelPrefix: 'lobby-mines',
    // Preserve local board progress when the server lags (anti-lag),
    // but accept the server state on game end/timeout
    mergeIncoming: (prev, incoming) => {
      if (incoming.status === 'waiting') return incoming;

      const prevVersion = prev?.version || 0;
      const newVersion = incoming.version || 0;
      if (prev && newVersion < prevVersion && incoming.status === 'playing') return prev;

      if (prev && userId && incoming.status === 'playing') {
        const myPrev = prev.players[userId];
        const myIncoming = incoming.players[userId];

        if (myPrev && myIncoming && myPrev.status !== 'left') {
          if (countMoves(myPrev) > countMoves(myIncoming) && myIncoming.status === 'playing') {
            return { ...incoming, players: { ...incoming.players, [userId]: myPrev } };
          }
        }
      }
      return incoming;
    }
  });

  const handleGameEndCheck = (newState: MinesweeperState, player: MinesweeperPlayer) => {
      const currentTime = Math.floor((Date.now() - newState.startTime) / 1000);

      let opened = 0, correctlyFlagged = 0, totalFlagged = 0;
      const totalCells = newState.settings.width * newState.settings.height;

      player.board.forEach(row => row.forEach(cell => {
          if (cell.isOpen) opened++;
          if (cell.isFlagged) {
              totalFlagged++;
              if (cell.isMine) correctlyFlagged++;
          }
      }));

      const isWin = (opened === totalCells - newState.settings.minesCount) ||
                    (totalFlagged === newState.settings.minesCount && correctlyFlagged === newState.settings.minesCount);

      // IMPORTANT: all callers (revealCell/toggleFlag/chordCell/handleTimeout) invoke this
      // check only for a player who was 'playing' before the action. A 'lost' status here
      // therefore means the loss happened just now and must be processed.
      const playerCount = Object.keys(newState.players).length;
      const mode = playerCount > 1 ? 'multi' : 'single';

      if (isWin && player.status === 'playing') {
          player.status = 'won';
          player.score = currentTime;
          newState.status = 'finished';
          newState.winner = player.name;
          newState.winnerId = player.id;

          if (userId && player.id === userId) {
              updatePlayerStats(userId, {
                  gameType: 'minesweeper',
                  result: 'win',
                  durationSeconds: currentTime,
                  mode: mode,
                  extraCount: correctlyFlagged
              });
          }
      }

      if (player.status === 'lost') {
          player.score = currentTime;
          const active = Object.values(newState.players).filter(p => p.status === 'playing');
          if (active.length === 0) newState.status = 'finished';

          if (userId && player.id === userId) {
              updatePlayerStats(userId, {
                  gameType: 'minesweeper',
                  result: 'loss',
                  durationSeconds: currentTime,
                  mode: mode,
                  extraCount: correctlyFlagged
              });
          }
      }
  };

  /**
   * Seat the player. Retryable on purpose: an invite link posted in a group
   * chat gets opened by everyone at once, and the old read-then-write form
   * meant whoever lost that race simply never appeared in the room.
   */
  const initGame = async (userProfile: { name: string; avatarUrl: string }) => {
    if (!userId || !lobbyId) return;

    await updateState((current) => {
      if (current.players[userId]) return null; // already seated
      if (current.status !== 'waiting') return null;
      if (Object.keys(current.players).length >= roomCapacity(GAME, current.settings?.maxPlayers)) return null;

      const next: MinesweeperState = JSON.parse(JSON.stringify(current));
      next.players[userId] = {
          id: userId,
          name: userProfile.name,
          avatarUrl: userProfile.avatarUrl,
          isHost: Object.keys(next.players).length === 0,
          board: [],
          status: 'playing',
          minesLeft: next.settings.minesCount,
          score: 0
      };

      return next;
    });
  };

  const startGame = async () => {
    await updateState((current) => {
    // Retryable so a player joining on the same beat as the host presses
    // start is dealt a board rather than dropped from the match.
    if (current.status !== 'waiting') return null;

    const newState: MinesweeperState = JSON.parse(JSON.stringify(current));
    newState.status = 'playing';
    newState.startTime = Date.now();
    newState.winner = null;

    Object.keys(newState.players).forEach(pid => {
        newState.players[pid].board = generateEmptyBoard(newState.settings.width, newState.settings.height);
        newState.players[pid].status = 'playing';
        newState.players[pid].minesLeft = newState.settings.minesCount;
        newState.players[pid].score = 0;
    });

    return newState;
    });
  };

  // Every player owns their own board, but all boards live in one row behind a
  // single version counter — so two players clicking at the same moment used to
  // collide and one click was dropped. These actions are written as functions of
  // the current state so a conflict can be rebuilt on fresh state and retried.
  const revealCell = async (x: number, y: number) => {
    if (!userId) return;
    await updateState((current) => {
      if (current.status !== 'playing') return null;
      const newState: MinesweeperState = JSON.parse(JSON.stringify(current));
      const player = newState.players[userId];

      if (!player || player.status !== 'playing') return null;
      if (player.board[y][x].isOpen || player.board[y][x].isFlagged) return null;

      // Optimization note: a hasStarted flag on the player would avoid the full scan,
      // but this is fast on the client and kept for compatibility
      const isFirstMove = player.board.flat().every((c) => !c.isOpen);
      if (isFirstMove) {
          placeMines(player.board, newState.settings.width, newState.settings.height, newState.settings.minesCount, x, y);
      }

      const cell = player.board[y][x];

      if (cell.isMine) {
          cell.isOpen = true;
          player.status = 'lost';
          // Reveal all mines
          player.board.forEach((r) => r.forEach((c) => { if (c.isMine) c.isOpen = true; }));
      } else {
          // Iterative approach
          openCellIterative(player.board, x, y, newState.settings.width, newState.settings.height);
      }

      handleGameEndCheck(newState, player);
      return newState;
    });
  };

  const toggleFlag = async (x: number, y: number) => {
    if (!userId) return;
    await updateState((current) => {
      if (current.status !== 'playing') return null;
      const newState: MinesweeperState = JSON.parse(JSON.stringify(current));
      const player = newState.players[userId];

      if (!player || player.status !== 'playing') return null;
      const cell = player.board[y][x];
      if (cell.isOpen) return null; // nothing to toggle — no state write

      cell.isFlagged = !cell.isFlagged;
      player.minesLeft += cell.isFlagged ? -1 : 1;

      handleGameEndCheck(newState, player);
      return newState;
    });
  };

  const chordCell = async (x: number, y: number) => {
    if (!userId) return;
    await updateState((current) => {
      if (current.status !== 'playing') return null;
      const newState: MinesweeperState = JSON.parse(JSON.stringify(current));
      const player = newState.players[userId];

      if (!player || player.status !== 'playing') return null;

      const { changed, hitMine } = chordCellLogic(player.board, x, y, newState.settings.width, newState.settings.height);
      if (!changed) return null; // nothing opened — no state write

      if (hitMine) {
          player.status = 'lost';
          player.board.forEach((r) => r.forEach((c) => { if (c.isMine) c.isOpen = true; }));
      }
      handleGameEndCheck(newState, player);
      return newState;
    });
  };

  const handleTimeout = async () => {
    if (!userId) return;
    await updateState((current) => {
      if (current.status !== 'playing') return null;
      const newState: MinesweeperState = JSON.parse(JSON.stringify(current));
      const player = newState.players[userId];
      if (!player || player.status !== 'playing') return null;

      player.status = 'lost';
      player.board.forEach((r) => r.forEach((c) => { if (c.isMine) c.isOpen = true; }));
      handleGameEndCheck(newState, player);
      return newState;
    });
  };

  /**
   * Backstop for a player who vanished rather than left.
   *
   * Each client only times out its own board, so a closed tab leaves that
   * player `playing` for good — and the match only finishes once nobody is
   * still playing. Everyone else was left staring at a finished-looking board
   * that never showed results.
   */
  const forceTimeUp = async () => {
    await updateState((current) => {
      if (current.status !== 'playing') return null;

      const limit = current.settings.timeLimit || 600;
      const overdueMs = Date.now() - (current.startTime + limit * 1000);
      if (overdueMs < STALLED_MATCH_GRACE_MS) return null;

      const stillPlaying = Object.values(current.players).filter((p) => p.status === 'playing');
      if (stillPlaying.length === 0) return null;

      const newState: MinesweeperState = JSON.parse(JSON.stringify(current));
      Object.values(newState.players).forEach((p) => {
        // Their own client records their loss if it is still connected; this
        // only settles the board so the room can show results.
        if (p.status === 'playing') p.status = 'lost';
      });
      newState.status = 'finished';

      return newState;
    });
  };

  const leaveGame = async () => {
     if (!lobbyId || !userId) return;

     // A finished match is a record, not live state: leaving must not rewrite
     // the results the other players are still looking at. Just walk away —
     // the page navigates us out.
     const snapshot = gameStateRef.current;
     if (!snapshot || snapshot.status === 'finished') return;

     const othersLeft = Object.values(snapshot.players)
         .some((p) => p.id !== userId && p.status !== 'left');
     if (!othersLeft) {
         await deleteLobby();
         return;
     }

     await updateState((current) => {
         if (current.status === 'finished') return null;
         if (!current.players[userId]) return null;

         const next: MinesweeperState = JSON.parse(JSON.stringify(current));
         const wasHost = next.players[userId]?.isHost;

         if (next.status === 'waiting') {
             delete next.players[userId];
         } else {
             // Mid-match the record stays so the scoreboard keeps the name.
             next.players[userId].status = 'left';
         }

         const remainingActive = Object.values(next.players).filter((p) => p.status !== 'left');
         if (remainingActive.length === 0) return null;

         if (wasHost) next.players[remainingActive[0].id].isHost = true;

         if (next.status === 'playing') {
             const playing = remainingActive.filter((p: MinesweeperPlayer) => p.status === 'playing');
             if (playing.length === 0) next.status = 'finished';
         }

         return next;
     });
  };

  return {
      gameState, roomMeta, loading, lobbyDeleted,
      initGame, startGame, revealCell, toggleFlag, chordCell, leaveGame, handleTimeout,
      forceTimeUp
  };
}