/**
 * A gate the game loop waits at while something on the table still deserves to be seen: a
 * 御霊 mid-line, a cut-in still up. Whoever starts such a thing takes a hold under its own
 * key and releases it when done; the loop's `wait()` resolves as soon as nothing is held.
 * Every hold carries a ceiling, so a clip that never fires `ended` cannot freeze the table.
 */
export interface Gate {
  hold(key: string, maxMs?: number): void;
  release(key: string): void;
  /** Resolves at once when nothing is held, otherwise when the last hold lets go. */
  wait(): Promise<void>;
  busy(): boolean;
}

/** The longest anything may hold the table, whatever it promised. */
export const GATE_MAX_MS = 12_000;

export function createGate(): Gate {
  const holds = new Map<string, ReturnType<typeof setTimeout>>();
  let waiters: (() => void)[] = [];

  const settle = () => {
    if (holds.size > 0) return;
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  };

  const gate: Gate = {
    hold(key, maxMs = GATE_MAX_MS) {
      const previous = holds.get(key);
      if (previous !== undefined) clearTimeout(previous);
      holds.set(
        key,
        setTimeout(() => gate.release(key), Math.min(maxMs, GATE_MAX_MS)),
      );
    },
    release(key) {
      const timer = holds.get(key);
      if (timer === undefined) return;
      clearTimeout(timer);
      holds.delete(key);
      settle();
    },
    wait() {
      if (holds.size === 0) return Promise.resolve();
      return new Promise((resolve) => waiters.push(resolve));
    },
    busy() {
      return holds.size > 0;
    },
  };
  return gate;
}
