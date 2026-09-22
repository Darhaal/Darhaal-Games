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
  sessionId: string,
  path: string,
  params: unknown
) {
  return {
    client_id: clientId,
    events: [
      {
        name,
        params: {
          ...cleanParams(params),
          page_location: `https://games.okhten.com${path}`,
          page_path: path,
          // Without this GA treats every event as its own session.
          engagement_time_msec: 1,
          session_id: sessionId
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
    '00000000-0000-4000-8000-000000000001',
    '/health-check',
    { game: 'validation' }
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

  const { name, clientId, sessionId, path, params } = (payload ?? {}) as Record<string, unknown>;

  if (typeof name !== 'string' || !KNOWN_EVENTS.has(name)) return ok();

  const id = cleanClientId(clientId);
  if (!id) return ok();

  // A visit without a usable session id is counted as its own visit rather
  // than folded into the browser's, which is what the first version did.
  const session = cleanClientId(sessionId) ?? id;

  const cleanedPath = cleanPath(path);

  const body = buildPayload(name, id, session, cleanedPath, params);

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
