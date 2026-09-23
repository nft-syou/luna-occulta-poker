// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGate } from "../characters/gate";
import type { SoundPlayer } from "../characters/sound";
import { initI18n } from "../i18n";
import {
  OPENING_DOORS_AT_MS,
  OPENING_DOORS_MS,
  OPENING_GATE_KEY,
  OPENING_REDUCED_MS,
  OpeningLayer,
  openingHoldMs,
  SEAT_LIT_STAGGER_MS,
} from "./OpeningLayer";

initI18n("ja");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => vi.useFakeTimers());

function fakeSound() {
  const calls: string[] = [];
  const sound: SoundPlayer = {
    se: (id, gain) => calls.push(`se:${id}:${gain ?? 1}`),
    startBgm: () => calls.push("bgm"),
    setBgm: () => {},
    setBgmVolume: () => {},
    setSe: () => {},
    setSeVolume: () => {},
    stopAll: () => {},
  };
  return { sound, calls };
}

describe("OpeningLayer", () => {
  it("holds the table for the whole opening, then lets the first hand be dealt", () => {
    const gate = createGate();
    const onOpened = vi.fn();
    const { container } = render(
      <OpeningLayer gate={gate} seatCount={6} reducedMotion={false} onOpened={onOpened} />,
    );
    expect(gate.busy()).toBe(true);
    expect(container.querySelector(".opening")).not.toBeNull();
    expect(container.querySelector(".opening-word")?.textContent).toBe("開帳");

    act(() => {
      vi.advanceTimersByTime(OPENING_DOORS_AT_MS);
    });
    expect(container.querySelector(".opening.opening-doors")).not.toBeNull();
    expect(gate.busy()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(OPENING_DOORS_MS);
    });
    // The doors are open: the veil is gone and the seats start to light, one after another.
    expect(container.querySelector(".opening")).toBeNull();
    expect(onOpened).toHaveBeenCalledWith(false);
    expect(gate.busy()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(openingHoldMs(6) - OPENING_DOORS_AT_MS - OPENING_DOORS_MS);
    });
    expect(gate.busy()).toBe(false);
  });

  it("lasts about two and a half seconds, the seats' stagger included", () => {
    expect(openingHoldMs(6)).toBeGreaterThanOrEqual(2200);
    expect(openingHoldMs(6)).toBeLessThanOrEqual(2800);
    expect(openingHoldMs(6) - openingHoldMs(5)).toBe(SEAT_LIT_STAGGER_MS);
  });

  it("strikes one low sound at the blackout and starts the music as the doors open", () => {
    const { sound, calls } = fakeSound();
    render(<OpeningLayer sound={sound} seatCount={3} reducedMotion={false} />);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^se:cutin:0\.\d+$/);
    act(() => {
      vi.advanceTimersByTime(OPENING_DOORS_AT_MS - 1);
    });
    expect(calls).not.toContain("bgm");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(calls).toContain("bgm");
  });

  it("ends at once on a click or a key: gate released, veil gone, music on", () => {
    for (const skip of ["click", "key"] as const) {
      const gate = createGate();
      const { sound, calls } = fakeSound();
      const onOpened = vi.fn();
      const { container, unmount } = render(
        <OpeningLayer
          gate={gate}
          sound={sound}
          seatCount={6}
          reducedMotion={false}
          onOpened={onOpened}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(400);
      });
      const layer = container.querySelector(".opening");
      if (layer === null) throw new Error("no opening");
      if (skip === "click") fireEvent.click(layer);
      else fireEvent.keyDown(window, { key: "a" });
      expect(gate.busy()).toBe(false);
      expect(container.querySelector(".opening")).toBeNull();
      expect(onOpened).toHaveBeenCalledWith(true);
      expect(calls).toContain("bgm");
      // Nothing left over fires later.
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onOpened).toHaveBeenCalledTimes(1);
      expect(calls.filter((c) => c === "bgm")).toHaveLength(1);
      unmount();
    }
  });

  it("with reduced motion is only a short fade, and holds the table only for that", () => {
    const gate = createGate();
    const { sound, calls } = fakeSound();
    const onOpened = vi.fn();
    const { container } = render(
      <OpeningLayer
        gate={gate}
        sound={sound}
        seatCount={6}
        reducedMotion={true}
        onOpened={onOpened}
      />,
    );
    expect(container.querySelector(".opening.reduced")).not.toBeNull();
    expect(container.querySelector(".opening-eclipse")).toBeNull();
    expect(gate.busy()).toBe(true);
    expect(calls).toEqual(["bgm"]);
    act(() => {
      vi.advanceTimersByTime(OPENING_REDUCED_MS);
    });
    expect(OPENING_REDUCED_MS).toBe(300);
    expect(gate.busy()).toBe(false);
    expect(container.querySelector(".opening")).toBeNull();
    expect(onOpened).toHaveBeenCalledWith(true);
  });

  it("lets go of the table if it is left mid-opening", () => {
    const gate = createGate();
    const { unmount } = render(<OpeningLayer gate={gate} seatCount={6} reducedMotion={false} />);
    gate.hold("other");
    unmount();
    gate.release("other");
    expect(gate.busy()).toBe(false);
    expect(OPENING_GATE_KEY).toBe("opening");
  });
});
