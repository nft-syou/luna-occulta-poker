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
    expect(screen.getByRole("tabpanel", { name: "The flow" })).toHaveTextContent(/best five/);
  });

  it("shows the panel of the tab that is picked", () => {
    render(<RulesDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Actions" }));
    expect(screen.getByRole("tab", { name: "Actions" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Actions" })).toHaveTextContent(/Raise to 12/);
    expect(screen.queryByRole("tabpanel", { name: "The flow" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "House rules" }));
    const house = screen.getByRole("tabpanel", { name: "House rules" });
    expect(house).toHaveTextContent(/topped back up/);
    expect(house).toHaveTextContent(/midnight, Japan time/);
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
