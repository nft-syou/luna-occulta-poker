# 宵闇の賭場 (Luna Occulta fanwork) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn jev-poker into 「宵闇の賭場」, an unofficial 月蝕綺譚 fan poker: the CPUs are five official 御霊 with official-derived personalities, faces at the seats, cut-in videos on big moments, spoken lines generated with Irodori-TTS, and the whole UI in the official 「宵闇に金」 tone.

**Architecture:** A new app-level module `src/characters/` holds the typed spirit data (`spirits.ts`), the script (`lines.ts`) and the voice player (`voice.ts`). Seats select a `spiritId`; the spirit's `persona` is handed to the unchanged `@jev-poker/agent`. The effects reducer (`fx.ts`) attaches a spoken line to each callout, and a new `CutInLayer` fires on all-ins, big pots and busts. The theme is a token-level rewrite of `styles.css` plus the Japanese dictionary.

**Tech Stack:** React 19, TypeScript strict, Vite, Vitest + jsdom, react-i18next, Biome; `sharp` (dev) for asset resizing; Irodori-TTS (Python/uv, CUDA) + ffmpeg for voice generation.

**Spec:** `docs/superpowers/specs/2026-09-22-luna-occulta-fanwork-design.md`

## Global Constraints

- `@jev-poker/engine` and `@jev-poker/agent` are not modified. Only the app (`src/`, `public/`, `scripts/`, `index.html`) changes.
- Palette tokens exactly as the spec §6.1: `--kitan-yoiyami #131320`, `--kitan-yoiyami-hi #1B1B2E`, `--kitan-kindei #D9A94C`, `--kitan-kindei-hi #F0CE7E`, `--kitan-shokko #C93A2E`, `--kitan-geppaku #E8E4D8`, `--kitan-anshi #5C4470`, `--kitan-panel #100E1C`, `--kitan-bubble #181626`, `--kitan-sublabel #9D93B5`; radii 4/5/10px; no font-size under 11px; no glowing rings; red area ≤ 5%.
- Fonts: Shippori Mincho B1 (500/700/800) for text, M PLUS Rounded 1c (800) for numbers, from Google Fonts.
- Spirit ids: `arujidono | sakuya | mami | tart | magoichi | janome`. `arujidono` is `silent` (no lines, voice or cut-in).
- Line ids are `<spirit>.<situation>.<n>`; audio lives at `/kitan/voice/<spirit>/<id>.mp3`.
- Cut-in triggers: CPU all-in declaration, CPU pot award ≥ 40 BB, CPU bust. One at a time; later triggers while one plays are dropped.
- Every screen states the game is an unofficial fanwork and links `https://vibe.co.jp/luna-occulta/fanworks`.
- `pnpm check` green at the end of every task. Commit messages: Conventional Commits, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Existing tests are updated, not deleted, except `PersonaEditor.test.tsx` which goes with its component.

---

## Phase 1 — Theme

### Task 1: Tokens, fonts, chrome, words

**Files:**
- Modify: `src/ui/styles.css` (`:root`, `.app`, `.topbar`, buttons/inputs, `.modal`, `.felt`, `.seat`, `.card`, `.chip*`, `.callout*`, `.winner-glow`, `.history`, `.stats`, `.showcase-*`, `.action-feed`)
- Modify: `index.html` (fonts `<link>`, title, description, OG, theme-color `#131320`), `public/site.webmanifest`, `src/i18n/locales/ja.json`, `src/i18n/locales/en.json`, `src/ui/App.tsx` (subtitle, footer), `src/site-metadata.test.ts`, `src/ui/App.test.tsx`, `src/ui/styles.test.ts`
- Create: `public/favicon.svg` (gold 式札 silhouette; replace), regenerate `favicon.ico`, `icon-192/512.png`, `apple-touch-icon.png` from it (sharp)

**Interfaces:**
- Produces: CSS custom properties `--kitan-*`; class `.kitan-button` semantics on `button` (primary) and `button.secondary`; `.habutae` for panels/modals; `.footer` in `App.tsx` with `t("app.fanworkNotice")` and links.
- Dictionary keys added: `app.fanworkNotice`, `app.fanworksLink`, `app.guidelineLink`, `app.hashtag`; renamed copy per spec §6.3 (`setup.human` → あるじどの, `setup.cpu` → 御霊, `setup.start` → 開帳, `setup.spectate` → 見物する, `table.leave` → 席を立つ, `table.hand` → 第{{number}}局, `table.pot` → 勾玉 …).

- [ ] Write `styles.test.ts` assertions: `:root` declares every `--kitan-*` token; no `#0f1a14`/`#2e8b57` (old greens) remain; no `font-size` below 11px.
- [ ] Rewrite `:root`, body background, typography, buttons (KitanButton), inputs, modal (羽二重), felt (lacquer ellipse + gold rim), seats, cards (月白 face, lacquer back), chips (gold outline tiers), callouts, winner glow (gold spill), feeds, panels, showcase overlays.
- [ ] Update `ja.json`/`en.json` words; add footer keys; update `App.tsx` header/footer; update `App.test.tsx`.
- [ ] Update `index.html` + manifest + `site-metadata.test.ts` (title `宵闇の賭場`, description mentions 非公式二次創作, theme-color `#131320`).
- [ ] New favicon set.
- [ ] `pnpm check`; commit `feat(theme): 宵闇に金 tokens, fonts, lacquer felt and world vocabulary`.

