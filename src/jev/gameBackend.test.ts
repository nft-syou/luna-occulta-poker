import { buildQuestions, personaPrompt } from "@jev-poker/agent";
import { APIError } from "@typesafe-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { spirit } from "../characters/spirits";
import { VALID } from "../worker/fixtures";
import { createGameBackend, DEV_SESSION, toDecideRequest } from "./gameBackend";

const STATE = {
  task: VALID.task,
  persona: personaPrompt(spirit("mami").persona),
  importantContext: VALID.importantContext,
  hand: VALID.hand,
  table: VALID.table,
  history: VALID.history,
};
const QUESTIONS = buildQuestions(
  { canFold: true, canCheck: false, callAmount: 2, minRaiseTo: null, maxRaiseTo: null },
  { street: "flop" },
);
const ANSWER = {
  model: "jev-latest",
  action: { choice: "fold", probabilities: { fold: 0.8, check_or_call: 0.2 } },
  sizing: { score: 0 },
  bluff_intent: { noul: 0.05 },
};

describe("toDecideRequest", () => {
  it("sends structure only: the spirit id, the legal labels, the allowlisted prose", () => {
    const req = toDecideRequest({ state: STATE, questions: QUESTIONS }) as Record<string, unknown>;
    expect(req.spirit).toBe("mami");
    expect(req.legal).toEqual({ fold: true, checkOrCall: true, betOrRaise: false });
    expect(req).not.toHaveProperty("persona");
    expect(req).not.toHaveProperty("questions");
    expect(JSON.stringify(req)).not.toContain(spirit("mami").persona.description.en);
  });
});

describe("createGameBackend", () => {
  const ok = () =>
    vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(ANSWER), { status: 200 }),
    );

  it("returns the answers in the SDK's shape", async () => {
    const f = ok();
    const backend = createGameBackend({ session: DEV_SESSION, onStop: () => {}, fetch: f });
    const result = await backend.systemOne({ state: STATE as never, questions: QUESTIONS });
    expect(result.answers.action.probabilities).toEqual({ fold: 0.8, check_or_call: 0.2 });
    expect(result.answers.sizing.score).toBe(0);
    expect(result.answers.bluff_intent.noul).toBe(0.05);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/jev/decide");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer dev");
  });

  it("renews an expired session once and retries", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "session_expired" }), { status: 401 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(ANSWER), { status: 200 }));
    const renew = vi.fn(async () => "fresh");
    const backend = createGameBackend({
      session: { token: async () => "old", renew },
      onStop: () => {},
      fetch: f,
    });
    await backend.systemOne({ state: STATE, questions: QUESTIONS } as never);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(
      new Headers((f.mock.calls[1] as [string, RequestInit])[1].headers).get("authorization"),
    ).toBe("Bearer fresh");
  });

  it("waits out a burst once", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "slow_down" }), {
          status: 429,
          headers: { "retry-after": "2" },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(ANSWER), { status: 200 }));
    const sleep = vi.fn(async () => {});
    const backend = createGameBackend({ session: DEV_SESSION, onStop: () => {}, fetch: f, sleep });
    await backend.systemOne({ state: STATE, questions: QUESTIONS } as never);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("stops the table for the night, and when Jev is unavailable, as a 402 the agent pauses on", async () => {
    for (const [status, error, reason] of [
      [429, "tonight_is_over", "tonight"],
      [503, "unavailable", "unavailable"],
    ] as const) {
      const onStop = vi.fn();
      const f = vi.fn(async () => new Response(JSON.stringify({ error }), { status }));
      const backend = createGameBackend({ session: DEV_SESSION, onStop, fetch: f });
      const err = await backend
        .systemOne({ state: STATE, questions: QUESTIONS } as never)
        .catch((e) => e);
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(402);
      expect(onStop).toHaveBeenCalledWith(reason);
    }
  });

  it("stops the table as unavailable when the session cannot be had", async () => {
    const boom = async (): Promise<string> => {
      throw new Error("turnstile timed out");
    };
    const cases = [
      { session: { token: boom, renew: boom }, first: 200 },
      { session: { token: async () => "old", renew: boom }, first: 401 },
    ];
    for (const { session, first } of cases) {
      const onStop = vi.fn();
      const f = vi.fn(
        async () =>
          new Response(JSON.stringify(first === 200 ? ANSWER : { error: "session_expired" }), {
            status: first,
          }),
      );
      const backend = createGameBackend({ session, onStop, fetch: f });
      const err = await backend
        .systemOne({ state: STATE, questions: QUESTIONS } as never)
        .catch((e) => e);
      expect(err).toBeInstanceOf(APIError);
      expect((err as APIError).status).toBe(402);
      expect(onStop).toHaveBeenCalledWith("unavailable");
    }
  });

  it("stops as unavailable when a renewed session is refused too", async () => {
    const onStop = vi.fn();
    const f = vi.fn(
      async () => new Response(JSON.stringify({ error: "session_expired" }), { status: 401 }),
    );
    const renew = vi.fn(async () => "fresh");
    const backend = createGameBackend({
      session: { token: async () => "old", renew },
      onStop,
      fetch: f,
    });
    const err = await backend
      .systemOne({ state: STATE, questions: QUESTIONS } as never)
      .catch((e) => e);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(2);
    expect((err as APIError).status).toBe(402);
    expect(onStop).toHaveBeenCalledWith("unavailable");
  });

  it("waits out a burst only once, then gives the agent the 429", async () => {
    const onStop = vi.fn();
    const f = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "slow_down" }), {
          status: 429,
          headers: { "retry-after": "2" },
        }),
    );
    const sleep = vi.fn(async () => {});
    const backend = createGameBackend({ session: DEV_SESSION, onStop, fetch: f, sleep });
    const err = await backend
      .systemOne({ state: STATE, questions: QUESTIONS } as never)
      .catch((e) => e);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(APIError);
    expect((err as APIError).status).toBe(429);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("falls back to two seconds when retry-after is not a number", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "slow_down" }), {
          status: 429,
          headers: { "retry-after": "soon" },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(ANSWER), { status: 200 }));
    const sleep = vi.fn(async () => {});
    const backend = createGameBackend({ session: DEV_SESSION, onStop: () => {}, fetch: f, sleep });
    await backend.systemOne({ state: STATE, questions: QUESTIONS } as never);
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});
