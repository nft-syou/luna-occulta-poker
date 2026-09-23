// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { RulesDialog } from "./RulesDialog";

initI18n("en");
afterEach(cleanup);

describe("RulesDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<RulesDialog open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is a labelled modal dialog that opens on the flow", () => {
    render(<RulesDialog open onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "How to play" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "The flow",
      "Actions",
      "Hand rankings",
      "House rules",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    const flow = screen.getByRole("tabpanel", { name: "The flow" });
    expect(
      within(flow).getByRole("figure", { name: /^Deal, flop, turn, river, showdown/ }),
    ).toHaveTextContent(/a round of betting each time/);
    expect(within(flow).getByRole("figure", { name: /jack-high straight/ })).toHaveTextContent(
      /Best five of seven/,
    );
    expect(within(flow).getByRole("figure", { name: /six-seat table/ })).toBeInTheDocument();
  });

  it("draws the best five of seven: five cards lit, two dimmed", () => {
    render(<RulesDialog open onClose={() => {}} />);
    const best = screen.getByRole("figure", { name: /jack-high straight/ });
    expect(best.querySelectorAll(".rules-card.is-made .card")).toHaveLength(5);
    const dim = [...best.querySelectorAll(".rules-card.is-dim .card")].map((c) => c.textContent);
    expect(dim.sort()).toEqual(["2♥", "K♦"]);
  });

  it("shows the panel of the tab that is picked", () => {
    render(<RulesDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.getByRole("tab", { name: "Actions" })).toHaveAttribute("aria-selected", "true");
    const actions = screen.getByRole("tabpanel", { name: "Actions" });
    expect(screen.queryByRole("tabpanel", { name: "The flow" })).not.toBeInTheDocument();
    const terms = [...actions.querySelectorAll(".rules-acts .callout")].map((c) => c.textContent);
    expect(terms).toEqual(["Fold", "Check", "Call", "Bet", "Raise", "All in"]);
    expect(actions.querySelector(".callout-allin")).toHaveTextContent("All in");
    const bar = within(actions).getByRole("figure", { name: /^The action bar/ });
    expect(
      within(bar)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["1One-tap sizes", "2−/+ and the slider", "3Fold, call, raise"]);
    // The mock bar is a picture: nothing in it can be reached or pressed.
    expect(bar.querySelector(".action-bar")).toHaveAttribute("aria-hidden", "true");
    expect(within(bar).queryAllByRole("button")).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: "House rules" }));
    const house = screen.getByRole("tabpanel", { name: "House rules" });
    expect(within(house).getByRole("figure", { name: /Dusk 100 BB/ })).toBeInTheDocument();
    expect(within(house).getByRole("figure", { name: /From 0 back/ })).toHaveTextContent(
      /spirits too/,
    );
    expect(house).toHaveTextContent(/open again at midnight/);
    expect(house).toHaveTextContent(/Japan time/);
    expect(house).toHaveTextContent(/only when she bluffs/);
  });

  it("moves between the tabs with the arrow keys", () => {
    render(<RulesDialog open onClose={() => {}} />);
    const first = screen.getByRole("tab", { name: "The flow" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("tab", { name: "Actions" });
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "The flow" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "House rules" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("lists the hands strongest first, each drawn as five cards", () => {
    render(<RulesDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Hand rankings" }));
    const list = screen.getByRole("list", { name: "Hand rankings" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector(".rules-hand-name")?.textContent)).toEqual([
      "Straight flush",
      "Four of a kind",
      "Full house",
      "Flush",
      "Straight",
      "Three of a kind",
      "Two pair",
      "Pair",
      "High card",
    ]);
    for (const item of items) expect(item.querySelectorAll(".card")).toHaveLength(5);
    expect(screen.getByText(/royal flush/)).toBeInTheDocument();
  });

  it("lights only the cards that make the hand", () => {
    render(<RulesDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Hand rankings" }));
    const items = within(screen.getByRole("list", { name: "Hand rankings" })).getAllByRole(
      "listitem",
    );
    const pair = items[7];
    const texts = (selector: string) =>
      [...(pair?.querySelectorAll(selector) ?? [])].map((card) => card.textContent);
    expect(texts(".rules-card.is-made .card")).toEqual(["A♥", "A♦"]);
    expect(texts(".rules-card.is-dim .card")).toEqual(["K♠", "9♣", "4♥"]);
    expect(items[2]?.querySelectorAll(".rules-card.is-dim")).toHaveLength(0);
  });

  it("closes from its close button and on Escape", () => {
    const onClose = vi.fn();
    render(<RulesDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("offers a skip only when it opened by itself", () => {
    const onClose = vi.fn();
    const { rerender } = render(<RulesDialog open onClose={onClose} />);
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    rerender(<RulesDialog open auto onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("takes the focus in and gives it back to the opener", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            opener
          </button>
          <RulesDialog open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
