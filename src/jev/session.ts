import type { SessionSource } from "./gameBackend";
import { turnstileToken } from "./turnstile";

/** A pass with this little left is renewed before use rather than sent to expire in flight. */
const MARGIN_MS = 60_000;

interface Pass {
  token: string;
  expiresAt: number;
}

/**
 * The player's pass to the Worker: Turnstile first, then `POST /api/session`, cached until a
 * minute before it expires. Concurrent callers share one request.
 */
export function createSessionSource(o: {
  getTurnstileToken: () => Promise<string>;
  fetch?: typeof fetch;
  now?: () => number;
}): SessionSource {
  const fetchImpl = o.fetch ?? ((input, init) => fetch(input, init));
  const now = o.now ?? Date.now;
  let pass: Pass | null = null;
  let pending: Promise<string> | null = null;

  const fetchPass = async (): Promise<string> => {
    const turnstileToken = await o.getTurnstileToken();
    const res = await fetchImpl("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turnstileToken }),
    });
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
