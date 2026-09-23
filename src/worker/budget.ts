export interface Limits {
  perPlayer: number;
  total: number;
}

export interface BudgetStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
  deleteAll(): Promise<void>;
}

export interface Budget {
  take(ip: string, day: string, limits: Limits): Promise<boolean>;
}

const JST_MS = 9 * 3600 * 1000;

export function jstDay(ms: number): string {
  return new Date(ms + JST_MS).toISOString().slice(0, 10);
}

export function nextJstMidnight(ms: number): string {
  const local = new Date(ms + JST_MS);
  const next = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  return new Date(next - JST_MS).toISOString();
}

/**
 * One call against the day's budget. The storage holds only today: a new day wipes it, so
 * yesterday's rows never pile up. This must stay a storage-only read-modify-write with no
 * non-storage awaits: the Durable Object's input gates serialise storage calls against every
 * other request to the same instance, and that's the only thing that makes this safe.
 */
export async function takeCall(
  storage: BudgetStorage,
  ip: string,
  day: string,
  limits: Limits,
): Promise<boolean> {
  if ((await storage.get<string>("day")) !== day) {
    await storage.deleteAll();
    await storage.put({ day });
  }
  const total = (await storage.get<number>("total")) ?? 0;
  const mine = (await storage.get<number>(`ip:${ip}`)) ?? 0;
  if (total >= limits.total || mine >= limits.perPlayer) return false;
  await storage.put({ total: total + 1, [`ip:${ip}`]: mine + 1 });
  return true;
}

/** The dev server's budget: the same rules, held in memory. */
export class MemoryBudget implements Budget {
  private readonly map = new Map<string, unknown>();
  private readonly storage: BudgetStorage = {
    get: async <T>(key: string) => this.map.get(key) as T | undefined,
    put: async (entries) => {
      for (const [k, v] of Object.entries(entries)) this.map.set(k, v);
    },
    deleteAll: async () => this.map.clear(),
  };
  take(ip: string, day: string, limits: Limits): Promise<boolean> {
    return takeCall(this.storage, ip, day, limits);
  }
}
