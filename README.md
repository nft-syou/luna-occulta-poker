# Yoiyami Poker (宵闇の賭場) — a Luna Occulta fan poker

[![CI](https://github.com/nft-syou/luna-occulta-poker/actions/workflows/ci.yml/badge.svg)](https://github.com/nft-syou/luna-occulta-poker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Deploys to Cloudflare Workers](https://img.shields.io/badge/deploys%20to-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](#deploy)

**Play at [yoiyami.syou.io](https://yoiyami.syou.io/)** — no key, no account: open the site and sit down.

**日本語版は [README.ja.md](README.ja.md) にあります。**

> An **unofficial fan work** based on 月蝕綺譚 -Luna Occulta- (a CryptoNinja side story). Not
> affiliated with the official game. Made within the
> [fan-work guidelines](https://vibe.co.jp/luna-occulta/fanworks) and the
> [CryptoNinja guidelines](https://www.ninja-dao.com/guidelines). #月蝕綺譚

No-Limit Texas Hold'em under an eclipsed moon. You sit down as あるじどの; across the lacquer
table are five 御霊 whose personalities are lifted from the official canon. They speak their
lines aloud, wear their official faces at the seats, and get a cut-in on all-ins, big pots and
busts. Or let a full table of spirits play while you watch.

## Playing

1. **開帳** to sit down, **見物** to watch a full table, **設定** for sound and language.
2. Pick a table — 六人卓 (six-handed) or 差し向かい (heads-up, against the spirit you choose) —
   and a stake: 宵 100BB, 深更 50BB or 蝕 25BB.
3. Open **読み** in the hand history to see what each spirit was weighing.
4. The site has a daily budget. When it is spent the table closes with 今宵はここまで and opens
   again at midnight, Japan time.

## The spirits

| Spirit | Clan | Canon | At the table |
| --- | --- | --- | --- |
| 咲耶 Sakuya | Koga · Fire | Bright and confident; cannot lie, and it shows on her face | Plays strong hands head-on, almost never bluffs. **Her lines change when she bluffs** — a tell |
| マミ Mami | Saika · Wood | Shape-shifter who wins by showing people a dream | Bluffs and semi-bluffs often, wins on numbers |
| タルト Tart | Koga · Water | "The long way round is the quick way" | Enters few pots, calls, raises only with the goods |
| 孫市 Magoichi | Saika · Fire | "Never missed a shot" | Selective, then aggressive for value; takes the whole pot |
| 蛇ノ目 Janome | Fuma · Wood | Easygoing and fatally off-beat | Loose, unreadable; shoves with the unexpected |
| あるじどの | — | Speaks no word | Your seat; when watching, a silent spirit |

Their personalities live in `src/characters/spirits.ts`, their lines in `src/characters/lines.ts`.

## How it works

The spirits decide with [TypeSafe Jev](https://typesafe.ai), through the poker engine and CPU
of [jev-poker](https://github.com/nft-syou/jev-poker) (`@jev-poker/engine` and
`@jev-poker/agent` from npm, used unchanged). This repository is the game around them: the
look, the characters, the voices, and one Cloudflare Worker.

The browser holds no key. For each decision it sends the Worker the shape of the hand —
enums, numbers and card codes, never text — and the Worker rebuilds the spirit's persona and
the questions itself, calls Jev with the operator's key, and returns only the answer. Sessions
come from an invisible Turnstile check; burst limits and a daily budget keep the key's spend
bounded. The full list of checks is in [SECURITY.md](SECURITY.md).

## Run locally

Requires Node.js 24 and pnpm 12.

    pnpm install
    JEV_API_KEY=sk-... pnpm dev                     # the app, with the Worker's handler at /api
    pnpm check                                      # lint + typecheck + tests + build

`pnpm dev` skips Turnstile and keeps the budget in memory. To run the real Worker, Durable
Object and rate limit instead, put the secrets in a git-ignored `.dev.vars` and run
`pnpm dev:worker`:

    JEV_API_KEY=sk-...
    JEV_ROUTE=typesafe
    TURNSTILE_SECRET=<a Cloudflare test secret>
    SESSION_SECRET=<openssl rand -base64 32>

Build with the matching test site key in `VITE_TURNSTILE_SITE_KEY`. Cloudflare lists the test
key pairs at
[developers.cloudflare.com/turnstile/troubleshooting/testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Deploy

The public site deploys from `main` through Cloudflare Workers Builds. To run your own:

1. **Turnstile** — create a widget in the Cloudflare dashboard: mode **Invisible**, hostname
   your public domain.
2. **Secrets** —

       wrangler secret put JEV_API_KEY
       wrangler secret put TURNSTILE_SECRET
       wrangler secret put SESSION_SECRET    # e.g. openssl rand -base64 32

3. **Settings** — in `wrangler.jsonc`, set `routes` to your domain and the `vars`: `JEV_ROUTE`
   (`typesafe` / `vercel` / `lolipop` / `cloudflare`), `JEV_MODEL`, and the daily limits
   `DAILY_CALLS_PER_PLAYER` / `DAILY_CALLS_TOTAL` (600 / 20000). The `cloudflare` route also
   needs `JEV_CF_ACCOUNT`, `JEV_CF_GATEWAY` and `JEV_CF_PROVIDER` — the provider slug alone,
   without a `custom-` prefix. Point the canonical and Open Graph URLs in `index.html` at your
   domain.
4. **Workers Builds** — connect the repository to the Worker (build command `pnpm build`,
   deploy command `npx wrangler deploy`) and add two build variables:
   `VITE_TURNSTILE_SITE_KEY` (the widget's site key, inlined at build time) and
   `PNPM_VERSION=12.4.2` (the build image's default pnpm is older).
5. **Check** — after the first deploy, sit down at a table yourself.

## Assets and voices

- The faces, standing art and cut-in drawings under `public/kitan/` come from the official
  fan-work materials (each cut-in is one frame from the official animation; the motion is
  staged here). Sources and processing are in `scripts/kitan-assets.json`;
  `pnpm assets:kitan` rebuilds them.
- The voices are generated with [Irodori-TTS](https://github.com/Aratako/Irodori-TTS) from the
  caption and seed published with each spirit's official voice sample — see
  [scripts/voice/README.md](scripts/voice/README.md).
- The music and sound effects are CC0 from 宵闇素材庫 (<https://vibe.co.jp/yoiyami/>).
- The design follows the official tone, 宵闇に金: an indigo ground, gold as lines and grains,
  eclipse red only for warnings and all-ins.

## Project layout

    src/ui/           screens, table, game loop, speech bubbles, cut-ins, the 開帳 opening
    src/characters/   the spirits, their lines, the voice and sound players
    src/jev/          the browser side of a decision: session, Turnstile, the Worker-backed CPU
    src/worker/       the Cloudflare Worker: /api/session, /api/jev/decide, the daily budget
    src/i18n/         ja / en dictionaries
    public/kitan/     the official materials, the generated voices, the music
    scripts/          asset intake, voice generation, icons and share card, the prose allowlist

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

The code is MIT — see [`LICENSE`](LICENSE).

**MIT does not cover `public/kitan/`.** Its terms are in
[`public/kitan/LICENSE`](public/kitan/LICENSE): the images and voices are 月蝕綺譚 fan-work
materials bundled for this game under its guidelines and may not be redistributed as an asset
collection. Only the music and effects under `public/kitan/sound/` are free (CC0, 宵闇素材庫).
