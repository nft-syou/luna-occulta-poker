/**
 * The one description of how the browser reaches Jev, shared by the UI, the backend and the
 * proxy. It must stay dependency-free: `tsconfig.functions.json` compiles it for the
 * Cloudflare Pages Function, so it may not import React, the SDK or any node/browser API.
 *
 * The URL-building half of that story — the fixed hosts, the allow-listed paths and the
 * regex-anchored Cloudflare gateway segments — now lives in `../worker/upstream`; this module
 * imports and re-exports it so every existing importer keeps compiling unchanged.
 */

import {
  ALLOWED_PATHS,
  CF_ACCOUNT_ID_PATTERN,
  CF_GATEWAY_ID_PATTERN,
  CF_PROVIDER_SLUG_PATTERN,
  CLOUDFLARE_UPSTREAM,
  type CloudflareGatewayInput,
  isJevRoute,
  isProviderSlug,
  JEV_ROUTES,
  type JevRoute,
  LOLIPOP_MODEL,
  LOLIPOP_UPSTREAM,
  TYPESAFE_UPSTREAM,
  type UpstreamEnv,
  type UpstreamUrlError,
  upstreamUrl,
  VERCEL_MODEL,
  VERCEL_UPSTREAM,
} from "../worker/upstream.ts";

export {
  ALLOWED_PATHS,
  CF_ACCOUNT_ID_PATTERN,
  CF_GATEWAY_ID_PATTERN,
  CF_PROVIDER_SLUG_PATTERN,
  CLOUDFLARE_UPSTREAM,
  type CloudflareGatewayInput,
  isJevRoute,
  isProviderSlug,
  JEV_ROUTES,
  type JevRoute,
  LOLIPOP_MODEL,
  LOLIPOP_UPSTREAM,
  TYPESAFE_UPSTREAM,
  type UpstreamEnv,
  type UpstreamUrlError,
  upstreamUrl,
  VERCEL_MODEL,
  VERCEL_UPSTREAM,
};

export type Connection =
  | { route: "typesafe"; apiKey: string }
  /** `apiKey` is a Vercel AI Gateway key, not a TypeSafe one. */
  | { route: "vercel"; apiKey: string }
  /** `apiKey` is a Lolipop AI Gateway project key, not a TypeSafe one. */
  | { route: "lolipop"; apiKey: string }
  | {
      route: "cloudflare";
      apiKey: string;
      accountId: string;
      gatewayId: string;
      /** Without the `custom-` prefix the gateway URL adds. */
      providerSlug: string;
      gatewayToken?: string;
    };

/** The browser sends the key in this header; the proxy turns it into `Authorization`. */
export const API_KEY_HEADER = "X-TypeSafe-Key";
export const ROUTE_HEADER = "X-Jev-Route";
export const CF_ACCOUNT_HEADER = "X-Jev-CF-Account";
export const CF_GATEWAY_HEADER = "X-Jev-CF-Gateway";
export const CF_PROVIDER_HEADER = "X-Jev-CF-Provider";
export const CF_TOKEN_HEADER = "X-Jev-CF-Token";

/** Printable ASCII only: anything a header may carry, and nothing that could split one. */
export const SECRET_PATTERN = /^[\x21-\x7E]{1,512}$/;

export type ConnectionField =
  | "route"
  | "apiKey"
  | "accountId"
  | "gatewayId"
  | "providerSlug"
  | "gatewayToken";

/** Error values are i18n keys, so the modal can render them next to their field. */
export type ConnectionErrors = Partial<Record<ConnectionField, string>>;

export type ConnectionValidation =
  | { ok: true; connection: Connection }
  | { ok: false; errors: ConnectionErrors };

/**
 * Cloudflare shows the provider as `custom-<slug>` but the URL segment already adds that
 * prefix, so a pasted `custom-foo` must not become `custom-custom-foo`.
 */
export function normalizeProviderSlug(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith("custom-") ? trimmed.slice("custom-".length) : trimmed;
}

function trimmed(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

export function validateConnection(input: unknown): ConnectionValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: { route: "connection.error.route" } };
  }
  const raw = input as Partial<Record<ConnectionField, unknown>>;
  if (!isJevRoute(raw.route)) return { ok: false, errors: { route: "connection.error.route" } };
  const route = raw.route;

  const errors: ConnectionErrors = {};
  const apiKey = trimmed(raw.apiKey) ?? "";
  if (!SECRET_PATTERN.test(apiKey)) errors.apiKey = "connection.error.apiKey";

  if (route !== "cloudflare") {
    if (errors.apiKey !== undefined) return { ok: false, errors };
    return { ok: true, connection: { route, apiKey } };
  }

  // Hex is case-insensitive; stored lowercased so the same account has one spelling.
  const accountId = (trimmed(raw.accountId) ?? "").toLowerCase();
  if (!CF_ACCOUNT_ID_PATTERN.test(accountId)) errors.accountId = "connection.error.accountId";
  const gatewayId = trimmed(raw.gatewayId) ?? "";
  if (!CF_GATEWAY_ID_PATTERN.test(gatewayId)) errors.gatewayId = "connection.error.gatewayId";
  const providerSlug = normalizeProviderSlug(trimmed(raw.providerSlug) ?? "");
  if (!isProviderSlug(providerSlug)) errors.providerSlug = "connection.error.providerSlug";

  // The gateway token is optional: only a non-blank one has to look like a secret.
  const token = raw.gatewayToken === undefined ? "" : (trimmed(raw.gatewayToken) ?? "\u0000");
  if (token.length > 0 && !SECRET_PATTERN.test(token))
    errors.gatewayToken = "connection.error.gatewayToken";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    connection: {
      route,
      apiKey,
      accountId,
      gatewayId,
      providerSlug,
      ...(token.length > 0 ? { gatewayToken: token } : {}),
    },
  };
}

export function connectionHeaders(connection: Connection): Record<string, string> {
  const headers: Record<string, string> = {
    [API_KEY_HEADER]: connection.apiKey,
    [ROUTE_HEADER]: connection.route,
  };
  if (connection.route === "cloudflare") {
    headers[CF_ACCOUNT_HEADER] = connection.accountId;
    headers[CF_GATEWAY_HEADER] = connection.gatewayId;
    headers[CF_PROVIDER_HEADER] = connection.providerSlug;
    if (connection.gatewayToken !== undefined) headers[CF_TOKEN_HEADER] = connection.gatewayToken;
  }
  return headers;
}

export function modelFor(connection: Connection, settingsModel: string): string {
  if (connection.route === "vercel") return VERCEL_MODEL;
  if (connection.route === "lolipop") return LOLIPOP_MODEL;
  return settingsModel;
}
