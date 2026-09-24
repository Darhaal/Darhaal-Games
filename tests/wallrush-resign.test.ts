import { describe, it, expect } from 'vitest';
import { advanceTurn, resignPlayer } from '@/lib/gameLogic/wallrushFlow';
import type { WallRushMode, WallRushState } from '@/types/wallrush';

/**
 * Giving up in Wall Rush: out of the race, still at the table.
 *
 * The failure worth guarding is the quiet one — a turn handed to someone who
 * is no longer racing, so the whole table sits through a thirty-second clock
 * on a spectator before anything moves.
 */

const AT = 1_000_000;

const table = (mode: WallRushMode, ids: string[], turn = ids[0]): WallRushState => ({
  players: ids.map((id, seat) => ({
    id, name: id.toUpperCase(), avatarUrl: '', isHost: seat === 0, seat, wallsLeft: 5
  })),
  pawns: Object.fromEntries(ids.map((id, i) => [id, { x: i, y: 0 }])),
  walls: [],
  status: 'playing',
  size: 11,
  turnPlayerId: turn,
  turnDeadline: AT,
  winnerIds: [],
  startTime: 0,
  lastActionTime: 0,
  version: 3,
  gameType: 'wallrush',
  settings: { mode, maxPlayers: ids.length, turnDuration: 30 }
} as unknown as WallRushState);

describe('resigning', () => {
  it('takes the pawn off the board and keeps the player in the room', () => {
    const next = resignPlayer(table('trio', ['a', 'b', 'c'], 'b'), 'a', AT)!;

    expect(next.pawns.a).toBeUndefined();
    expect(next.players.map((p) => p.id)).toContain('a');
    expect(next.resigned).toEqual(['a']);
    expect(next.status).toBe('playing');
  });

  it('passes the turn on when it was the resigning player’s', () => {
    const next = resignPlayer(table('trio', ['a', 'b', 'c'], 'a'), 'a', AT)!;

    expect(next.turnPlayerId).toBe('b');
    expect(next.turnDeadline).toBe(AT + 30_000);
  });

  it('leaves the turn alone when it was somebody else’s', () => {
    const next = resignPlayer(table('trio', ['a', 'b', 'c'], 'c'), 'a', AT)!;

    expect(next.turnPlayerId).toBe('c');
  });

  it('ends a duel on the spot, for the player who stayed', () => {
    // A race needs two runners; the rival has nobody left to beat.
    const next = resignPlayer(table('duel', ['a', 'b'], 'a'), 'a', AT)!;

    expect(next.status).toBe('finished');
    expect(next.winnerIds).toEqual(['b']);
  });

  it('ends a four when the last rival gives up', () => {
    let state = table('ffa', ['a', 'b', 'c', 'd'], 'a');
    state = resignPlayer(state, 'a', AT)!;
    state = resignPlayer(state, 'b', AT)!;
    expect(state.status).toBe('playing');

    state = resignPlayer(state, 'c', AT)!;
    expect(state.status).toBe('finished');
    expect(state.winnerIds).toEqual(['d']);
  });

  it('lets a partner carry on in 2v2', () => {
    // Seats 0 and 2 are one team; one of them resigning does not concede it.
    const next = resignPlayer(table('teams', ['a', 'b', 'c', 'd'], 'a'), 'a', AT)!;

    expect(next.status).toBe('playing');
    expect(next.pawns.c).toBeDefined();
  });

  it('concedes 2v2 when both partners have given up', () => {
    let state = table('teams', ['a', 'b', 'c', 'd'], 'b');
    state = resignPlayer(state, 'a', AT)!;
    state = resignPlayer(state, 'c', AT)!;

    expect(state.status).toBe('finished');
    expect(state.winnerIds.sort()).toEqual(['b', 'd']);
  });

  it('does nothing for a player already out, or a match not running', () => {
    const once = resignPlayer(table('trio', ['a', 'b', 'c']), 'a', AT)!;
    expect(resignPlayer(once, 'a', AT)).toBeNull();

    const waiting = { ...table('trio', ['a', 'b', 'c']), status: 'waiting' } as WallRushState;
    expect(resignPlayer(waiting, 'a', AT)).toBeNull();
  });

  it('tells the table who gave up', () => {
    const next = resignPlayer(table('trio', ['a', 'b', 'c']), 'b', AT)!;

    expect(next.notifications?.at(-1)?.message.ru).toBe('B сдался');
  });
});

describe('the turn never stops on a spectator', () => {
  it('walks past everyone who has resigned', () => {
    const state = table('ffa', ['a', 'b', 'c', 'd'], 'a');
    delete state.pawns.b;
    delete state.pawns.c;

    advanceTurn(state, AT);
    expect(state.turnPlayerId).toBe('d');

    advanceTurn(state, AT);
    expect(state.turnPlayerId).toBe('a');
  });

  it('wraps round the table to find the next runner', () => {
    const state = table('ffa', ['a', 'b', 'c', 'd'], 'd');
    delete state.pawns.a;

    advanceTurn(state, AT);
    expect(state.turnPlayerId).toBe('b');
  });

  it('hands the turn to nobody when nobody is left racing', () => {
    const state = table('trio', ['a', 'b', 'c'], 'a');
    state.pawns = {};

    advanceTurn(state, AT);
    expect(state.turnPlayerId).toBeNull();
  });
});
