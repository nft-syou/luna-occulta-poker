// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { HandSnapshot, LegalActions } from "@jev-poker/engine";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGate, type Gate } from "../characters/gate";
import type { SoundPlayer } from "../characters/sound";
import type { VoicePlayer } from "../characters/voice";
import { initI18n } from "../i18n";
import type { StopReason } from "../jev/gameBackend";
import { EMPTY_FX, type TableFx } from "./fx";
import { OPENING_DOORS_AT_MS, OPENING_DOORS_MS, openingHoldMs } from "./OpeningLayer";
import { TableView } from "./TableView";
import type { GameController, GameSeat } from "./useGame";

initI18n("en");

// @testing-library/react only auto-registers its afterEach(cleanup) hook when a global
// `afterEach` exists, which this project's Vitest config does not enable (no `test.globals`).
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.classList.remove("showcase");
});

const SEATS: GameSeat[] = [
  { id: 0, name: "You", kind: "human", stack: 200, spiritId: "arujidono" },
  { id: 1, name: "Rocky", kind: "cpu", stack: 200, spiritId: "sakuya" },
];

const SNAPSHOT: HandSnapshot = {
  handNumber: 0,
  button: 1,
  street: "preflop",
  board: [],
  players: [
    {
      seat: 0,
      stack: 198,
      holeCards: [
        { rank: 14, suit: "s" },
        { rank: 13, suit: "s" },
      ],
      contributed: 2,
      streetBet: 2,
      folded: false,
      allIn: false,
    },
    {
      seat: 1,
      stack: 199,
      holeCards: [
        { rank: 7, suit: "d" },
        { rank: 2, suit: "c" },
      ],
      contributed: 1,
      streetBet: 1,
      folded: false,
      allIn: false,
    },
  ],
  actingSeat: 0,
  toAct: [0, 1],
  currentBet: 2,
  minRaise: 2,
  bigBlind: 2,
  pot: 3,
  complete: false,
};

/** An effects slice with something in the feed, so the strip has a reason to be up. */
const FEED_FX: TableFx = {
  ...EMPTY_FX,
  feed: [
    { id: 1, type: "street", street: "flop", at: 10 },
    { id: 2, type: "action", seat: 1, kind: "raise", amount: 12, at: 11 },
  ],
};

const LEGAL: LegalActions = {
  canFold: true,
  canCheck: true,
  callAmount: null,
  minRaiseTo: 4,
  maxRaiseTo: 198,
};

function controller(overrides: Partial<GameController["state"]> = {}): GameController {
  return {
    state: {
      snapshot: SNAPSHOT,
      seats: SEATS,
      log: [],
      thinkingSeat: null,
      paused: false,
      pauseReason: null,
      handsPlayed: 0,
      gameOver: false,
      error: null,
      stats: {},
      prefetch: { started: 0, hits: 0, misses: 0 },
      lastDecision: null,
      maxPot: 0,
      fx: EMPTY_FX,
      ...overrides,
    },
    humanSeats: [0],
    spectator: false,
    legalForHuman: LEGAL,
    humanAct: () => {},
    togglePause: () => {},
    halt: () => {},
    cumulative: {},
    statsKeys: { 0: "human:You", 1: "persona:rock" },
    resetCumulative: () => {},
  };
}

