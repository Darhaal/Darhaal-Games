import type { GameState as CoupState, Player as CoupPlayer } from '@/types/coup';
import type { BattleshipState, PlayerBoard as BattleshipPlayer } from '@/types/battleship';
import type { FlagerState } from '@/types/flager';
import type { MinesweeperState, MinesweeperPlayer } from '@/types/minesweeper';
import type { SpyfallState } from '@/types/spyfall';
import type { WallRushMode, WallRushState } from '@/types/wallrush';
import type { DotsState } from '@/types/dots';
import type { ReversiState } from '@/types/reversi';
import { emptyBoard, DEFAULT_SIZE, MIN_SIZE, MAX_SIZE } from '@/lib/gameLogic/dots';
import { startingBoard, BOARD_SIZE as REVERSI_SIZE } from '@/lib/gameLogic/reversi';
import { WALLS_FOR_MODE, PLAYERS_FOR_MODE, BOARD_FOR_MODE } from '@/lib/gameLogic/wallrush';
import { SPYFALL_PACKS } from '@/data/spyfall/locations';
import type { GameId } from './registry';
import { num, str, type OptionValues } from './options';

/**
 * Builds the `game_state` a freshly created lobby starts from.
 *
 * This was an `if / else if` chain inside the create screen's submit handler,
 * so the opening state of every game lived in a UI event handler and could
 * only be exercised by clicking through the form. Here it is a pure function
 * of the host, the player cap and the chosen options — unit-testable, and one
 * place to add a game rather than one more branch in a growing handler.
 *
 * Note the two player shapes: Coup, Flager and Spyfall keep an array, while
 * Battleship and Minesweeper key players by id. That difference is load-bearing
 * in the game hooks, so it is preserved rather than normalised away here.
 */

export interface NewGameHost {
  id: string;
  name: string;
  avatarUrl: string;
}

/** Which state type each game stores, so callers narrow by id. */
export interface GameStateByType {
  spyfall: SpyfallState;
  minesweeper: MinesweeperState;
  flager: FlagerState;
  battleship: BattleshipState;
  coup: CoupState;
  wallrush: WallRushState;
  dots: DotsState;
  reversi: ReversiState;
}

export type AnyGameState = GameStateByType[GameId];

interface FactoryArgs {
  host: NewGameHost;
  maxPlayers: number;
  values: OptionValues;
  /** One timestamp for the whole state, so its fields cannot disagree. */
  now: number;
  /** The host's player record, minus whatever each game adds to it. */
  base: { id: string; name: string; avatarUrl: string; isHost: true };
}

/**
 * One factory per game, keyed so the record is exhaustive over `GameId` and
 * the return type narrows: `createInitialState('minesweeper', …)` is a
 * MinesweeperState, not a union every caller has to pick apart again.
 */
