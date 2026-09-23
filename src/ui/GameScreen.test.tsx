// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { DEV_SESSION } from "../jev/gameBackend";
import { GameScreen } from "./GameScreen";
import { DEFAULT_SETTINGS, type Settings } from "./storage";

initI18n("en");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

/** A human first to act, with speculation on: the only questions asked are speculated ones. */
const HUMAN_FIRST: Settings = {
  ...DEFAULT_SETTINGS,
  speed: "max",
  prefetch: true,
  seats: [
    { name: "You", kind: "human", spiritId: "arujidono" },
    { name: "A", kind: "cpu", spiritId: "sakuya" },
    { name: "B", kind: "cpu", spiritId: "mami" },
  ],
};

/** A table seed whose first hand has the human to act first (the button, three-handed). */
const HUMAN_FIRST_SEED = 7;

describe("GameScreen", () => {
  it("halts the table when a speculated question hears the night is over", async () => {
    // The engine seeds the table from `crypto`; pin it so the same seat acts first every run.
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(<T,>(array: T): T => {
      (array as unknown as Uint32Array)[0] = HUMAN_FIRST_SEED;
      return array;
    });
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "tonight_is_over", resumesAt: "x" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <GameScreen
        settings={HUMAN_FIRST}
        language="en"
        session={DEV_SESSION}
        recording={false}
        onOpenSettings={() => {}}
        onLeave={() => {}}
      />,
    );

    await screen.findByRole("dialog", { name: "That's all for tonight" }, { timeout: 5000 });
    // The loop never asked a question of its own: it is still the human's turn...
    expect(screen.getByText("Your turn")).toBeInTheDocument();
    // ...and yet the table is halted, with the stop named in the header.
    expect(await screen.findByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getAllByText("That's all for tonight").length).toBeGreaterThan(1);
  });

  it("deals the first hand only once the opening is over, or skipped", async () => {
    // Nobody answers: all this test needs is the first deal, which asks nothing.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const { container } = render(
      <GameScreen
        settings={{ ...HUMAN_FIRST, seats: HUMAN_FIRST.seats.slice(1) }}
        language="en"
        session={DEV_SESSION}
        recording={false}
        onOpenSettings={() => {}}
        onLeave={() => {}}
      />,
    );
    expect(container.querySelector(".opening")).not.toBeNull();
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByText("Hand #1")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(container.querySelector(".opening")).toBeNull();
    expect(await screen.findByText("Hand #1", {}, { timeout: 500 })).toBeInTheDocument();
  });
});
