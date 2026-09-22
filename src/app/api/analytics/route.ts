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

  const { name, clientId, path, params } = (payload ?? {}) as Record<string, unknown>;

  if (typeof name !== 'string' || !KNOWN_EVENTS.has(name)) return ok();

  const id = cleanClientId(clientId);
  if (!id) return ok();

  const cleanedPath = cleanPath(path);

  const body = {
    client_id: id,
    events: [
      {
        name,
        params: {
          ...cleanParams(params),
          page_location: `https://games.okhten.com${cleanedPath}`,
          page_path: cleanedPath,
          // Without this GA treats every event as its own session.
          engagement_time_msec: 1,
          session_id: id
        }
      }
    ]
  };

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