const FACTORIES: { [K in GameId]: (args: FactoryArgs) => GameStateByType[K] } = {
  spyfall: ({ maxPlayers, values, base }) => ({
    players: [{ ...base, isSpy: false, role: null, isReady: true, hasNominated: false, score: 0 }],
    status: 'waiting',
    settings: {
      roundDuration: num(values, 'roundMinutes', 8) * 60,
      spyCount: 1,
      useCustomLocations: false,
      customLocations: [],
      packId: str(values, 'packId', SPYFALL_PACKS[0].id),
      maxPlayers
    },
    currentLocationId: null,
    locationList: [],
    startTime: 0,
    winner: null,
    nomination: null,
    notifications: [],
    version: 1,
    gameType: 'spyfall'
  }),

  minesweeper: ({ host, maxPlayers, values, now, base }) => {
    const size = num(values, 'size', 20);
    const totalCells = size * size;
    const requested = Math.floor(totalCells * (num(values, 'mineDensity', 15) / 100));
    // The first reveal opens a 3x3 safe pocket, so the board has to keep nine
    // cells free however dense the host asked for — otherwise the opening move
    // is impossible.
    const minesCount = Math.max(1, Math.min(requested, totalCells - 9));

    const player: MinesweeperPlayer = {
      ...base,
      board: [],
      status: 'playing',
      minesLeft: minesCount,
      score: 0
    };

    return {
      players: { [host.id]: player },
      status: 'waiting',
      startTime: 0,
      lastActionTime: now,
      version: 1,
      winner: null,
      gameType: 'minesweeper',
      settings: {
        maxPlayers,
        width: size,
        height: size,
        minesCount,
        timeLimit: num(values, 'timeLimitMinutes', 20) * 60,
        difficulty: 'custom'
      }
    };
  },

  flager: ({ maxPlayers, values, now, base }) => ({
    players: [
      {
        ...base,
        score: 0,
        guesses: [],
        hasFinishedRound: false,
        roundScore: 0,
        history: [],
        isReadyForNextRound: false
      }
    ],
    status: 'waiting',
    targetChain: [],
    currentRoundIndex: 0,
    roundStartTime: now,
    lastActionTime: now,
    version: 1,
    gameType: 'flager',
    settings: {
      maxPlayers,
      totalRounds: num(values, 'rounds', 5),
      roundDuration: num(values, 'roundSeconds', 60)
    }
  }),

  battleship: ({ host, now, base }) => {
    const player: BattleshipPlayer = {
      ...base,
      isReady: false,
      ships: [],
      shots: {},
      aliveShipsCount: 0
    };

    return {
      players: { [host.id]: player },
      turn: null,
      phase: 'setup',
      status: 'waiting',
      winner: null,
      logs: [],
      lastActionTime: now,
      version: 1,
      gameType: 'battleship',
      // Always two, whatever the caller passes: the board has two sides.
      settings: { maxPlayers: 2 },
      turnDeadline: undefined
    };
  },

  wallrush: ({ maxPlayers, values, now, base }) => {
    // The mode decides the headcount and the wall allowance, not the host: a
    // duel is two players with ten walls each, a four is five walls each,
    // because twenty walls on one board locks it solid.
    const mode = (str(values, 'mode', 'duel') as WallRushMode);
    const seats = PLAYERS_FOR_MODE[mode] ? mode : 'duel';

    return {
      players: [{ ...base, seat: 0, wallsLeft: WALLS_FOR_MODE[seats], score: 0 }],
      status: 'waiting',
      size: BOARD_FOR_MODE[seats],
      // Seats, and therefore starting squares, are dealt when the match
      // starts — they depend on who actually turned up.
      pawns: {},
      walls: [],
      turnPlayerId: null,
      winnerIds: [],
      startTime: 0,
      lastActionTime: now,
      notifications: [],
      version: 1,
      gameType: 'wallrush',
      settings: {
        maxPlayers: PLAYERS_FOR_MODE[seats] ?? maxPlayers,
        mode: seats,
        turnDuration: num(values, 'turnSeconds', 45)
      }
    };
  },

  dots: ({ maxPlayers, values, now, base }) => {
    // Clamped rather than trusted: the slider is the only caller today, but a
    // board outside these bounds would render as a sliver or a wall of cells.
    const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, num(values, 'size', DEFAULT_SIZE)));

    return {
      players: [{ ...base, seat: 0, score: 0 }],
      status: 'waiting',
      size,
      ...emptyBoard(size),
      turnPlayerId: null,
      winnerIds: [],
      startTime: 0,
      lastActionTime: now,
      notifications: [],
      version: 1,
      gameType: 'dots',
      settings: {
        maxPlayers,
        size,
        turnDuration: num(values, 'turnSeconds', 30)
      }
    };
  },

  reversi: ({ now, base }) => ({
    players: [{ ...base, seat: 0, score: 0 }],
    status: 'waiting',
    size: REVERSI_SIZE,
    // The opening four are on the board from the moment the room exists, so
    // the lobby preview and the first turn see the same position.
    board: startingBoard(),
    turnPlayerId: null,
    passes: 0,
    winnerIds: [],
    startTime: 0,
    lastActionTime: now,
    notifications: [],
    version: 1,
    gameType: 'reversi',
    // Always two: the game has one colour each and no variant with more.
    settings: { maxPlayers: 2, turnDuration: 45 }
  }),

  coup: ({ maxPlayers, now, base }) => {
    const player: CoupPlayer = { ...base, coins: 2, cards: [], isDead: false, isReady: true };

    return {
      players: [player],
      deck: [],
      turnIndex: 0,
      logs: [],
      status: 'waiting',
      phase: 'choosing_action',
      currentAction: null,
      lastActionTime: now,
      version: 1,
      turnDeadline: undefined,
      gameType: 'coup',
      settings: { maxPlayers },
      passedPlayers: []
    };
  }
};

