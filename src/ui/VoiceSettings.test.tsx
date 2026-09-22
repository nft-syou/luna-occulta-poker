// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { DEFAULT_SETTINGS, type Settings } from "./storage";
import { VoiceSettings } from "./VoiceSettings";

initI18n("en");
afterEach(cleanup);

describe("VoiceSettings", () => {
  it("switches one situation off and leaves the rest", () => {
    const onChange = vi.fn();
    render(<VoiceSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Fold"));
    const next = onChange.mock.calls[0]?.[0] as Settings;
    expect(next.voiceSituations.fold).toBe(false);
    expect(next.voiceSituations.raise).toBe(true);
    expect(next.voice).toBe(true);
  });

  it("hides the details while the voices are off", () => {
    render(<VoiceSettings settings={{ ...DEFAULT_SETTINGS, voice: false }} onChange={() => {}} />);
    expect(screen.queryByLabelText("Fold")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Voice volume")).not.toBeInTheDocument();
  });

  it("turns every situation off and on again in one click", () => {
    const onChange = vi.fn();
    const { rerender } = render(<VoiceSettings settings={DEFAULT_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "All off" }));
    const off = onChange.mock.calls[0]?.[0] as Settings;
    expect(Object.values(off.voiceSituations).every((v) => v === false)).toBe(true);
    rerender(<VoiceSettings settings={off} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "All on" }));
    const on = onChange.mock.calls[1]?.[0] as Settings;
    expect(Object.values(on.voiceSituations).every((v) => v === true)).toBe(true);
  });
});
