import type { SessionSource } from "./gameBackend";
import { turnstileToken } from "./turnstile";

/** A pass with this little left is renewed before use rather than sent to expire in flight. */
const MARGIN_MS = 60_000;

interface Pass {
  token: string;
  expiresAt: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The player's pass to the Worker: Turnstile first, then `POST /api/session`, cached until a
 * minute before it expires. Concurrent callers share one request.
 */
export function createSessionSource(o: {
  getTurnstileToken: () => Promise<string>;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): SessionSource {
  const fetchImpl = o.fetch ?? ((input, init) => fetch(input, init));
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? defaultSleep;
  let pass: Pass | null = null;
  let pending: Promise<string> | null = null;

  const fetchPass = async (): Promise<string> => {
    const turnstileToken = await o.getTurnstileToken();
    const post = () =>
      fetchImpl("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnstileToken }),
      });
    // The session bucket is separate from decide's (see src/worker/api.ts), but it can still be
    // exhausted on its own (many tabs, a page reload storm); wait the Worker's `retry-after` out
    // once, the same as gameBackend does for a decide 429, rather than stopping the table.
    let res = await post();
    if (res.status === 429) {
      const seconds = Number(res.headers.get("retry-after") ?? "2");
      await sleep((Number.isFinite(seconds) ? seconds : 2) * 1000);
      res = await post();
    }
    if (res.status !== 200) throw new Error(`session refused (${res.status})`);
    const body = (await res.json()) as { token?: unknown; expiresAt?: unknown };
    const expiresAt = typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : Number.NaN;
    if (typeof body.token !== "string" || Number.isNaN(expiresAt)) {
      throw new Error("session malformed");
    }
    pass = { token: body.token, expiresAt };
    return body.token;
  };

  const fresh = (): Promise<string> => {
    pending ??= fetchPass().finally(() => {
      pending = null;
    });
    return pending;
  };

  return {
    token: async () => (pass !== null && pass.expiresAt - now() > MARGIN_MS ? pass.token : fresh()),
    renew: () => {
      pass = null;
      return fresh();
    },
  };
}

/** The real pass when a Turnstile site key is configured; the dev server's open one otherwise. */
export function defaultSessionSource(): SessionSource {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey) return createSessionSource({ getTurnstileToken: async () => "dev" });
  return createSessionSource({ getTurnstileToken: () => turnstileToken(siteKey) });
}
