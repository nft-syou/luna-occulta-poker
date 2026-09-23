// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { TitleScreen } from "./TitleScreen";

initI18n("en");
afterEach(cleanup);

describe("TitleScreen", () => {
  it("renders the title and its three ways in", () => {
    render(<TitleScreen onPlay={() => {}} onWatch={() => {}} onSettings={() => {}} />);
    expect(screen.getByRole("heading", { name: "Yoiyami Poker" })).toBeInTheDocument();
    expect(screen.getByText("Meet me under the eaten moon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("calls its handlers", () => {
    const onPlay = vi.fn();
    const onWatch = vi.fn();
    const onSettings = vi.fn();
    render(<TitleScreen onPlay={onPlay} onWatch={onWatch} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onWatch).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
