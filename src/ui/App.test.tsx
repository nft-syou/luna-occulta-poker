// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";

// `App.tsx` picks its language at import time; pin English before that happens so the
// queries below can use the English strings.
initI18n("en");

// @testing-library/react only auto-registers its afterEach(cleanup) hook when a global
// `afterEach` exists, which this project's Vitest config does not enable (no `test.globals`).
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

// jsdom plays no media; the table's music and voices are not what these tests are about.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

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

/** The dev server's pass (no site key in tests, so the session source posts "dev"). */
const PASS = { token: "dev", expiresAt: new Date(Date.now() + 7200_000).toISOString() };

/** Answers `/api/session` with a pass and every decide call with `status` and `body`. */
function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const reply = (s: number, b: unknown) =>
    new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
  const mock = vi.fn(async (url: RequestInfo | URL) =>
    String(url) === "/api/session" ? reply(200, PASS) : reply(status, body),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function renderApp() {
  const { App } = await import("./App");
  return render(<App />);
}

const titleHeading = () => screen.getByRole("heading", { level: 1, name: "Yoiyami Poker" });

describe("App", () => {
  // The features of every decision now include a Monte Carlo equity and an exact
  // hand-strength enumeration, 15-30 ms each: alongside the other test files this no longer
  // fits the default 5 s.
  it("goes from the title to a watched table with Jev decisions and back", {
    timeout: 20_000,
  }, async () => {
    // A key an older version kept is gone once the app has loaded.
    localStorage.setItem("jev-poker.apiKey", "sk-old");
    const fetchMock = stubFetch(200, ANSWER);
    await renderApp();
    expect(localStorage.getItem("jev-poker.apiKey")).toBeNull();

    // The title screen is its own header: the name appears once, as the title.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(screen.getByRole("heading", { name: "A table to watch" })).toBeInTheDocument();
    // Watching is six-handed only: no table format to pick.
    expect(screen.queryByRole("radiogroup", { name: "Table" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));

    await waitFor(() => expect(screen.getByText("Spectator mode")).toBeInTheDocument());
    // The record opens from the header, as a drawer over the table.
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(screen.getByRole("heading", { name: "Hand history" })).toBeInTheDocument();
    // Every CPU action carries the decision (its "read") the history panel expands.
    await waitFor(() => expect(screen.getAllByText("Read").length).toBeGreaterThan(0), {
      timeout: 15_000,
    });
    // A pass first, then the decisions from the Worker's decide endpoint, not from the
    // fail-open fallback.
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls[0]).toBe("/api/session");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      turnstileToken: "dev",
    });
    expect(urls.slice(1).every((url) => url === "/api/jev/decide")).toBe(true);
    expect(urls.length).toBeGreaterThan(1);
    expect(screen.queryByText(/could not decide/)).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // No recording mode unless the page was opened for it.
    expect(screen.queryByRole("button", { name: "Recording mode" })).not.toBeInTheDocument();

    // The table's settings button opens the same dialog as the title's.
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Leave table" }));
    expect(titleHeading()).toBeInTheDocument();
  });

  it("deals a heads-up table against the chosen spirit", { timeout: 20_000 }, async () => {
    stubFetch(200, ANSWER);
    const { container } = await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("radio", { name: /Heads-up/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Janome/ }));
    fireEvent.click(screen.getByRole("button", { name: "Deal" }));

    await waitFor(() => expect(container.querySelectorAll(".seat")).toHaveLength(2));
    // The choice is remembered for the next visit.
    expect(JSON.parse(localStorage.getItem("jev-poker.tableChoice") ?? "{}")).toMatchObject({
      format: "hu",
      opponent: "janome",
    });
  });

  it("stays at the table setup when no pass can be had", async () => {
    // A fresh module, so no pass cached by an earlier test is waiting.
    vi.resetModules();
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL) =>
        new Response(JSON.stringify({ error: "turnstile_failed" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));

    expect(
      await screen.findByText("The moon slipped behind a cloud. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A table to watch" })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/session");
  });

  it("closes the table for the night and sends the player back to the title", {
    timeout: 20_000,
  }, async () => {
    stubFetch(429, { error: "tonight_is_over", resumesAt: "2026-09-24T00:00:00+09:00" });
    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));

    const dialog = await screen.findByRole(
      "dialog",
      { name: "That's all for tonight" },
      { timeout: 15_000 },
    );
    // The table has stopped dealing: its header offers to resume, not to pause.
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Leave the table" }));
    expect(titleHeading()).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stores a language only when the player picks one in the settings", async () => {
    await renderApp();
    // A first visit follows the browser and writes nothing down.
    expect(localStorage.getItem("jev-poker.lang")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "ja" } });
    expect(localStorage.getItem("jev-poker.lang")).toBe("ja");
    fireEvent.change(screen.getByLabelText("言語"), { target: { value: "en" } });
    expect(localStorage.getItem("jev-poker.lang")).toBe("en");
  });
});
