import { describe, expect, it, vi } from "vitest";
import { createSessionSource } from "./session";

const NOW = Date.UTC(2026, 8, 23, 3);
const HOUR = 3600_000;

function server(expiresIn = 2 * HOUR) {
  let n = 0;
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    n += 1;
    return new Response(
      JSON.stringify({ token: `pass-${n}`, expiresAt: new Date(NOW + expiresIn).toISOString() }),
    );
  });
}

describe("session source", () => {
  it("posts once, reuses the pass, and renews on request", async () => {
    const f = server();
    const getTurnstileToken = vi.fn(async () => "ts");
    const s = createSessionSource({
      getTurnstileToken,
      fetch: f as unknown as typeof fetch,
      now: () => NOW,
    });
    expect(await s.token()).toBe("pass-1");
    expect(await s.token()).toBe("pass-1");
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/session");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ turnstileToken: "ts" });

    expect(await s.renew()).toBe("pass-2");
    expect(await s.token()).toBe("pass-2");
    expect(f).toHaveBeenCalledTimes(2);
    expect(getTurnstileToken).toHaveBeenCalledTimes(2);
  });

  it("fetches a new pass when the cached one has a minute or less left", async () => {
    const f = server();
    let now = NOW;
    const s = createSessionSource({
      getTurnstileToken: async () => "ts",
      fetch: f as unknown as typeof fetch,
      now: () => now,
    });
    await s.token();
    now = NOW + 2 * HOUR - 61_000;
    expect(await s.token()).toBe("pass-1");
    now = NOW + 2 * HOUR - 60_000;
    expect(await s.token()).toBe("pass-2");
  });

  it("shares one request between concurrent callers", async () => {
    const f = server();
    const getTurnstileToken = vi.fn(async () => "ts");
    const s = createSessionSource({
      getTurnstileToken,
      fetch: f as unknown as typeof fetch,
      now: () => NOW,
    });
    const tokens = await Promise.all([s.token(), s.token(), s.renew()]);
    expect(tokens).toEqual(["pass-1", "pass-1", "pass-1"]);
    expect(getTurnstileToken).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("throws when the server refuses, and tries afresh next time", async () => {
    const f = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ error: "turnstile_failed" }), { status: 403 }),
    );
    const s = createSessionSource({
      getTurnstileToken: async () => "ts",
      fetch: f as unknown as typeof fetch,
      now: () => NOW,
    });
    await expect(s.token()).rejects.toThrow();
    await expect(s.token()).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("throws when Turnstile does, without asking the server", async () => {
    const f = server();
    const s = createSessionSource({
      getTurnstileToken: async () => {
        throw new Error("turnstile");
      },
      fetch: f as unknown as typeof fetch,
      now: () => NOW,
    });
    await expect(s.token()).rejects.toThrow("turnstile");
    expect(f).not.toHaveBeenCalled();
  });

  it("waits out a single 429 from /api/session and succeeds on retry", async () => {
    let call = 0;
    const f = vi.fn(async (_url: string, _init?: RequestInit) => {
      call += 1;
      if (call === 1) return new Response(null, { status: 429, headers: { "retry-after": "5" } });
      return new Response(
        JSON.stringify({ token: "pass-1", expiresAt: new Date(NOW + 2 * HOUR).toISOString() }),
      );
    });
    const sleep = vi.fn(async () => {});
    const s = createSessionSource({
      getTurnstileToken: async () => "ts",
      fetch: f as unknown as typeof fetch,
      now: () => NOW,
      sleep,
    });
    expect(await s.token()).toBe("pass-1");
    expect(f).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it("throws after a second 429 from /api/session", async () => {
    const f = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(null, { status: 429, headers: { "retry-after": "3" } }),
    );
    const sleep = vi.fn(async () => {});
    const s = createSessionSource({
      getTurnstileToken: async () => "ts",
      fetch: f as unknown as typeof fetch,
      now: () => NOW,
      sleep,
    });
    await expect(s.token()).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("waits the default 2 seconds when /api/session's 429 has no retry-after", async () => {
    let call = 0;
    const f = vi.fn(async (_url: string, _init?: RequestInit) => {
      call += 1;
      if (call === 1) return new Response(null, { status: 429 });
      return new Response(
        JSON.stringify({ token: "pass-1", expiresAt: new Date(NOW + 2 * HOUR).toISOString() }),
      );
    });
    const sleep = vi.fn(async () => {});
    const s = createSessionSource({
      getTurnstileToken: async () => "ts",
      fetch: f as unknown as typeof fetch,
      now: () => NOW,
      sleep,
    });
    expect(await s.token()).toBe("pass-1");
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});
