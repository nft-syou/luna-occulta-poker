// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { TableSetup } from "./TableSetup";
import { DEFAULT_CHOICE } from "./tableChoice";

initI18n("en");
afterEach(cleanup);

const props = {
  mode: "play" as const,
  choice: DEFAULT_CHOICE,
  language: "en" as const,
  busy: false,
  error: null,
  onChange: () => {},
  onStart: () => {},
  onBack: () => {},
};

describe("TableSetup", () => {
  it("offers the opponent only heads-up", () => {
    const { rerender } = render(<TableSetup {...props} />);
    expect(screen.queryByRole("radiogroup", { name: "Opponent" })).not.toBeInTheDocument();
    rerender(<TableSetup {...props} choice={{ ...DEFAULT_CHOICE, format: "hu" }} />);
    expect(screen.getByRole("radiogroup", { name: "Opponent" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: /Sakuya|Mami|Tart|Magoichi|Janome/ })).toHaveLength(
      5,
    );
  });

  it("changes the format, the rate and the opponent", () => {
    const onChange = vi.fn();
    render(
      <TableSetup {...props} choice={{ ...DEFAULT_CHOICE, format: "hu" }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Eclipse/ }));
    expect(onChange).toHaveBeenLastCalledWith({ format: "hu", rate: "shoku", opponent: "sakuya" });
    fireEvent.click(screen.getByRole("radio", { name: /Janome/ }));
    expect(onChange).toHaveBeenLastCalledWith({ format: "hu", rate: "yoi", opponent: "janome" });
    fireEvent.click(screen.getByRole("radio", { name: /Six-handed/ }));
    expect(onChange).toHaveBeenLastCalledWith({ format: "six", rate: "yoi", opponent: "sakuya" });
  });

  it("hides the format when watching, and shows busy and errors", () => {
    const { rerender } = render(<TableSetup {...props} mode="watch" />);
    expect(screen.queryByRole("radiogroup", { name: "Table" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watch" })).toBeEnabled();
    rerender(
      <TableSetup
        {...props}
        busy={true}
        error="The moon slipped behind a cloud. Please try again."
      />,
    );
    expect(screen.getByRole("button", { name: "Waiting for the moon…" })).toBeDisabled();
    expect(screen.getByText(/slipped behind a cloud/)).toBeInTheDocument();
  });
});
