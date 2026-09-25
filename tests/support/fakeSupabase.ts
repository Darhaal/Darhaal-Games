/**
 * An in-memory stand-in for the part of Supabase the game hooks talk to: the
 * `lobbies` row, the `update_game_state` compare-and-swap, `leave_lobby`, and
 * the realtime UPDATE/DELETE feed.
 *
 * Swapped in with
 *   vi.mock('@/lib/supabase', () => import('./support/fakeSupabase'));
 * so the real hooks — `useLobbySync` and each game's actions on top of it — run
 * unchanged, several players at once, against one shared row. That is what the
 * state machines needed to be tested at all: their rules live inside hooks, and
 * the interesting cases are two players acting at the same moment.
 *
 * The CAS mirrors the SQL in supabase/migrations/20260709000000_v2_security.sql:
 * a write lands only when the stored version equals the expected one and the
 * new version is higher. Realtime is delivered synchronously, inside the write,
 * which is enough for hooks that already treat their own echo as a no-op.
 */

type GameStateJson = Record<string, unknown> & { version?: number; status?: string };

interface Row {
  id: string;
  name: string;
  code: string;
  host_id: string;
  status: string;
  game_state: GameStateJson | null;
}

type Payload = { new?: Row; old?: { id: string } };

interface Subscription {
  event: 'UPDATE' | 'DELETE';
  filter: string;
  handler: (payload: Payload) => void;
}

const copy = <T>(value: T): T => structuredClone(value);

class FakeChannel {
  subs: Subscription[] = [];

  on(_type: string, opts: { event: 'UPDATE' | 'DELETE'; filter: string }, handler: (payload: Payload) => void) {
    this.subs.push({ event: opts.event, filter: opts.filter, handler });
    return this;
  }

  subscribe() {
    channels.add(this);
    return this;
  }
}

const rows = new Map<string, Row>();
const channels = new Set<FakeChannel>();
let interceptors: Array<(lobbyId: string) => void | 'error'> = [];

function broadcast(event: 'UPDATE' | 'DELETE', row: Row) {
  for (const channel of [...channels]) {
    for (const sub of channel.subs) {
      if (sub.event !== event || sub.filter !== `id=eq.${row.id}`) continue;
      sub.handler(event === 'UPDATE' ? { new: copy(row) } : { old: { id: row.id } });
    }
  }
}

/** Test-side controls over the fake database. */
export const db = {
  /** Writes that landed and writes the CAS turned away, since the last reset. */
  stats: { writes: 0, conflicts: 0 },

  reset() {
    rows.clear();
    channels.clear();
    interceptors = [];
    db.stats.writes = 0;
    db.stats.conflicts = 0;
  },

  /** A lobby row holding `state`, as the create screen would leave it. */
  seed(id: string, state: object, hostId = 'a') {
    const gameState = copy(state) as GameStateJson;
    rows.set(id, {
      id,
      name: 'Test room',
      code: 'TEST',
      host_id: hostId,
      status: gameState.status ?? 'waiting',
      game_state: gameState
    });
  },

  /** A copy of what is stored now. */
  state<T>(id: string): T {
    const row = rows.get(id);
    if (!row) throw new Error(`fake supabase: no lobby ${id}`);
    return copy(row.game_state) as T;
  },

  exists(id: string) {
    return rows.has(id);
  },

  /**
   * Lands a write the way another client's would: version bumped, stored,
   * pushed to every subscriber. For setting up a position, or for a rival
   * write slipped in through `beforeNextWrite`.
   */
  write<T>(id: string, mutate: (state: T) => void) {
    const row = rows.get(id);
    if (!row) throw new Error(`fake supabase: no lobby ${id}`);
    const next = copy(row.game_state) as GameStateJson;
    mutate(next as unknown as T);
    next.version = (next.version || 0) + 1;
    row.game_state = next;
    row.status = next.status ?? row.status;
    broadcast('UPDATE', row);
  },

  /** Runs `fn` just before the next CAS is judged — where a rival write would land. */
  beforeNextWrite(fn: (lobbyId: string) => void) {
    interceptors.push(fn);
  },

  /** The next write fails outright, as it would without permission or network. */
  failNextWrite() {
    interceptors.push(() => 'error');
  }
};

export const supabase = {
  from(table: string) {
    if (table !== 'lobbies') throw new Error(`fake supabase: no table ${table}`);
    return {
      select: () => ({
        eq: (_column: string, id: string) => ({
          single: async () => {
            const row = rows.get(id);
            return row
              ? { data: copy(row), error: null }
              : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
          }
        })
      }),
      update: (values: Partial<Row>) => ({
        eq: (_column: string, id: string) => {
          const row = rows.get(id);
          if (row) Object.assign(row, values);
          return Promise.resolve({ data: null, error: null });
        }
      })
    };
  },

  async rpc(name: string, args: Record<string, unknown>) {
    const lobbyId = args.p_lobby_id as string;

    if (name === 'update_game_state') {
      if (interceptors.shift()?.(lobbyId) === 'error') {
        return { data: null, error: { message: 'permission denied for function update_game_state' } };
      }

      const row = rows.get(lobbyId);
      const stored = Number(row?.game_state?.version ?? 0);
      const next = args.p_new_state as GameStateJson;
      const incoming = Number(next?.version ?? 0);

      if (!row || stored !== args.p_expected_version || stored >= incoming) {
        db.stats.conflicts++;
        return { data: false, error: null };
      }

      row.game_state = copy(next);
      row.status = args.p_status as string;
      db.stats.writes++;
      broadcast('UPDATE', row);
      return { data: true, error: null };
    }

    if (name === 'leave_lobby') {
      const row = rows.get(lobbyId);
      if (row) {
        rows.delete(lobbyId);
        broadcast('DELETE', row);
      }
      return { data: true, error: null };
    }

    throw new Error(`fake supabase: no rpc ${name}`);
  },

  channel() {
    return new FakeChannel();
  },

  removeChannel(channel: FakeChannel) {
    channels.delete(channel);
    return Promise.resolve('ok');
  }
};
