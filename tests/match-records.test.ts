// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/supabase', () => import('./support/fakeSupabase'));
vi.mock('@/lib/matchRecords', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/matchRecords')>()),
  recordMatch: vi.fn(async () => true)
}));

import { db } from './support/fakeSupabase';
import { seat, play } from './support/players';
import { recordMatch, matchSeconds, type MatchRecord } from '@/lib/matchRecords';
import { createInitialState } from '@/games/initialState';
import { GAME_IDS } from '@/games/registry';
import { generateEmptyBoard } from '@/lib/gameLogic/minesweeper';
import { useFlagerGame } from '@/hooks/useFlagerGame';
import { useMinesweeperGame } from '@/hooks/useMinesweeperGame';
import { useBattleshipGame } from '@/hooks/useBattleshipGame';
import { useSpyfallGame } from '@/hooks/useSpyfallGame';
import { useDotsGame } from '@/hooks/useDotsGame';
import { useReversiGame } from '@/hooks/useReversiGame';
import { useWallRushGame } from '@/hooks/useWallRushGame';
import type { FlagerPlayerState, FlagerState } from '@/types/flager';
import type { MinesweeperPlayer, MinesweeperState } from '@/types/minesweeper';
import type { BattleshipState } from '@/types/battleship';
import type { SpyfallState } from '@/types/spyfall';
import type { DotsState } from '@/types/dots';
import type { ReversiState } from '@/types/reversi';
import type { WallRushState } from '@/types/wallrush';

/**
 * What each game records, for whom, and when. The database makes a second
 * write of the same match a no-op (the key is unique); these tests hold the
 * games to their side of it: one record per player per match, the same key
 * every time, the right result — including for players who used to be missed.
 */

const LOBBY = 'lobby-records';
const START = Date.parse('2026-09-25T10:00:00Z');
const host = { id: 'a', name: 'A', avatarUrl: '' };

const records = () => vi.mocked(recordMatch).mock.calls.map(([r]) => r as MatchRecord);

beforeEach(() => {
  db.reset();
  vi.mocked(recordMatch).mockClear();
});

describe('every game', () => {
  const HOOKS: Record<(typeof GAME_IDS)[number], string> = {
    spyfall: 'useSpyfallGame', minesweeper: 'useMinesweeperGame', flager: 'useFlagerGame',
    battleship: 'useBattleshipGame', coup: 'useCoupGame', wallrush: 'useWallRushGame',
    dots: 'useDotsGame', reversi: 'useReversiGame', wikiler: 'useWikilerGame',
    timler: 'useTimlerGame'
  };

  it.each(GAME_IDS.map((id) => [id]))('%s records through recordMatch and counts a walk-out as a loss', (id) => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'hooks', `${HOOKS[id]}.ts`), 'utf8');

    expect(code).toContain("from '@/lib/matchRecords'");
    expect(code).toContain(`game: '${id}'`);
    expect(code).toContain('key: matchKey(lobbyId, ');
    // Inside leaveGame, before the leave is written.
    expect(code).toMatch(/const leaveGame = async[\s\S]*?await record\(snapshot, (?:'loss', )?true\)/);
  });
});

describe('matchSeconds', () => {
  it('runs from the start to the last write, not to whenever the result is opened', () => {
    expect(matchSeconds(START, START + 95_000, 600)).toBe(95);
  });

  it('falls back when the times are missing or out of order', () => {
    expect(matchSeconds(undefined, START, 600)).toBe(600);
    expect(matchSeconds(START, START - 1, 600)).toBe(600);
  });
});

