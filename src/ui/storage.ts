import type { SeatKind } from "@jev-poker/engine";
import { SITUATIONS, type Situation } from "../characters/lines";
import { isSpiritId, type SpiritId } from "../characters/spirits";
import { LANGUAGE_STORAGE_KEY, type Language } from "../i18n";
import { EMPTY_STATS, type PlayerStats, type StatsKey } from "./stats";

/**
 * Where versions that asked players for their own key kept it: a connection record, and
 * before that a bare TypeSafe key. The key is the operator's now; these are only ever removed.
 */
const OLD_CREDENTIAL_KEYS = ["jev-poker.connection", "jev-poker.apiKey"] as const;
export const SETTINGS_STORAGE_KEY = "jev-poker.settings";
export const STATS_STORAGE_KEY = "jev-poker.stats";

export type Speed = "slow" | "normal" | "fast" | "max";
export const SPEEDS: readonly Speed[] = ["slow", "normal", "fast", "max"];

/** Allowed caps for `Settings.prefetchMaxInFlight`. */
export const PREFETCH_MAX_IN_FLIGHT_OPTIONS: readonly number[] = [2, 4, 6, 8];

export interface SeatSetting {
  /** Shown for a human seat; a 御霊's seat is named after the 御霊. */
  name: string;
  kind: SeatKind;
  spiritId: SpiritId;
}

export interface Settings {
  seats: SeatSetting[];
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  speed: Speed;
  /** Whether CPU turns are speculatively prefetched ahead of the acting seat's turn. */
  prefetch: boolean;
  /** Cap on concurrent speculative Jev requests; one of `PREFETCH_MAX_IN_FLIGHT_OPTIONS`. */
  prefetchMaxInFlight: number;
  /** Whether the 御霊 speak their lines aloud. */
  voice: boolean;
  /** Voice volume, 0–1. */
  voiceVolume: number;
  /** Which situations are spoken; a line for a situation switched off is shown, not said. */
  voiceSituations: VoiceSituations;
  /**
   * Whether the 御霊 still speak in a hand the player has folded (or was not dealt into).
   * Off by default: once out, the player is waiting, and the lines are shown, not said.
   */
  voiceWhenOut: boolean;
  /** Whether the quiet loop plays under the table. */
  bgm: boolean;
  /** Music volume, 0–1. */
  bgmVolume: number;
  /** Whether the table's own sounds play (cards, 勾玉, the cut-in). */
  se: boolean;
  /** Effects volume, 0–1. */
  seVolume: number;
}

export type VoiceSituations = Record<Situation, boolean>;

export const ALL_SITUATIONS_ON: VoiceSituations = Object.fromEntries(
  SITUATIONS.map((s) => [s, true]),
) as VoiceSituations;

/**
 * What the 御霊 say out loud before anyone changes it: the moments worth hearing — sitting
 * down, a raise, a shove, a pot worth the words, a stack gone. Folds, checks and calls
 * happen several times a hand; spoken every time they wear out their welcome, so their
 * lines are shown in the bubble and left unsaid until the player asks for them.
 */
export const DEFAULT_VOICE_SITUATIONS: VoiceSituations = Object.fromEntries(
  SITUATIONS.map((s) => [
    s,
    s === "greet" || s === "raise" || s === "allin" || s === "bigwin" || s === "bust",
  ]),
) as VoiceSituations;

export const DEFAULT_SEATS: readonly SeatSetting[] = [
  { name: "あるじどの", kind: "human", spiritId: "arujidono" },
  { name: "咲耶", kind: "cpu", spiritId: "sakuya" },
  { name: "マミ", kind: "cpu", spiritId: "mami" },
  { name: "タルト", kind: "cpu", spiritId: "tart" },
  { name: "孫市", kind: "cpu", spiritId: "magoichi" },
  { name: "蛇ノ目", kind: "cpu", spiritId: "janome" },
];