## Phase 2 — Spirits

### Task 2: Spirit data and asset intake

**Files:**
- Create: `src/characters/spirits.ts`, `src/characters/spirits.test.ts`, `scripts/kitan-assets.json`, `scripts/fetch-kitan-assets.mjs`, `public/kitan/{icon,canon,showcase}/*`, `public/kitan/README.md`
- Modify: `package.json` (`assets:kitan` script, `sharp` devDependency)

**Interfaces (produces):**
```ts
export type SpiritId = "arujidono" | "sakuya" | "mami" | "tart" | "magoichi" | "janome";
export interface Spirit { id; name; kana; tagline; copy; persona: Persona; silent; tell; icon; canon; showcase: string|null; voice: {caption; seed}|null }
export const SPIRITS: readonly Spirit[];           // arujidono first
export const CPU_SPIRIT_IDS: readonly SpiritId[];  // the five with lines
export function spiritById(id: string): Spirit | undefined;
export function spiritPersonas(): Persona[];
```

- [ ] Tests: 6 spirits, unique ids, personas' variance in [0,1], `arujidono.silent && showcase === null && voice === null`, every non-silent spirit has icon/canon/showcase paths under `/kitan/`.
- [ ] Write `spirits.ts` with the official-derived persona texts (spec §3.2) and Irodori caption/seed from kitan-lore.
- [ ] Asset ledger + fetch script (sharp: icons → 256px webp; canon/showcase copied); run it; commit outputs with `public/kitan/README.md` stating source and 掟.
- [ ] `pnpm check`; commit `feat(characters): spirit data and official asset intake`.

### Task 3: Seats pick spirits

**Files:**
- Modify: `src/ui/storage.ts` (+tests), `src/ui/useGame.ts` (+tests), `src/ui/Setup.tsx` (+tests), `src/ui/App.tsx` (+tests), `src/ui/GameScreen.tsx`, `src/ui/SeatView.tsx` (+tests), `src/ui/TableView.tsx` (+tests), `src/ui/StatsPanel.tsx`, `src/ui/stats.ts`, `src/i18n/locales/*.json`
- Delete: `src/ui/PersonaEditor.tsx`, `src/ui/PersonaEditor.test.tsx`

**Interfaces:**
- `SeatSetting = { name: string; kind: SeatKind; spiritId: SpiritId }`; `Settings.voice: boolean`, `Settings.voiceVolume: number`.
- `validateSettings` returns `"invalidBlinds" | "invalidStack" | "duplicateSpirit" | null`.
- `GameSeat` gains `spiritId: SpiritId`. `TableView` prop `personaNames` stays (fed from spirit names).
- `SeatView` props gain `spirit: Spirit` and render `<img class="seat-face" src={spirit.icon}>` + `.seat-tagline`.

- [ ] storage tests: legacy `personaId` seats → defaults; duplicate spirit → `duplicateSpirit`; `voice`/`voiceVolume` defaults and clamping.
- [ ] useGame: `toConfig` maps `spiritId` → engine `personaId`; `personaFor` looks up `spiritPersonas()`; stats key `persona:<spiritId>`.
- [ ] Setup: spirit `<select>` per CPU seat with face preview, name input only for human seats, remove persona editor button, add voice fields.
- [ ] SeatView face frame + tagline; TableView passes `spirit`.
- [ ] Remove PersonaEditor and `personas` screen from App; App no longer calls `loadPersonas`.
- [ ] `pnpm check`; commit `feat(characters): seats are 御霊; faces at the table; persona editor removed`.

## Phase 3 — Lines and cut-ins

### Task 4: Script and speech bubbles

**Files:**
- Create: `src/characters/lines.ts`, `src/characters/lines.test.ts`, `src/ui/SpeechView.tsx` (replaces `CalloutView.tsx`)
- Modify: `src/ui/fx.ts` (+tests), `src/ui/useGame.ts` (reduceFx call passes seat spirit + bluff + rng), `src/ui/SeatView.tsx`, `src/ui/styles.css`

**Interfaces:**
```ts
export type Situation = "greet"|"fold"|"check"|"call"|"bet"|"raise"|"allin"|"win"|"bigwin"|"lose"|"bust";
export interface SpeechLine { id: string; text: string; tts?: string; bluff?: boolean }
export const LINES: Record<CpuSpiritId, Record<Situation, readonly SpeechLine[]>>;
export function pickLine(spirit: SpiritId, situation: Situation, rng: () => number, bluff?: boolean): SpeechLine | null;
export function audioPath(spirit: SpiritId, line: SpeechLine): string;
// fx.ts
export interface Callout { …; line: SpeechLine | null }
export interface FxContext { spiritOf: (seat: SeatId) => SpiritId | null; bluffOf: (seat: SeatId) => boolean; rng: () => number }
export function reduceFx(fx: TableFx, event: GameEvent, at: number, ctx?: FxContext): TableFx;
```
- `TableFx` gains `speech: readonly Speech[]` for lines that are not tied to an action (win/bigwin/lose/bust/greet): `{ id, seat, line, at }`.

