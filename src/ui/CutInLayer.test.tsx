// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGate } from "../characters/gate";
import { spirit } from "../characters/spirits";
import { CUT_IN_BEAT_MS, CUT_IN_HOLD_MS, CUT_IN_LEAVE_MS, CutInLayer } from "./CutInLayer";
import type { CutIn } from "./fx";

// @testing-library/react only auto-registers its afterEach(cleanup) hook when a global
// `afterEach` exists, which this project's Vitest config does not enable (no `test.globals`).
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => vi.useFakeTimers());

const LINE = { id: "sakuya.allin.1", text: "全部だ。あたしは嘘つかない" };
const SHOVE: CutIn = { id: 3, seat: 1, kind: "allin", line: LINE, at: 100 };

/** The whole cut-in: the beat of silence, the hold, then the sweep out. */
const TOTAL_MS = CUT_IN_BEAT_MS + CUT_IN_HOLD_MS;

describe("CutInLayer", () => {
  it("stages the 御霊's cut-in art with her name and her line, once per cut-in id", () => {
    const { container, rerender } = render(<CutInLayer cutIn={SHOVE} spirit={spirit("sakuya")} />);
    const art = container.querySelector("img.cutin-art");
    expect(art?.getAttribute("src")).toBe("/kitan/cutin/sakuya.webp");
    expect(container.querySelector(".cutin-band")).not.toBeNull();
    expect(container.querySelector(".cutin-name")?.textContent).toBe("咲耶");
    expect(container.querySelector(".cutin-line")?.textContent).toBe(LINE.text);
    expect(container.querySelector(".cutin")).toHaveAttribute("aria-hidden", "true");
    // The kind colours the band, so an all-in reads differently from a pot won.
    expect(container.querySelector(".cutin")).toHaveAttribute("data-kind", "allin");

    act(() => {
      vi.advanceTimersByTime(TOTAL_MS);
    });
    expect(container.querySelector(".cutin.leaving")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(CUT_IN_LEAVE_MS);
    });
    expect(container.querySelector(".cutin")).toBeNull();

    // The same cut-in re-rendered (the state still holds it) does not come back.
    rerender(<CutInLayer cutIn={SHOVE} spirit={spirit("sakuya")} />);
    expect(container.querySelector(".cutin")).toBeNull();

    // A new one does.
    rerender(<CutInLayer cutIn={{ ...SHOVE, id: 4, kind: "bigwin" }} spirit={spirit("sakuya")} />);
    expect(container.querySelector('.cutin[data-kind="bigwin"]')).not.toBeNull();
  });

  it("falls back to her standing art when the cut-in drawing will not load", () => {
    const { container } = render(<CutInLayer cutIn={SHOVE} spirit={spirit("tart")} />);
    const art = container.querySelector("img.cutin-art");
    if (art === null) throw new Error("no art");
    expect(art.getAttribute("src")).toBe("/kitan/cutin/tart.webp");
    fireEvent.error(art);
    expect(container.querySelector("img.cutin-art")?.getAttribute("src")).toBe(
      "/kitan/canon/tart.webp",
    );
  });

  it("shows nothing for a seat without cut-in art, and nothing at all with no cut-in", () => {
    const silent = render(<CutInLayer cutIn={SHOVE} spirit={spirit("arujidono")} />);
    expect(silent.container.querySelector(".cutin")).toBeNull();
    silent.unmount();
    const none = render(<CutInLayer cutIn={null} spirit={null} />);
    expect(none.container.querySelector(".cutin")).toBeNull();
  });

  it("holds the table while it is up and lets go as it leaves", () => {
    const gate = createGate();
    render(<CutInLayer cutIn={SHOVE} spirit={spirit("mami")} gate={gate} />);
    expect(gate.busy()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(TOTAL_MS);
    });
    expect(gate.busy()).toBe(false);
  });

  it("is over in under three seconds, so the hand is not left waiting", () => {
    expect(TOTAL_MS + CUT_IN_LEAVE_MS).toBeLessThan(3200);
  });
});
