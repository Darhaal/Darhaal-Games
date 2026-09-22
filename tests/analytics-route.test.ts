import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/analytics/route';

/**
 * What the server actually sends to Google.
 *
 * This is the test that matters. Four releases went out believing the room
 * id had stopped reaching Google, each time on the strength of a check that
 * could not see the requests that mattered. Here the request is the thing
 * under test: the payload is inspected directly, so there is nothing to miss.
 */

const GA_HOST = 'google-analytics.com';

let sent: { url: string; body: unknown }[] = [];

const post = (payload: unknown) =>
  POST(new Request('https://games.okhten.com/api/analytics', {
    method: 'POST',
    body: JSON.stringify(payload)
  }));

const ROOM = 'a6a7ac96-f617-4b55-ba3a-8c9fb76c651a';
const CLIENT = '00000000-0000-4000-8000-000000000000';

const validEvent = (over: Record<string, unknown> = {}) => ({
  name: 'lobby_created',
  clientId: CLIENT,
  path: '/play',
  params: { game: 'coup' },
  ...over
});

beforeEach(() => {
  sent = [];
  vi.stubEnv('GA_API_SECRET', 'test-secret');
  vi.stubGlobal('fetch', (url: string, init?: { body?: string }) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined });
    return Promise.resolve(new Response(null, { status: 204 }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Everything that left, flattened to one searchable string. */
const everythingSent = () => JSON.stringify(sent);

describe('the room id never reaches Google', () => {
  it('strips it from the reported path', async () => {
    await post(validEvent({ path: `/game/coup?id=${ROOM}` }));

    expect(everythingSent()).not.toContain(ROOM);
    expect(sent[0].body).toMatchObject({
      events: [{ params: { page_path: '/game/coup?id=redacted' } }]
    });
  });

  it('strips it even when the client forgot to', async () => {
    // The client redacts too, but a page can be tampered with and a route
    // handler cannot. This is the pass that counts.
    await post(validEvent({ path: `/game/dots?id=${ROOM}&code=SECRET` }));

    expect(everythingSent()).not.toContain(ROOM);
    expect(everythingSent()).not.toContain('SECRET');
  });

  it('strips one hidden inside returnUrl', async () => {
    await post(validEvent({ path: `/?returnUrl=%2Fgame%2Fcoup%3Fid%3D${ROOM}` }));

    expect(everythingSent()).not.toContain(ROOM);
  });

  it('builds the address itself rather than taking one', async () => {
    // The failure that cost four releases was gtag filling this field in on
    // its own. Here it is assembled from the cleaned path and nothing else.
    await post(validEvent({
      path: `/game/coup?id=${ROOM}`,
      params: { game: 'coup', page_location: `https://evil.example/?id=${ROOM}` }
    }));

    expect(everythingSent()).not.toContain(ROOM);
    expect(everythingSent()).not.toContain('evil.example');
    expect(sent[0].body).toMatchObject({
      events: [{ params: { page_location: 'https://games.okhten.com/game/coup?id=redacted' } }]
    });
  });
});

describe('what the server refuses', () => {
  it('sends nothing without an API secret', async () => {
    vi.stubEnv('GA_API_SECRET', '');
    await post(validEvent());

    expect(sent).toEqual([]);
  });

  it('rejects an event name it does not declare', async () => {
    await post(validEvent({ name: 'something_invented' }));

    expect(sent).toEqual([]);
  });

  it('rejects a client id that is not one we would have made', async () => {
    await post(validEvent({ clientId: 'user-42' }));

    expect(sent).toEqual([]);
  });

  it('drops parameters that are not on the allow-list', async () => {
    await post(validEvent({
      params: {
        game: 'coup',
        userId: 'd5fd3a34-7fd3-484e-b557-96a095320c99',
        email: 'someone@example.com',
        nickname: 'Player'
      }
    }));

    const out = everythingSent();
    expect(out).not.toContain('d5fd3a34');
    expect(out).not.toContain('example.com');
    expect(out).not.toContain('nickname');
    expect(sent[0].body).toMatchObject({ events: [{ params: { game: 'coup' } }] });
  });

  it('caps a long string rather than forwarding it whole', async () => {
    await post(validEvent({ params: { reason: 'x'.repeat(500) } }));

    const params = (sent[0].body as { events: { params: Record<string, string> }[] })
      .events[0].params;
    expect(params.reason.length).toBeLessThanOrEqual(120);
  });

  it('survives a body that is not JSON at all', async () => {
    const res = await POST(new Request('https://games.okhten.com/api/analytics', {
      method: 'POST',
      body: 'not json'
    }));

    expect(res.status).toBe(204);
    expect(sent).toEqual([]);
  });
});

describe('the endpoint gives nothing away', () => {
  it('answers 204 whether or not it did anything', async () => {
    const good = await post(validEvent());
    const bad = await post(validEvent({ name: 'nope' }));

    // A measurement endpoint that reports on itself is a way to probe the
    // site; both answers look the same from outside.
    expect(good.status).toBe(204);
    expect(bad.status).toBe(204);
  });

  it('addresses Google and nowhere else', async () => {
    await post(validEvent());

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toContain(GA_HOST);
  });
});
