# Analytics

Usage measurement, arranged so that a room link cannot reach Google.

## Shape

Nothing Google supplies runs in the browser. There is no gtag, no Google
script tag, no Google cookie.

```
page  ──POST──▶  /api/analytics  ──▶  GA4 Measurement Protocol
```

The page posts `{ name, clientId, path, params }` to this site's own route
handler. The handler validates it, cleans it again, builds the page address
itself and forwards it to Google.

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
