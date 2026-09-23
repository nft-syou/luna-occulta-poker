# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private
vulnerability reporting instead: **Security → Report a vulnerability** on this
repository. You will get a reply within a week, and a fix or a decision within
30 days of the report being confirmed.

Please include what you found, how to reproduce it and what you think the
impact is. If you are unsure whether something counts, report it anyway.

## What is in scope

- The Worker (`src/worker/`): anything that lets a request skip a guard, reach
  the operator's Jev key, or make the Worker contact a host other than the
  fixed upstreams in `src/worker/upstream.ts`. In particular:
  - Forging or replaying a session token, or getting one verified for an IP
    other than the one it was issued to (`src/worker/session.ts`).
  - Getting free-form prose (rather than an allow-listed string) into the
    request the Worker sends to Jev, or getting an unknown/out-of-range field
    past the schema check (`src/worker/schema.ts`, `src/worker/prose.ts`,
    `src/worker/prose-allowlist.json`).
  - Evading the per-IP burst limit or the daily budget
    (`src/worker/budget.ts`, `src/worker/budgetObject.ts`).
  - Leaking the operator's key, a caller's IP, or another caller's session
    token in a response, a log, or an error.
- Dependency vulnerabilities that are reachable from the deployed site.

## What is out of scope

- The security of TypeSafe, Vercel, Lolipop, Cloudflare or Turnstile
  themselves. Report those to the respective provider.
- Hitting the daily budget or the burst limit as an ordinary player — those
  are the abuse controls working as designed, not a vulnerability.
- Issues that require a compromised browser or a malicious browser extension.

## How the app is meant to behave

Players bring nothing. The operator's Jev key lives only as a Worker secret and
never reaches the browser. Before the browser can ask for a decision it must
pass an invisible Turnstile check and exchange that for a signed, IP-bound
session token (`POST /api/session`); every `POST /api/jev/decide` is then
checked in order — session, then the closed-vocabulary shape of the request,
then a per-IP burst limit, then a daily budget — before the Worker builds the
actual Jev request itself (the spirit's persona and the typed questions; the
two free-text fields the request may carry are accepted only when they match
`src/worker/prose-allowlist.json` word for word) and forwards it upstream with
the operator's key. Nothing about the key or the upstream URL is ever taken
from the browser, and the Worker stores nothing beyond the day's per-IP and
total call counts. Details are in the "Security" section of the
[README](README.md#security).

## Known limits and follow-ups

- The Worker does not check the `hostname` that Turnstile's siteverify reports,
  so a token solved on another site using the same site key would be accepted.
  The widget's hostname list in the Cloudflare dashboard is the only guard
  today; checking it server-side is a follow-up.
- Burst limits, daily budgets and session binding count per IPv4 address or
  per IPv6 /64. Players behind one shared IPv4 address (carrier-grade NAT, an
  office) share one budget; someone holding several /64s gets several.

## Supported versions

Only the `main` branch and the deployment built from it receive fixes.
