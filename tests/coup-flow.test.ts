// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => import('./support/fakeSupabase'));
vi.mock('@/lib/playerStats', () => ({ updatePlayerStats: vi.fn() }));

import { db } from './support/fakeSupabase';
import { seat, play } from './support/players';
import { useCoupGame } from '@/hooks/useCoupGame';
import { updatePlayerStats } from '@/lib/playerStats';
import { buildDeck } from '@/lib/gameLogic/coup';
import type { GameState, Player, Role } from '@/types/coup';

/**
 * Coup's phase machine, played through the real hook by several players at
 * once against one shared row. Each test sets up a table with known hands so
 * challenges have a known outcome.
 */

const LOBBY = 'lobby-coup';

const seatAt = (roles: Role[], id: string, coins = 2): Player => ({
  id,
  name: id.toUpperCase(),
  avatarUrl: '',
  coins,
  cards: roles.map((role) => ({ role, revealed: false })),
  isDead: false,
  isHost: id === 'a',
  isReady: true
});

/** A match in progress, A to move; the deck is whatever the hands left. */
function table(players: Player[], over: Partial<GameState> = {}): GameState {
  const deck = buildDeck();
  for (const p of players) for (const c of p.cards) deck.splice(deck.indexOf(c.role), 1);
  return {
    players,
    deck,
    turnIndex: 0,
    logs: [],
    status: 'playing',
    phase: 'choosing_action',
    currentAction: null,
    passedPlayers: [],
    lastActionTime: 0,
    turnDeadline: Date.now() + 60_000,
    startTime: Date.now(),
    version: 1,
    gameType: 'coup',
    settings: { maxPlayers: 6 },
    ...over
  };
}

const stored = () => db.state<GameState>(LOBBY);
const who = (id: string) => stored().players.find((p) => p.id === id)!;
const turnOf = () => stored().players[stored().turnIndex]?.id;
const expire = () => play(async () => db.write<GameState>(LOBBY, (s) => { s.turnDeadline = Date.now() - 1; }));

/** Every card is somewhere: in a hand (shown or not), in the deck, or in an exchange. */
const cardsInPlay = (s: GameState) =>
  s.deck.length + (s.exchangeBuffer?.length ?? 0) +
  s.players.reduce((n, p) => n + p.cards.length, 0) -
  // During an exchange the hand's live cards are in the buffer as well.
  (s.exchangeBuffer ? s.players.find((p) => p.id === s.pendingPlayerId)!.cards.filter((c) => !c.revealed).length : 0);

async function sit(...players: Player[]) {
  const hooks = [];
  for (const p of players) hooks.push(await seat(() => useCoupGame(LOBBY, p.id)));
  return hooks;
}

beforeEach(() => {
  db.reset();
  vi.mocked(updatePlayerStats).mockClear();
});