- [ ] lines tests: every CPU spirit × situation has ≥ 2 lines; ids unique and match `<spirit>.<situation>.<n>`; `pickLine("sakuya","raise",rng,true)` returns only `bluff: true` lines and `false` never does; `pickLine("arujidono",…)` is null.
- [ ] Write the script (Japanese, per official voice), review with the user.
- [ ] fx tests: ActionTaken attaches `line` for CPU spirits, null for human/silent; PotAwarded pushes `win` (or `bigwin` ≥ 40 BB) speech for CPU winners and `lose` for CPU showdown losers; HandEnded with stack 0 pushes `bust`.
- [ ] `SpeechView`: 羽二重 bubble with `line.text` + action label; falls back to label only.
- [ ] `pnpm check`; commit `feat(characters): the 御霊 speak — script, speech bubbles and fx lines`.

### Task 5: Cut-in layer

**Files:**
- Create: `src/ui/CutInLayer.tsx`, `src/ui/CutInLayer.test.tsx`
- Modify: `src/ui/fx.ts` (`TableFx.cutIn: CutIn | null`, `{ id, seat, kind: "allin"|"bigwin"|"bust", line, at }`), `src/ui/TableView.tsx`, `src/ui/styles.css`

- [ ] fx tests: all-in/bigwin/bust set `cutIn` only when none is active (`cutIn.at + CUT_IN_MS > at` means active); silent/human never.
- [ ] `CutInLayer` renders `<video muted playsInline autoPlay>` of `spirit.showcase`, or `<img>` under reduced motion, plus the line; calls `onDone` on `ended` or after 5 s; 280ms fade.
- [ ] TableView mounts it inside `.felt`; preloads videos on mount.
- [ ] `pnpm check`; commit `feat(ui): cut-in videos on all-ins, big pots and busts`.

## Phase 4 — Voice

### Task 6: Irodori-TTS generation

**Files:**
- Create: `scripts/voice/README.md`, `scripts/voice/pyproject.toml`, `scripts/voice/generate.py`, `scripts/voice/export-lines.ts`, `public/kitan/voice/**`
- Modify: `package.json` (`voice:lines`, `voice:generate`), `.gitignore` (`scripts/voice/.venv`, `scripts/voice/out/`)

- [ ] `export-lines.ts` dumps `{ id, spirit, text: tts ?? text, caption, seed }[]` to `scripts/voice/lines.json`.
- [ ] `generate.py`: `InferenceRuntime` from `irodori_tts`, one synth per line with `--no-ref`, `caption`, `seed`; skip existing; ffmpeg → mono 64 kbps mp3 with loudnorm.
- [ ] Try `Aratako/Irodori-TTS-500M-v2-VoiceDesign` against the official sample; record the chosen model in README.
- [ ] Generate all lines; commit `feat(voice): Irodori-TTS clips for the five 御霊`.

### Task 7: Voice player

**Files:**
- Create: `src/characters/voice.ts`, `src/characters/voice.test.ts`, `src/characters/voice-files.test.ts`
- Modify: `src/ui/TableView.tsx` (play on new callout line / speech / cut-in), `src/ui/App.tsx` (unlock on start), `src/ui/Setup.tsx` (voice toggle + volume already added in Task 3)

**Interfaces:**
```ts
export interface VoicePlayer { play(spirit: SpiritId, line: SpeechLine, opts?: { priority?: boolean }): void; preload(paths: string[]): void; setEnabled(on: boolean): void; setVolume(v: number): void; unlock(): void }
export function createVoicePlayer(init: { enabled: boolean; volume: number; audio?: (src: string) => HTMLAudioElement }): VoicePlayer;
```
- [ ] Tests with a fake `Audio`: correct src; `priority` pauses others; disabled → no play; errors swallowed.
- [ ] `voice-files.test.ts`: every line id has its mp3.
- [ ] Wire into TableView (`useEffect` on `fx.callouts`/`fx.speech`/`fx.cutIn` ids) and greet on table mount (600 ms apart).
- [ ] `pnpm check`; commit `feat(voice): the 御霊 speak aloud`.

## Phase 5 — Finish

### Task 8: OG image, README, changelog

- [ ] Screenshot the table (agent-browser, 1200×630) → `public/og.png`.
- [ ] README.ja.md / README.md: fanwork notice, roster, asset sources and 掟, voice generation steps.
- [ ] `CHANGELOG.md` entry. `pnpm check`; commit `docs: 宵闇の賭場 README, OG card`.
