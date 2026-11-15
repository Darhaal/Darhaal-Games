import { NextResponse } from 'next/server';
import {
  ALLOWED_PARAMS, GA_EVENTS, GA_MEASUREMENT_ID, REDACTED_PARAMS
} from '@/constants/analytics';

/**
 * The only thing on this site that talks to Google.
 *
 * The browser loads nothing from Google, sets no Google cookie and never
 * names a page to it. It posts an event here, and this forwards a cleaned
 * version over the GA4 Measurement Protocol.
 *
 * That shape is the whole point. gtag fills in the page address itself, from
 * `document.location`, and on this site a game screen's address contains the
 * room id — which for a private room is the entirety of its security. Four
 * releases tried to make gtag report something else and each one still
 * leaked (docs/analytics.md). Here the address is a string this file
 * assembles, so there is nothing to override and nothing to get wrong.
 *
 * Nothing here trusts the client. The event name must be one we declare, the
 * parameters must be on the allow-list, and the path is redacted again on
 * arrival — a page can be tampered with, a route handler cannot.
 */

export const runtime = 'edge';

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

const KNOWN_EVENTS = new Set<string>(Object.values(GA_EVENTS));
const ALLOWED = new Set<string>(ALLOWED_PARAMS);

/** Keeps one event's worth of parameters, discarding anything unexpected. */
function cleanParams(input: unknown): Record<string, string | number | boolean> {
  if (!input || typeof input !== 'object') return {};

  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED.has(key)) continue;

    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    // Strings are capped: a parameter is a category, not a place to put prose.
    else if (typeof value === 'string') out[key] = value.slice(0, 120);
  }
  return out;
}

/**
 * The path, redacted again.
 *
 * The client already did this. Doing it here as well is the difference
 * between a promise and a guarantee: this is the last point the value passes
 * through, and it is the one the visitor cannot alter.
 */
function cleanPath(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) return '/';

  try {
    const url = new URL(input, 'https://placeholder.invalid');
    for (const key of REDACTED_PARAMS) {
      if (url.searchParams.has(key)) url.searchParams.set(key, 'redacted');
    }
    return (url.pathname + url.search).slice(0, 300);
  } catch {
    return '/';
  }
}

/** A client id is a UUID this browser made up. Anything else is discarded. */
const cleanClientId = (input: unknown): string | null =>
  typeof input === 'string' && /^[0-9a-f-]{36}$/i.test(input) ? input : null;

/**
 * A session id is the visit's start in Unix seconds.
 *
 * GA4 wants a positive integer here. Until 2.15.5 this was a UUID, which GA
 * could not group by — every session-based figure (sessions, engaged
 * sessions, engagement time) read zero.
 */
const cleanSessionId = (input: unknown): number | null =>
  typeof input === 'string' && /^[1-9]\d{0,11}$/.test(input) ? Number(input) : null;

/** The longest stretch one event may claim: GA's own session window. */
const MAX_ENGAGEMENT_MS = 30 * 60 * 1000;

/**
 * Visible time since the visitor's previous event, as the page measured it.
 * At least 1 ms: GA counts a visitor as active only with some engagement.
 */
const cleanEngagement = (input: unknown): number =>
  typeof input === 'number' && Number.isFinite(input)
    ? Math.min(Math.max(Math.round(input), 1), MAX_ENGAGEMENT_MS)
    : 1;

const SITE_HOST = 'games.okhten.com';

/**
 * Where the visit came from — an origin such as `https://www.google.com/`,
 * never a path or a query, and nothing from this site itself.
 */
function cleanReferrer(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.hostname === SITE_HOST) return null;
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return null;
  }
}

/** GA's own spelling of the engines it files under Organic Search. */
const SEARCH_ENGINES: readonly [RegExp, string][] = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)(yandex\.[a-z.]+|ya\.ru)$/, 'yandex'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)yahoo\./, 'yahoo'],
  [/(^|\.)baidu\.com$/, 'baidu'],
  [/(^|\.)ecosia\.org$/, 'ecosia'],
  [/^search\.brave\.com$/, 'brave'],
  [/(^|\.)qwant\.com$/, 'qwant'],
  [/(^|\.)startpage\.com$/, 'startpage']
];

/** A campaign label from the landing address: short, no spaces or markup. */
const cleanTag = (value: string | null): string | null =>
  value && /^[\w.+-]{1,100}$/.test(value) ? value : null;

type TrafficSource = { source: string; medium: string; campaign?: string };

/**
 * Where a visit came from, in GA's terms, on its first event only.
 *
 * gtag works this out itself from the landing address and the referrer and
 * puts it on its own session_start, which this protocol may not send — so for
 * every visit read "Unassigned". `campaign_details` is the
 * protocol's documented way to say it instead. The order is gtag's: campaign
 * tags on the landing address, then the referring site (a search engine is
 * organic, anything else a referral), and with neither, direct.
 */