describe('Coup — plain actions', () => {
  it('income pays one and passes the turn, and everyone sees it', async () => {
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('income'));

    expect(who('a').coins).toBe(3);
    expect(turnOf()).toBe('b');
    expect(stored().phase).toBe('choosing_action');
    expect(b.current.gameState?.players[0].coins).toBe(3);
  });

  it('a player cannot act out of turn', async () => {
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [, b] = await sit(...stored().players);

    await play(() => b.current.performAction('income'));

    expect(who('b').coins).toBe(2);
    expect(db.stats.writes).toBe(0);
  });

  it('a claim nobody challenges goes through once everyone has passed', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a, b, c] = await sit(...stored().players);

    await play(() => a.current.performAction('tax'));
    expect(stored().phase).toBe('waiting_for_challenges');

    await play(() => b.current.pass());
    expect(stored().phase).toBe('waiting_for_challenges');
    expect(who('a').coins).toBe(2);

    await play(() => c.current.pass());
    expect(who('a').coins).toBe(5);
    expect(turnOf()).toBe('b');
  });

  it('passes given at the same instant both count', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a, b, c] = await sit(...stored().players);

    await play(() => a.current.performAction('tax'));
    await play(() => b.current.pass(), () => c.current.pass());

    expect(who('a').coins).toBe(5);
    expect(turnOf()).toBe('b');
  });

  it('a coup costs seven and takes a card; the last card ends the match', async () => {
    const b = seatAt(['captain', 'assassin'], 'b');
    b.cards[0].revealed = true;
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a', 7), b]));
    const [ha, hb] = await sit(...stored().players);

    await play(() => ha.current.performAction('coup', 'b'));
    expect(stored()).toMatchObject({ phase: 'losing_influence', pendingPlayerId: 'b' });
    expect(who('a').coins).toBe(0);

    await play(() => hb.current.resolveLoss(1));

    expect(who('b').isDead).toBe(true);
    expect(stored()).toMatchObject({ status: 'finished', winnerId: 'a' });
  });

  it('records the result once for each player when the match ends', async () => {
    const b = seatAt(['captain', 'assassin'], 'b');
    b.cards[0].revealed = true;
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a', 7), b]));
    const [ha, hb] = await sit(...stored().players);

    await play(() => ha.current.performAction('coup', 'b'));
    await play(() => hb.current.resolveLoss(1));

    const calls = vi.mocked(updatePlayerStats).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.find(([id]) => id === 'a')?.[1]).toMatchObject({ gameType: 'coup', result: 'win' });
    expect(calls.find(([id]) => id === 'b')?.[1]).toMatchObject({ gameType: 'coup', result: 'loss' });
  });
});

