/**
 * Google Analytics: what we measure, and what we refuse to send.
 *
 * The measurement id is not a secret — it ships in the page source of every
 * site that uses GA — so it lives here rather than in an environment variable
 * nobody would remember to set.
 */
/**
 * Analytics is off.
 *
 * gtag reports the page address with every hit, and on this site the address
 * of a game screen contains the room id — which for a private room is the
 * whole of its security. Four separate attempts to make gtag report a
 * redacted address instead were each verified and each still leaked:
 * `page_location` on the event, on `config`, via `set`, and re-applied on
 * navigation. Measured end to end on a real room, the id went out anyway.
 *
 * So nothing is collected until it can be shown not to. The consent banner,
 * the privacy policy and the event call sites all stay in place and inert;
 * turning this back on is one constant, and must not happen without the
 * end-to-end check in docs/analytics.md passing.
 */
export const ANALYTICS_ENABLED = false;

export const GA_MEASUREMENT_ID = 'G-EN84T7BSHC';

/** Where the consent decision is remembered. Versioned: if what we ask for
 *  ever changes, the old answer stops counting and we ask again. */
export const CONSENT_KEY = 'darhaal.analytics-consent.v1';

export type ConsentChoice = 'granted' | 'denied';

/**
 * Query parameters stripped before a URL is reported.
 *
 * `id` is the one that matters: a room link *is* the invitation, and a
 * private room's link is the only thing standing between it and a stranger.
 * Handing those to a third party because they happen to sit in the address
 * bar is not something a player agreed to. `returnUrl` and `code` go for the
 * same reason.
 */
export const REDACTED_PARAMS = ['id', 'code', 'returnUrl', 'token', 'access_token'] as const;

/**
 * The events the app reports, spelled out so a typo becomes a type error
 * rather than a metric that silently never arrives.
 *
 * None of them carry a user id, a nickname, an email or a room id. GA4 is a
 * third party; what reaches it is counts and categories, nothing that points
 * back at a person or unlocks a room.
 */
export const GA_EVENTS = {
  lobbyCreated: 'lobby_created',
  lobbyJoined: 'lobby_joined',
  matchStarted: 'match_started',
  matchFinished: 'match_finished',
  rematchStarted: 'rematch_started',
  appError: 'app_error'
} as const;

export type GaEvent = (typeof GA_EVENTS)[keyof typeof GA_EVENTS];
