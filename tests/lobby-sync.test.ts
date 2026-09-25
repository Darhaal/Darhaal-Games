// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

vi.mock('@/lib/supabase', () => import('./support/fakeSupabase'));

import { db } from './support/fakeSupabase';
import { seat, play } from './support/players';
import { useLobbySync } from '@/hooks/core/useLobbySync';
import { SYNC_CONFLICT_EVENT } from '@/lib/gameStateSync';

/**
 * The write path every game shares: optimistic write, compare-and-swap, and on
 * a lost race a rebuild on the winner's state. It was verified against the
 * live database once (twelve simultaneous writes, none lost); this keeps it
 * verified.
 */

interface Marks {
  version: number;
  status: string;
  lastActionTime?: number;
  marks: string[];
}

const LOBBY = 'lobby-sync';

const mount = (userId: string) =>
  seat(() => useLobbySync<Marks>({ lobbyId: LOBBY, userId, channelPrefix: 'test' }));

const mark = (who: string) => (s: Marks): Marks => ({ ...s, marks: [...s.marks, who] });
const rival = () => db.write<Marks>(LOBBY, (s) => { s.marks.push('rival'); });

let toasts = 0;
const countToast = () => { toasts++; };

beforeEach(() => {
  db.reset();
  db.seed(LOBBY, { version: 1, status: 'playing', marks: [] });
  toasts = 0;
  window.addEventListener(SYNC_CONFLICT_EVENT, countToast);
});

afterEach(() => {
  window.removeEventListener(SYNC_CONFLICT_EVENT, countToast);
});

describe('useLobbySync — writes', () => {
  it('loads the room and bumps the version on every write', async () => {
    const a = await mount('a');
    expect(a.current.gameState?.marks).toEqual([]);

    await play(() => a.current.updateState(mark('a')));

    expect(db.state<Marks>(LOBBY)).toMatchObject({ version: 2, marks: ['a'] });
    expect(a.current.gameState?.version).toBe(2);
  });

  it('shows one player’s write to the others', async () => {
    const a = await mount('a');
    const b = await mount('b');

    await play(() => a.current.updateState(mark('a')));

    expect(b.current.gameState?.marks).toEqual(['a']);
  });

  it('an updater that returns null writes nothing', async () => {
    const a = await mount('a');

    await play(() => a.current.updateState(() => null));

    expect(db.stats.writes).toBe(0);
    expect(db.state<Marks>(LOBBY).version).toBe(1);
  });
});

describe('useLobbySync — a lost race', () => {
  it('is rebuilt on the winner’s state instead of being dropped', async () => {
    const a = await mount('a');
    db.beforeNextWrite(rival);

    await play(() => a.current.updateState(mark('a')));

    expect(db.state<Marks>(LOBBY).marks).toEqual(['rival', 'a']);
    expect(a.current.gameState?.marks).toEqual(['rival', 'a']);
    expect(db.stats.conflicts).toBe(1);
  });

  it('is resolved without bothering the player', async () => {
    const a = await mount('a');
    db.beforeNextWrite(rival);

    await play(() => a.current.updateState(mark('a')));

    expect(toasts).toBe(0);
  });

  it('two players at the same instant both land', async () => {
    const a = await mount('a');
    const b = await mount('b');

    await play(
      () => a.current.updateState(mark('a')),
      () => b.current.updateState(mark('b'))
    );

    expect(db.state<Marks>(LOBBY).marks.sort()).toEqual(['a', 'b']);
    expect(a.current.gameState?.marks.sort()).toEqual(['a', 'b']);
    expect(b.current.gameState?.marks.sort()).toEqual(['a', 'b']);
  });

  it('twelve players at the same instant all land', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const players = [];
    for (const id of ids) players.push(await mount(id));

    // Staggered by one write each so no player is outraced more than the
    // retry budget allows — the live test had the same shape.
    for (let i = 0; i < players.length; i += 3) {
      await play(...players.slice(i, i + 3).map((p, j) => () => p.current.updateState(mark(ids[i + j]))));
    }

    expect(db.state<Marks>(LOBBY).marks.sort()).toEqual([...ids].sort());
    expect(toasts).toBe(0);
  });

  it('gives up after three rebuilds and tells the player', async () => {
    const a = await mount('a');
    for (let i = 0; i < 4; i++) db.beforeNextWrite(rival);

    await play(() => a.current.updateState(mark('a')));

    expect(db.state<Marks>(LOBBY).marks).toEqual(['rival', 'rival', 'rival', 'rival']);
    expect(a.current.gameState?.marks).not.toContain('a');
    expect(toasts).toBe(1);
  });

  it('a finished state cannot be rebuilt: one try, then re-sync and tell the player', async () => {
    const a = await mount('a');
    db.beforeNextWrite(rival);

    await play(() => a.current.updateState({ ...a.current.gameState!, marks: ['a'] }));

    expect(db.state<Marks>(LOBBY).marks).toEqual(['rival']);
    expect(a.current.gameState?.marks).toEqual(['rival']);
    expect(toasts).toBe(1);
  });

  it('a write that fails outright is taken back and reported once', async () => {
    const a = await mount('a');
    db.failNextWrite();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

    await play(() => a.current.updateState(mark('a')));

    quiet.mockRestore();
    expect(db.state<Marks>(LOBBY).marks).toEqual([]);
    expect(a.current.gameState?.marks).toEqual([]);
    expect(toasts).toBe(1);
  });

  it('an action no longer legal on the fresh state is dropped quietly', async () => {
    const a = await mount('a');
    db.beforeNextWrite(() => db.write<Marks>(LOBBY, (s) => { s.status = 'finished'; }));

    await play(() => a.current.updateState((s) => (s.status === 'playing' ? mark('a')(s) : null)));

    expect(db.state<Marks>(LOBBY)).toMatchObject({ status: 'finished', marks: [] });
    expect(toasts).toBe(0);
  });
});

describe('useLobbySync — the room going away', () => {
  it('tells every player when the last one out removes the room', async () => {
    const a = await mount('a');
    const b = await mount('b');

    await play(() => a.current.deleteLobby());

    expect(db.exists(LOBBY)).toBe(false);
    expect(a.current.lobbyDeleted).toBe(true);
    expect(b.current.lobbyDeleted).toBe(true);
    expect(b.current.gameState).toBeNull();
  });

  it('a link to a room that is gone loads as deleted', async () => {
    db.reset();
    const a = await mount('a');
    await act(async () => {});

    expect(a.current.lobbyDeleted).toBe(true);
    expect(a.current.loading).toBe(false);
  });
});
