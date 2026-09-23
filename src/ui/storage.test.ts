// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_STATS, type PlayerStats } from "./stats";
import {
  clearCumulativeStats,
  DEFAULT_SEATS,
  DEFAULT_SETTINGS,
  forgetOldCredentials,
  loadCumulativeStats,
  loadSettings,
  SETTINGS_STORAGE_KEY,
  STATS_STORAGE_KEY,
  saveCumulativeStats,
  saveSettings,
  validateSettings,
} from "./storage";

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("forgets the keys older versions stored, and nothing else", () => {
    localStorage.setItem(
      "jev-poker.connection",
      JSON.stringify({ route: "typesafe", apiKey: "sk-1" }),
    );
    localStorage.setItem("jev-poker.apiKey", "sk-old");
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{}");
    forgetOldCredentials();
    expect(localStorage.getItem("jev-poker.connection")).toBeNull();
    expect(localStorage.getItem("jev-poker.apiKey")).toBeNull();
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe("{}");
  });

  it("returns defaults for missing or broken settings", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{bad");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ seats: "nope", bigBlind: 4 }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, bigBlind: 4 });
  });

  it("falls back to defaults for an invalid prefetch or prefetchMaxInFlight", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ prefetch: "nope", prefetchMaxInFlight: 5 }),
    );
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ prefetch: false, prefetchMaxInFlight: 8 }),
    );
    expect(loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      prefetch: false,
      prefetchMaxInFlight: 8,
    });
  });

  it("reads settings an older version saved with a model, and drops the model", () => {
    // The Worker picks the model now; a BYOK-era choice must neither break loading nor linger.
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ model: "jev-custom", speed: "max" }),
    );
    const settings = loadSettings();
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, speed: "max" });
    expect(settings).not.toHaveProperty("model");
  });

  it("round-trips settings", () => {
    const settings = { ...DEFAULT_SETTINGS, speed: "max" as const, startingStack: 500 };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it("validates blinds and stack", () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toBeNull();
    expect(validateSettings({ ...DEFAULT_SETTINGS, smallBlind: 5, bigBlind: 2 })).toBe(
      "invalidBlinds",
    );
    expect(validateSettings({ ...DEFAULT_SETTINGS, smallBlind: 0 })).toBe("invalidBlinds");
    expect(validateSettings({ ...DEFAULT_SETTINGS, startingStack: 15 })).toBe("invalidStack");
    expect(validateSettings({ ...DEFAULT_SETTINGS, startingStack: 10.5 })).toBe("invalidStack");
  });

  it("round-trips cumulative stats", () => {
    expect(loadCumulativeStats()).toEqual({});
    const stats: PlayerStats = { ...EMPTY_STATS, handsPlayed: 4, handsWon: 1, netChips: -12 };
    saveCumulativeStats({ "persona:rock": stats, "human:You": EMPTY_STATS });
    expect(loadCumulativeStats()).toEqual({ "persona:rock": stats, "human:You": EMPTY_STATS });
    clearCumulativeStats();
    expect(loadCumulativeStats()).toEqual({});
  });

  it("tolerates broken or partial cumulative stats", () => {
    localStorage.setItem(STATS_STORAGE_KEY, "{bad");
    expect(loadCumulativeStats()).toEqual({});
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify([1, 2]));
    expect(loadCumulativeStats()).toEqual({});
    // Fields added after an old record was written fall back to zero.
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ "persona:rock": { handsPlayed: 3, netChips: "nope" }, bogus: 7 }),
    );
    expect(loadCumulativeStats()).toEqual({ "persona:rock": { ...EMPTY_STATS, handsPlayed: 3 } });
  });
});

describe("spirit seats", () => {
  beforeEach(() => localStorage.clear());

  it("drops a seat list written before the 御霊 (personaId) and seats the defaults", () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        seats: [
          { name: "You", kind: "human", personaId: "tag" },
          { name: "Rocky", kind: "cpu", personaId: "rock" },
        ],
        bigBlind: 4,
      }),
    );
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, bigBlind: 4 });
  });

  it("keeps a seat list of known spirits and rejects an unknown one", () => {
    const seats = [
      { name: "me", kind: "human", spiritId: "arujidono" },
      { name: "", kind: "cpu", spiritId: "janome" },
    ];
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ seats }));
    expect(loadSettings().seats).toEqual(seats);
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ seats: [seats[0], { name: "", kind: "cpu", spiritId: "gokou" }] }),
    );
    expect(loadSettings().seats).toEqual(DEFAULT_SEATS);
  });

  it("refuses the same spirit in two chairs", () => {
    const seats = DEFAULT_SETTINGS.seats.map((s, i) =>
      i === 3 ? { ...s, spiritId: "mami" as const } : s,
    );
    expect(validateSettings({ ...DEFAULT_SETTINGS, seats })).toBe("duplicateSpirit");
    expect(validateSettings(DEFAULT_SETTINGS)).toBeNull();
  });

  it("reads the voice switch and clamps the volume", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ voice: false, voiceVolume: 3 }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, voice: false, voiceVolume: 1 });
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ voice: "loud", voiceVolume: -1 }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, voiceVolume: 0 });
    saveSettings({ ...DEFAULT_SETTINGS, voiceVolume: 0.25 });
    expect(loadSettings().voiceVolume).toBe(0.25);
  });
});