function trafficSource(entry: unknown, referrer: string | null, path: string): TrafficSource | null {
  if (entry !== true) return null;

  const query = new URL(path, 'https://placeholder.invalid').searchParams;
  const tagged = cleanTag(query.get('utm_source'));
  if (tagged) {
    const campaign = cleanTag(query.get('utm_campaign'));
    return {
      source: tagged,
      medium: cleanTag(query.get('utm_medium')) ?? '(not set)',
      ...(campaign ? { campaign } : {})
    };
  }

  if (referrer) {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    const engine = SEARCH_ENGINES.find(([pattern]) => pattern.test(host));
    return engine ? { source: engine[1], medium: 'organic' } : { source: host, medium: 'referral' };
  }

  return { source: '(direct)', medium: '(none)' };
}

/**
 * Is this deployment collecting anything?
 *
 * The POST answers 204 to everything on purpose, which left no way at all to
 * tell a configured deployment from one whose environment variable never took
 * — and Vercel only applies a new variable on the next deploy, so "I added
 * the key" and "the key is live" are different statements.
 *
 * Says whether a secret is present, never what it is, and nothing about any
 * visitor. That analytics exists is already on the consent banner and in the
 * privacy policy, so this gives nothing away that the site does not announce.
 */
/**
 * The exact shape sent to Google.
 *
 * Shared with the validator below on purpose: a self-check that builds its
 * own payload proves only that the self-check works.
 */
function buildPayload(
  name: string,
  clientId: string,
  sessionId: number,
  path: string,
  params: unknown,
  engagementMs = 1,
  referrer: string | null = null,
  traffic: TrafficSource | null = null
) {
  return {
    client_id: clientId,
    events: [
      // Applies to the events sent with it and after it, so it goes first.
      ...(traffic ? [{ name: 'campaign_details', params: traffic }] : []),
      {
        name,
        params: {
          ...cleanParams(params),
          page_location: `https://${SITE_HOST}${path}`,
          page_path: path,
          // Both are needed for GA to count sessions and engagement.
          engagement_time_msec: engagementMs,
          session_id: sessionId,
          // The standard "Page referrer" dimension, next to the channel
          // that campaign_details gives the session.
          ...(referrer ? { page_referrer: referrer } : {})
        }
      }
    ]
  };
}

/**
 * Asks Google whether it would accept what we send.
 *
 * GA drops a malformed event in silence on the real endpoint, so "the key is
 * set" and "the events arrive" are still different statements. The debug
 * endpoint answers the second one. Only reached with `?validate=1`, returns
 * Google's own verdict about our payload shape, and carries no secret and no
 * visitor data.
 */
async function validate(apiSecret: string) {
  const probe = buildPayload(
    'page_view',
    '00000000-0000-4000-8000-000000000000',
    1700000000,
    '/health-check',
    { game: 'validation' },
    1,
    'https://www.google.com/',
    { source: 'google', medium: 'organic' }
  );

  const res = await fetch(
    `https://www.google-analytics.com/debug/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${apiSecret}`,
    { method: 'POST', body: JSON.stringify(probe) }
  );

  const report = (await res.json()) as { validationMessages?: unknown[] };
  const messages = report.validationMessages ?? [];

  return {
    accepted: Array.isArray(messages) && messages.length === 0,
    messages
  };
}

export async function GET(request: Request) {
  const apiSecret = process.env.GA_API_SECRET;
  const base = { configured: Boolean(apiSecret), measurementId: GA_MEASUREMENT_ID };

  if (!apiSecret || new URL(request.url).searchParams.get('validate') !== '1') {
    return NextResponse.json(base);
  }

  try {
    return NextResponse.json({ ...base, ...(await validate(apiSecret)) });
  } catch {
    return NextResponse.json({ ...base, accepted: null, messages: ['validation call failed'] });
  }
}

export async function POST(request: Request) {
  // Always 204, whatever happens. A measurement endpoint that reports on
  // itself is a way to probe the site, and there is nothing the page would
  // do with the answer anyway.
  const ok = () => new NextResponse(null, { status: 204 });

  const apiSecret = process.env.GA_API_SECRET;
  if (!apiSecret) return ok(); // not configured: collect nothing

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return ok();
  }

  const { name, clientId, sessionId, path, params, engagementMs, referrer, entry } =
    (payload ?? {}) as Record<string, unknown>;

  if (typeof name !== 'string' || !KNOWN_EVENTS.has(name)) return ok();

  const id = cleanClientId(clientId);
  if (!id) return ok();

  // A visit without a usable session id is counted as its own visit rather
  // than folded into the browser's, which is what the first version did.
  const session = cleanSessionId(sessionId) ?? Math.floor(Date.now() / 1000);

  const cleanedPath = cleanPath(path);
  const cleanedReferrer = cleanReferrer(referrer);

  const body = buildPayload(
    name, id, session, cleanedPath, params, cleanEngagement(engagementMs), cleanedReferrer,
    trafficSource(entry, cleanedReferrer, cleanedPath)
  );

  try {
    await fetch(
      `${GA_ENDPOINT}?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${apiSecret}`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  } catch {
    // Google being unreachable is not the player's problem.
  }

  return ok();
}
