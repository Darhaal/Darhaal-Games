# Analytics

**Status: off.** `ANALYTICS_ENABLED` in `src/constants/analytics.ts` is `false`
and nothing is collected. The consent banner, the privacy policy and every
`track()` call site are in place and inert.

## Why it is off

gtag attaches the page address to every hit it sends. On this site the address
of a game screen is `/game/<game>?id=<room uuid>`, and a room link is its
invitation — for a private room it is the only thing between the room and a
stranger. Sending those to Google is not something a player agreed to, and it
is not what the privacy policy says happens.

Four attempts were made to have gtag report a redacted address instead. Each
was shipped, and each still leaked when measured end to end on a real room:

| attempt | what was tried | result |
|---|---|---|
| 2.4.0 | `redactUrl` + `config` with `page_location` | leaked |
| 2.4.1 | `page_location` spread into every event | leaked |
| 2.5.1 | `gtag('set', 'page_location', …)` before each hit | leaked |
| 2.5.2 | `page_location` in the event parameters | leaked |

Two of those were reported as fixed on the strength of a check that watched
only `fetch` and `sendBeacon`. gtag sends most hits by image pixel and XHR, so
the check never saw the hits that mattered. That mistake is the reason this
document exists.

## The check that must pass before it goes back on

Not a unit test. The unit tests prove `redactUrl` correct, and `redactUrl` was
always correct — it simply was not the thing filling in the field.

On the deployed site, with consent granted:

1. Intercept **all four** transports: `fetch`, `navigator.sendBeacon`,
   `XMLHttpRequest.prototype.open`, and the `src` setter on
   `HTMLImageElement.prototype`. Missing the last two is what produced two
   false clears.
2. Load a game URL carrying a recognisable id.
3. Wait fifteen seconds for GA to flush; it batches.
4. Assert the id appears in **no** intercepted request, not merely that `dl`
   looks clean on the hits that happened to arrive.

## If it is picked up again

The approach that has not been tried is to keep the browser out of it: post
events to our own route handler and forward them to GA from the server over
the Measurement Protocol, with an address we control. The browser then never
loads gtag, so there is no cookie, no third-party script, and no URL for it to
read.
