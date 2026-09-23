import { json, type Sessions } from "./api";

/** How long a pass lasts once Turnstile has let a player in. */
export const SESSION_TTL_MS = 2 * 3600 * 1000;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const BASE64URL = /^[A-Za-z0-9_-]+$/;

interface Pass {
  ip: string;
  exp: number;
}

function encodeBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** Throws on anything that is not unpadded base64url. */
function decodeBase64url(text: string): Uint8Array<ArrayBuffer> {
  if (!BASE64URL.test(text) || text.length % 4 === 1) throw new Error("not base64url");
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function signToken(secret: string, payload: Pass): Promise<string> {
  const part = encodeBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    new TextEncoder().encode(part),
  );
  return `${part}.${encodeBase64url(new Uint8Array(mac))}`;
}

function isPass(value: unknown): value is Pass {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.ip === "string" && typeof v.exp === "number";
}

/** True only for a pass signed with `secret`, issued to `ip`, and not yet expired. Never throws. */
export async function verifyToken(
  secret: string,
  token: string | null,
  ip: string,
  now: number,
): Promise<boolean> {
  if (!secret || token === null) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [part, sig] = parts as [string, string];
  try {
    // crypto.subtle.verify compares in constant time; the payload is read only once it is ours.
    const signed = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, "verify"),
      decodeBase64url(sig),
      new TextEncoder().encode(part),
    );
    if (!signed) return false;
    const payload: unknown = JSON.parse(new TextDecoder().decode(decodeBase64url(part)));
    return isPass(payload) && payload.ip === ip && payload.exp > now;
  } catch {
    return false;
  }
}

/** Asks Cloudflare whether a Turnstile token is good. Any failure along the way is a no. */
export async function verifyTurnstile(
  fetchImpl: typeof fetch,
  secret: string,
  token: string,
  ip: string,
): Promise<boolean> {
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
    });
    const body = (await res.json()) as { success?: unknown } | null;
    return body?.success === true;
  } catch {
    return false;
  }
}

function turnstileTokenOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const token = (body as { turnstileToken?: unknown }).turnstileToken;
  return typeof token === "string" && token !== "" ? token : null;
}

export function createSessions(o: {
  sessionSecret: string;
  turnstileSecret: string;
  fetch: typeof fetch;
  now: () => number;
}): Sessions {
  // The Worker already refuses to run unguarded; this is the same refusal one layer down.
  const configured = Boolean(o.sessionSecret) && Boolean(o.turnstileSecret);
  return {
    async issue(body, ip) {
      if (!configured) return json(503, { error: "unavailable" });
      const turnstileToken = turnstileTokenOf(body);
      if (
        turnstileToken === null ||
        !(await verifyTurnstile(o.fetch, o.turnstileSecret, turnstileToken, ip))
      ) {
        return json(403, { error: "turnstile_failed" });
      }
      const exp = o.now() + SESSION_TTL_MS;
      return json(200, {
        token: await signToken(o.sessionSecret, { ip, exp }),
        expiresAt: new Date(exp).toISOString(),
      });
    },
    verify: async (token, ip) => configured && verifyToken(o.sessionSecret, token, ip, o.now()),
  };
}
