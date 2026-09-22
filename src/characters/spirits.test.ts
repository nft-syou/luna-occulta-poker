import { describe, expect, it } from "vitest";
import { CPU_SPIRIT_IDS, isSpiritId, SPIRITS, spirit, spiritById, spiritPersonas } from "./spirits";

describe("spirits", () => {
  it("seats あるじどの and the five 御霊, each once", () => {
    expect(SPIRITS.map((s) => s.id)).toEqual([
      "arujidono",
      "sakuya",
      "mami",
      "tart",
      "magoichi",
      "janome",
    ]);
    expect(new Set(SPIRITS.map((s) => s.id)).size).toBe(SPIRITS.length);
    expect(CPU_SPIRIT_IDS).toEqual(["sakuya", "mami", "tart", "magoichi", "janome"]);
  });

  it("hands Jev a persona per spirit with the same id and a variance in [0, 1]", () => {
    const personas = spiritPersonas();
    expect(personas.map((p) => p.id)).toEqual(SPIRITS.map((s) => s.id));
    for (const p of personas) {
      expect(p.variance).toBeGreaterThanOrEqual(0);
      expect(p.variance).toBeLessThanOrEqual(1);
      expect(p.description.en.length).toBeGreaterThan(40);
      expect(p.description.ja.length).toBeGreaterThan(20);
      expect(p.isPreset).toBe(true);
    }
  });

  it("keeps あるじどの silent: no lines, no video, no voice", () => {
    const a = spirit("arujidono");
    expect(a.silent).toBe(true);
    expect(a.cutin).toBeNull();
    expect(a.voice).toBeNull();
    expect(a.tell).toBe(false);
  });

  it("gives every speaking spirit a face, a standing art, cut-in art and a voice design", () => {
    for (const id of CPU_SPIRIT_IDS) {
      const s = spirit(id);
      expect(s.silent).toBe(false);
      expect(s.icon).toMatch(/^\/kitan\/icon\/.*\.webp$/);
      expect(s.canon).toMatch(/^\/kitan\/canon\/.*\.webp$/);
      expect(s.cutin).toMatch(/^\/kitan\/cutin\/.*\.webp$/);
      expect(s.voice?.caption.length).toBeGreaterThan(10);
      expect(Number.isInteger(s.voice?.seed)).toBe(true);
    }
  });

  it("only 咲耶 has a tell", () => {
    expect(SPIRITS.filter((s) => s.tell).map((s) => s.id)).toEqual(["sakuya"]);
  });

  it("looks spirits up by id", () => {
    expect(spiritById("mami")?.name.ja).toBe("マミ");
    expect(spiritById("gokou")).toBeUndefined();
    expect(isSpiritId("tart")).toBe(true);
    expect(isSpiritId("tag")).toBe(false);
    expect(() => spirit("nobody" as never)).toThrow();
  });
});
