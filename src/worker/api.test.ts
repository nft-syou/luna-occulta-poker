import { describe, expect, it, vi } from "vitest";
import { type ApiDeps, handleApi, OPEN_SESSIONS } from "./api";
import { MemoryBudget } from "./budget";
import { VALID } from "./fixtures";

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
});