describe('Flager', () => {
  const racer = (id: string, over: Partial<FlagerPlayerState> = {}): FlagerPlayerState => ({
    id, name: id.toUpperCase(), avatarUrl: '', isHost: id === 'a', score: 0, guesses: [],
    hasFinishedRound: true, roundScore: 0, history: [], isReadyForNextRound: true, ...over
  });
  const hit = (flagCode: string, attempts = 1) => ({ flagCode, isCorrect: true, attempts, points: 900 });
  const miss = (flagCode: string) => ({ flagCode, isCorrect: false, attempts: 10, points: 0 });

  const finished = (players: FlagerPlayerState[]): FlagerState => ({
    players, status: 'finished', targetChain: ['FR', 'DE', 'JP'], currentRoundIndex: 2,
    roundStartTime: START, playedSeconds: 74, lastActionTime: START, version: 1,
    notifications: [], gameType: 'flager', settings: { maxPlayers: 4, totalRounds: 3, roundDuration: 60 }
  });

  it('alone, more than half the flags is a win — and the length is time spent guessing', async () => {
    db.seed(LOBBY, finished([racer('a', { score: 1800, history: [hit('fr'), hit('de', 3), miss('jp')] })]));
    await seat(() => useFlagerGame(LOBBY, 'a'));

    expect(records()).toEqual([expect.objectContaining({
      game: 'flager', result: 'win', mode: 'single', durationSeconds: 74, score: 1800,
      key: `${LOBBY}:FR-DE-JP`,
      details: { rounds: 3, guessed: 2, firstTry: 1, lastChance: 0, players: 1 }
    })]);
  });

  it('alone, half or fewer is a loss — solo matches used to count as wins every time', async () => {
    db.seed(LOBBY, finished([racer('a', { score: 900, history: [hit('fr'), miss('de'), miss('jp')] })]));
    await seat(() => useFlagerGame(LOBBY, 'a'));

    expect(records()[0]).toMatchObject({ result: 'loss', mode: 'single' });
  });

  it('together, the top score wins, and a tie wins for both', async () => {
    db.seed(LOBBY, finished([racer('a', { score: 1500 }), racer('b', { score: 1500 }), racer('c', { score: 700 })]));
    for (const id of ['a', 'b', 'c']) await seat(() => useFlagerGame(LOBBY, id));

    expect(records().map((r) => r.result)).toEqual(['win', 'win', 'loss']);
    expect(new Set(records().map((r) => r.key)).size).toBe(1);
  });

  it('a room opened again records the same match under the same key', async () => {
    db.seed(LOBBY, finished([racer('a', { score: 1500 })]));
    await seat(() => useFlagerGame(LOBBY, 'a'));
    await seat(() => useFlagerGame(LOBBY, 'a'));

    const [first, second] = records();
    expect(second).toEqual(first);
  });
});

describe('Minesweeper', () => {
  /** A 4×4 board, one mine in the corner, everything open but (1,0). */
  const board = (open = true) => {
    const cells = generateEmptyBoard(4, 4);
    cells[0][0].isMine = true;
    for (const row of cells) for (const c of row) if (!c.isMine && open) c.isOpen = true;
    // The cell left to open touches the mine, so opening it floods nothing.
    cells[0][1].isOpen = false;
    cells[0][1].neighborCount = 1;
    return cells;
  };
  const sweeper = (id: string, over: Partial<MinesweeperPlayer> = {}): MinesweeperPlayer => ({
    id, name: id.toUpperCase(), avatarUrl: '', isHost: id === 'a',
    board: board(), status: 'playing', minesLeft: 1, score: 0, ...over
  });
  const field = (players: MinesweeperPlayer[]): MinesweeperState => ({
    players: Object.fromEntries(players.map((p) => [p.id, p])),
    status: 'playing', startTime: Date.now() - 50_000, lastActionTime: 0, version: 1,
    winner: null, notifications: [], gameType: 'minesweeper',
    settings: { maxPlayers: 4, width: 4, height: 4, minesCount: 1, timeLimit: 600, difficulty: 'custom' }
  });

  it('the winner records a win and the one still sweeping a loss — they used to get nothing', async () => {
    db.seed(LOBBY, field([sweeper('a'), sweeper('b')]));
    const a = await seat(() => useMinesweeperGame(LOBBY, 'a'));
    await seat(() => useMinesweeperGame(LOBBY, 'b'));

    await play(() => a.current.revealCell(1, 0));

    expect(records().map((r) => r.result).sort()).toEqual(['loss', 'win']);
    expect(records().every((r) => r.mode === 'multi' && r.details?.size === 4)).toBe(true);
    // Cleared by opening, not by flags; the one still sweeping had a cell left.
    expect(records().find((r) => r.result === 'win')?.details).toMatchObject({ flags: 0, safeLeft: 0, byFlags: false });
    expect(records().find((r) => r.result === 'loss')?.details).toMatchObject({ safeLeft: 1 });
    expect(records().find((r) => r.result === 'win')?.durationSeconds).toBeGreaterThanOrEqual(50);
  });

  it('a mine records the loss at once, while the others play on', async () => {
    db.seed(LOBBY, field([sweeper('a'), sweeper('b')]));
    const a = await seat(() => useMinesweeperGame(LOBBY, 'a'));

    await play(() => a.current.revealCell(0, 0));

    expect(db.state<MinesweeperState>(LOBBY).status).toBe('playing');
    expect(records()).toEqual([expect.objectContaining({ result: 'loss' })]);
  });

  it('alone, it is a solo match', async () => {
    db.seed(LOBBY, field([sweeper('a')]));
    const a = await seat(() => useMinesweeperGame(LOBBY, 'a'));

    await play(() => a.current.revealCell(1, 0));

    expect(records()).toEqual([expect.objectContaining({ result: 'win', mode: 'single' })]);
  });

  it('walking away from a live board records a loss', async () => {
    db.seed(LOBBY, field([sweeper('a'), sweeper('b'), sweeper('c')]));
    const b = await seat(() => useMinesweeperGame(LOBBY, 'b'));

    await play(() => b.current.leaveGame());

    expect(records()).toEqual([expect.objectContaining({ result: 'loss', details: expect.objectContaining({ left: true }) })]);
  });
});

