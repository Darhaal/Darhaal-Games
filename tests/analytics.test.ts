import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { redactUrl, shortReason } from '@/lib/analytics';
import { ALLOWED_PARAMS, GA_EVENTS, REDACTED_PARAMS } from '@/constants/analytics';

/**
 * These two functions are what stands between a private room's invite link
 * and a third party's logs. A room link *is* the invitation: anyone holding
 * it can walk in. Handing those to Google because they happen to be in the
 * address bar is not something a player agreed to.
 */

describe('redactUrl', () => {
  it('strips the room id from a game URL', () => {
    const out = redactUrl('/game/spyfall?id=f98b1275-df04-4c9a-b27f-c3632fd9f9ba');

    expect(out).not.toContain('f98b1275');
    expect(out).toBe('/game/spyfall?id=redacted');
  });

  it('keeps the path, so the report still says which game', () => {
    expect(redactUrl('/game/reversi?id=abc')).toMatch(/^\/game\/reversi/);
  });

  it('strips every parameter on the list', () => {
    const query = REDACTED_PARAMS.map((p) => `${p}=secret`).join('&');
    const out = redactUrl(`/play?${query}`);

    expect(out).not.toContain('secret');
    for (const param of REDACTED_PARAMS) {
      expect(out).toContain(`${param}=redacted`);
    }
  });

  it('strips a room link hidden inside returnUrl', () => {
    // The sign-in redirect carries the destination, room id and all.
    const out = redactUrl('/?returnUrl=%2Fgame%2Fcoup%3Fid%3Dsecret-room');

    expect(out).not.toContain('secret-room');
  });

  it('leaves harmless parameters alone', () => {
    expect(redactUrl('/games?sort=newest')).toBe('/games?sort=newest');
  });

  it('never returns an absolute URL, so nothing leaks through the host', () => {
    expect(redactUrl('https://games.okhten.com/game/dots?id=abc')).toBe('/game/dots?id=redacted');
  });

  it('always answers with a relative path, whatever it is handed', () => {
    // The invariant that matters is not a particular string: it is that the
    // result never carries a host and never throws in the middle of a page
    // view.
    for (const input of ['::::', '', '//evil.example/x', 'https://evil.example/x?id=abc']) {
      const out = redactUrl(input);
      expect(out.startsWith('/'), `${input} -> ${out}`).toBe(true);
      expect(out).not.toContain('evil.example');
      expect(out).not.toContain('abc');
    }
  });
});

describe('shortReason', () => {
  it('drops URLs, which in this app carry room ids', () => {
    const out = shortReason('Failed to fetch https://games.okhten.com/game/coup?id=secret-room');

    expect(out).not.toContain('secret-room');
    expect(out).not.toContain('https');
    expect(out).toContain('[url]');
  });

  it('caps the length rather than forwarding a whole stack trace', () => {
    expect(shortReason('x'.repeat(500)).length).toBeLessThanOrEqual(120);
  });

  it('collapses whitespace so a multi-line message stays one value', () => {
    expect(shortReason('two\n\n  lines')).toBe('two lines');
  });

  it('has something to say about an empty message', () => {
    expect(shortReason('')).toBe('unknown');
    expect(shortReason('   ')).toBe('unknown');
  });
});

const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.tsx?$/.test(name) ? [full] : [];
    });

const walkSrc = () => walk('src');

