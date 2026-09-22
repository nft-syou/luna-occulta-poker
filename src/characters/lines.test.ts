import { describe, expect, it } from "vitest";
import { allLines, audioPath, LINES, pickLine, rollFrom, SITUATIONS } from "./lines";
import { CPU_SPIRIT_IDS } from "./spirits";

describe("the script", () => {
  it("gives every speaking spirit at least two lines for every situation", () => {
    for (const spirit of CPU_SPIRIT_IDS) {
      for (const situation of SITUATIONS) {
        const plain = LINES[spirit][situation].filter((l) => l.bluff !== true);
        expect(plain.length, `${spirit}.${situation}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("names every line after its spirit and situation, uniquely", () => {
    const ids = allLines().map(({ line }) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { spirit, line } of allLines()) {
      expect(line.id).toMatch(new RegExp(`^${spirit}\\.(${SITUATIONS.join("|")})\\.\\d+$`));
      expect(line.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the bluff tell for 咲耶 alone, on bets and raises", () => {
    for (const { spirit, line } of allLines()) {
      if (line.bluff === true) {
        expect(spirit).toBe("sakuya");
        expect(line.id).toMatch(/^sakuya\.(bet|raise)\./);
      }
    }
    expect(LINES.sakuya.bet.some((l) => l.bluff === true)).toBe(true);
    expect(LINES.sakuya.raise.some((l) => l.bluff === true)).toBe(true);
  });

  it("lets a bluffing 咲耶 say only her bluff lines, and an honest one none of them", () => {
    for (const roll of [0, 0.3, 0.6, 0.999]) {
      expect(pickLine("sakuya", "raise", roll, true)?.bluff).toBe(true);
      expect(pickLine("sakuya", "raise", roll, false)?.bluff).toBeUndefined();
      expect(pickLine("sakuya", "fold", roll, true)?.bluff).toBeUndefined();
    }
  });

  it("ignores the bluff flag for everyone else", () => {
    const honest = pickLine("mami", "raise", 0.5, false);
    expect(pickLine("mami", "raise", 0.5, true)).toEqual(honest);
  });

  it("says nothing for a human seat or for あるじどの", () => {
    expect(pickLine(null, "win", 0.5)).toBeNull();
    expect(pickLine("arujidono", "win", 0.5)).toBeNull();
  });

  it("walks every candidate as the roll goes from 0 to 1", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(pickLine("tart", "fold", i / 20)?.id ?? "");
    expect(seen).toEqual(new Set(LINES.tart.fold.map((l) => l.id)));
  });

  it("puts the audio next to the spirit, named by the line id", () => {
    const line = LINES.janome.greet[0];
    if (line === undefined) throw new Error("no line");
    expect(audioPath("janome", line)).toBe("/kitan/voice/janome/janome.greet.1.mp3");
  });

  it("rolls a stable number in [0, 1) from an integer", () => {
    expect(rollFrom(7)).toBe(rollFrom(7));
    expect(rollFrom(7)).not.toBe(rollFrom(8));
    for (let n = 0; n < 1000; n++) {
      const r = rollFrom(n);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });
});
