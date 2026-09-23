import { type ApiEnv, handleApi } from "./api";
import type { JevBudget } from "./budgetObject";
import { createSessions } from "./session";

export { JevBudget } from "./budgetObject";

interface Env extends ApiEnv {
  JEV_BUDGET: DurableObjectNamespace<JevBudget>;
  JEV_BURST: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const budget = env.JEV_BUDGET.get(env.JEV_BUDGET.idFromName("global"));
    return handleApi(request, {
      env,
      budget: { take: (ip, day, limits) => budget.take(ip, day, limits) },
      burst: env.JEV_BURST,
      sessions: createSessions({
        sessionSecret: env.SESSION_SECRET ?? "",
        turnstileSecret: env.TURNSTILE_SECRET ?? "",
        fetch,
        now: Date.now,
      }),
      fetch,
      now: Date.now,
    });
  },
} satisfies ExportedHandler<Env>;
