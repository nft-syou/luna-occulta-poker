import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGate, GATE_MAX_MS } from "./gate";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createGate", () => {
  it("lets the loop through at once when nothing is held", async () => {
    const gate = createGate();
    expect(gate.busy()).toBe(false);
    await expect(gate.wait()).resolves.toBeUndefined();
  });

  it("holds the loop until every key is released", async () => {
    const gate = createGate();
    gate.hold("voice:a");
    gate.hold("cutin");
    let through = false;
    void gate.wait().then(() => {
      through = true;
    });
    await Promise.resolve();
    expect(through).toBe(false);
    gate.release("voice:a");
    await Promise.resolve();
    expect(through).toBe(false);
    gate.release("cutin");
    await Promise.resolve();
    expect(through).toBe(true);
    expect(gate.busy()).toBe(false);
  });

  it("lets a hold go by itself after its ceiling, capped at the gate's own", async () => {
    const gate = createGate();
    gate.hold("stuck", 2000);
    gate.hold("forever", 60_000);
    vi.advanceTimersByTime(2000);
    expect(gate.busy()).toBe(true);
    vi.advanceTimersByTime(GATE_MAX_MS - 2000);
    expect(gate.busy()).toBe(false);
    await expect(gate.wait()).resolves.toBeUndefined();
  });

  it("restarts the ceiling when a key is held again", () => {
    const gate = createGate();
    gate.hold("k", 1000);
    vi.advanceTimersByTime(800);
    gate.hold("k", 1000);
    vi.advanceTimersByTime(800);
    expect(gate.busy()).toBe(true);
    vi.advanceTimersByTime(200);
    expect(gate.busy()).toBe(false);
  });

  it("ignores a release of a key it does not hold", () => {
    const gate = createGate();
    expect(() => gate.release("nobody")).not.toThrow();
  });
});
