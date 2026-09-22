/**
 * Analytics: what is measured, and what is refused.
 *
 * Nothing Google supplies runs in the browser. The page posts an event to
 * this site's own route handler, which forwards it to GA4 over the
 * Measurement Protocol. That is not a stylistic preference — see
 * docs/analytics.md. gtag attaches the page address to every hit and fills
 * that field itself, and on this site a game screen's address contains the
 * room id, which for a private room is the whole of its security. Four
 * attempts to make gtag report something else each shipped and each still
 * leaked. With the browser out of the loop there is no address for anything
 * to read.
 */

/**
 * The master switch.
 *
 * The server half also refuses to do anything without `GA_API_SECRET`, so a
 * deployment that has not been given one collects nothing whatever this says.
 */
export const ANALYTICS_ENABLED = true;

/** Not a secret — it identifies the property, not the account. */
export const GA_MEASUREMENT_ID = 'G-EN84T7BSHC';

/** Where this site posts its own events. Same origin: no third party. */
export const ANALYTICS_ENDPOINT = '/api/analytics';

/**
 * Where the consent decision is remembered. Versioned: if what is asked for
 * ever changes, the old answer stops counting and the question is asked again.
 */
export const CONSENT_KEY = 'darhaal.analytics-consent.v2';

/**
 * A random id for this browser, so GA can tell one visitor's events from
 * another's. Written only after consent, and it is the only identifier the
 * arrangement has: it is generated here, means nothing anywhere else, and
 * disappears when the visitor clears their site data.
 */
export const CLIENT_ID_KEY = 'darhaal.analytics-client.v1';

export type ConsentChoice = 'granted' | 'denied';

/**
 * Query parameters stripped before a path is reported.
 *
 * `id` is the one that matters: a room link *is* the invitation, and a
 * private room's link is the only thing standing between it and a stranger.
 * `returnUrl` carries one too, because the sign-in redirect puts the
 * destination in it. Applied on the client and again on the server, which
 * does not trust what the client sent.
 */
export const REDACTED_PARAMS = ['id', 'code', 'returnUrl', 'token', 'access_token'] as const;

/**
 * The events the app reports, spelled out so a typo becomes a type error
 * rather than a metric that silently never arrives. The server rejects
 * anything not on this list.
 */
export const GA_EVENTS = {
  pageView: 'page_view',
  lobbyCreated: 'lobby_created',
  lobbyJoined: 'lobby_joined',
  matchStarted: 'match_started',
  matchFinished: 'match_finished',
  rematchStarted: 'rematch_started',
  appError: 'app_error'
} as const;

export type GaEvent = (typeof GA_EVENTS)[keyof typeof GA_EVENTS];

/**
 * Parameter names an event may carry. The server drops everything else
 * rather than passing it on.
 *
 * This is the list that keeps the arrangement honest: no ids, no names, no
 * free text beyond a trimmed error reason. Adding to it is a deliberate act,
 * and `tests/analytics.test.ts` checks that nothing identifying gets on.
 */
export const ALLOWED_PARAMS = [
  'page_path',
  'game',
  'mode',
  'players',
  'max_players',
  'is_private',
  'result',
  'duration_seconds',
  'where',
  'reason'
] as const;

export type AllowedParam = (typeof ALLOWED_PARAMS)[number];
