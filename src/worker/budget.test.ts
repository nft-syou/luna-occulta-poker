import { describe, expect, it } from "vitest";
import { jstDay, MemoryBudget, nextJstMidnight } from "./budget";

const LIMITS = { perPlayer: 2, total: 3 };

describe("budget", () => {
  it("counts per player and in total", async () => {
    const b = new MemoryBudget();
    expect(await b.take("a", "2026-09-23", LIMITS)).toBe(true);
    expect(await b.take("a", "2026-09-23", LIMITS)).toBe(true);
    expect(await b.take("a", "2026-09-23", LIMITS)).toBe(false);
    expect(await b.take("b", "2026-09-23", LIMITS)).toBe(true);
    expect(await b.take("c", "2026-09-23", LIMITS)).toBe(false);
  });

  it("starts afresh on a new day", async () => {
    const b = new MemoryBudget();
    await b.take("a", "2026-09-23", LIMITS);
    await b.take("a", "2026-09-23", LIMITS);
    expect(await b.take("a", "2026-09-24", LIMITS)).toBe(true);
  });

  it("uses the Japanese day", () => {
    expect(jstDay(Date.UTC(2026, 8, 23, 14, 59))).toBe("2026-09-23");
    expect(jstDay(Date.UTC(2026, 8, 23, 15, 0))).toBe("2026-09-24");
    expect(nextJstMidnight(Date.UTC(2026, 8, 23, 10, 0))).toBe("2026-09-23T15:00:00.000Z");
  });
});
