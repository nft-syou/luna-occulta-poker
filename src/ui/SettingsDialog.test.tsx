// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { SettingsDialog } from "./SettingsDialog";
import { DEFAULT_SETTINGS } from "./storage";

initI18n("en");
afterEach(cleanup);

const props = {
  open: true,
  settings: DEFAULT_SETTINGS,
  language: "en" as const,
  onChange: () => {},
  onLanguage: () => {},
  onClose: () => {},
};

describe("SettingsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SettingsDialog {...props} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the sound settings and a language select that calls onLanguage", () => {
    const onLanguage = vi.fn();
    render(<SettingsDialog {...props} onLanguage={onLanguage} />);
    expect(screen.getByText("Music")).toBeInTheDocument();
    const select = screen.getByLabelText("Language");
    fireEvent.change(select, { target: { value: "ja" } });
    expect(onLanguage).toHaveBeenCalledWith("ja");
  });

  it("calls onClose from the Close button", () => {
    const onClose = vi.fn();
    render(<SettingsDialog {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
