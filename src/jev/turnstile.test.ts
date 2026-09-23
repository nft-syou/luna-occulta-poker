// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom fetches no external scripts: the api.js tag never loads unless a test says it did.
const scripts = () => document.head.querySelectorAll<HTMLScriptElement>("script[src*='turnstile']");

function fakeTurnstile(options: { removeThrows?: boolean } = {}) {
  const calls: { callback?: (token: string) => void; error?: () => void } = {};
  const api = {
    render: vi.fn(
      (_el: HTMLElement, o: { callback: (t: string) => void; "error-callback": () => void }) => {
        calls.callback = o.callback;
        calls.error = o["error-callback"];
        return "w1";
      },
    ),
    execute: vi.fn(),
    remove: vi.fn(() => {
      if (options.removeThrows) throw new Error("remove");
    }),
  };
  return { api, calls };
}

/** A fresh module each time, so no script load is shared between tests. */
async function load() {
  vi.resetModules();
  return (await import("./turnstile")).turnstileToken;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete window.turnstile;
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("turnstileToken", () => {
  it("gives up after 30 s when the script never loads", async () => {
    const turnstileToken = await load();
    const result = turnstileToken("site").catch((e: Error) => e);
    expect(scripts()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(29_999);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual(new Error("turnstile timed out"));
  });

  it("counts the script's load time against the same 30 s", async () => {
    const { api } = fakeTurnstile();
    const turnstileToken = await load();
    const result = turnstileToken("site").catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(20_000);
    window.turnstile = api;
    scripts()[0]?.onload?.(new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.execute).toHaveBeenCalledWith("w1");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toEqual(new Error("turnstile timed out"));
    expect(api.remove).toHaveBeenCalledWith("w1");
    expect(document.querySelector(".turnstile-challenge")).toBeNull();
  });

  it("drops a script that failed, so a retry adds only its own", async () => {
    const turnstileToken = await load();
    const first = turnstileToken("site").catch((e: Error) => e);
    scripts()[0]?.onerror?.(new Event("error"));
    expect(await first).toEqual(new Error("turnstile failed to load"));
    expect(scripts()).toHaveLength(0);
    void turnstileToken("site").catch(() => {});
    expect(scripts()).toHaveLength(1);
  });

  it("resolves with the widget's token and cleans up", async () => {
    const { api, calls } = fakeTurnstile();
    const turnstileToken = await load();
    const result = turnstileToken("site");
    window.turnstile = api;
    scripts()[0]?.onload?.(new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    const box = document.querySelector(".turnstile-challenge");
    expect(box?.parentElement).toBe(document.body);
    expect(api.render.mock.calls[0]?.[1]).toMatchObject({
      sitekey: "site",
      execution: "execute",
      appearance: "interaction-only",
    });
    calls.callback?.("tok");
    expect(await result).toBe("tok");
    expect(api.remove).toHaveBeenCalledWith("w1");
    expect(document.querySelector(".turnstile-challenge")).toBeNull();
  });

  it("settles even when removing the widget throws", async () => {
    const { api, calls } = fakeTurnstile({ removeThrows: true });
    const turnstileToken = await load();
    const result = turnstileToken("site").catch((e: Error) => e);
    window.turnstile = api;
    scripts()[0]?.onload?.(new Event("load"));
    await vi.advanceTimersByTimeAsync(0);
    calls.error?.();
    expect(await result).toEqual(new Error("turnstile refused"));
    expect(document.querySelector(".turnstile-challenge")).toBeNull();
  });
});
