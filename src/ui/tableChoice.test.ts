// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./storage";
import { DEFAULT_CHOICE, loadTableChoice, saveTableChoice, settingsFor } from "./tableChoice";

beforeEach(() => localStorage.clear());

describe("settingsFor", () => {
  it("seats あるじどの and the five 御霊 at six-max, at the chosen depth", () => {
    const s = settingsFor(
      { format: "six", rate: "shinkou", opponent: "tart" },
      "play",
      DEFAULT_SETTINGS,
    );
    expect(s.seats.map((x) => [x.spiritId, x.kind])).toEqual([
      ["arujidono", "human"],
      ["sakuya", "cpu"],
      ["mami", "cpu"],
      ["tart", "cpu"],
      ["magoichi", "cpu"],
      ["janome", "cpu"],
    ]);
    expect([s.smallBlind, s.bigBlind, s.startingStack]).toEqual([1, 2, 100]);
    expect(s.speed).toBe("normal");
    expect(s.prefetch).toBe(false);
  });

  it("seats one chosen 御霊 heads-up", () => {
    const s = settingsFor(
      { format: "hu", rate: "shoku", opponent: "janome" },
      "play",
      DEFAULT_SETTINGS,
    );
    expect(s.seats.map((x) => [x.spiritId, x.kind])).toEqual([
      ["arujidono", "human"],
      ["janome", "cpu"],
    ]);
    expect(s.startingStack).toBe(50);
  });

  it("watches six-max only, with あるじどの as a silent 御霊", () => {
    const s = settingsFor(
      { format: "hu", rate: "yoi", opponent: "mami" },
      "watch",
      DEFAULT_SETTINGS,
    );
    expect(s.seats).toHaveLength(6);
    expect(s.seats.every((x) => x.kind === "cpu")).toBe(true);
    expect(s.startingStack).toBe(200);
  });

  it("keeps the sound settings it was given", () => {
    const base = { ...DEFAULT_SETTINGS, bgm: false, voiceVolume: 0.3 };
    const s = settingsFor(DEFAULT_CHOICE, "play", base);
    expect([s.bgm, s.voiceVolume]).toEqual([false, 0.3]);
  });
});

describe("the last choice", () => {
  it("is remembered and survives a broken record", () => {
    expect(loadTableChoice()).toEqual(DEFAULT_CHOICE);
    saveTableChoice({ format: "hu", rate: "shoku", opponent: "magoichi" });
    expect(loadTableChoice()).toEqual({ format: "hu", rate: "shoku", opponent: "magoichi" });
    localStorage.setItem("jev-poker.tableChoice", '{"format":"eight"}');
    expect(loadTableChoice()).toEqual(DEFAULT_CHOICE);
  });
});
