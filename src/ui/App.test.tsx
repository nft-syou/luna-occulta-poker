// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type Settings } from "./storage";

// `App.tsx` picks its language at import time; pin English before that happens so the
// queries below can use the English strings.
initI18n("en");

// @testing-library/react only auto-registers its afterEach(cleanup) hook when a global
// `afterEach` exists, which this project's Vitest config does not enable (no `test.globals`).
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const CPU_ONLY: Settings = {
  ...DEFAULT_SETTINGS,
  speed: "max",
  seats: [
    { name: "A", kind: "cpu", spiritId: "sakuya" },
    { name: "B", kind: "cpu", spiritId: "mami" },
    { name: "C", kind: "cpu", spiritId: "tart" },
  ],
};

/**
 * A decide answer that is legal whatever the table offers: `decideAction` keeps only the
 * probabilities whose label was offered, and `check_or_call` always is.
 */
const ANSWER = {
  model: "jev-latest",
  action: {
    choice: "check_or_call",
    probabilities: { fold: 0.05, check_or_call: 0.9, bet_or_raise: 0.05 },
  },
  sizing: { score: 1 },
  bluff_intent: { noul: 0.1 },
};

function stubJevFetch(): ReturnType<typeof vi.fn> {
  const mock = vi.fn(
    async () =>
      new Response(JSON.stringify(ANSWER), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("App", () => {
  // The features of every decision (and of every speculated one) now include a Monte Carlo
  // equity and an exact hand-strength enumeration, 15-30 ms each: alongside the other test
  // files this no longer fits the default 5 s.
  it("goes from setup to a spectated table with Jev decisions and back", {
    timeout: 20_000,
  }, async () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(CPU_ONLY));
    const fetchMock = stubJevFetch();

    const { App } = await import("./App");
    render(<App />);

    expect(screen.getByRole("heading", { name: "New table" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Watch the CPUs play" }));

    expect(screen.getByText("Spectator mode")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hand history" })).toBeInTheDocument();

    // Every CPU action carries the Jev decision the history panel expands.
    await waitFor(() => expect(screen.getAllByText("Jev").length).toBeGreaterThan(0), {
      timeout: 15_000,
    });
    // The decisions came from the Worker's decide endpoint, not from the fail-open fallback.
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/jev/decide");
    expect(screen.queryByText("Fallback: Jev was unavailable")).not.toBeInTheDocument();

    // The wide layout keeps the felt up and swaps the side column between the two panels.
    // jsdom has no `matchMedia`, so `TableView` treats it as a wide screen.
    fireEvent.click(screen.getByRole("button", { name: "Stats" }));
    expect(screen.getByRole("heading", { name: "Standings" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hand history" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "This session" })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(screen.getByRole("heading", { name: "Hand history" })).toBeInTheDocument();

    // Spectator speed control: the table header changes the persisted setting live.
    fireEvent.change(screen.getByLabelText("Speed"), { target: { value: "slow" } });
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}") as Settings;
      expect(stored.speed).toBe("slow");
    });

    fireEvent.click(screen.getByRole("button", { name: "Leave table" }));
    expect(screen.getByRole("heading", { name: "New table" })).toBeInTheDocument();
  });
});
