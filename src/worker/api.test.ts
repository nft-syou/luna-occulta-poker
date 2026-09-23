import { describe, expect, it, vi } from "vitest";
import { type ApiDeps, clientKey, handleApi, OPEN_SESSIONS } from "./api";
import { MemoryBudget } from "./budget";
import { VALID } from "./fixtures";
import { MAX_BODY_BYTES } from "./schema";

const ANSWER = {
  model: "jev-latest",
  answers: {
    action: { type: "choice", choice: "check_or_call", probabilities: { check_or_call: 1 } },
    sizing: { type: "score", score: 1 },
    bluff_intent: { type: "noul", noul: 0.1 },
  },
};

function deps(over: Partial<ApiDeps> = {}): ApiDeps {
  return {
    env: { JEV_API_KEY: "sk-op", DEV_OPEN: "1" },
    budget: new MemoryBudget(),
    burst: { limit: async () => ({ success: true }) },
    sessions: OPEN_SESSIONS,
    fetch: vi.fn(async () => new Response(JSON.stringify(ANSWER), { status: 200 })),
    now: () => Date.UTC(2026, 8, 23, 3, 0),
    ...over,
  };
}

const decide = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/api/jev/decide", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer dev", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("handleApi", () => {
  it("answers a valid decision with the three answers only", async () => {
    const res = await handleApi(decide(VALID), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      model: "jev-latest",
      action: { choice: "check_or_call", probabilities: { check_or_call: 1 } },
      sizing: { score: 1 },
      bluff_intent: { noul: 0.1 },
    });
  });

  it("knows no other path or method", async () => {
    expect(
      (await handleApi(new Request("http://x/api/jev/v1/systemone", { method: "POST" }), deps()))
        .status,
    ).toBe(404);
    expect((await handleApi(new Request("http://x/api/jev/decide"), deps())).status).toBe(405);
  });

  it("checks the session first", async () => {
    const sessions = { ...OPEN_SESSIONS, verify: async () => false };
    const res = await handleApi(decide(VALID), deps({ sessions }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "session_expired" });
  });

  it("refuses a bad shape before spending anything", async () => {
    const d = deps();
    expect((await handleApi(decide({ ...VALID, task: "write a poem" }), d)).status).toBe(400);
    expect((await handleApi(decide("x".repeat(20000)), d)).status).toBe(400);
    expect((await handleApi(decide("{not json"), d)).status).toBe(400);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("slows a burst down", async () => {
    const res = await handleApi(
      decide(VALID),
      deps({ burst: { limit: async () => ({ success: false }) } }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("2");
    expect(await res.json()).toEqual({ error: "slow_down" });
  });

  it("ends the night when the budget is spent, with the time it comes back", async () => {
    const d = deps({ env: { JEV_API_KEY: "sk-op", DEV_OPEN: "1", DAILY_CALLS_PER_PLAYER: "1" } });
    expect((await handleApi(decide(VALID), d)).status).toBe(200);
    const res = await handleApi(decide(VALID), d);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "tonight_is_over",
      resumesAt: "2026-09-23T15:00:00.000Z",
    });
  });

  it("maps the upstream's refusals", async () => {
    const up = (status: number) =>
      deps({ fetch: vi.fn(async () => new Response("{}", { status })) });
    expect((await handleApi(decide(VALID), up(402))).status).toBe(429);
    expect((await handleApi(decide(VALID), up(401))).status).toBe(503);
    expect((await handleApi(decide(VALID), up(500))).status).toBe(502);
  });

  it("refuses to run open in production", async () => {
    const res = await handleApi(
      decide(VALID),
      deps({ env: { JEV_API_KEY: "sk-op" }, sessions: OPEN_SESSIONS }),
    );
    expect(res.status).toBe(503);
  });

  it("is unavailable without an operator key", async () => {
    expect((await handleApi(decide(VALID), deps({ env: { DEV_OPEN: "1" } }))).status).toBe(503);
  });

  it("refuses a production request without cf-connecting-ip before touching sessions or budget", async () => {
    const sessions = { ...OPEN_SESSIONS, verify: vi.fn(async () => true) };
    const budget = new MemoryBudget();
    const takeSpy = vi.spyOn(budget, "take");
    const d = deps({
      env: { JEV_API_KEY: "sk-op", TURNSTILE_SECRET: "ts", SESSION_SECRET: "ss" },
      sessions,
      budget,
    });
    const res = await handleApi(decide(VALID), d);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
    expect(sessions.verify).not.toHaveBeenCalled();
    expect(takeSpy).not.toHaveBeenCalled();

    const sessionRes = await handleApi(
      new Request("http://x/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnstileToken: "tok" }),
      }),
      d,
    );
    expect(sessionRes.status).toBe(400);
  });

  it("treats an empty cf-connecting-ip header the same as a missing one in production", async () => {
    const d = deps({ env: { JEV_API_KEY: "sk-op", TURNSTILE_SECRET: "ts", SESSION_SECRET: "ss" } });
    const res = await handleApi(decide(VALID, { "cf-connecting-ip": "" }), d);
    expect(res.status).toBe(400);
  });

  it("still falls back to a loopback IP for the dev server without the header", async () => {
    // DEV_OPEN deps() already omits cf-connecting-ip on every other test in this file; this one
    // makes the fallback explicit rather than incidental.
    const res = await handleApi(decide(VALID), deps());
    expect(res.status).toBe(200);
  });

  it("asks the gateways for Jev by the id each one lists it under", async () => {
    for (const [route, model, host] of [
      ["vercel", "typesafe-ai/jev", "https://ai-gateway.vercel.sh/typesafe/"],
      ["lolipop", "typesafe/jev-latest", "https://ai-gateway.lolipop.jp/"],
    ] as const) {
      const d = deps({ env: { JEV_API_KEY: "sk-op", DEV_OPEN: "1", JEV_ROUTE: route } });
      expect((await handleApi(decide(VALID), d)).status).toBe(200);
      const [url, init] = vi.mocked(d.fetch).mock.calls[0] as [string, RequestInit];
      expect(url.startsWith(host)).toBe(true);
      expect(JSON.parse(init.body as string).model).toBe(model);
    }
  });

  it("slows a burst of session requests down before asking Turnstile", async () => {
    const sessions = { ...OPEN_SESSIONS, issue: vi.fn(OPEN_SESSIONS.issue) };
    const limit = vi.fn(async (_o: { key: string }) => ({ success: false }));
    const res = await handleApi(
      new Request("http://x/api/session", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4" },
        body: JSON.stringify({ turnstileToken: "tok" }),
      }),
      deps({ sessions, burst: { limit } }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("2");
    expect(await res.json()).toEqual({ error: "slow_down" });
    expect(limit).toHaveBeenCalledWith({ key: "1.2.3.4" });
    expect(sessions.issue).not.toHaveBeenCalled();
  });

  it("refuses a body whose declared length is too large without reading it", async () => {
    const big = (path: string) =>
      new Request(`http://x${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer dev",
          "content-length": String(MAX_BODY_BYTES + 1),
        },
        body: JSON.stringify(VALID),
      });
    const d = deps();
    const decideReq = big("/api/jev/decide");
    expect((await handleApi(decideReq, d)).status).toBe(400);
    expect(decideReq.bodyUsed).toBe(false);
    expect(d.fetch).not.toHaveBeenCalled();

    // The session path hands Turnstile no body at all, which it answers 403 turnstile_failed.
    const issue = vi.fn(OPEN_SESSIONS.issue);
    const sessionReq = big("/api/session");
    await handleApi(sessionReq, deps({ sessions: { ...OPEN_SESSIONS, issue } }));
    expect(sessionReq.bodyUsed).toBe(false);
    expect(issue.mock.calls[0]?.[0]).toBeUndefined();
  });

  it("counts an IPv6 player by their /64, so a new address in it is the same player", async () => {
    const limit = vi.fn(async (_o: { key: string }) => ({ success: true }));
    const budget = new MemoryBudget();
    const take = vi.spyOn(budget, "take");
    const issue = vi.fn(async (_body: unknown, _ip: string, _key?: string) => new Response("{}"));
    const verify = vi.fn(async (_token: string | null, _key: string) => true);
    const d = deps({ burst: { limit }, budget, sessions: { issue, verify } });
    const ip = "2001:db8:1:2:aaaa:bbbb:cccc:dddd";
    await handleApi(decide(VALID, { "cf-connecting-ip": ip }), d);
    expect(verify).toHaveBeenCalledWith("dev", "2001:db8:1:2::/64");
    expect(limit).toHaveBeenCalledWith({ key: "2001:db8:1:2::/64" });
    expect(take.mock.calls[0]?.[0]).toBe("2001:db8:1:2::/64");
    await handleApi(
      new Request("http://x/api/session", {
        method: "POST",
        headers: { "cf-connecting-ip": ip },
        body: "{}",
      }),
      d,
    );
    // Turnstile still hears the real address; the pass is bound to the /64.
    expect(issue).toHaveBeenCalledWith({}, ip, "2001:db8:1:2::/64");
  });
});

describe("clientKey", () => {
  it("keeps IPv4 as it is", () => {
    expect(clientKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("reads a v4-mapped IPv6 address as the IPv4 it carries", () => {
    expect(clientKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(clientKey("::FFFF:203.0.113.7")).toBe("203.0.113.7");
    expect(clientKey("::ffff:cb00:7107")).toBe("203.0.113.7");
  });

  it("keys a full IPv6 address by its /64", () => {
    expect(clientKey("2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(clientKey("2001:DB8:1:2:AAAA:BBBB:CCCC:DDDD")).toBe("2001:db8:1:2::/64");
  });

  it("keys a compressed IPv6 address by its /64", () => {
    expect(clientKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(clientKey("2001:db8:1:2::")).toBe("2001:db8:1:2::/64");
    expect(clientKey("::1")).toBe("0:0:0:0::/64");
    expect(clientKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("leaves anything it cannot read alone", () => {
    expect(clientKey("not an ip")).toBe("not an ip");
    expect(clientKey("1:2:3:4:5:6:7:8:9")).toBe("1:2:3:4:5:6:7:8:9");
  });
});
