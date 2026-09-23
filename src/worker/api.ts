import { type Budget, jstDay, type Limits, nextJstMidnight } from "./budget";
import { callJev, type UpstreamConfig } from "./decide";
import { MAX_BODY_BYTES, parseDecideRequest } from "./schema";
import { LOLIPOP_MODEL, VERCEL_MODEL } from "./upstream";

export interface ApiEnv {
  JEV_API_KEY?: string;
  JEV_ROUTE?: string;
  JEV_MODEL?: string;
  JEV_CF_ACCOUNT?: string;
  JEV_CF_GATEWAY?: string;
  JEV_CF_PROVIDER?: string;
  JEV_CF_TOKEN?: string;
  TYPESAFE_BASE_URL?: string;
  DAILY_CALLS_PER_PLAYER?: string;
  DAILY_CALLS_TOTAL?: string;
  TURNSTILE_SECRET?: string;
  SESSION_SECRET?: string;
  /** Set only by the Vite dev server: allows running without Turnstile and a session secret. */
  DEV_OPEN?: string;
}

export interface Burst {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Sessions {
  /** Asks Turnstile about `ip` (the real address) and binds the pass to `key` (default `ip`). */
  issue(body: unknown, ip: string, key?: string): Promise<Response>;
  /** `key` is what the pass was bound to: see `clientKey`. */
  verify(token: string | null, key: string): Promise<boolean>;
}

export interface ApiDeps {
  env: ApiEnv;
  budget: Budget;
  burst: Burst;
  sessions: Sessions;
  fetch: typeof fetch;
  now: () => number;
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

/** The dev server's sessions: Turnstile is skipped and any token is accepted. */
export const OPEN_SESSIONS: Sessions = {
  issue: async (_body, _ip) =>
    json(200, { token: "dev", expiresAt: new Date(Date.now() + 7200_000).toISOString() }),
  verify: async () => true,
};

function limitsFrom(env: ApiEnv): Limits {
  const n = (v: string | undefined, fallback: number) => {
    const x = Number(v);
    return Number.isInteger(x) && x > 0 ? x : fallback;
  };
  return { perPlayer: n(env.DAILY_CALLS_PER_PLAYER, 600), total: n(env.DAILY_CALLS_TOTAL, 20000) };
}

function upstreamFrom(env: ApiEnv): UpstreamConfig | null {
  if (!env.JEV_API_KEY) return null;
  const route = env.JEV_ROUTE ?? "typesafe";
  const model =
    route === "vercel"
      ? VERCEL_MODEL
      : route === "lolipop"
        ? LOLIPOP_MODEL
        : (env.JEV_MODEL ?? "jev-latest");
  return {
    apiKey: env.JEV_API_KEY,
    route,
    model,
    ...(env.JEV_CF_ACCOUNT ? { cfAccount: env.JEV_CF_ACCOUNT } : {}),
    ...(env.JEV_CF_GATEWAY ? { cfGateway: env.JEV_CF_GATEWAY } : {}),
    ...(env.JEV_CF_PROVIDER ? { cfProvider: env.JEV_CF_PROVIDER } : {}),
    ...(env.JEV_CF_TOKEN ? { cfToken: env.JEV_CF_TOKEN } : {}),
    ...(env.TYPESAFE_BASE_URL ? { typesafeBaseUrl: env.TYPESAFE_BASE_URL } : {}),
  };
}

/** Production must have its guards configured; only the dev server may run without them. */
function guarded(env: ApiEnv): boolean {
  return env.DEV_OPEN === "1" || (Boolean(env.TURNSTILE_SECRET) && Boolean(env.SESSION_SECRET));
}

/**
 * `null` means "refuse": in production every request carries `cf-connecting-ip` (Cloudflare
 * sets it), so a missing or empty header is never a real player — and a token issued to a
 * placeholder IP would verify for any header-less request. The Vite dev server never sets this
 * header, so `DEV_OPEN` falls back to a fixed loopback address instead of refusing everything.
 */
function ipOf(request: Request, devOpen: boolean): string | null {
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) return ip;
  return devOpen ? "127.0.0.1" : null;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEXTET = /^[0-9a-f]{1,4}$/;

function isIpv4(ip: string): boolean {
  const m = IPV4.exec(ip);
  return m?.slice(1).every((part) => Number(part) <= 255) ?? false;
}

/** The eight hextets of an IPv6 address, or `null` when it is not one. */
function hextets(ip: string): number[] | null {
  let text = ip.toLowerCase().replace(/%.*$/, "");
  // A dotted IPv4 tail (`::ffff:1.2.3.4`) is the last two hextets written another way.
  const tail = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (tail) {
    const head = tail[1] as string;
    const v4 = tail[2] as string;
    if (!isIpv4(v4)) return null;
    const [a, b, c, d] = v4.split(".").map(Number) as [number, number, number, number];
    text = `${head}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const split = (half: string | undefined) => (half ? half.split(":") : []);
  const left = split(halves[0]);
  const right = split(halves[1]);
  if (![...left, ...right].every((part) => HEXTET.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const fill = new Array<string>(missing).fill("0");
  return [...left, ...fill, ...right].map((part) => Number.parseInt(part, 16));
}

/**
 * The key a player is counted and bound by. IPv4 is the address itself; IPv6 is its /64,
 * because one connection is usually handed a whole /64 and could otherwise take a fresh budget
 * with every address in it. A v4-mapped address (`::ffff:a.b.c.d`) is the IPv4 it carries.
 * Anything unreadable is left as it is.
 */
export function clientKey(ip: string): string {
  if (isIpv4(ip)) return ip;
  const h = hextets(ip);
  if (h === null) return ip;
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) {
    const hi = h[6] as number;
    const lo = h[7] as number;
    return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
  }
  return `${h
    .slice(0, 4)
    .map((x) => x.toString(16))
    .join(":")}::/64`;
}

async function readJson(request: Request): Promise<unknown | undefined> {
  // Refuse an oversized body by its declared length before reading any of it; the byte check
  // below still catches a chunked body that declares nothing.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return undefined;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function handleApi(request: Request, deps: ApiDeps): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname !== "/api/session" && pathname !== "/api/jev/decide")
    return json(404, { error: "not_found" });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!guarded(deps.env)) return json(503, { error: "unavailable" });
  const ip = ipOf(request, deps.env.DEV_OPEN === "1");
  if (ip === null) return json(400, { error: "bad_request" });
  const key = clientKey(ip);
  const slowDown = () => json(429, { error: "slow_down" }, { "retry-after": "2" });

  if (pathname === "/api/session") {
    // Every session request costs a Turnstile siteverify call: the same burst limit applies.
    if (!(await deps.burst.limit({ key })).success) return slowDown();
    const body = await readJson(request);
    return deps.sessions.issue(body, ip, key);
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!(await deps.sessions.verify(token, key))) return json(401, { error: "session_expired" });

  const req = parseDecideRequest(await readJson(request));
  if (req === null) return json(400, { error: "bad_request" });

  if (!(await deps.burst.limit({ key })).success) return slowDown();

  const upstream = upstreamFrom(deps.env);
  if (upstream === null) return json(503, { error: "unavailable" });

  const now = deps.now();
  const tonight = () => json(429, { error: "tonight_is_over", resumesAt: nextJstMidnight(now) });
  if (!(await deps.budget.take(key, jstDay(now), limitsFrom(deps.env)))) return tonight();

  const outcome = await callJev(req, upstream, deps.fetch);
  switch (outcome.kind) {
    case "ok":
      return json(200, outcome.answer);
    case "tonight":
      return tonight();
    case "unavailable":
      return json(503, { error: "unavailable" });
    case "error":
      return json(502, { error: "upstream_error" });
  }
}