/** jsdom ships no `matchMedia`; stub one that reports the width we want to test. */
function stubViewport(phone: boolean): void {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: phone,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function renderTable(
  overrides: Partial<GameController["state"]> = {},
  extraProps: Partial<{
    recording: boolean;
    onOpenSettings: () => void;
    stopReason: StopReason | null;
    voice: VoicePlayer;
    sound: SoundPlayer;
    voiceWhenOut: boolean;
    opening: boolean;
    gate: Gate;
  }> = {},
) {
  return render(
    <TableView
      game={controller(overrides)}
      speed="normal"
      startingStack={200}
      language="en"
      onLeave={() => {}}
      onOpenSettings={() => {}}
      recording={false}
      {...extraProps}
    />,
  );
}

describe("TableView", () => {
  it("keeps the felt up on a phone and opens the log and stats from the header", () => {
    stubViewport(true);
    const { container } = renderTable();

    // No bottom tab bar and no side column: the felt is the page.
    expect(container.querySelector(".tab-bar")).toBeNull();
    expect(container.querySelector(".table-side")).toBeNull();
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Table" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stats" }));
    const dialog = screen.getByRole("dialog", { name: "Statistics" });
    expect(within(dialog).getByRole("heading", { name: "Statistics" })).toBeInTheDocument();
    // The felt and the action bar stay where they were, under the drawer.
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(screen.getByText("Your turn")).toBeInTheDocument();
  });

  it("swaps the side column for the recording layout and leaves it on Escape", () => {
    stubViewport(false);
    const { container } = renderTable({}, { recording: true });
    expect(document.body.classList.contains("showcase")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Recording mode" }));
    // The body class is what hides the app chrome around the table.
    expect(document.body.classList.contains("showcase")).toBe(true);
    expect(container.querySelector(".showcase-panel")).not.toBeNull();
    expect(container.querySelector(".ticker")).not.toBeNull();
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(container.querySelector(".showcase-corner")).toHaveTextContent(
      "Powered by TypeSafe Jev",
    );
    // Everything that is not the table itself steps aside.
    expect(screen.queryByRole("heading", { name: "Hand history" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave table" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stats" })).not.toBeInTheDocument();
    // The pause control survives, because a recording still needs steering.
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.classList.contains("showcase")).toBe(false);
    expect(container.querySelector(".showcase-panel")).toBeNull();
    expect(screen.getByRole("button", { name: "Leave table" })).toBeInTheDocument();
  });

  it("bubbles the thinking seat only while recording", () => {
    stubViewport(false);
    const { container } = renderTable({ thinkingSeat: 1 }, { recording: true });
    expect(container.querySelector(".showcase-bubble")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Recording mode" }));
    const bubble = container.querySelector(".showcase-bubble");
    expect(bubble).not.toBeNull();
    expect(bubble?.getAttribute("data-seat")).toBe("1");
    expect(bubble).toHaveTextContent("Thinking…");
  });

  it("gives the felt the full width on a wide screen, with no side column", () => {
    stubViewport(false);
    const { container } = renderTable();
    expect(container.querySelector(".table-side")).toBeNull();
    expect(container.querySelector(".felt")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Hand history" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Statistics" })).not.toBeInTheDocument();
  });

  it("opens the log as a drawer and switches panels from inside it", () => {
    stubViewport(false);
    const { container } = renderTable();
    const log = screen.getByRole("button", { name: "Log" });
    expect(log).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(log);
    const dialog = screen.getByRole("dialog", { name: "Hand history" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(log).toHaveAttribute("aria-expanded", "true");
    // Focus goes into the drawer.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // The backdrop covers the header, so the drawer carries its own switch: one click swaps
    // the panel, and there is never a second drawer.
    const logTab = within(dialog).getByRole("button", { name: "Log" });
    expect(logTab).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Stats" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const stats = screen.getByRole("dialog", { name: "Statistics" });
    expect(within(stats).getByRole("button", { name: "Stats" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("heading", { name: "Hand history" })).not.toBeInTheDocument();
    expect(container.querySelectorAll(".drawer")).toHaveLength(1);
  });

  it("makes the rest of the table inert while the drawer is open", () => {
    stubViewport(false);
    const { container } = renderTable();
    const main = container.querySelector(".table-main") as HTMLElement;
    expect(main).not.toHaveAttribute("inert");

    const log = screen.getByRole("button", { name: "Log" });
    fireEvent.click(log);
    // Tab cannot reach the header, the felt or the action bar behind the drawer.
    expect(main).toHaveAttribute("inert");
    expect(main.contains(screen.getByRole("dialog"))).toBe(false);

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(main).not.toHaveAttribute("inert");
    // The opener is focusable again, and has the focus back.
    expect(document.activeElement).toBe(log);
  });

  it("closes the drawer with Escape, its close button or a click beside it", () => {
    stubViewport(false);
    const { container } = renderTable();
    const log = screen.getByRole("button", { name: "Log" });

    fireEvent.click(log);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Focus comes back to the button that opened it.
    expect(document.activeElement).toBe(log);

    fireEvent.click(log);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(log);
    fireEvent.click(container.querySelector(".drawer-backdrop") as Element);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves the drawer open when Escape belongs to a dialog above it", () => {
    stubViewport(false);
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    // The night's dialog (or the settings) opens over the drawer, outside the table.
    const above = document.createElement("div");
    above.className = "modal-backdrop";
    document.body.append(above);
    try {
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByRole("dialog", { name: "Hand history" })).toBeInTheDocument();
    } finally {
      above.remove();
    }
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the drawer when it becomes the player's turn, so the action bar shows", () => {
    stubViewport(true);
    const props = {
      speed: "normal" as const,
      startingStack: 200,
      language: "en" as const,
      onLeave: () => {},
      onOpenSettings: () => {},
      recording: false,
    };
    const waiting = { ...controller(), legalForHuman: null };
    const { rerender } = render(<TableView game={waiting} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<TableView game={controller()} {...props} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Your turn")).toBeInTheDocument();
  });

  it("groups the hand and badges on the left and the buttons together on the right", () => {
    stubViewport(false);
    const { container } = renderTable({}, { recording: true });
    const info = container.querySelector(".table-header-info");
    const actions = container.querySelector(".table-header-actions");
    expect(info).toHaveTextContent("Hand #1");
    const names = [...(actions?.querySelectorAll("button") ?? [])].map((b) => b.textContent);
    expect(names).toEqual(["Pause", "Log", "Stats", "Settings", "Recording mode", "Leave table"]);
    expect(info?.querySelector("button")).toBeNull();
  });

  it("offers no recording button unless the page was opened for recording", () => {
    stubViewport(false);
    renderTable();
    expect(screen.queryByRole("button", { name: "Recording mode" })).not.toBeInTheDocument();
    cleanup();
    renderTable({}, { recording: true });
    expect(screen.getByRole("button", { name: "Recording mode" })).toBeInTheDocument();
  });

  it("opens the settings from the header, with no speed or prefetch controls left", () => {
    stubViewport(false);
    const onOpenSettings = vi.fn();
    renderTable({}, { onOpenSettings });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Prefetch/ })).not.toBeInTheDocument();
  });

  it("draws each seat's bet as chips out on the felt", () => {
    stubViewport(false);
    const { container } = renderTable();
    // One stack per seat with chips in front of it. Those 3 chips are the blinds, still out
    // on the felt, so the middle is empty and says so; the total is what they add up to.
    expect(container.querySelectorAll(".bet-stack")).toHaveLength(2);
    expect(container.querySelector(".chip-stack.pot")).toBeNull();
    expect(screen.getByText("Pot: 0")).toBeInTheDocument();
    expect(screen.getByText("Total: 3")).toBeInTheDocument();
    // The old number pill is gone.
    expect(container.querySelector(".seat-bet")).toBeNull();
  });

  it("flies the chips of whatever the effects layer recorded", () => {
    stubViewport(false);
    const { container } = renderTable({
      fx: {
        ...EMPTY_FX,
        chipMoves: [{ id: 1, seat: 1, kind: "toBet", amount: 6, at: 10 }],
        callouts: [{ id: 2, seat: 1, kind: "raise", amount: 12, at: 10, line: null }],
        winners: [0],
        winnersAt: 11,
      },
    });
    expect(container.querySelectorAll(".chip-fly")).toHaveLength(1);
    expect(screen.getByText("RAISE 6 BB")).toBeInTheDocument();
    expect(container.querySelector(".winner-glow")).not.toBeNull();
  });

  it("keeps every flight inside the felt's clipping layer", () => {
    // A flight is a felt-sized box translated by tens of percent. Left loose on the felt it
    // reached past the page, grew the scrollable area and made the layout jump sideways on
    // every bet, so each one must sit inside the single `.fx-layer` that clips them.
    stubViewport(false);
    const { container } = renderTable({
      fx: {
        ...EMPTY_FX,
        chipMoves: [
          { id: 1, seat: 1, kind: "toBet", amount: 6, at: 10 },
          { id: 2, seat: 0, kind: "toSeat", amount: 40, at: 11 },
        ],
      },
    });
    const layers = container.querySelectorAll(".felt > .fx-layer");
    expect(layers).toHaveLength(1);
    const flights = container.querySelectorAll(".chip-fly");
    expect(flights).toHaveLength(2);
    for (const flight of flights) {
      expect(flight.parentElement).toBe(layers[0]);
    }
    expect(container.querySelectorAll(".felt > .chip-fly")).toHaveLength(0);
  });

  it("puts the action feed under the felt on a wide screen", () => {
    stubViewport(false);
    const { container } = renderTable({ fx: FEED_FX });
    const feed = container.querySelector(".action-feed");
    expect(feed).not.toBeNull();
    expect(screen.getByText("Flop")).toBeInTheDocument();
    // Decoration next to the hand history, which is the readable record.
    expect(feed).toHaveAttribute("aria-hidden", "true");
  });

  it("throws every callout inwards, whichever rail its seat is on", () => {
    stubViewport(false);
    // The human seat anchors the bottom of the table and the other seat faces it.
    const { container } = renderTable({
      fx: {
        ...EMPTY_FX,
        callouts: [
          { id: 1, seat: 0, kind: "check", amount: 0, at: 10, line: null },
          { id: 2, seat: 1, kind: "bet", amount: 12, at: 11, line: null },
        ],
      },
    });
    const spots = [...container.querySelectorAll(".callout-spot")] as HTMLElement[];
    expect(spots).toHaveLength(2);
    const inY = spots.map((spot) => Number(spot.style.getPropertyValue("--in-y")));
    // Opposite rails point opposite ways, and neither points nowhere.
    expect(inY[0]).toBeLessThan(0);
    expect(inY[1]).toBeGreaterThan(0);
    // Nothing places itself below its seat any more: every label sits in a placed wrapper.
    expect(container.querySelectorAll(".callout")).toHaveLength(2);
    for (const callout of container.querySelectorAll(".callout")) {
      expect(callout.parentElement?.classList.contains("callout-spot")).toBe(true);
    }
  });

  it("draws every bubble in one layer above the chips, not inside its seat", () => {
    // A seat is transformed, so it is a stacking context: a bubble inside it could only rise
    // above the seat itself, and the felt's chip stacks and flights were painted over it.
    stubViewport(false);
    const line = { id: "sakuya.raise.1", text: "レイズ。あたしの番だ" };
    const { container } = renderTable({
      fx: {
        ...EMPTY_FX,
        chipMoves: [{ id: 1, seat: 1, kind: "toBet", amount: 6, at: 10 }],
        callouts: [
          { id: 2, seat: 0, kind: "check", amount: 0, at: 10, line: null },
          { id: 3, seat: 1, kind: "raise", amount: 12, at: 11, line },
        ],
      },
    });
    const layers = container.querySelectorAll(".felt > .speech-layer");
    expect(layers).toHaveLength(1);
    const spots = container.querySelectorAll(".callout-spot");
    expect(spots).toHaveLength(2);
    for (const spot of spots) {
      expect(spot.closest(".seat")).toBeNull();
      expect(spot.closest(".speech-layer")).toBe(layers[0]);
    }
    // Painted after the chips and their flights, so equal footing could never hide it either.
    const children = [...(container.querySelector(".felt")?.children ?? [])];
    const layerAt = children.indexOf(layers[0] as Element);
    expect(layerAt).toBeGreaterThan(
      children.indexOf(container.querySelector(".fx-layer") as Element),
    );
    for (const stack of container.querySelectorAll(".felt > .bet-stack")) {
      expect(layerAt).toBeGreaterThan(children.indexOf(stack));
    }
  });

  it("shows only the newest bubble on a phone, and one per seat on a wide screen", () => {
    const fx = {
      fx: {
        ...EMPTY_FX,
        callouts: [
          {
            id: 1,
            seat: 1,
            kind: "raise" as const,
            amount: 12,
            at: 10,
            line: { id: "sakuya.raise.1", text: "レイズ。あたしの番だ" },
          },
          { id: 2, seat: 0, kind: "call" as const, amount: 12, at: 11, line: null },
        ],
      },
    };
    stubViewport(true);
    const phone = renderTable(fx);
    // Two seats acted in quick succession: the second one's shout replaces the first.
    expect(phone.container.querySelectorAll(".callout-spot")).toHaveLength(1);
    expect(screen.getByText("CALL 6 BB")).toBeInTheDocument();
    expect(screen.queryByText("レイズ。あたしの番だ")).not.toBeInTheDocument();
    phone.unmount();

    stubViewport(false);
    const wide = renderTable(fx);
    expect(wide.container.querySelectorAll(".callout-spot")).toHaveLength(2);
    expect(screen.getByText("レイズ。あたしの番だ")).toBeInTheDocument();
  });

  it("empties the middle as soon as the pot has been paid out", () => {
    stubViewport(false);
    const { container } = renderTable({
      fx: { ...EMPTY_FX, potPaid: true, winners: [0], winnersAt: 12 },
    });
    // The snapshot still says 3 — the engine keeps `contributed` until the next hand — but
    // the chips have flown to the winner, so the felt shows an empty middle counting down.
    expect(screen.getByText("Pot: 0")).toBeInTheDocument();
    expect(screen.queryByText("Pot: 3")).not.toBeInTheDocument();
    expect(container.querySelector(".chip-stack.pot")).toBeNull();
    // And nothing is left in front of the seats either.
    expect(container.querySelectorAll(".bet-stack")).toHaveLength(0);
  });

  it("counts only swept-in chips in the middle and spells out the total beside them", () => {
    stubViewport(false);
    // Flop: 10 went in preflop from each seat, and seat 0 has now bet 6 more.
    const flop: HandSnapshot = {
      ...SNAPSHOT,
      street: "flop",
      pot: 26,
      currentBet: 6,
      players: SNAPSHOT.players.map((p) =>
        p.seat === 0
          ? { ...p, contributed: 16, streetBet: 6 }
          : { ...p, contributed: 10, streetBet: 0 },
      ),
    };
    const { container } = renderTable({ snapshot: flop });
    expect(screen.getByText("Pot: 20")).toBeInTheDocument();
    expect(screen.getByText("Total: 26")).toBeInTheDocument();
    expect(container.querySelector(".chip-stack.pot")).not.toBeNull();
    expect(container.querySelectorAll(".bet-stack")).toHaveLength(1);
  });

  it("drops the total once every bet has been swept in", () => {
    stubViewport(false);
    const swept: HandSnapshot = {
      ...SNAPSHOT,
      street: "turn",
      pot: 26,
      currentBet: 0,
      players: SNAPSHOT.players.map((p) => ({ ...p, contributed: 13, streetBet: 0 })),
    };
    renderTable({ snapshot: swept });
    expect(screen.getByText("Pot: 26")).toBeInTheDocument();
    expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument();
  });

  it("follows the snapshot's pot again once the next hand has started", () => {
    stubViewport(false);
    const { container } = renderTable({ fx: { ...EMPTY_FX, potPaid: false } });
    // The new hand's blinds are out in front of their seats again, and count towards the total.
    expect(screen.getByText("Total: 3")).toBeInTheDocument();
    expect(container.querySelectorAll(".bet-stack")).toHaveLength(2);
  });

  it("keeps the feed off a phone until the table is being recorded", () => {
    stubViewport(true);
    const { container } = renderTable({ fx: FEED_FX }, { recording: true });
    expect(container.querySelector(".action-feed")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Recording mode" }));
    expect(container.querySelector(".action-feed")).not.toBeNull();
  });

  it("names a table the server stopped for the night in the night's own words", () => {
    stubViewport(false);
    renderTable({ paused: true, pauseReason: "tonight" }, { stopReason: "tonight" });
    expect(screen.getByText("That's all for tonight")).toBeInTheDocument();
    expect(screen.queryByText(/credit|TypeSafe/)).not.toBeInTheDocument();
  });

  it("calls a table the server could not reach merely paused", () => {
    stubViewport(false);
    renderTable({ paused: true, pauseReason: "tonight" }, { stopReason: "unavailable" });
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.queryByText("That's all for tonight")).not.toBeInTheDocument();
    expect(screen.queryByText(/credit|TypeSafe/)).not.toBeInTheDocument();
  });

  it("offers no resume once the server has stopped the table", () => {
    stubViewport(false);
    for (const stopReason of ["tonight", "unavailable"] as const) {
      const { unmount } = renderTable({ paused: true, pauseReason: "tonight" }, { stopReason });
      // The dialog covers the table, but the keyboard can still reach the header behind it.
      expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
      unmount();
    }
    renderTable({ paused: true, pauseReason: null }, { stopReason: null });
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
  });

  it("shows no stop badge when there is no pause reason", () => {
    stubViewport(false);
    renderTable({ paused: false, pauseReason: null });
    expect(screen.queryByText("That's all for tonight")).not.toBeInTheDocument();
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  });

  it("hides the stop badge in recording mode", () => {
    stubViewport(false);
    renderTable(
      { paused: true, pauseReason: "tonight" },
      { stopReason: "tonight", recording: true },
    );
    expect(screen.getByText("That's all for tonight")).toBeInTheDocument();

    // Recording mode's header keeps only the pause/resume button and the exit control; the
    // badge steps aside with everything else that isn't the table itself.
    fireEvent.click(screen.getByRole("button", { name: "Recording mode" }));
    expect(screen.queryByText("That's all for tonight")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });
});

