# Contributing to jev-poker

Thanks for taking the time. This page covers how to get a working checkout, what
a change needs before it can be merged, and where things live.

## Setup

Node.js 24 and pnpm 12 (`corepack enable` picks the pnpm version from
`package.json`).

    pnpm install
    pnpm dev            # Vite dev server, with the Worker's own handler mounted at /api
    pnpm check          # what CI runs: lint + typecheck + tests + build

Playing locally against the real Jev needs an operator key: `JEV_API_KEY=sk-... pnpm dev`
(see the README's "Run locally" for `pnpm dev:worker`, which runs the real Worker, Durable
Object and rate limit against a git-ignored `.dev.vars`). Nothing in the repo needs a key to
build or test: the engine, the Worker and the UI are all tested without one.

## Before opening a pull request

- `pnpm check` passes. It is the same command CI runs.
- New behaviour comes with a test next to the code (`*.test.ts` / `*.test.tsx`).
  The engine is tested with seeded random play, the proxy against a fake `fetch`,
  the UI with Testing Library in jsdom.
- Layout changes were looked at in a browser. jsdom computes no layout, so a CSS
  fix that is only reasoned about is not verified; measure it (phone width and
  desktop width) before saying it is fixed.
- The stylesheet is formatted by Biome (`pnpm format`), and `.gitattributes`
  keeps every text file on LF.
- User-facing strings go through i18n: add the key to both
  `src/i18n/locales/en.json` and `ja.json`.
- Commit messages follow Conventional Commits (`feat(ui): …`, `fix(proxy): …`,
  `docs: …`, `chore: …`), and the PR description explains why, not just what.

## Things to keep true

- **The browser never sends prose.** `POST /api/jev/decide` accepts only the closed-vocabulary
  structure in `src/worker/schema.ts` (enums, numbers, card codes); the Worker rebuilds the
  spirit's persona and the typed questions itself, and lets through only the library's own
  `task` / `importantContext` strings that appear in `src/worker/prose-allowlist.json`. Run
  `pnpm prose:allowlist` and commit the result if `@jev-poker/agent`'s prose changes.
- **The Worker never takes an upstream URL from the browser.** Upstreams are the fixed hosts in
  `src/worker/upstream.ts`, chosen by the operator's `JEV_ROUTE`, with every interpolated value
  matched against an anchored regex first. A new route is a new constant and a new regex, never
  a pass-through.
- **The server stores and logs nothing beyond the daily counts it needs.** No `console.*` in
  `src/worker`, and `cache-control: no-store` on every API response. The only state is the
  `JEV_BUDGET` Durable Object's per-day, per-IP call counts, wiped when the day rolls over.
- **Every request is checked in order** — session, then shape, then burst, then daily budget,
  then upstream — and production refuses to run without `TURNSTILE_SECRET` and
  `SESSION_SECRET` configured (`src/worker/api.ts`'s `guarded`).
- **The engine has no dependencies** and no knowledge of the UI or of Jev.
- **Every CPU decision fails open**: if Jev cannot be reached the CPU checks or
  folds and the history says why.

## Reporting

- Bugs and feature requests: open an issue using the templates.
- Security problems: do not open an issue; see [SECURITY.md](SECURITY.md).

## Project layout

See the "Project layout" section of the [README](README.md#project-layout). The
design spec lives in `docs/superpowers/specs/` and is updated alongside changes
that alter the design (routes, proxy rules, persistence).

## License

By contributing you agree that your contributions are licensed under the MIT
License, like the rest of the project.
