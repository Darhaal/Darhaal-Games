# Analytics

Usage measurement, arranged so that a room link cannot reach Google.

## Shape

Nothing Google supplies runs in the browser. There is no gtag, no Google
script tag, no Google cookie.

```
page  ──POST──▶  /api/analytics  ──▶  GA4 Measurement Protocol
```

The page posts `{ name, clientId, sessionId, path, params, engagementMs,
referrer }` to this site's own route handler. The handler validates it,
cleans it again, builds the page address itself and forwards it to Google.

## Sessions, engagement, new visitors, source

What the Measurement Protocol needs, and what it will not do (fixed
2026-11-09, after a week of GA4 reporting zeros):

- **`session_id` is the visit's start in Unix seconds.** GA4 accepts only a
  positive integer. It used to be a UUID, so no session was ever counted.
- **`engagement_time_msec` is real.** The page measures visible time since
  the previous event (a hidden tab does not count) and sends the last page's
  share as `page_engagement` when the tab is hidden. It was a constant 1 ms.
- **New visitors are the `new_visitor` event**, sent once per browser id.
  `first_visit`, `session_start` and `user_engagement` are reserved names GA4
  refuses over this protocol, so the built-in "New users" stays at zero.
- **The channel is a `campaign_details` event** sent ahead of a visit's
  first event (the client marks it `entry`). The protocol may not send
  gtag's `session_start`, which is where gtag puts source/medium, so every
  session read "Unassigned"; `campaign_details` is the protocol's documented
  substitute. The server decides it in gtag's order: `utm_source` /
  `utm_medium` / `utm_campaign` on the landing address (plain labels only),
  else the referrer — a search engine is `google` / `organic` and so on, any
  other site is its host / `referral` — else `(direct)` / `(none)`.
- **`page_referrer` is an origin only** (`https://www.google.com/`), on a
  visit's first event, never a path or a search query.
- **Realtime's "First user …" cards** come from `first_visit`, which this
  protocol cannot send, so they may stay "(not set)". The channel shows in
  *Traffic acquisition* (session default channel group).

## Why, and not as a preference

gtag attaches the page address to every hit and fills that field in itself,
from `document.location`. On this site a game screen's address is
`/game/<game>?id=<room uuid>`, and a room link *is* the invitation — for a
private room it is the only thing between the room and a stranger.

Four releases tried to make gtag report a redacted address. Each shipped, and
each still leaked when measured end to end on a real room:

| release | what was tried | result |
|---|---|---|
| 2.4.0 | `redactUrl` + `config` with `page_location` | leaked |
| 2.4.1 | `page_location` spread into every event | leaked |
| 2.5.1 | `gtag('set', 'page_location', …)` before each hit | leaked |
| 2.5.2 | `page_location` in the event parameters | leaked |

Two of those were reported as fixed on the strength of a check that watched
only `fetch` and `sendBeacon`. gtag sends most hits by image pixel and XHR, so
the check never saw the hits that mattered and cleared them twice.

With the browser out of the loop, the address is a string
`src/app/api/analytics/route.ts` assembles. There is nothing to override.

## What the server refuses

`src/app/api/analytics/route.ts`, covered by `tests/analytics-route.test.ts`:

- an event name that is not in `GA_EVENTS`
- a `clientId` that is not a UUID this site would have generated
- any parameter not in `ALLOWED_PARAMS` — dropped, not forwarded
- `id`, `code`, `returnUrl`, `token`, `access_token` in the path — replaced
  with `redacted`, **again**, because the client's pass is not trusted
- a `page_location` supplied by the client — ignored; the server builds it
- anything at all, if `GA_API_SECRET` is unset

It answers `204` in every case. A measurement endpoint that reports on itself
is a way to probe the site.

The visitor's IP does not reach Google either: the request comes from the
server, and `ip_override` is deliberately not sent.

## Configuration

`GA_API_SECRET` — created in GA4 under *Admin → Data Streams → the stream →
Measurement Protocol API secrets*, then set in Vercel as an environment
variable. It is a secret: server-side only, never `NEXT_PUBLIC_`.

Without it the route collects nothing and the site behaves exactly as if
analytics were off.

## Seeing it broken down by game

Every event carries `game`, and the lifecycle events carry `players`,
`max_players`, `is_private`, `result`, `duration_seconds` and `where`. GA
stores all of them but shows none of them in a report until each is
registered as a custom dimension — so out of the box the Events report says
`match_started` and not which game.

*Admin → Custom definitions → Create custom dimension*, scope **Event**, and
the event parameter name typed exactly as it is sent:

| dimension | parameter | what it answers |
|---|---|---|
| Game | `game` | which games are played |
| Players | `players` | how many sat down |
| Max players | `max_players` | what sizes rooms are made for |
| Private | `is_private` | how many rooms are private |
| Result | `result` | win or loss |
| Duration | `duration_seconds` | how long a match runs |
| Where | `where` | which path an error or closure came from |

Registration is not retroactive: a dimension starts collecting from the
moment it is created, so it is worth doing all of them at once.

## Is it actually running?

```
GET /api/analytics             → { configured, measurementId }
GET /api/analytics?validate=1  → … plus { accepted, messages }
```

`configured` says whether this deployment has `GA_API_SECRET`. Vercel applies
a new environment variable only on the next deploy, so "the key was added" and
"the key is live" are different statements and this is the one that answers
the second.

`validate=1` sends a probe to Google's debug endpoint and returns Google's own
verdict — GA drops a malformed event in silence on the real endpoint, so a set
key does not by itself mean events arrive. The probe is built by the same
function as a real event; a self-check that builds its own payload proves only
that the self-check works.

Neither carries a secret or anything about a visitor. That analytics exists is
already on the consent banner and in the privacy policy.

## Checking it

`tests/analytics-route.test.ts` inspects the outgoing payload directly, which
is what the four failed attempts lacked — it asserts on the request rather
than on a function that was correct all along. Removing the redaction from the
route fails four of its tests; that check was run.

If ever verifying in a browser again, intercept **all four** transports —
`fetch`, `navigator.sendBeacon`, `XMLHttpRequest.prototype.open`, and the
`src` setter on `HTMLImageElement.prototype`. Missing the last two is what
produced two false clears.
