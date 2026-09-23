import { DurableObject } from "cloudflare:workers";
import { type Limits, takeCall } from "./budget";

/** The day's count of calls, per IP and in total. One instance for the whole game. */
export class JevBudget extends DurableObject {
  take(ip: string, day: string, limits: Limits): Promise<boolean> {
    return this.ctx.blockConcurrencyWhile(() =>
      takeCall(
        {
          get: (key) => this.ctx.storage.get(key),
          put: (entries) => this.ctx.storage.put(entries),
          deleteAll: () => this.ctx.storage.deleteAll(),
        },
        ip,
        day,
        limits,
      ),
    );
  }
}