describe('what the app is allowed to report', () => {
  it('never passes an identifier to track()', () => {
    // A cheap read of every call site. The parameters are meant to be
    // categories and counts; anything named like an id, a nickname or an
    // email is a mistake worth failing the build over.
    const forbidden = /\b(userId|user_id|\bemail\b|nickname|username|avatarUrl|lobbyId|lobby_id|roomCode|room_code)\b/;
    const offenders: string[] = [];

    for (const file of walk('src')) {
      const text = readFileSync(file, 'utf8');
      for (const call of text.matchAll(/track\(\s*GA_EVENTS\.\w+\s*,\s*\{([^}]*)\}/g)) {
        if (forbidden.test(call[1])) offenders.push(`${file}: ${call[1].trim()}`);
      }
    }

    expect(offenders, `identifiers must not be reported:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('uses only event names from the list', () => {
    const declared = new Set<string>(Object.values(GA_EVENTS));
    const used = new Set<string>();

    for (const file of walk('src')) {
      for (const call of readFileSync(file, 'utf8').matchAll(/GA_EVENTS\.(\w+)/g)) {
        used.add(call[1]);
      }
    }

    for (const key of used) {
      expect(Object.keys(GA_EVENTS), `GA_EVENTS.${key} is not declared`).toContain(key);
    }
    expect(declared.size).toBeGreaterThan(0);
  });
});

describe('nothing is sent before consent', () => {
  const store = new Map<string, string>();
  let posted: string[];

  beforeEach(() => {
    store.clear();
    posted = [];
    vi.stubGlobal('window', {
      location: { hostname: 'games.okhten.com', pathname: '/play', search: '' },
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k)
      }
    });
    vi.stubGlobal('navigator', { sendBeacon: (url: string) => { posted.push(url); return true; } });
    vi.stubGlobal('fetch', (url: string) => { posted.push(String(url)); return Promise.resolve(); });
    vi.stubGlobal('Blob', class { constructor(public parts: unknown[]) {} });
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000000' });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('posts nothing while the answer is missing', async () => {
    const { track } = await import('@/lib/analytics');
    track(GA_EVENTS.lobbyCreated, { game: 'coup' });

    expect(posted).toEqual([]);
  });

  it('posts nothing after a refusal', async () => {
    const { track, writeConsent } = await import('@/lib/analytics');
    writeConsent('denied');
    track(GA_EVENTS.lobbyCreated, { game: 'coup' });

    expect(posted).toEqual([]);
  });

  it('forgets the browser id when the answer is no', async () => {
    const { writeConsent } = await import('@/lib/analytics');
    store.set('darhaal.analytics-client.v1', 'some-id');
    writeConsent('denied');

    expect(store.has('darhaal.analytics-client.v1')).toBe(false);
  });

  it('posts to this site and nowhere else once allowed', async () => {
    const { track, writeConsent } = await import('@/lib/analytics');
    writeConsent('granted');
    track(GA_EVENTS.lobbyCreated, { game: 'coup' });

    // A first visit sends new_visitor along with the event itself.
    expect(posted).toEqual(['/api/analytics', '/api/analytics']);
    // The browser must never address Google directly — that is the whole
    // reason this arrangement exists.
    expect(posted.some((u) => u.includes('google'))).toBe(false);
  });

  it('announces a new browser once, not on every event', async () => {
    const { track, writeConsent } = await import('@/lib/analytics');
    writeConsent('granted');
    track(GA_EVENTS.lobbyCreated, { game: 'coup' });
    track(GA_EVENTS.lobbyJoined, { game: 'coup' });

    expect(posted).toHaveLength(3);
  });

  it('marks only a visit\'s first events as its entry, for the channel', async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal('navigator', {
      sendBeacon: (_url: string, blob: { parts: string[] }) => { bodies.push(JSON.parse(blob.parts[0])); return true; }
    });
    const { track, writeConsent } = await import('@/lib/analytics');
    writeConsent('granted');
    track(GA_EVENTS.lobbyCreated, { game: 'coup' });
    track(GA_EVENTS.lobbyJoined, { game: 'coup' });

    expect(bodies.map((b) => b.entry)).toEqual([true, true, undefined]);
  });

  it('numbers the visit by its start in seconds, as GA4 requires', async () => {
    const { track, writeConsent } = await import('@/lib/analytics');
    writeConsent('granted');
    track(GA_EVENTS.lobbyCreated, { game: 'coup' });

    const session = JSON.parse(store.get('darhaal.analytics-session.v1') ?? '{}') as { id?: string };
    expect(session.id).toMatch(/^[1-9]\d{9}$/);
  });

  it('starts a new visit over a session id the old version stored', async () => {
    const { track, writeConsent } = await import('@/lib/analytics');
    writeConsent('granted');
    store.set('darhaal.analytics-session.v1', JSON.stringify({
      id: '11111111-1111-4111-8111-111111111111', seen: Date.now()
    }));
    track(GA_EVENTS.lobbyCreated, { game: 'coup' });

    const session = JSON.parse(store.get('darhaal.analytics-session.v1') ?? '{}') as { id?: string };
    expect(session.id).toMatch(/^[1-9]\d{9}$/);
  });

  // randomUUID is missing on plain-http pages and before Safari 15.4; it used
  // to throw out of track() and blank the whole page.
  it('makes its own browser id where crypto.randomUUID is missing', async () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(171) });
    const { track, writeConsent } = await import('@/lib/analytics');
    writeConsent('granted');

    expect(() => track(GA_EVENTS.lobbyCreated, { game: 'coup' })).not.toThrow();
    expect(store.get('darhaal.analytics-client.v1')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('never throws into the caller', async () => {
    vi.stubGlobal('crypto', {});
    const { track, writeConsent } = await import('@/lib/analytics');
    writeConsent('granted');

    expect(() => track(GA_EVENTS.lobbyCreated, { game: 'coup' })).not.toThrow();
  });
});

describe('the parameters an event may carry', () => {
  it('has nothing on the allow-list that identifies anybody', () => {
    const identifying = /(^|_)(id|user|email|name|nick|avatar|room|code|token|password)($|_)/i;
    const offenders = ALLOWED_PARAMS.filter((p) => identifying.test(p) && p !== 'page_path');

    expect(offenders, `these would carry an identifier: ${offenders.join(', ')}`).toEqual([]);
  });

  it('accounts for every parameter the app actually sends', () => {
    // A parameter the server does not know is dropped in silence, which is
    // the safe failure but an invisible one — so the two lists are compared.
    const used = new Set<string>();
    for (const file of walkSrc()) {
      const text = readFileSync(file, 'utf8');
      for (const call of text.matchAll(/track\(\s*(?:GA_EVENTS\.\w+|'[\w_]+')\s*,\s*\{([^}]*)\}/g)) {
        for (const key of call[1].matchAll(/(\w+)\s*:/g)) used.add(key[1]);
      }
    }

    for (const key of used) {
      expect(ALLOWED_PARAMS as readonly string[], `${key} is sent but not allowed`).toContain(key);
    }
  });
});