/**
 * The state a rematch room opens with: this match's settings, nobody seated.
 *
 * A rematch is a new room rather than this one reset — resetting in place
 * pulls the results out from under anyone still reading them, and a room
 * people reached by link keeps its old identity forever. Nobody is seated
 * because the players arrive through the usual join, which is also what lets
 * the second one press "play again" and land in the same room.
 *
 * Keyed over `GameId` like FACTORIES, so a new game cannot ship without
 * saying what its rematch looks like. Settings are carried across wholesale
 * rather than rebuilt from the create screen's options, which would lose
 * anything the two representations disagree about.
 *
 * `version: 1` is correct and not a violation of the write-path rule: this is
 * a brand-new row, not an update to an existing one.
 */
const REMATCH: { [K in GameId]: (parent: GameStateByType[K]) => GameStateByType[K] } = {
  spyfall: (p) => ({
    ...p,
    players: [],
    // The roster empties, so the running score has to travel separately.
    carriedScores: Object.fromEntries(p.players.map((pl) => [pl.id, pl.score || 0])),
    status: 'waiting',
    currentLocationId: null,
    locationList: [],
    startTime: 0,
    winner: null,
    winReason: undefined,
    nomination: null,
    notifications: [],
    version: 1
  }),

  minesweeper: (p) => ({
    ...p,
    players: {},
    status: 'waiting',
    startTime: 0,
    winner: null,
    winnerId: undefined,
    lastActionTime: Date.now(),
    version: 1
  }),

  flager: (p) => ({
    ...p,
    players: [],
    status: 'waiting',
    targetChain: [],
    currentRoundIndex: 0,
    roundStartTime: Date.now(),
    lastActionTime: Date.now(),
    notifications: [],
    version: 1
  }),

  battleship: (p) => ({
    ...p,
    players: {},
    turn: null,
    phase: 'setup',
    status: 'waiting',
    winner: null,
    logs: [],
    lastActionTime: Date.now(),
    turnDeadline: undefined,
    version: 1
  }),

  coup: (p) => ({
    ...p,
    players: [],
    deck: [],
    turnIndex: 0,
    logs: [],
    status: 'waiting',
    phase: 'choosing_action',
    currentAction: null,
    pendingPlayerId: undefined,
    exchangeBuffer: undefined,
    passedPlayers: [],
    winner: undefined,
    winnerId: undefined,
    lastActionTime: Date.now(),
    turnDeadline: undefined,
    version: 1
  }),

  dots: (p) => ({
    ...p,
    players: [],
    status: 'waiting',
    ...emptyBoard(p.settings.size),
    turnPlayerId: null,
    turnDeadline: undefined,
    winnerIds: [],
    startTime: 0,
    lastActionTime: Date.now(),
    notifications: [],
    version: 1
  }),

  reversi: (p) => ({
    ...p,
    players: [],
    status: 'waiting',
    board: startingBoard(p.size || REVERSI_SIZE),
    turnPlayerId: null,
    turnDeadline: undefined,
    passes: 0,
    winnerIds: [],
    startTime: 0,
    lastActionTime: Date.now(),
    notifications: [],
    version: 1
  }),

  wallrush: (p) => ({
    ...p,
    players: [],
    status: 'waiting',
    pawns: {},
    walls: [],
    turnPlayerId: null,
    turnDeadline: undefined,
    winnerIds: [],
    startTime: 0,
    lastActionTime: Date.now(),
    notifications: [],
    rematchLobbyId: undefined,
    version: 1
  })
};

export function createRematchState<T extends GameId>(
  id: T,
  parent: GameStateByType[T]
): GameStateByType[T] {
  return REMATCH[id](parent);
}

export function createInitialState<T extends GameId>(
  id: T,
  host: NewGameHost,
  maxPlayers: number,
  values: OptionValues
): GameStateByType[T] {
  return FACTORIES[id]({
    host,
    maxPlayers,
    values,
    now: Date.now(),
    base: { id: host.id, name: host.name, avatarUrl: host.avatarUrl, isHost: true }
  });
}