export const DEFAULT_SETTINGS: Settings = {
  seats: [...DEFAULT_SEATS],
  startingStack: 200,
  smallBlind: 1,
  bigBlind: 2,
  speed: "normal",
  prefetch: true,
  prefetchMaxInFlight: 6,
  voice: true,
  voiceVolume: 0.8,
  voiceSituations: DEFAULT_VOICE_SITUATIONS,
  voiceWhenOut: false,
  bgm: true,
  // Under the table, not on it: the loop should sit well below the voices and the felt.
  bgmVolume: 0.12,
  se: true,
  seVolume: 0.55,
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the app keeps working for this session only.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Removes any key an older version stored, so no player's secret lingers in this browser. */
export function forgetOldCredentials(): void {
  for (const key of OLD_CREDENTIAL_KEYS) remove(key);
}

export function loadSettings(): Settings {
  const raw = read(SETTINGS_STORAGE_KEY);
  if (raw === null) return { ...DEFAULT_SETTINGS, seats: [...DEFAULT_SEATS] };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    return {
      seats: isSeatArray(parsed.seats) ? parsed.seats : [...DEFAULT_SEATS],
      startingStack: numberOr(parsed.startingStack, DEFAULT_SETTINGS.startingStack),
      smallBlind: numberOr(parsed.smallBlind, DEFAULT_SETTINGS.smallBlind),
      bigBlind: numberOr(parsed.bigBlind, DEFAULT_SETTINGS.bigBlind),
      speed: isSpeed(parsed.speed) ? parsed.speed : DEFAULT_SETTINGS.speed,
      prefetch: typeof parsed.prefetch === "boolean" ? parsed.prefetch : DEFAULT_SETTINGS.prefetch,
      prefetchMaxInFlight: isPrefetchMaxInFlight(parsed.prefetchMaxInFlight)
        ? parsed.prefetchMaxInFlight
        : DEFAULT_SETTINGS.prefetchMaxInFlight,
      voice: typeof parsed.voice === "boolean" ? parsed.voice : DEFAULT_SETTINGS.voice,
      voiceVolume: clampVolume(numberOr(parsed.voiceVolume, DEFAULT_SETTINGS.voiceVolume)),
      voiceSituations: readSituations(parsed.voiceSituations),
      voiceWhenOut:
        typeof parsed.voiceWhenOut === "boolean"
          ? parsed.voiceWhenOut
          : DEFAULT_SETTINGS.voiceWhenOut,
      bgm: typeof parsed.bgm === "boolean" ? parsed.bgm : DEFAULT_SETTINGS.bgm,
      bgmVolume: clampVolume(numberOr(parsed.bgmVolume, DEFAULT_SETTINGS.bgmVolume)),
      se: typeof parsed.se === "boolean" ? parsed.se : DEFAULT_SETTINGS.se,
      seVolume: clampVolume(numberOr(parsed.seVolume, DEFAULT_SETTINGS.seVolume)),
    };
  } catch {
    return { ...DEFAULT_SETTINGS, seats: [...DEFAULT_SEATS] };
  }
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Cumulative stats survive reloads, so they must survive a record written by an older
 * version too: anything unreadable degrades to zeroes instead of throwing at the table.
 */
export function loadCumulativeStats(): Record<StatsKey, PlayerStats> {
  const raw = read(STATS_STORAGE_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const result: Record<StatsKey, PlayerStats> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const fields = value as Partial<Record<keyof PlayerStats, unknown>>;
      const stats = { ...EMPTY_STATS };
      for (const field of Object.keys(EMPTY_STATS) as (keyof PlayerStats)[]) {
        stats[field] = numberOr(fields[field], 0);
      }
      result[key] = stats;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveCumulativeStats(record: Record<StatsKey, PlayerStats>): void {
  write(STATS_STORAGE_KEY, JSON.stringify(record));
}

export function clearCumulativeStats(): void {
  remove(STATS_STORAGE_KEY);
}

export function loadLanguage(): string | null {
  return read(LANGUAGE_STORAGE_KEY);
}

export function saveLanguage(language: Language): void {
  write(LANGUAGE_STORAGE_KEY, language);
}

export type SettingsProblem = "invalidBlinds" | "invalidStack" | "duplicateSpirit";

export function validateSettings(settings: Settings): SettingsProblem | null {
  const { smallBlind, bigBlind, startingStack, seats } = settings;
  if (!Number.isInteger(bigBlind) || bigBlind <= 0) return "invalidBlinds";
  if (!Number.isInteger(smallBlind) || smallBlind <= 0 || smallBlind > bigBlind)
    return "invalidBlinds";
  if (!Number.isInteger(startingStack) || startingStack < bigBlind * 10) return "invalidStack";
  // One 式札 per 御霊: the same spirit cannot sit in two chairs.
  if (new Set(seats.map((s) => s.spiritId)).size !== seats.length) return "duplicateSpirit";
  return null;
}

/** A stored switch map, with any situation it does not name left at its default. */
function readSituations(value: unknown): VoiceSituations {
  const out = { ...DEFAULT_VOICE_SITUATIONS };
  if (typeof value !== "object" || value === null) return out;
  for (const situation of SITUATIONS) {
    const v = (value as Record<string, unknown>)[situation];
    if (typeof v === "boolean") out[situation] = v;
  }
  return out;
}

export function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isSpeed(value: unknown): value is Speed {
  return typeof value === "string" && (SPEEDS as readonly string[]).includes(value);
}

function isPrefetchMaxInFlight(value: unknown): value is number {
  return typeof value === "number" && PREFETCH_MAX_IN_FLIGHT_OPTIONS.includes(value);
}

function isSeatArray(value: unknown): value is SeatSetting[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 6 &&
    value.every(
      (s: Partial<SeatSetting>) =>
        typeof s.name === "string" &&
        (s.kind === "human" || s.kind === "cpu") &&
        // A record from before the 御霊 (a `personaId`) has no `spiritId` and falls back whole.
        isSpiritId(s.spiritId),
    )
  );
}