describe("TableView voices", () => {
  function fakeVoice() {
    const calls: { spirit: string; id: string; priority: boolean }[] = [];
    const voice: VoicePlayer = {
      play: (spirit, line, opts) => {
        calls.push({ spirit, id: line.id, priority: opts?.priority === true });
      },
      preload: () => {},
      setEnabled: () => {},
      setVolume: () => {},
      setSituations: () => {},
      stopAll: () => {},
    };
    return { voice, calls };
  }
  const line = { id: "sakuya.raise.1", text: "レイズ。あたしの番だ" };

  it("says a new shout's line once, and never a human's", () => {
    stubViewport(false);
    const { voice, calls } = fakeVoice();
    const withCallout = (id: number, seat: number) => ({
      fx: {
        ...EMPTY_FX,
        callouts: [{ id, seat, kind: "raise" as const, amount: 12, at: 10, line }],
      },
    });
    const { rerender } = render(
      <TableView
        game={controller(withCallout(1, 1))}
        speed="normal"
        startingStack={200}
        language="en"
        onLeave={() => {}}
        onOpenSettings={() => {}}
        recording={false}
        voice={voice}
      />,
    );
    expect(calls).toEqual([{ spirit: "sakuya", id: line.id, priority: false }]);
    // The same callout again: nothing more.
    rerender(
      <TableView
        game={controller(withCallout(1, 1))}
        speed="normal"
        startingStack={200}
        language="en"
        onLeave={() => {}}
        onOpenSettings={() => {}}
        recording={false}
        voice={voice}
      />,
    );
    expect(calls).toHaveLength(1);
    // A human seat's shout (seat 0) carries no line and says nothing.
    rerender(
      <TableView
        game={controller(withCallout(2, 0))}
        speed="normal"
        startingStack={200}
        language="en"
        onLeave={() => {}}
        onOpenSettings={() => {}}
        recording={false}
        voice={voice}
      />,
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]?.spirit).toBe("arujidono");
  });

  it("gives a cut-in's line priority and lets it stand for the all-in shout", () => {
    stubViewport(false);
    const { voice, calls } = fakeVoice();
    const shove = { id: "sakuya.allin.1", text: "全部だ。あたしは嘘つかない" };
    renderTable(
      {
        fx: {
          ...EMPTY_FX,
          callouts: [{ id: 1, seat: 1, kind: "allin", amount: 200, at: 10, line: shove }],
          cutIn: { id: 2, seat: 1, kind: "allin", line: shove, at: 10 },
        },
      },
      { voice },
    );
    expect(calls).toEqual([{ spirit: "sakuya", id: shove.id, priority: true }]);
  });

  it("speaks a word after the hand, but leaves the big ones to the cut-in", () => {
    stubViewport(false);
    const { voice, calls } = fakeVoice();
    const win = { id: "sakuya.win.1", text: "ほらね。言ったでしょ" };
    const big = { id: "sakuya.bigwin.1", text: "ひと太刀で" };
    renderTable(
      {
        fx: {
          ...EMPTY_FX,
          speech: [
            { id: 5, seat: 1, situation: "win", line: win, at: 10 },
            { id: 6, seat: 1, situation: "bigwin", line: big, at: 11 },
          ],
          cutIn: { id: 7, seat: 1, kind: "bigwin", line: big, at: 11 },
        },
      },
      { voice },
    );
    // Only the newest word is considered, and a big win is the cut-in's to say.
    expect(calls).toEqual([{ spirit: "sakuya", id: big.id, priority: true }]);
  });

  it("greets from every 御霊's seat as the table opens, a beat apart", () => {
    vi.useFakeTimers();
    try {
      stubViewport(false);
      const { voice, calls } = fakeVoice();
      renderTable({}, { voice });
      expect(calls).toEqual([]);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.id).toMatch(/^sakuya\.greet\./);
      expect(screen.getByText(/^(あんたの顔見ると|さ、始めよっか)/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("TableView voices while the player is out of the hand", () => {
  const raise = { id: "sakuya.raise.1", text: "レイズ。あたしの番だ" };
  const shout = {
    fx: {
      ...EMPTY_FX,
      callouts: [{ id: 1, seat: 1, kind: "raise" as const, amount: 12, at: 10, line: raise }],
    },
  };
  function voiceCalls() {
    const calls: string[] = [];
    const voice: VoicePlayer = {
      play: (_spirit, line) => {
        calls.push(line.id);
      },
      preload: () => {},
      setEnabled: () => {},
      setVolume: () => {},
      setSituations: () => {},
      stopAll: () => {},
    };
    return { voice, calls };
  }
  /** The same hand with the human (seat 0) folded. */
  const humanFolded: HandSnapshot = {
    ...SNAPSHOT,
    players: SNAPSHOT.players.map((p) => (p.seat === 0 ? { ...p, folded: true } : p)),
  };
  /** A hand the human was not dealt into (busted, or waiting). */
  const humanNotDealt: HandSnapshot = {
    ...SNAPSHOT,
    players: SNAPSHOT.players.filter((p) => p.seat !== 0),
  };

  it("keeps the 御霊 quiet once the player has folded", () => {
    stubViewport(false);
    const { voice, calls } = voiceCalls();
    renderTable({ ...shout, snapshot: humanFolded }, { voice });
    expect(calls).toEqual([]);
    // The bubble still shows the words.
    expect(screen.getByText(raise.text)).toBeInTheDocument();
  });

  it("keeps them quiet in a hand the player was not dealt into", () => {
    stubViewport(false);
    const { voice, calls } = voiceCalls();
    renderTable({ ...shout, snapshot: humanNotDealt }, { voice });
    expect(calls).toEqual([]);
  });

  it("lets them speak after a fold when the player asked for it", () => {
    stubViewport(false);
    const { voice, calls } = voiceCalls();
    renderTable({ ...shout, snapshot: humanFolded }, { voice, voiceWhenOut: true });
    expect(calls).toEqual([raise.id]);
  });

  it("lets them speak while the player is still in the hand", () => {
    stubViewport(false);
    const { voice, calls } = voiceCalls();
    renderTable(shout, { voice });
    expect(calls).toEqual([raise.id]);
  });

  it("lets them speak at a table with no human seat", () => {
    stubViewport(false);
    const { voice, calls } = voiceCalls();
    const watched = controller({ ...shout, snapshot: humanNotDealt });
    render(
      <TableView
        game={{ ...watched, humanSeats: [], spectator: true, legalForHuman: null }}
        speed="normal"
        startingStack={200}
        language="en"
        onLeave={() => {}}
        onOpenSettings={() => {}}
        recording={false}
        voice={voice}
      />,
    );
    expect(calls).toEqual([raise.id]);
  });

  it("does not say a line held back during the fold once the player is dealt in again", () => {
    stubViewport(false);
    const { voice, calls } = voiceCalls();
    const props = {
      speed: "normal" as const,
      startingStack: 200,
      language: "en" as const,
      onLeave: () => {},
      onOpenSettings: () => {},
      recording: false,
      voice,
    };
    const { rerender } = render(
      <TableView game={controller({ ...shout, snapshot: humanFolded })} {...props} />,
    );
    rerender(<TableView game={controller({ ...shout, snapshot: SNAPSHOT })} {...props} />);
    expect(calls).toEqual([]);
  });

  it("still greets as the player sits down", () => {
    vi.useFakeTimers();
    try {
      stubViewport(false);
      const { voice, calls } = voiceCalls();
      renderTable({ snapshot: null }, { voice });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(calls[0]).toMatch(/^sakuya\.greet\./);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("TableView sounds", () => {
  function fakeSound() {
    const played: string[] = [];
    const sound: SoundPlayer = {
      se: (id) => played.push(id),
      startBgm: () => {},
      setBgm: () => {},
      setBgmVolume: () => {},
      setSe: () => {},
      setSeVolume: () => {},
      stopAll: () => {},
    };
    return { sound, played };
  }

  it("deals with a tick, sends chips out with one 勾玉 and brings a pot home with several", () => {
    stubViewport(false);
    const { sound, played } = fakeSound();
    renderTable(
      {
        fx: {
          ...EMPTY_FX,
          feed: [{ id: 1, type: "street", street: "flop", at: 10 }],
          chipMoves: [{ id: 2, seat: 1, kind: "toBet", amount: 6, at: 10 }],
        },
      },
      { sound },
    );
    expect(played).toEqual(["deal", "chip"]);
    cleanup();

    const home = fakeSound();
    renderTable(
      {
        fx: { ...EMPTY_FX, chipMoves: [{ id: 3, seat: 0, kind: "toSeat", amount: 90, at: 11 }] },
      },
      { sound: home.sound },
    );
    expect(home.played).toEqual(["pot"]);
  });

  it("strikes on an all-in cut-in and marks a big win and a bust with their own sounds", () => {
    stubViewport(false);
    for (const [kind, expected] of [
      ["allin", "cutin"],
      ["bigwin", "bigwin"],
      ["bust", "bust"],
    ] as const) {
      const { sound, played } = fakeSound();
      renderTable(
        { fx: { ...EMPTY_FX, cutIn: { id: 9, seat: 1, kind, line: null, at: 12 } } },
        { sound },
      );
      expect(played, kind).toEqual([expected]);
      cleanup();
    }
  });

  it("says nothing twice for the same effect", () => {
    stubViewport(false);
    const { sound, played } = fakeSound();
    const fx = {
      ...EMPTY_FX,
      chipMoves: [{ id: 2, seat: 1, kind: "toBet" as const, amount: 6, at: 10 }],
    };
    const { rerender } = render(
      <TableView
        game={controller({ fx })}
        speed="normal"
        startingStack={200}
        language="en"
        onLeave={() => {}}
        onOpenSettings={() => {}}
        recording={false}
        sound={sound}
      />,
    );
    rerender(
      <TableView
        game={controller({ fx })}
        speed="normal"
        startingStack={200}
        language="en"
        onLeave={() => {}}
        onOpenSettings={() => {}}
        recording={false}
        sound={sound}
      />,
    );
    expect(played).toEqual(["chip"]);
  });
});

describe("TableView opening", () => {
  const THREE: GameSeat[] = [
    ...SEATS,
    { id: 2, name: "Mami", kind: "cpu", stack: 200, spiritId: "mami" },
  ];

  it("keeps the seats dark under the veil, then lights them one after another", () => {
    vi.useFakeTimers();
    try {
      stubViewport(false);
      const gate = createGate();
      const { container } = renderTable({ snapshot: null, seats: THREE }, { opening: true, gate });
      const felt = container.querySelector(".felt");
      expect(container.querySelector(".opening")).not.toBeNull();
      expect(felt).toHaveClass("seats-dim");
      expect(gate.busy()).toBe(true);

      act(() => {
        vi.advanceTimersByTime(OPENING_DOORS_AT_MS + OPENING_DOORS_MS);
      });
      expect(container.querySelector(".opening")).toBeNull();
      expect(felt).not.toHaveClass("seats-dim");
      expect(felt).toHaveClass("seats-lit");
      // Round the table from the player's own seat, a beat apart.
      const delays = [...container.querySelectorAll<HTMLElement>(".seat")].map((seat) =>
        seat.style.getPropertyValue("--lit-delay"),
      );
      expect(delays).toEqual(["0ms", "80ms", "160ms"]);

      act(() => {
        vi.advanceTimersByTime(openingHoldMs(3));
      });
      expect(gate.busy()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lights every seat at once when the opening is skipped", () => {
    vi.useFakeTimers();
    try {
      stubViewport(false);
      const gate = createGate();
      const { container } = renderTable({ snapshot: null, seats: THREE }, { opening: true, gate });
      fireEvent.keyDown(window, { key: " " });
      expect(gate.busy()).toBe(false);
      expect(container.querySelector(".opening")).toBeNull();
      const felt = container.querySelector(".felt");
      expect(felt).not.toHaveClass("seats-dim");
      expect(felt).not.toHaveClass("seats-lit");
    } finally {
      vi.useRealTimers();
    }
  });

  it("greets only once the doors are open", () => {
    vi.useFakeTimers();
    try {
      stubViewport(false);
      const calls: string[] = [];
      const voice: VoicePlayer = {
        play: (_spirit, line) => {
          calls.push(line.id);
        },
        preload: () => {},
        setEnabled: () => {},
        setVolume: () => {},
        setSituations: () => {},
        stopAll: () => {},
      };
      renderTable({ snapshot: null }, { opening: true, voice });
      act(() => {
        vi.advanceTimersByTime(OPENING_DOORS_AT_MS);
      });
      expect(calls).toEqual([]);
      act(() => {
        vi.advanceTimersByTime(OPENING_DOORS_MS);
      });
      expect(calls).toEqual([]);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(calls[0]).toMatch(/^sakuya\.greet\./);
    } finally {
      vi.useRealTimers();
    }
  });
});
