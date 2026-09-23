import type { JevBackend } from "@jev-poker/agent";
import { APIError } from "@typesafe-ai/sdk";
import { SPIRITS } from "../characters/spirits";

export interface SessionSource {
  token(): Promise<string>;
  renew(): Promise<string>;
}

export const DEV_SESSION: SessionSource = { token: async () => "dev", renew: async () => "dev" };

export type StopReason = "tonight" | "unavailable";

export interface GameBackendOptions {
  session: SessionSource;
  onStop: (reason: StopReason) => void;
  fetch?: typeof fetch;
  endpoint?: string;
  sleep?: (ms: number) => Promise<void>;
}

type Obj = Record<string, unknown>;

/**
 * What the Worker gets instead of the SDK request: the structure of the decision and nothing
 * the browser wrote. The persona becomes a spirit id (the Worker has the text), the questions
 * become three booleans (the Worker rebuilds them), and the prose left is the library's own,
 * which the Worker checks against its allowlist.
 */
export function toDecideRequest(request: { state: unknown; questions: unknown }): unknown {
  const state = request.state as Obj;
  const persona = state.persona as { name?: unknown } | undefined;
  const spirit = SPIRITS.find((s) => s.persona.name.en === persona?.name)?.id ?? "arujidono";
  const action = (request.questions as { action?: { criteria?: Obj } }).action;
  const labels = Object.keys(action?.criteria ?? {});
  return {
    spirit,
    legal: {
      fold: labels.includes("fold"),
      checkOrCall: labels.includes("check_or_call"),
      betOrRaise: labels.includes("bet_or_raise"),
    },
    task: state.task,
    importantContext: state.importantContext,
    hand: state.hand,
    table: state.table,
    history: state.history,
  };
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createGameBackend(options: GameBackendOptions): JevBackend {
  const fetchImpl = options.fetch ?? fetch;
  const endpoint = options.endpoint ?? "/api/jev/decide";
  const sleep = options.sleep ?? defaultSleep;

  const post = (body: string, token: string, signal?: AbortSignal) =>
    fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body,
      ...(signal === undefined ? {} : { signal }),
    });

  /** Pauses the table the way the agent already understands: a 402 is a billing stop. */
  const stop = (reason: StopReason): never => {
    options.onStop(reason);
    throw new APIError(402, { error: reason }, new Headers(), reason);
  };

  return {
    kind: "typesafe",
    async systemOne(request, requestOptions) {
      const body = JSON.stringify(
        toDecideRequest(request as { state: unknown; questions: unknown }),
      );
      const signal = requestOptions?.signal ?? undefined;
      let res = await post(body, await options.session.token(), signal);
      if (res.status === 401) res = await post(body, await options.session.renew(), signal);
      if (res.status === 429) {
        const payload = (await res
          .clone()
          .json()
          .catch(() => ({}))) as { error?: string };
        if (payload.error === "tonight_is_over") stop("tonight");
        const seconds = Number(res.headers.get("retry-after") ?? "2");
        await sleep((Number.isFinite(seconds) ? seconds : 2) * 1000);
        res = await post(body, await options.session.token(), signal);
      }
      if (res.status === 401 || res.status === 503) stop("unavailable");
      if (res.status === 429) {
        const payload = (await res
          .clone()
          .json()
          .catch(() => ({}))) as { error?: string };
        if (payload.error === "tonight_is_over") stop("tonight");
      }
      if (!res.ok)
        throw new APIError(
          res.status,
          await res.json().catch(() => undefined),
          res.headers,
          `decide ${res.status}`,
        );
      const a = (await res.json()) as {
        model: string;
        action: { choice: string; probabilities: Record<string, number> };
        sizing: { score: number };
        bluff_intent: { noul: number };
      };
      return {
        model: a.model,
        answers: {
          action: {
            type: "choice",
            choice: a.action.choice,
            confidence: 0,
            probabilities: a.action.probabilities,
          },
          sizing: {
            type: "score",
            score: a.sizing.score,
            confidence: 0,
            legend: {},
            probabilities: {},
          },
          bluff_intent: { type: "noul", noul: a.bluff_intent.noul },
        },
        usage: { input_tokens: 0, output_tokens: 0 },
      } as never;
    },
  };
}
