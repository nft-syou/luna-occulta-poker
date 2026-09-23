/**
 * The one place an upstream Jev URL is built, used by the Worker alone. It stays
 * dependency-free (no React, no SDK, no node or browser API) so the Worker bundle carries
 * nothing it does not need.
 *
 * The security rule this module exists to enforce: nothing here ever accepts a free-form
 * upstream URL. `upstreamUrl` picks one of four fixed hosts by route id and interpolates only
 * values that passed an anchored regex here and then `encodeURIComponent`.
 */

export type JevRoute = "typesafe" | "vercel" | "lolipop" | "cloudflare";

export const JEV_ROUTES: readonly JevRoute[] = ["typesafe", "vercel", "lolipop", "cloudflare"];

export const CF_ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;
export const CF_GATEWAY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const CF_PROVIDER_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const TYPESAFE_UPSTREAM = "https://api.typesafe.ai";
export const VERCEL_UPSTREAM = "https://ai-gateway.vercel.sh/typesafe";
export const LOLIPOP_UPSTREAM = "https://ai-gateway.lolipop.jp";
export const CLOUDFLARE_UPSTREAM = "https://gateway.ai.cloudflare.com";

/** The Vercel AI Gateway addresses Jev by this id instead of `jev-latest`. */
export const VERCEL_MODEL = "typesafe-ai/jev";
/** The Lolipop AI Gateway lists Jev under this id. */
export const LOLIPOP_MODEL = "typesafe/jev-latest";

/** The only paths the Worker will ever call upstream, with the method each one allows. */
export const ALLOWED_PATHS: Readonly<Record<string, "GET" | "POST">> = {
  "v1/systemone": "POST",
};

export interface CloudflareGatewayInput {
  accountId?: unknown;
  gatewayId?: unknown;
  providerSlug?: unknown;
}

export interface UpstreamEnv {
  /** Overrides the upstream root of the `typesafe` route only (tests, staging). */
  TYPESAFE_BASE_URL?: string | undefined;
}

export type UpstreamUrlError = "invalid_route" | "invalid_path" | "invalid_gateway_config";

export function isJevRoute(value: unknown): value is JevRoute {
  return typeof value === "string" && (JEV_ROUTES as readonly string[]).includes(value);
}

/**
 * The URL segment is `custom-<slug>`, so the slug itself must not carry that prefix — one
 * `custom-` is stripped on the way in, and a second one (`custom-custom-x`) is a mistake the
 * player has to see in the modal rather than a 400 on every hand.
 */
export function isProviderSlug(slug: string): boolean {
  return CF_PROVIDER_SLUG_PATTERN.test(slug) && !slug.startsWith("custom-");
}

function trimmed(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

const SAFE_BASE_URL_PATTERNS = [
  /^https:\/\/[^\s]+$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/,
] as const;

/**
 * The single place an upstream URL is built. Every caller passes a route id and an
 * allow-listed path; nothing here is taken from user input except values that just matched
 * an anchored regex, and those are still `encodeURIComponent`d before interpolation.
 */
export function upstreamUrl(
  route: string | null | undefined,
  path: string,
  cf: CloudflareGatewayInput | null | undefined,
  env: UpstreamEnv,
): string | { error: UpstreamUrlError } {
  const id = route === null || route === undefined ? "typesafe" : route;
  if (!isJevRoute(id)) return { error: "invalid_route" };
  if (!Object.hasOwn(ALLOWED_PATHS, path)) return { error: "invalid_path" };

  if (id === "typesafe") {
    // An empty or malformed override would otherwise build a relative URL, or ship the key
    // over plain http to somewhere else entirely: fall back to the default instead.
    const override = (env.TYPESAFE_BASE_URL ?? "").trim();
    const safe = SAFE_BASE_URL_PATTERNS.some((pattern) => pattern.test(override));
    const base = (safe ? override : TYPESAFE_UPSTREAM).replace(/\/+$/, "");
    return `${base}/${path}`;
  }
  if (id === "vercel") return `${VERCEL_UPSTREAM}/${path}`;
  if (id === "lolipop") return `${LOLIPOP_UPSTREAM}/${path}`;

  const accountId = trimmed(cf?.accountId) ?? "";
  const gatewayId = trimmed(cf?.gatewayId) ?? "";
  const providerSlug = trimmed(cf?.providerSlug) ?? "";
  if (
    !CF_ACCOUNT_ID_PATTERN.test(accountId) ||
    !CF_GATEWAY_ID_PATTERN.test(gatewayId) ||
    !isProviderSlug(providerSlug)
  ) {
    return { error: "invalid_gateway_config" };
  }
  const segments = [accountId, gatewayId, `custom-${providerSlug}`].map(encodeURIComponent);
  return `${CLOUDFLARE_UPSTREAM}/v1/${segments.join("/")}/${path}`;
}
