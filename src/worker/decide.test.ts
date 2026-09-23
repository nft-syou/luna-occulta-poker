import { buildQuestions, personaPrompt } from "@jev-poker/agent";
import { describe, expect, it, vi } from "vitest";
import { spirit } from "../characters/spirits";
import { buildJevBody, callJev, pickAnswer } from "./decide";
import { VALID } from "./fixtures";

const ANSWER = {
  model: "jev-latest",
  answers: {
    action: {
      type: "choice",
      choice: "bet_or_raise",
      confidence: 0.7,
      probabilities: { fold: 0.1, check_or_call: 0.2, bet_or_raise: 0.7 },
    },
    sizing: { type: "score", score: 2, confidence: 0.6, legend: {}, probabilities: {} },
    bluff_intent: { type: "noul", noul: 0.2 },
  },
  usage: { input_tokens: 900, output_tokens: 3 },
  secret_debug: "dropped",
};

const CFG = { apiKey: "sk-op", route: "typesafe", model: "jev-latest" };

describe("buildJevBody", () => {
  it("takes the persona from the spirit and the questions from the library, never from the request", () => {
    const body = buildJevBody(VALID, "jev-latest");
    const state = body.state as Record<string, unknown>;
    expect(state.persona).toEqual(personaPrompt(spirit("sakuya").persona));
    expect(state.task).toBe(VALID.task);
    expect(state.importantContext).toEqual(VALID.importantContext);
    expect(state.hand).toEqual(VALID.hand);
    expect(body.questions).toEqual(
      buildQuestions(
        { canFold: true, canCheck: true, callAmount: null, minRaiseTo: 4, maxRaiseTo: 200 },
        { street: "flop", style: "unified" },
      ),
    );
    expect(body.model).toBe("jev-latest");
  });
});

describe("pickAnswer", () => {
  it("keeps the three answers and drops everything else", () => {
    expect(pickAnswer(ANSWER)).toEqual({
      model: "jev-latest",
      action: {
        choice: "bet_or_raise",
        probabilities: { fold: 0.1, check_or_call: 0.2, bet_or_raise: 0.7 },
      },
      sizing: { score: 2 },
      bluff_intent: { noul: 0.2 },
    });
  });
  it("refuses a malformed answer", () => {
    expect(pickAnswer({ answers: {} })).toBeNull();
    expect(pickAnswer(null)).toBeNull();
  });
  it("refuses null in place of an object at any level, instead of throwing", () => {
    expect(pickAnswer({ model: "jev-latest", answers: null })).toBeNull();
    expect(
      pickAnswer({
        model: "jev-latest",
        answers: {
          action: null,
          sizing: ANSWER.answers.sizing,
          bluff_intent: ANSWER.answers.bluff_intent,
        },
      }),
    ).toBeNull();
    expect(
      pickAnswer({
        model: "jev-latest",
        answers: {
          action: { choice: "bet_or_raise", probabilities: null },
          sizing: ANSWER.answers.sizing,
          bluff_intent: ANSWER.answers.bluff_intent,
        },
      }),
    ).toBeNull();
  });
});

describe("callJev", () => {
  const respond = (status: number, body: unknown = ANSWER) =>
    vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(body), { status }),
    );

  it("posts with the operator key to the configured upstream", async () => {
    const f = respond(200);
    const out = await callJev(VALID, CFG, f);
    expect(out.kind).toBe("ok");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-op");
  });

  it("turns 402 into tonight, 401/403 into unavailable and the rest into error", async () => {
    expect((await callJev(VALID, CFG, respond(402))).kind).toBe("tonight");
    expect((await callJev(VALID, CFG, respond(401))).kind).toBe("unavailable");
    expect((await callJev(VALID, CFG, respond(403))).kind).toBe("unavailable");
    expect((await callJev(VALID, CFG, respond(500))).kind).toBe("error");
    expect((await callJev(VALID, CFG, respond(200, { nope: 1 }))).kind).toBe("error");
    const broken = vi.fn(async () => {
      throw new Error("down");
    });
    expect((await callJev(VALID, CFG, broken)).kind).toBe("error");
  });

  it("turns a 200 with a null answers.action into error, without rejecting", async () => {
    const malformed = {
      ...ANSWER,
      answers: { ...ANSWER.answers, action: null },
    };
    await expect(callJev(VALID, CFG, respond(200, malformed))).resolves.toEqual({ kind: "error" });
  });

  it("sends the cloudflare gateway token as cf-aig-authorization, mirroring the proxy", async () => {
    const f = respond(200);
    const cfCfg = {
      apiKey: "sk-op",
      route: "cloudflare",
      model: "jev-latest",
      cfAccount: "0123456789abcdef0123456789abcdef",
      cfGateway: "my-gateway",
      cfProvider: "typesafe",
      cfToken: "gw-tok",
    };
    await callJev(VALID, cfCfg, f);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/my-gateway/custom-typesafe/v1/systemone",
    );
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-op");
    expect(headers.get("cf-aig-authorization")).toBe("Bearer gw-tok");
  });

  it("omits cf-aig-authorization on the cloudflare route when no gateway token is configured", async () => {
    const f = respond(200);
    const cfCfg = {
      apiKey: "sk-op",
      route: "cloudflare",
      model: "jev-latest",
      cfAccount: "0123456789abcdef0123456789abcdef",
      cfGateway: "my-gateway",
      cfProvider: "typesafe",
    };
    await callJev(VALID, cfCfg, f);
    const [, init] = f.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("cf-aig-authorization")).toBe(false);
  });

  it("never sends cf-aig-authorization on a non-cloudflare route, even if a token is configured", async () => {
    const f = respond(200);
    await callJev(VALID, { ...CFG, cfToken: "gw-tok" }, f);
    const [, init] = f.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("cf-aig-authorization")).toBe(false);
  });
});
