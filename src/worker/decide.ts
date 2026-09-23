import { buildQuestions, personaPrompt } from "@jev-poker/agent";
import type { LegalActions } from "@jev-poker/engine";
import { spirit } from "../characters/spirits";
import { styleOfTask } from "./prose";
import type { DecideLegal, DecideRequest } from "./schema";
import { upstreamUrl } from "./upstream";

export interface UpstreamConfig {
  apiKey: string;
  route: string;
  model: string;
  cfAccount?: string;
  cfGateway?: string;
  cfProvider?: string;
  cfToken?: string;
  typesafeBaseUrl?: string;
}

export interface DecideAnswer {
  model: string;
  action: { choice: string; probabilities: Record<string, number> };
  sizing: { score: number };
  bluff_intent: { noul: number };
}

export type UpstreamOutcome =
  | { kind: "ok"; answer: DecideAnswer }
  | { kind: "tonight" }
  | { kind: "unavailable" }
  | { kind: "error" };

/** The smallest `LegalActions` whose offered labels are exactly `legal`: all `buildQuestions` reads. */
function legalActions(legal: DecideLegal): LegalActions {
  return {
    canFold: legal.fold,
    canCheck: legal.checkOrCall,
    callAmount: null,
    minRaiseTo: legal.betOrRaise ? 4 : null,
    maxRaiseTo: legal.betOrRaise ? 200 : null,
  };
}

export function buildJevBody(req: DecideRequest, model: string) {
  const style = styleOfTask(req.task) ?? "unified";
  return {
    state: {
      task: req.task,
      persona: personaPrompt(spirit(req.spirit).persona),
      importantContext: req.importantContext,
      hand: req.hand,
      table: req.table,
      history: req.history,
    },
    questions: buildQuestions(legalActions(req.legal), { street: req.hand.street, style }),
    model,
  };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function pickAnswer(json: unknown): DecideAnswer | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as { model?: unknown; answers?: Record<string, Record<string, unknown>> };
  const a = j.answers;
  if (typeof j.model !== "string" || a === undefined) return null;
  const action = a.action;
  const sizing = a.sizing;
  const bluff = a.bluff_intent;
  if (action === undefined || sizing === undefined || bluff === undefined) return null;
  if (typeof action.choice !== "string" || typeof action.probabilities !== "object") return null;
  if (!finite(sizing.score) || !finite(bluff.noul)) return null;
  const probabilities: Record<string, number> = {};
  for (const [k, v] of Object.entries(action.probabilities as Record<string, unknown>)) {
    if (finite(v)) probabilities[k] = v;
  }
  return {
    model: j.model,
    action: { choice: action.choice, probabilities },
    sizing: { score: sizing.score },
    bluff_intent: { noul: bluff.noul },
  };
}

export async function callJev(
  req: DecideRequest,
  cfg: UpstreamConfig,
  fetchImpl: typeof fetch,
): Promise<UpstreamOutcome> {
  const url = upstreamUrl(
    cfg.route,
    "v1/systemone",
    { accountId: cfg.cfAccount, gatewayId: cfg.cfGateway, providerSlug: cfg.cfProvider },
    { TYPESAFE_BASE_URL: cfg.typesafeBaseUrl },
  );
  if (typeof url !== "string") return { kind: "unavailable" };
  // Every route authenticates the same way the proxy does: the operator's key as a bearer
  // token. Only an authenticated Cloudflare AI Gateway wants its own token alongside it.
  const headers = new Headers({
    authorization: `Bearer ${cfg.apiKey}`,
    "content-type": "application/json",
    accept: "application/json",
  });
  if (cfg.route === "cloudflare" && cfg.cfToken) {
    headers.set("cf-aig-authorization", `Bearer ${cfg.cfToken}`);
  }
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(buildJevBody(req, cfg.model)),
    });
  } catch {
    return { kind: "error" };
  }
  if (res.status === 402) return { kind: "tonight" };
  if (res.status === 401 || res.status === 403) return { kind: "unavailable" };
  if (!res.ok) return { kind: "error" };
  const answer = pickAnswer(await res.json().catch(() => null));
  return answer === null ? { kind: "error" } : { kind: "ok", answer };
}
