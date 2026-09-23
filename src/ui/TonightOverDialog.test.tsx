// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { TonightOverDialog } from "./TonightOverDialog";

initI18n("en");
afterEach(cleanup);

describe("TonightOverDialog", () => {
  it("renders nothing while the table runs", () => {
    const { container } = render(<TonightOverDialog reason={null} onLeave={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("closes the night with a way out", () => {
    const onLeave = vi.fn();
    render(<TonightOverDialog reason="tonight" onLeave={onLeave} />);
    expect(screen.getByRole("dialog", { name: "That's all for tonight" })).toBeInTheDocument();
    expect(
      screen.getByText("The moon will rise again. The table opens at midnight, Japan time."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave the table" }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("says the moon is hidden when the table cannot be reached", () => {
    render(<TonightOverDialog reason="unavailable" onLeave={() => {}} />);
    expect(
      screen.getByText("The moon is behind a cloud. Please come back in a little while."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/midnight/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave the table" })).toBeInTheDocument();
  });
});
