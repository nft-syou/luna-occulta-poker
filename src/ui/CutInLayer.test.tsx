// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spirit } from "../characters/spirits";
import { CUT_IN_HOLD_MS, CUT_IN_LEAVE_MS, CutInLayer } from "./CutInLayer";
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

describe("CutInLayer", () => {
  it("plays the 御霊's showcase video with her line, once per cut-in id", () => {
    const { container, rerender } = render(<CutInLayer cutIn={SHOVE} spirit={spirit("sakuya")} />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("/kitan/showcase/sakuya.mp4");
    expect(video).toHaveAttribute("playsinline");
    expect(container.querySelector(".cutin-line")?.textContent).toBe(LINE.text);
    expect(container.querySelector(".cutin-name")?.textContent).toBe("咲耶");
    expect(container.querySelector(".cutin")).toHaveAttribute("aria-hidden", "true");

    // The video ends: the panel fades, then goes.
    if (video === null) throw new Error("no video");
    fireEvent(video, new Event("ended"));
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
    expect(container.querySelector(".cutin-panel.cutin-bigwin")).not.toBeNull();
  });

  it("takes itself down after the hold when the video never ends", () => {
    const { container } = render(<CutInLayer cutIn={SHOVE} spirit={spirit("mami")} />);
    expect(container.querySelector(".cutin")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(CUT_IN_HOLD_MS);
    });
    expect(container.querySelector(".cutin.leaving")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(CUT_IN_LEAVE_MS);
    });
    expect(container.querySelector(".cutin")).toBeNull();
  });

  it("shows the standing art instead of the video under reduced motion", () => {
    const { container } = render(
      <CutInLayer cutIn={SHOVE} spirit={spirit("tart")} reducedMotion={true} />,
    );
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img.cutin-still")?.getAttribute("src")).toBe(
      "/kitan/canon/tart.webp",
    );
  });

  it("shows nothing for a seat without a video, and nothing at all with no cut-in", () => {
    const silent = render(<CutInLayer cutIn={SHOVE} spirit={spirit("arujidono")} />);
    expect(silent.container.querySelector(".cutin")).toBeNull();
    silent.unmount();
    const none = render(<CutInLayer cutIn={null} spirit={null} />);
    expect(none.container.querySelector(".cutin")).toBeNull();
  });
});
