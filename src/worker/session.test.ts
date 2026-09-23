import { describe, expect, it, vi } from "vitest";
import { createSessions, signToken, verifyToken, verifyTurnstile } from "./session";

const NOW = Date.UTC(2026, 8, 23, 3);

describe("session tokens", () => {
  it("verify for the same ip before they expire", async () => {
    const t = await signToken("s3cret", { ip: "1.2.3.4", exp: NOW + 1000 });
    expect(await verifyToken("s3cret", t, "1.2.3.4", NOW)).toBe(true);
    expect(await verifyToken("s3cret", t, "5.6.7.8", NOW)).toBe(false);
    expect(await verifyToken("s3cret", t, "1.2.3.4", NOW + 1001)).toBe(false);
    expect(await verifyToken("other", t, "1.2.3.4", NOW)).toBe(false);
  });

  it("do not survive tampering", async () => {
    const t = await signToken("s3cret", { ip: "1.2.3.4", exp: NOW + 1000 });
    const [payload, sig] = t.split(".") as [string, string];
    const forgedPayload = btoa(JSON.stringify({ ip: "1.2.3.4", exp: NOW + 99_999_999 })).replace(
      /=+$/,
      "",
    );
    // The forgery is well-formed base64url, so it is the signature that turns it away.
    expect(forgedPayload).toMatch(/^[A-Za-z0-9_-]+$/);
    const forged = `${forgedPayload}.${sig}`;
    expect(await verifyToken("s3cret", forged, "1.2.3.4", NOW)).toBe(false);
    expect(await verifyToken("s3cret", `${payload}.`, "1.2.3.4", NOW)).toBe(false);
    expect(await verifyToken("s3cret", `.${sig}`, "1.2.3.4", NOW)).toBe(false);
    expect(await verifyToken("s3cret", `${t}.x`, "1.2.3.4", NOW)).toBe(false);
    expect(await verifyToken("s3cret", `${payload}.${sig}=`, "1.2.3.4", NOW)).toBe(false);
    expect(await verifyToken("s3cret", null, "1.2.3.4", NOW)).toBe(false);
    expect(await verifyToken("s3cret", "garbage", "1.2.3.4", NOW)).toBe(false);
  });

  it("reject a signed payload that is not a pass", async () => {
    const enc = (s: string) => btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("s3cret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    for (const body of ["not json", "null", '{"ip":1,"exp":"soon"}']) {
      const part = enc(body);
      const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(part));
      const sig = enc(String.fromCharCode(...new Uint8Array(mac)));
      expect(await verifyToken("s3cret", `${part}.${sig}`, "1.2.3.4", NOW)).toBe(false);
    }
  });
});

describe("turnstile", () => {
  it("asks siteverify and trusts only success", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    expect(await verifyTurnstile(f, "sec", "tok", "1.2.3.4")).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    const form = new URLSearchParams(String(init.body));
    expect(form.get("secret")).toBe("sec");
    expect(form.get("response")).toBe("tok");
    expect(form.get("remoteip")).toBe("1.2.3.4");
    const no = vi.fn(async () => new Response(JSON.stringify({ success: false })));
    expect(await verifyTurnstile(no, "sec", "tok", "1.2.3.4")).toBe(false);
  });

  it("treats a network or JSON failure as a failure", async () => {
    const down = vi.fn(async (): Promise<Response> => {
      throw new TypeError("network");
    });
    expect(await verifyTurnstile(down, "sec", "tok", "1.2.3.4")).toBe(false);
    const html = vi.fn(async () => new Response("<html>"));
    expect(await verifyTurnstile(html, "sec", "tok", "1.2.3.4")).toBe(false);
  });

  it("issues a token only after Turnstile passes", async () => {
    const pass = createSessions({
      sessionSecret: "s3cret",
      turnstileSecret: "sec",
      now: () => NOW,
      fetch: vi.fn(async () => new Response(JSON.stringify({ success: true }))),
    });
    const ok = await pass.issue({ turnstileToken: "tok" }, "1.2.3.4");
    expect(ok.status).toBe(200);
    const { token, expiresAt } = (await ok.json()) as { token: string; expiresAt: string };
    expect(Date.parse(expiresAt)).toBe(NOW + 2 * 3600 * 1000);
    expect(await pass.verify(token, "1.2.3.4")).toBe(true);
    expect(await pass.verify(token, "5.6.7.8")).toBe(false);

    const fail = createSessions({
      sessionSecret: "s3cret",
      turnstileSecret: "sec",
      now: () => NOW,
      fetch: vi.fn(async () => new Response(JSON.stringify({ success: false }))),
    });
    const refused = await fail.issue({ turnstileToken: "tok" }, "1.2.3.4");
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "turnstile_failed" });
    expect((await fail.issue({}, "1.2.3.4")).status).toBe(403);
    expect((await fail.issue(undefined, "1.2.3.4")).status).toBe(403);
  });

  it("refuses to work without its secrets", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    // A pass that would be valid, were an empty secret acceptable.
    const token = await signToken("s3cret", { ip: "1.2.3.4", exp: NOW + 1000 });
    for (const secrets of [
      { sessionSecret: "", turnstileSecret: "sec" },
      { sessionSecret: "s3cret", turnstileSecret: "" },
    ]) {
      const s = createSessions({ ...secrets, now: () => NOW, fetch: f });
      const res = await s.issue({ turnstileToken: "tok" }, "1.2.3.4");
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "unavailable" });
      expect(await s.verify(token, "1.2.3.4")).toBe(false);
    }
    expect(f).not.toHaveBeenCalled();
  });
});