describe('Battleship', () => {
  const sailor = (id: string) => ({
    id, name: id.toUpperCase(), avatarUrl: '', ships: [], shots: {},
    isReady: true, isHost: id === 'a', aliveShipsCount: 10
  });

  it('a room that ends before the first shot is nobody’s win or loss', async () => {
    const state: BattleshipState = {
      players: { a: sailor('a') }, turn: null, phase: 'finished', status: 'finished', winner: 'a',
      notifications: [], lastActionTime: 0, version: 1, gameType: 'battleship', settings: { maxPlayers: 2 }
    };
    db.seed(LOBBY, state);
    await seat(() => useBattleshipGame(LOBBY, host));

    expect(records()).toEqual([]);
  });

  it('counts the shots each player fires, not the misses marked around a sunk ship', async () => {
    const sub = (id: string, x: number) => ({ id, type: 'submarine' as const, size: 1, orientation: 'horizontal' as const, position: { x, y: 0 }, hits: 0 });
    db.seed(LOBBY, {
      players: { a: { ...sailor('a'), ships: [sub('a1', 0)] }, b: { ...sailor('b'), ships: [sub('b1', 5), sub('b2', 9)], aliveShipsCount: 2 } },
      turn: 'a', phase: 'playing', status: 'playing', winner: null, startTime: START, turnDeadline: Date.now() + 60_000,
      notifications: [], lastActionTime: START, version: 1, gameType: 'battleship', settings: { maxPlayers: 2 }
    } satisfies BattleshipState);
    const a = await seat(() => useBattleshipGame(LOBBY, host));

    await play(() => a.current.fireShot(5, 0));

    const me = db.state<BattleshipState>(LOBBY).players.a;
    expect(me.shotsFired).toBe(1);
    expect(Object.keys(me.shots).length).toBeGreaterThan(1);
  });

  it('a finished battle records the ships lost', async () => {
    const a = { ...sailor('a'), shotsFired: 12, ships: [
      { id: 's1', type: 'submarine' as const, size: 1, orientation: 'horizontal' as const, position: { x: 0, y: 0 }, hits: 1 },
      { id: 's2', type: 'submarine' as const, size: 1, orientation: 'horizontal' as const, position: { x: 2, y: 0 }, hits: 0 }
    ] };
    db.seed(LOBBY, {
      players: { a, b: sailor('b') }, turn: null, phase: 'finished', status: 'finished', winner: 'b',
      startTime: START, notifications: [], lastActionTime: START + 300_000, version: 1,
      gameType: 'battleship', settings: { maxPlayers: 2 }
    } satisfies BattleshipState);
    await seat(() => useBattleshipGame(LOBBY, host));

    expect(records()).toEqual([expect.objectContaining({
      result: 'loss', durationSeconds: 300, details: { shipsLost: 1, shots: 12 }
    })]);
  });
});

