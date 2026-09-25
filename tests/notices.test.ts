// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => import('./support/fakeSupabase'));
vi.mock('@/lib/playerStats', () => ({ updatePlayerStats: vi.fn() }));

import { db } from './support/fakeSupabase';
import { seat, play } from './support/players';
import { pushNotice, leftTheGame } from '@/lib/notifications';
import { useBattleshipGame } from '@/hooks/useBattleshipGame';
import { useMinesweeperGame } from '@/hooks/useMinesweeperGame';
import { generateEmptyBoard } from '@/lib/gameLogic/minesweeper';
import type { GameNotification } from '@/types/notification';
import type { BattleshipState, PlayerBoard } from '@/types/battleship';
import type { MinesweeperPlayer, MinesweeperState } from '@/types/minesweeper';

/**
 * The in-match toast: what each game posts, and the one helper that posts it.
 */

const LOBBY = 'lobby-notices';

beforeEach(() => {
  db.reset();
});

describe('pushNotice', () => {
  it('keeps the last three, newest last', () => {
    const state: { notifications?: GameNotification[] } = {};
    for (let i = 1; i <= 5; i++) pushNotice(state, leftTheGame(`P${i}`), 'leave', i);

    expect(state.notifications?.map((n) => n.id)).toEqual([3, 4, 5]);
    expect(state.notifications?.at(-1)?.message).toEqual({ ru: 'P5 покинул игру', en: 'P5 left the game' });
  });

  it('starts the list on a state that has none', () => {
    const state: { notifications?: GameNotification[] } = {};
    pushNotice(state, { ru: 'а', en: 'a' }, 'info', 1);

    expect(state.notifications).toEqual([{ id: 1, message: { ru: 'а', en: 'a' }, type: 'info' }]);
  });
});

describe('Battleship notices', () => {
  const sailor = (id: string, over: Partial<PlayerBoard> = {}): PlayerBoard => ({
    id, name: id.toUpperCase(), avatarUrl: '', ships: [], shots: {},
    isReady: false, isHost: id === 'a', aliveShipsCount: 0, ...over
  });

  const battle = (over: Partial<BattleshipState>): BattleshipState => ({
    players: { a: sailor('a'), b: sailor('b') },
    turn: null, phase: 'setup', status: 'playing', winner: null,
    notifications: [], lastActionTime: 0, version: 1,
    gameType: 'battleship', settings: { maxPlayers: 2 },
    ...over
  });

  const captain = (id: string) => seat(() => useBattleshipGame(LOBBY, { id, name: id.toUpperCase(), avatarUrl: '' }));

  it('tells the other side when a fleet is placed', async () => {
    db.seed(LOBBY, battle({}));
    const a = await captain('a');
    await captain('b');

    await play(async () => a.current.autoPlaceShips());
    await play(() => a.current.submitShips());

    expect(db.state<BattleshipState>(LOBBY).notifications?.at(-1)).toMatchObject({
      type: 'info', message: { ru: 'A расставил флот', en: 'A has placed their fleet' }
    });
  });

  it('says whose clock ran out when the turn passes', async () => {
    db.seed(LOBBY, battle({
      phase: 'playing', turn: 'a', turnDeadline: Date.now() - 1,
      players: { a: sailor('a', { isReady: true }), b: sailor('b', { isReady: true }) }
    }));
    await captain('a');
    const b = await captain('b');

    await play(() => b.current.handleTimeout());

    const stored = db.state<BattleshipState>(LOBBY);
    expect(stored.turn).toBe('b');
    expect(stored.notifications?.at(-1)).toMatchObject({
      type: 'alert', message: { ru: 'A не успел — ход переходит', en: 'A ran out of time — the turn passes' }
    });
  });
});

describe('Minesweeper notices', () => {
  /** A 4x4 board with one mine in the corner and one cell already open. */
  const board = () => {
    const cells = generateEmptyBoard(4, 4);
    cells[0][0].isMine = true;
    cells[3][3].isOpen = true;
    return cells;
  };

  const sweeper = (id: string): MinesweeperPlayer => ({
    id, name: id.toUpperCase(), avatarUrl: '', isHost: id === 'a',
    board: board(), status: 'playing', minesLeft: 1, score: 0
  });

  const field = (ids: string[]): MinesweeperState => ({
    players: Object.fromEntries(ids.map((id) => [id, sweeper(id)])),
    status: 'playing', startTime: Date.now(), lastActionTime: 0, version: 1,
    winner: null, notifications: [], gameType: 'minesweeper',
    settings: { maxPlayers: 4, width: 4, height: 4, minesCount: 1, timeLimit: 600, difficulty: 'custom' }
  });

  it('tells the others who hit a mine', async () => {
    db.seed(LOBBY, field(['a', 'b']));
    const a = await seat(() => useMinesweeperGame(LOBBY, 'a'));

    await play(() => a.current.revealCell(0, 0));

    expect(db.state<MinesweeperState>(LOBBY).notifications?.at(-1)).toMatchObject({
      type: 'alert', message: { ru: 'A подорвался на мине', en: 'A hit a mine' }
    });
  });

  it('keeps quiet in a game played alone', async () => {
    db.seed(LOBBY, field(['a']));
    const a = await seat(() => useMinesweeperGame(LOBBY, 'a'));

    await play(() => a.current.revealCell(0, 0));

    expect(db.state<MinesweeperState>(LOBBY).notifications).toEqual([]);
  });

  it('tells the others who left', async () => {
    db.seed(LOBBY, field(['a', 'b', 'c']));
    const b = await seat(() => useMinesweeperGame(LOBBY, 'b'));

    await play(() => b.current.leaveGame());

    expect(db.state<MinesweeperState>(LOBBY).notifications?.at(-1)?.message).toEqual(leftTheGame('B'));
  });
});