describe('Coup — challenges', () => {
  it('a challenged Duke proves it: the challenger loses a card and the tax is paid', async () => {
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('tax'));
    await play(() => b.current.challenge());

    expect(stored()).toMatchObject({ phase: 'losing_influence', pendingPlayerId: 'b' });
    // The shown card goes back into the deck and a fresh one is drawn.
    expect(who('a').cards.every((c) => !c.revealed)).toBe(true);
    expect(cardsInPlay(stored())).toBe(15);

    await play(() => b.current.resolveLoss(0));

    expect(who('b').cards[0].revealed).toBe(true);
    expect(who('a').coins).toBe(5);
    expect(turnOf()).toBe('b');
  });

  it('a bluff caught: the bluffer loses a card and gets nothing', async () => {
    db.seed(LOBBY, table([seatAt(['captain', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('tax'));
    await play(() => b.current.challenge());
    expect(stored()).toMatchObject({ phase: 'losing_influence', pendingPlayerId: 'a' });

    await play(() => a.current.resolveLoss(1));

    expect(who('a').coins).toBe(2);
    expect(who('a').cards[1].revealed).toBe(true);
    expect(turnOf()).toBe('b');
  });

  it('only the first of two challenges counts', async () => {
    db.seed(LOBBY, table([
      seatAt(['captain', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a, b, c] = await sit(...stored().players);

    await play(() => a.current.performAction('tax'));
    await play(() => b.current.challenge(), () => c.current.challenge());

    expect(stored()).toMatchObject({ phase: 'losing_influence', pendingPlayerId: 'a' });
    expect(stored().logs.filter((l) => typeof l.action !== 'string' && l.action.en.startsWith('Challenges'))).toHaveLength(1);
  });
});

describe('Coup — blocks', () => {
  it('a block nobody challenges stands', async () => {
    db.seed(LOBBY, table([seatAt(['captain', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('steal', 'b'));
    await play(() => b.current.pass());
    expect(stored().phase).toBe('waiting_for_blocks');

    await play(() => b.current.block());
    expect(stored().phase).toBe('waiting_for_block_challenges');

    await play(() => a.current.pass());

    expect(who('a').coins).toBe(2);
    expect(who('b').coins).toBe(2);
    expect(turnOf()).toBe('b');
  });

  it('a bluffed block is caught and the steal goes ahead', async () => {
    db.seed(LOBBY, table([seatAt(['captain', 'contessa'], 'a'), seatAt(['duke', 'assassin'], 'b')]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('steal', 'b'));
    await play(() => b.current.pass());
    await play(() => b.current.block());
    await play(() => a.current.challenge());
    expect(stored()).toMatchObject({ phase: 'losing_influence', pendingPlayerId: 'b' });

    await play(() => b.current.resolveLoss(0));

    expect(who('a').coins).toBe(4);
    expect(who('b').coins).toBe(0);
    expect(turnOf()).toBe('b');
  });

  it('an assassination: three paid, the target loses a card', async () => {
    db.seed(LOBBY, table([seatAt(['assassin', 'contessa'], 'a', 3), seatAt(['captain', 'duke'], 'b')]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('assassinate', 'b'));
    expect(who('a').coins).toBe(0);
    await play(() => b.current.pass());
    await play(() => b.current.pass());
    expect(stored()).toMatchObject({ phase: 'losing_influence', pendingPlayerId: 'b' });

    await play(() => b.current.resolveLoss(0));

    expect(who('b').cards[0].revealed).toBe(true);
    expect(turnOf()).toBe('b');
  });

  it('after a proven claim the target may still block, and everyone may answer again', async () => {
    db.seed(LOBBY, table([
      seatAt(['captain', 'contessa'], 'a'), seatAt(['duke', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a, b, c] = await sit(...stored().players);

    await play(() => a.current.performAction('steal', 'b'));
    await play(() => c.current.pass());
    await play(() => b.current.challenge());
    await play(() => b.current.resolveLoss(0));

    expect(stored().phase).toBe('waiting_for_blocks');
    expect(stored().passedPlayers).toEqual([]);
  });
});

describe('Coup — exchange', () => {
  it('draws two, keeps two, and returns the rest to the deck', async () => {
    db.seed(LOBBY, table([seatAt(['ambassador', 'duke'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('exchange'));
    await play(() => b.current.pass());

    const buffer = stored().exchangeBuffer!;
    expect(stored()).toMatchObject({ phase: 'resolving_exchange', pendingPlayerId: 'a' });
    expect(buffer).toHaveLength(4);
    expect(cardsInPlay(stored())).toBe(15);

    await play(() => a.current.resolveExchange([2, 3]));

    expect(who('a').cards.map((c) => c.role)).toEqual([buffer[2], buffer[3]]);
    expect(stored().deck).toHaveLength(11);
    expect(cardsInPlay(stored())).toBe(15);
    expect(turnOf()).toBe('b');
  });
});

describe('Coup — the clock', () => {
  it('a player who lets their turn run out is removed and the next one moves', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [, b] = await sit(...stored().players);
    await expire();

    await play(() => b.current.skipTurn());

    expect(stored().players.map((p) => p.id)).toEqual(['b', 'c']);
    expect(turnOf()).toBe('b');
  });

  it('an unanswered claim goes through when the answer window closes', async () => {
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('tax'));
    await expire();
    await play(() => b.current.skipTurn());

    expect(who('a').coins).toBe(5);
    expect(turnOf()).toBe('b');
  });

  it('a clock that runs early writes nothing', async () => {
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [, b] = await sit(...stored().players);

    await play(() => b.current.skipTurn());

    expect(db.stats.writes).toBe(0);
  });

  it('two players timing out the same turn remove only one player', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [, b, c] = await sit(...stored().players);
    await expire();

    await play(() => b.current.skipTurn(), () => c.current.skipTurn());

    expect(stored().players.map((p) => p.id)).toEqual(['b', 'c']);
  });
});

describe('Coup — leaving mid-match', () => {
  it('the leaver’s turn goes to the next player', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a] = await sit(...stored().players);

    await play(() => a.current.leaveGame());

    expect(stored().players.map((p) => p.id)).toEqual(['b', 'c']);
    expect(turnOf()).toBe('b');
    expect(stored().phase).toBe('choosing_action');
  });

  it('with one player left, that player wins', async () => {
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')]));
    const [, b] = await sit(...stored().players);

    await play(() => b.current.leaveGame());

    expect(stored()).toMatchObject({ status: 'finished', winnerId: 'a' });
  });

  it('names who left in the history, in both languages', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [, , c] = await sit(...stored().players);

    await play(() => c.current.leaveGame());

    expect(stored().logs[0].action).toEqual({ ru: 'C покинул матч', en: 'C left the match' });
  });

  it('a challenger who leaves owing a card does not undo the proven claim', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'captain'], 'c')
    ]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('tax'));
    await play(() => b.current.challenge());
    expect(stored()).toMatchObject({ phase: 'losing_influence', pendingPlayerId: 'b' });

    await play(() => b.current.leaveGame());

    // A proved the Duke: the tax is paid and the turn moves on, rather than
    // A being handed the same turn again with nothing to show for it.
    expect(who('a').coins).toBe(5);
    expect(turnOf()).toBe('c');
    expect(stored().phase).toBe('choosing_action');
  });

  it('a challenger who leaves owing a card does not undo a proven block', async () => {
    db.seed(LOBBY, table([
      seatAt(['captain', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a, b, c] = await sit(...stored().players);

    await play(() => a.current.performAction('steal', 'b'));
    await play(() => b.current.pass());
    await play(() => b.current.block());
    await play(() => c.current.challenge());
    expect(stored()).toMatchObject({ phase: 'losing_influence', pendingPlayerId: 'c' });

    await play(() => c.current.leaveGame());

    expect(who('a').coins).toBe(2);
    expect(who('b').coins).toBe(2);
    expect(turnOf()).toBe('b');
  });

  it('if everyone still at the table has passed, the claim resolves without waiting for the clock', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a, b, c] = await sit(...stored().players);

    await play(() => a.current.performAction('tax'));
    await play(() => b.current.pass());
    await play(() => c.current.leaveGame());

    expect(who('a').coins).toBe(5);
    expect(turnOf()).toBe('b');
  });

  it('a target who leaves cancels the action against them', async () => {
    db.seed(LOBBY, table([
      seatAt(['assassin', 'contessa'], 'a', 3), seatAt(['captain', 'duke'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a, b] = await sit(...stored().players);

    await play(() => a.current.performAction('assassinate', 'b'));
    await play(() => b.current.leaveGame());

    // Nothing is left to act on, so the turn passes rather than A moving twice.
    expect(stored().players.map((p) => p.id)).toEqual(['a', 'c']);
    expect(stored().phase).toBe('choosing_action');
    expect(stored().currentAction).toBeNull();
    expect(turnOf()).toBe('c');
  });

  it('an exchange cut short puts the drawn cards back', async () => {
    db.seed(LOBBY, table([
      seatAt(['ambassador', 'duke'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['contessa', 'duke'], 'c')
    ]));
    const [a, b, c] = await sit(...stored().players);

    await play(() => a.current.performAction('exchange'));
    await play(() => b.current.pass(), () => c.current.pass());
    expect(stored().phase).toBe('resolving_exchange');
    expect(stored().deck).toHaveLength(7);

    await play(() => a.current.leaveGame());

    // The deck gets back the two it lent; A's own hand leaves with A.
    expect(stored().deck).toHaveLength(9);
    expect(turnOf()).toBe('b');
  });

  it('a blocker who leaves takes the block with them', async () => {
    db.seed(LOBBY, table([
      seatAt(['captain', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['duke', 'duke'], 'c')
    ]));
    const [a, , c] = await sit(...stored().players);

    await play(() => a.current.performAction('foreign_aid'));
    await play(() => c.current.block());
    await play(() => c.current.leaveGame());

    expect(who('a').coins).toBe(4);
    expect(turnOf()).toBe('b');
  });

  it('the host who leaves hands the room on', async () => {
    db.seed(LOBBY, table([
      seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b'), seatAt(['ambassador', 'duke'], 'c')
    ]));
    const [a] = await sit(...stored().players);

    await play(() => a.current.leaveGame());

    expect(who('b').isHost).toBe(true);
  });

  it('leaving a finished match leaves the result alone', async () => {
    db.seed(LOBBY, table([seatAt(['duke', 'contessa'], 'a'), seatAt(['captain', 'assassin'], 'b')], {
      status: 'finished', winnerId: 'a', winner: 'A'
    }));
    const [, b] = await sit(...stored().players);

    await play(() => b.current.leaveGame());

    expect(db.stats.writes).toBe(0);
    expect(stored().players).toHaveLength(2);
  });
});