describe('Spyfall', () => {
  it('records the spy’s side and who caught them', async () => {
    const state = createInitialState('spyfall', host, 8, {}) as SpyfallState;
    state.players = [
      { ...state.players[0], isSpy: false },
      { id: 'b', name: 'B', avatarUrl: '', isHost: false, isSpy: true, role: null, isReady: true, score: 0 },
      { id: 'c', name: 'C', avatarUrl: '', isHost: false, isSpy: false, role: null, isReady: true, score: 0 }
    ];
    Object.assign(state, {
      status: 'finished', winner: 'locals', winReason: 'spy_caught', startTime: START,
      nomination: { authorId: 'a', targetId: 'b', votes: {}, startTime: START }
    });
    db.seed(LOBBY, state);
    for (const id of ['a', 'b', 'c']) await seat(() => useSpyfallGame(LOBBY, id));

    const [a, b, c] = records();
    expect(a).toMatchObject({ result: 'win', details: { spy: false, reason: 'spy_caught', caughtSpy: true } });
    expect(b).toMatchObject({ result: 'loss', details: { spy: true, reason: 'spy_caught' } });
    expect(c).toMatchObject({ result: 'win', details: { spy: false, reason: 'spy_caught' } });
    expect(c.details).not.toHaveProperty('caughtSpy');
  });
});

describe('leaving a match in progress is a loss', () => {
  const seated = (id: string, seatNo: number) => ({ id, name: id.toUpperCase(), avatarUrl: '', isHost: id === 'a', seat: seatNo, score: 0 });

  it('in Dots & Boxes', async () => {
    const state = createInitialState('dots', host, 3, {}) as DotsState;
    Object.assign(state, { status: 'playing', startTime: START, players: [seated('a', 0), seated('b', 1), seated('c', 2)], turnPlayerId: 'a' });
    db.seed(LOBBY, state);
    const b = await seat(() => useDotsGame(LOBBY, 'b'));

    await play(() => b.current.leaveGame());

    expect(records()).toEqual([expect.objectContaining({ game: 'dots', result: 'loss', key: `${LOBBY}:${START}` })]);
  });

  it('in Reversi', async () => {
    const state = createInitialState('reversi', host, 2, {}) as ReversiState;
    Object.assign(state, { status: 'playing', startTime: START, players: [seated('a', 0), seated('b', 1)], turnPlayerId: 'a' });
    db.seed(LOBBY, state);
    const b = await seat(() => useReversiGame(LOBBY, 'b'));

    await play(() => b.current.leaveGame());

    expect(records()).toEqual([expect.objectContaining({ game: 'reversi', result: 'loss', score: 2 })]);
  });

  it('in Wall Rush, with the walls used', async () => {
    const state = createInitialState('wallrush', host, 2, {}) as WallRushState;
    Object.assign(state, {
      status: 'playing', startTime: START, turnPlayerId: 'a',
      players: [{ ...seated('a', 0), wallsLeft: 10 }, { ...seated('b', 2), wallsLeft: 7 }],
      pawns: { a: { x: 4, y: 8 }, b: { x: 4, y: 0 } }
    });
    db.seed(LOBBY, state);
    const b = await seat(() => useWallRushGame(LOBBY, 'b'));

    await play(() => b.current.leaveGame());

    expect(records()).toEqual([expect.objectContaining({
      game: 'wallrush', result: 'loss', details: { mode: state.settings.mode, wallsUsed: 3, wallsTotal: 10, left: true }
    })]);
  });

  it('but leaving a finished match records nothing new', async () => {
    const state = createInitialState('dots', host, 2, {}) as DotsState;
    Object.assign(state, { status: 'finished', startTime: START, winnerIds: ['a'], players: [seated('a', 0), seated('b', 1)] });
    db.seed(LOBBY, state);
    const b = await seat(() => useDotsGame(LOBBY, 'b'));
    vi.mocked(recordMatch).mockClear();

    await play(() => b.current.leaveGame());

    expect(records()).toEqual([]);
  });
});
