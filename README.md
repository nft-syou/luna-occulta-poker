# Yoiyami Poker (宵闇の賭場) — a Luna Occulta fan poker

[![CI](https://github.com/nft-syou/jev-poker/actions/workflows/ci.yml/badge.svg)](https://github.com/nft-syou/jev-poker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](.node-version)
[![pnpm](https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Deploys to Cloudflare Workers](https://img.shields.io/badge/deploys%20to-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](#deploy-to-cloudflare-workers)

**Nothing to set up to play** — no key, no account: open the site and sit down. To host it yourself, see [Deploy to Cloudflare Workers](#deploy-to-cloudflare-workers).

**日本語版は [README.ja.md](README.ja.md) にあります。**

> An **unofficial fan work** based on 月蝕綺譚 -Luna Occulta- (a CryptoNinja side story). Not
> affiliated with the official game. Made within the
> [fan-work guidelines](https://vibe.co.jp/luna-occulta/fanworks) and the
> [CryptoNinja guidelines](https://www.ninja-dao.com/guidelines). #月蝕綺譚

No-Limit Texas Hold'em under an eclipsed moon. You sit down as あるじどの; across the
lacquer table are five 御霊 whose personalities are lifted from the official canon —
咲耶, マミ, タルト, 孫市 and 蛇ノ目. Every one of their decisions is made by
[TypeSafe Jev](https://typesafe.ai); they speak their lines aloud, wear their official
faces at the seats, and get a cut-in on all-ins, big pots and busts. Or let a
full table of spirits play while you watch. No key, no setup: the operator's Jev key
lives behind the table, not in your browser.

Built on [jev-poker](https://github.com/nft-syou/jev-poker): the engine and the CPU are
unchanged (`@jev-poker/engine`, `@jev-poker/agent`); the look, the characters and the
voices are the fan work.

## The spirits

| Spirit | Clan | Canon | At the table |
| --- | --- | --- | --- |
| 咲耶 Sakuya | Koga · Fire | Bright and confident; cannot lie, and it shows on her face | Plays strong hands head-on, almost never bluffs. **Her lines change when she bluffs** — a tell |
| マミ Mami | Saika · Wood | Shape-shifter who wins by showing people a dream | Bluffs and semi-bluffs often, wins on numbers |
| タルト Tart | Koga · Water | "The long way round is the quick way" | Enters few pots, calls, raises only with the goods |
| 孫市 Magoichi | Saika · Fire | "Never missed a shot" | Selective, then aggressive for value; takes the whole pot |
| 蛇ノ目 Janome | Fuma · Wood | Easygoing and fatally off-beat | Loose, unreadable; shoves with the unexpected |
| あるじどの | — | Speaks no word | Your seat; in spectator mode, a silent CPU |

The personality texts are in `src/characters/spirits.ts` and the script in `src/characters/lines.ts`.

## How it works

1. The game engine (`src/engine`, zero dependencies) deals, enforces betting rules, builds side pots and evaluates hands.
2. For every CPU decision, `src/jev` compresses the situation (position, made hand, draws, exact hand strength and equity, pot odds, stacks in BB, this hand's actions) into a closed-vocabulary structure — enums, numbers and card codes, never prose — and sends only that to this site's own Worker.
3. The Worker (`src/worker/decide.ts`) rebuilds the parts a request never carries: the spirit's persona text (from `src/characters/spirits.ts`) and the three typed questions (`action`, `sizing`, `bluff_intent`) that `@jev-poker/agent`'s `buildQuestions` derives from the structure. The two free-text fields the library itself produces (`task`, `importantContext`) are let through only when they match `src/worker/prose-allowlist.json` word for word.
4. The Worker forwards the assembled request to Jev with the operator's key and hands back only `{ model, action, sizing, bluff_intent }`.
5. The persona's *variance* decides whether the CPU always takes the most likely action or samples; the result is clamped to a legal bet size.
6. If Jev is unreachable, or the operator's daily budget for the day is spent, the CPU checks or folds and the history shows why (or the table pauses with 今宵はここまで — see "Play").

The engine and the CPU are the npm packages `@jev-poker/engine` and `@jev-poker/agent`, developed in https://github.com/nft-syou/jev-poker.

Your browser never sends prose and never sees the operator's key. It talks only to this
site's own `POST /api/session` and `POST /api/jev/decide`, both served by a single
Cloudflare Worker (`src/worker/`) — see "Security" below.

## Play

1. Open the deployed site (or run it locally, below).
2. Title screen: **開帳** to sit down, **見物** to watch a full table play itself, or **設定** for sound and language.
3. Table setup: a table (六人卓 six-handed, or 差し向かい heads-up, where you also pick your one opponent), then a stake — 宵 100BB, 深更 50BB or 蝕 25BB. Watching is six-handed only.
4. Sitting down asks an invisible Turnstile check to vouch for you; once through, you're seated for two hours.
5. Open "Jev" in the hand history to see the probabilities behind each CPU action.
6. When the operator's daily budget for your IP, or for the whole site, is spent, the table pauses with 今宵はここまで — it resumes at Japan midnight.

## Security

The Worker is the only thing that holds the operator's Jev key; it never reaches the
browser. "Per IP" below means per IPv4 address, or per IPv6 /64 (one connection is usually
handed a whole /64).

`POST /api/session` takes `{ turnstileToken }`. It goes through the same burst limit as below
(`429 slow_down`), then asks Cloudflare's siteverify about the token; anything but a pass is
`403 turnstile_failed`.

Every `POST /api/jev/decide` is checked in order, stopping at the first failure:

1. **Session** — `Authorization: Bearer <token>`, an HMAC-SHA256 token issued by `/api/session` once Turnstile passes, valid 2 hours and bound to the caller's IP. Bad, expired or foreign-IP tokens get `401 session_expired`.
2. **Shape** — the body is ≤16 KB of JSON matching a closed-vocabulary schema (`src/worker/schema.ts`): enums from a fixed list, numbers in range, card codes matching a regex, arrays capped in length, unknown keys rejected. Otherwise `400 bad_request`.
3. **Burst** — 20 requests per 10 seconds per IP (`JEV_BURST`, a Cloudflare rate limit binding). Over that, `429 slow_down` with `retry-after: 2`.
4. **Daily budget** — a Durable Object (`JEV_BUDGET`) counts calls per IP and in total, resetting at Japan midnight (`DAILY_CALLS_PER_PLAYER=600`, `DAILY_CALLS_TOTAL=20000` by default). Over either, `429 tonight_is_over` with `{ resumesAt }`.
5. **Upstream** — the Worker assembles the real Jev request itself (see "How it works"); the browser's JSON never reaches Jev unmodified. It calls one of four fixed hosts chosen by the operator's `JEV_ROUTE`, never a URL taken from the browser (`src/worker/upstream.ts`). Upstream 402 (the operator's credit is exhausted) becomes `429 tonight_is_over`; 401/403 (a key problem) becomes `503 unavailable` rather than blaming the player; anything else is `502 upstream_error`.

Outside `/api/session` and `/api/jev/decide`, every path is `404 not_found`; anything but
`POST` is `405 method_not_allowed`. In production, if `TURNSTILE_SECRET` or
`SESSION_SECRET` is missing the Worker refuses every request with `503 unavailable`
instead of running open — only the Vite dev server sets `DEV_OPEN=1` to skip this.
To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Run locally

Requires Node.js 24 and pnpm.

    pnpm install
    JEV_API_KEY=sk-... pnpm dev   # Vite dev server; /api/* runs the same handler as the Worker,
                                   # budget in memory, Turnstile skipped (DEV_OPEN)
    pnpm dev:worker                # build + `wrangler dev`: the real Worker, Durable Object
                                    # and rate limit; needs secrets, below
    pnpm check                     # lint + typecheck + tests + build

`pnpm dev:worker` reads secrets and vars from `.dev.vars` in the project root — **git-ignored,
never commit it**:

    JEV_API_KEY=sk-...
    JEV_ROUTE=typesafe
    JEV_MODEL=jev-latest
    TURNSTILE_SECRET=1x0000000000000000000000000000000AA
    SESSION_SECRET=<any random string, e.g. `openssl rand -base64 32`>

The `TURNSTILE_SECRET` above is one of Cloudflare's documented always-pass test secrets; pair
it with the matching test site key, set as `VITE_TURNSTILE_SITE_KEY` before building, so
`pnpm dev:worker` runs end to end without a real widget. See
[developers.cloudflare.com/turnstile/troubleshooting/testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
for the current pairs — don't reuse a real site's keys locally.

`.node-version` pins this project to Node 24 for tools that read it.

## Deploy to Cloudflare Workers

The public instance is deployed from `main` through Cloudflare Workers Builds. To run your own,
as the operator:

1. Fork or push this repo to GitHub.
2. Cloudflare dashboard → Turnstile → create a widget. Mode **Invisible**; hostname: your
   public domain only. Note the site key and the secret. For local development, use
   one of Cloudflare's documented test key pairs instead of a real site's keys — see
   [developers.cloudflare.com/turnstile/troubleshooting/testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
3. Set the three secrets:

       wrangler secret put JEV_API_KEY
       wrangler secret put TURNSTILE_SECRET
       wrangler secret put SESSION_SECRET

   `SESSION_SECRET` is the HMAC key that signs session tokens — generate one with, e.g.,
   `openssl rand -base64 32`.
4. In `wrangler.jsonc`'s `vars`, set `JEV_ROUTE` (`typesafe` / `vercel` / `lolipop` /
   `cloudflare`) and `JEV_MODEL`, and adjust `DAILY_CALLS_PER_PLAYER` / `DAILY_CALLS_TOTAL` if
   the defaults (600 / 20000 per Japan day) don't fit. Routing through Cloudflare AI Gateway
   also needs `JEV_CF_ACCOUNT`, `JEV_CF_GATEWAY` and `JEV_CF_PROVIDER` — the **provider slug
   alone, without a `custom-` prefix**; a `custom-…` value makes every decision answer
   `503 unavailable`.
5. Cloudflare dashboard → Workers & Pages → Create → connect this repo through Workers Builds.
   Build command `pnpm build`; deploy command `wrangler deploy`.
6. Add `VITE_TURNSTILE_SITE_KEY` (the public site key from step 2 — not a secret, but must be
   present at build time for Vite to inline it) as a Workers Builds **build variable**.
7. Assign a custom domain to the Worker, then update `index.html`'s canonical and Open Graph
   URLs to it.
8. After the first deploy, play one hand yourself: confirm the table loads with no key prompt,
   and — if Turnstile decides the visit needs an interactive challenge — that it appears
   centred on screen and can be answered.

Optional variable `TYPESAFE_BASE_URL` overrides the upstream API root of the
`typesafe` route only; the gateway hosts are constants in the code. It is
used only when it looks like `https://…` (or `http://localhost…` for local
work); anything else falls back to the default.

## Assets and voices

- The faces, standing art and cut-in drawings under `public/kitan/` come from the official
  fan-work materials and asset vault (each cut-in is one frame lifted from the official
  animation; the motion is staged here); sources and processing are in `scripts/kitan-assets.json`
  and `pnpm assets:kitan` rebuilds them. They belong to the original work and are not covered by
  this repository's MIT license ([public/kitan/README.md](public/kitan/README.md)).
- The voices are mp3s generated with [Irodori-TTS](https://github.com/Aratako/Irodori-TTS)'s
  VoiceDesign model from the caption and seed published with each spirit's official voice sample.
  Edit a line and regenerate only that clip: see [scripts/voice/README.md](scripts/voice/README.md).
- The music and sound effects are CC0 from 宵闇素材庫 (<https://vibe.co.jp/yoiyami/>): one quiet
  koto loop under the table and a handful of short sounds, kept sparse because the official tone
  sheet makes silence the ground.
- The design follows the official tone, 宵闇に金: an indigo ground, gold as lines and grains,
  eclipse red only for warnings and all-ins.

## Project layout

    src/engine/       the poker engine (dealing, betting, side pots, hand evaluation), zero dependencies
    src/characters/   the spirits' data, script and voice player
    src/jev/          app-only: the session/Turnstile client and the Worker-backed CPU decision backend
    src/worker/       the Cloudflare Worker: static assets, /api/session, /api/jev/decide, the budget Durable Object
    src/ui/        React UI, game loop, history with Jev probabilities, speech bubbles and cut-ins
    src/i18n/      en / ja dictionaries
    src/proxy/     the dev server's request/response adapter, shared by `pnpm dev`
    public/kitan/  official assets (images, videos) and the generated voices
    scripts/       asset intake, voice generation and the prose allowlist generator
    docs/superpowers/specs/  design specs

## Roadmap

- Tournament format: `BlindSchedule` already abstracts blinds; busted seats are not rebought when `format` is `tournament`.
- Versioned question sets recorded on each decision.

## Contributing

Bug reports, feature requests and pull requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for how the project is built and tested, and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for how we treat each other. Changes are
listed in [CHANGELOG.md](CHANGELOG.md).

## License

The code is MIT — see [`LICENSE`](LICENSE).

**MIT does not cover `public/kitan/`.** Its terms are set out in
[`public/kitan/LICENSE`](public/kitan/LICENSE): the images and voices are 月蝕綺譚 fan-work
materials bundled for this game under its guidelines, and may not be redistributed as an asset
collection. Only the music and effects under `public/kitan/sound/` are free — those are CC0
from 宵闇素材庫.
