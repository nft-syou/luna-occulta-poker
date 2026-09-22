// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initI18n } from "../i18n";
import { Setup } from "./Setup";
import { DEFAULT_SETTINGS, type Settings } from "./storage";

initI18n("en");

// @testing-library/react only auto-registers its afterEach(cleanup) hook when a global
// `afterEach` exists, which this project's Vitest config does not enable (no `test.globals`).
// Clean up explicitly so renders from one test don't leak into the next.
afterEach(cleanup);

function renderSetup(
  props: Partial<Parameters<typeof Setup>[0]> = {},
  settings: Settings = DEFAULT_SETTINGS,
) {
  return render(
    <Setup
      settings={settings}
      language="en"
      hasConnection={true}
      onChange={() => {}}
      onStart={() => {}}
      onOpenConnection={() => {}}
      {...props}
    />,
  );
}

describe("Setup", () => {
  it("disables start without a connection and shows a hint", () => {
    renderSetup({ hasConnection: false });
    expect(screen.getByRole("button", { name: "Start playing" })).toBeDisabled();
    expect(screen.getByText("Set up a connection first.")).toBeInTheDocument();
  });

  it("changes the number of seats and starts when valid", () => {
    const onChange = vi.fn();
    const onStart = vi.fn();
    renderSetup({ onChange, onStart });
    fireEvent.change(screen.getByLabelText("Seats"), { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ seats: DEFAULT_SETTINGS.seats.slice(0, 3) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start playing" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("seats a spirit nobody else has when a chair is added", () => {
    const onChange = vi.fn();
    const two: Settings = { ...DEFAULT_SETTINGS, seats: DEFAULT_SETTINGS.seats.slice(0, 2) };
    renderSetup({ onChange }, two);
    fireEvent.change(screen.getByLabelText("Seats"), { target: { value: "4" } });
    const next = onChange.mock.calls[0]?.[0] as Settings;
    expect(next.seats.map((s) => s.spiritId)).toEqual(["arujidono", "sakuya", "mami", "tart"]);
  });

  it("offers every spirit for a seat, with her face beside the choice", () => {
    const onChange = vi.fn();
    renderSetup({ onChange });
    const select = screen.getByLabelText("Spirit 2") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual([
      "arujidono",
      "sakuya",
      "mami",
      "tart",
      "magoichi",
      "janome",
    ]);
    expect(select.value).toBe("sakuya");
    fireEvent.change(select, { target: { value: "janome" } });
    const next = onChange.mock.calls[0]?.[0] as Settings;
    expect(next.seats[1]?.spiritId).toBe("janome");
    // The face shown next to the select is the chosen spirit's icon.
    const faces = document.querySelectorAll<HTMLImageElement>(".seat-pick-face");
    expect(faces[1]?.getAttribute("src")).toBe("/kitan/icon/sakuya.webp");
  });

  it("refuses to start while a spirit sits twice", () => {
    const seats = DEFAULT_SETTINGS.seats.map((s, i) =>
      i === 2 ? { ...s, spiritId: "sakuya" as const } : s,
    );
    renderSetup({}, { ...DEFAULT_SETTINGS, seats });
    expect(screen.getByRole("button", { name: "Start playing" })).toBeDisabled();
    expect(screen.getByText("Each spirit can sit at the table only once.")).toBeInTheDocument();
  });

  it("only lets a human seat be renamed", () => {
    renderSetup();
    expect(screen.getByLabelText("Name 1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name 2")).not.toBeInTheDocument();
  });

  it("toggles prefetch and hides the max-in-flight select when it is off", () => {
    const onChange = vi.fn();
    const { rerender } = renderSetup({ onChange });
    expect(screen.getByLabelText("Speculative prefetch (faster, more API calls)")).toBeChecked();
    expect(screen.getByLabelText("Max parallel Jev requests")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Speculative prefetch (faster, more API calls)"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ prefetch: false }));

    rerender(
      <Setup
        settings={{ ...DEFAULT_SETTINGS, prefetch: false }}
        language="en"
        hasConnection={true}
        onChange={onChange}
        onStart={() => {}}
        onOpenConnection={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Max parallel Jev requests")).not.toBeInTheDocument();
  });

  it("toggles the voices and hides the volume when they are off", () => {
    const onChange = vi.fn();
    renderSetup({ onChange });
    expect(screen.getByLabelText("Spirit voices")).toBeChecked();
    expect(screen.getByLabelText("Voice volume")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Spirit voices"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ voice: false }));
    cleanup();
    renderSetup({ onChange }, { ...DEFAULT_SETTINGS, voice: false });
    expect(screen.queryByLabelText("Voice volume")).not.toBeInTheDocument();
  });

  it("labels the start button as spectating when no seat is human", () => {
    renderSetup(
      {},
      {
        ...DEFAULT_SETTINGS,
        seats: DEFAULT_SETTINGS.seats.map((s) => ({ ...s, kind: "cpu" as const })),
      },
    );
    expect(screen.getByRole("button", { name: "Watch the CPUs play" })).toBeEnabled();
  });
});
