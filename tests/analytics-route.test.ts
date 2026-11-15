import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/analytics/route';

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

const SESSION = '1762700000';

const validEvent = (over: Record<string, unknown> = {}) => ({
  name: 'lobby_created',
  clientId: CLIENT,
  sessionId: SESSION,
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

describe('sessions', () => {
  it('reports the visit, not the browser', async () => {
    // The first version sent the client id here, which put every event a
    // person ever fired into one session that never ended — GA would then
    // never count a second visit.
    await post(validEvent());

    const params = (sent[0].body as { events: { params: Record<string, unknown> }[] })
      .events[0].params;
    // GA4 takes a positive integer here; a UUID left every session uncounted.
    expect(params.session_id).toBe(Number(SESSION));
    expect(params.session_id).not.toBe(CLIENT);
  });

  const sessionSent = () =>
    (sent[0].body as { events: { params: Record<string, unknown> }[] }).events[0].params.session_id;

  it('starts a visit of its own when no session is offered', async () => {
    await post(validEvent({ sessionId: undefined }));

    expect(Number.isInteger(sessionSent())).toBe(true);
    expect(sessionSent()).toBeGreaterThan(0);
  });

  it('refuses a session id that is not one we would have made', async () => {
    for (const bad of ['; drop table lobbies', '11111111-1111-4111-8111-111111111111', '0', '-5']) {
      sent = [];
      await post(validEvent({ sessionId: bad }));
      expect(sessionSent()).not.toBe(bad);
      expect(Number.isInteger(sessionSent())).toBe(true);
    }
  });
});

describe('engagement and source', () => {
  const params = () =>
    (sent[0].body as { events: { params: Record<string, unknown> }[] }).events[0].params;

  it('passes the visible time the page measured', async () => {
    await post(validEvent({ engagementMs: 42_000 }));
    expect(params().engagement_time_msec).toBe(42_000);
  });

  it('keeps it between 1 ms and half an hour', async () => {
    await post(validEvent({ engagementMs: 10 * 60 * 60 * 1000 }));
    expect(params().engagement_time_msec).toBe(30 * 60 * 1000);
    sent = [];
    await post(validEvent({ engagementMs: 'lots' }));
    expect(params().engagement_time_msec).toBe(1);
  });

  it('reports where the visit came from as an origin only', async () => {
    await post(validEvent({ referrer: 'https://www.google.com/search?q=spyfall+online' }));
    expect(params().page_referrer).toBe('https://www.google.com/');
    expect(everythingSent()).not.toContain('spyfall+online');
  });

  it('says nothing about a move within the site or a strange referrer', async () => {
    for (const referrer of ['https://games.okhten.com/ru', 'javascript:alert(1)', 'not a url']) {
      sent = [];
      await post(validEvent({ referrer }));
      expect(params().page_referrer).toBeUndefined();
    }
  });
});

// Without a channel every visit read "Unassigned": the protocol may not send
// gtag's session_start, and campaign_details is its documented substitute.
describe('the channel of a visit', () => {
  const events = () => (sent[0].body as { events: { name: string; params: Record<string, unknown> }[] }).events;
  const channel = () => events().find((e) => e.name === 'campaign_details')?.params;

  it('files a search engine as organic, before the event it applies to', async () => {
    await post(validEvent({ entry: true, referrer: 'https://www.google.com.ua/search?q=coup' }));
    expect(events()[0].name).toBe('campaign_details');
    expect(channel()).toEqual({ source: 'google', medium: 'organic' });
    expect(events()[1].name).toBe('lobby_created');
  });

  it('files another site as a referral, by its host alone', async () => {
    await post(validEvent({ entry: true, referrer: 'https://okhten.com/projects?ref=x' }));
    expect(channel()).toEqual({ source: 'okhten.com', medium: 'referral' });
  });

  it('calls a visit with no referrer direct', async () => {
    await post(validEvent({ entry: true }));
    expect(channel()).toEqual({ source: '(direct)', medium: '(none)' });
  });

  it('prefers campaign tags on the landing address', async () => {
    await post(validEvent({
      entry: true,
      referrer: 'https://www.google.com/',
      path: '/?utm_source=okhten&utm_medium=site&utm_campaign=launch'
    }));
    expect(channel()).toEqual({ source: 'okhten', medium: 'site', campaign: 'launch' });
  });

  it('drops a campaign tag that is not a plain label', async () => {
    await post(validEvent({ entry: true, path: '/?utm_source=%3Cscript%3E' }));
    expect(channel()).toEqual({ source: '(direct)', medium: '(none)' });
  });

  it('names the channel only on a visit\'s first event', async () => {
    await post(validEvent({ referrer: 'https://www.google.com/' }));
    expect(channel()).toBeUndefined();
    expect(events()).toHaveLength(1);
  });
});

describe('the health check', () => {
  const check = (query = '') =>
    GET(new Request(`https://games.okhten.com/api/analytics${query}`));

  it('says a deployment with a secret is configured', async () => {
    const body = await (await check()).json();

    expect(body.configured).toBe(true);
  });

  it('says a deployment without one is not', async () => {
    vi.stubEnv('GA_API_SECRET', '');
    const body = await (await check()).json();

    expect(body.configured).toBe(false);
  });

  it('never repeats the secret back', async () => {
    vi.stubEnv('GA_API_SECRET', 'super-secret-value');
    const text = JSON.stringify(await (await check('?validate=1')).json());

    expect(text).not.toContain('super-secret-value');
  });

  it('does not call Google unless asked to', async () => {
    await check();

    expect(sent).toEqual([]);
  });

  it('validates against the payload it really sends', async () => {
    vi.stubGlobal('fetch', (url: string, init?: { body?: string }) => {
      sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined });
      return Promise.resolve(new Response(JSON.stringify({ validationMessages: [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    });

    const body = await (await check('?validate=1')).json();

    expect(body.accepted).toBe(true);
    expect(sent[0].url).toContain('/debug/mp/collect');
    // The probe must go through the same builder as a real event, or it
    // proves only that the probe works. It carries a channel too, so Google
    // checks campaign_details as well.
    expect(sent[0].body).toMatchObject({
      events: [
        { name: 'campaign_details', params: { source: 'google', medium: 'organic' } },
        { name: 'page_view', params: { page_path: '/health-check' } }
      ]
    });
  });

  it('reports Google’s complaints rather than swallowing them', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(
      JSON.stringify({ validationMessages: [{ description: 'bad param' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));

    const body = await (await check('?validate=1')).json();

    expect(body.accepted).toBe(false);
    expect(JSON.stringify(body.messages)).toContain('bad param');
  });
});
