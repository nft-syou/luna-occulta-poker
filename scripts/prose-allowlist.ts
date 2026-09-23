// Writes src/worker/prose-allowlist.json: every task sentence and context line the library can
// put in front of Jev, gathered through its public `featuresFromView`. The Worker accepts no
// other prose. Re-run after upgrading @jev-poker/agent: `pnpm prose:allowlist`.
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  featuresFromView,
  OPPONENT_TYPES,
  type OpponentStats,
  type OpponentType,
  type PromptStyle,
} from "@jev-poker/agent";
import {
  type ActionTakenEvent,
  fixedBlinds,
  type GameEvent,
  playerView,
  Table,
} from "@jev-poker/engine";

export interface ProseAllowlist {
  tasks: Record<string, PromptStyle>;
  lines: string[];
}

const STYLES: readonly PromptStyle[] = ["unified", "split"];
const TYPES = Object.keys(OPPONENT_TYPES) as OpponentType[];
const STATS: OpponentStats = { hands: 40, vpipPct: 30, pfrPct: 20, postflopAggressionPct: 40 };

/** A three-handed table stopped at the first preflop decision and at the first flop decision. */
function views() {
  const table = new Table({
    format: "cash",
    blinds: fixedBlinds(1, 2),
    startingStack: 200,
    seats: [0, 1, 2].map((id) => ({ id, name: `s${id}`, kind: "cpu" as const })),
    seed: 7,
  });
  const taken: ActionTakenEvent[] = [];
  table.on((event: GameEvent) => {
    if (event.type === "ActionTaken") taken.push(event);
  });
  let snapshot = table.startHand();
  const seat = snapshot.actingSeat as number;
  const preflop = playerView(snapshot, seat, [...taken]);
  while (snapshot.street === "preflop") {
    const acting = snapshot.actingSeat as number;
    const legal = table.legalActions(acting);
    table.act(acting, legal.canCheck ? { type: "check" } : { type: "call" });
    snapshot = table.snapshot() ?? snapshot;
  }
  const flop = playerView(snapshot, snapshot.actingSeat as number, [...taken]);
  return [preflop, flop];
}

export function collectProse(): ProseAllowlist {
  const tasks: Record<string, PromptStyle> = {};
  const lines = new Set<string>();
  const persona = { name: "x", description: "x" };
  for (const view of views()) {
    for (const style of STYLES) {
      for (const rangeEquity of [false, true]) {
        for (const stats of [false, true]) {
          for (const type of [null, ...TYPES]) {
            const f = featuresFromView(view, persona, {
              style,
              rangeEquity,
              ...(stats ? { opponentStatsFor: () => STATS } : {}),
              ...(type === null ? {} : { opponentTypeFor: () => type }),
            });
            tasks[f.task] = style;
            for (const line of f.importantContext) lines.add(line);
          }
        }
      }
    }
  }
  return { tasks, lines: [...lines].sort() };
}

const out = fileURLToPath(new URL("../src/worker/prose-allowlist.json", import.meta.url));
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  writeFileSync(out, `${JSON.stringify(collectProse(), null, 2)}\n`);
  console.log(`wrote ${out}`);
}
