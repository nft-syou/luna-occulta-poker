# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- The engine and agent packages and the benchmark moved out: the game now takes
  `@jev-poker/engine` and `@jev-poker/agent` from npm.

### Changed

- Sound: a quiet CC0 koto loop under the table and a few short effects (a card dealt, 勾玉 out
  and home, the cut-in's strike), with music, effects and voices each switchable mid-hand from
  a 音 dialog in the table header.
- The cut-in is staged rather than played: the felt dims, a lacquer band cuts across it and the
  official 必殺カットイン drawing bursts out with the 御霊's name and line, over in under three
  seconds. Voices default to greetings, raises, all-ins, big wins and busts.
- The game is now 宵闇の賭場, an unofficial 月蝕綺譚 -Luna Occulta- fan work: the CPUs are five
  official 御霊 (咲耶・マミ・タルト・孫市・蛇ノ目) with personalities derived from the public canon,
  their faces at the seats, spoken lines generated with Irodori-TTS from the official voice designs
  (咲耶's lines give her bluffs away), showcase cut-ins on all-ins, big pots and busts, and the whole
  UI in the official 宵闇に金 tone. The persona editor is retired; every screen carries the fan-work
  notice.

### Added

- Link previews and app icons: Open Graph / Twitter card metadata, a 1200x630 card image, SVG/ICO/PNG favicons, an Apple touch icon, a web manifest and robots.txt.
- No-Limit Texas Hold'em engine (dealing, betting rules, side pots, hand
  evaluation) with seeded random-play tests.
- CPU players that decide through TypeSafe Jev: typed questions for action,
  sizing and bluff intent, five preset personas, editable custom personas.
- Four ways to reach Jev with your own credentials: TypeSafe direct, Vercel AI
  Gateway, Lolipop AI Gateway and Cloudflare AI Gateway, through a fixed-host
  proxy that stores nothing.
- Speculative prefetching of likely CPU decisions, with a toggle and an in-flight
  cap.
- Standings, play-style and Jev statistics, kept per session and cumulatively in
  the browser.
- A recording mode for the table with decision bubbles and a live ticker.
- Chips, callouts and an action feed on the felt, timed to the chosen speed.
- One-tap bet sizing (pot fractions after the flop, bet multiples before it) and
  a phone layout for the player's controls.
- A billing pause with a modal when the upstream answers 402.
- English and Japanese UI.
- A benchmark harness against baseline bots and Slumbot, with saved results.
- The engine and the CPU as npm packages: `@jev-poker/engine` and `@jev-poker/agent` (Changesets keeps a changelog per package under `packages/` from the first release on).

[Unreleased]: https://github.com/nft-syou/jev-poker/commits/main
