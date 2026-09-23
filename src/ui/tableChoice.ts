import { CPU_SPIRIT_IDS, type CpuSpiritId, spirit } from "../characters/spirits";
import type { SeatSetting, Settings } from "./storage";

export type TableFormat = "six" | "hu";
export type RateId = "yoi" | "shinkou" | "shoku";
export type TableMode = "play" | "watch";

export interface TableChoice {
  format: TableFormat;
  rate: RateId;
  opponent: CpuSpiritId;
}

export const RATES: readonly { id: RateId; depthBB: number }[] = [
  { id: "yoi", depthBB: 100 },
  { id: "shinkou", depthBB: 50 },
  { id: "shoku", depthBB: 25 },
];

export const DEFAULT_CHOICE: TableChoice = { format: "six", rate: "yoi", opponent: "sakuya" };

const KEY = "jev-poker.tableChoice";
const BIG_BLIND = 2;

const seat = (id: SeatSetting["spiritId"], kind: SeatSetting["kind"]): SeatSetting => ({
  name: spirit(id).name.ja,
  kind,
  spiritId: id,
});

export function settingsFor(choice: TableChoice, mode: TableMode, base: Settings): Settings {
  const depth = RATES.find((r) => r.id === choice.rate)?.depthBB ?? 100;
  const six = mode === "watch" || choice.format === "six";
  const seats = six
    ? [
        seat("arujidono", mode === "watch" ? "cpu" : "human"),
        ...CPU_SPIRIT_IDS.map((id) => seat(id, "cpu")),
      ]
    : [seat("arujidono", "human"), seat(choice.opponent, "cpu")];
  return {
    ...base,
    seats,
    smallBlind: 1,
    bigBlind: BIG_BLIND,
    startingStack: depth * BIG_BLIND,
    speed: "normal",
    prefetch: false,
  };
}

function isChoice(v: unknown): v is TableChoice {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Partial<TableChoice>;
  return (
    (c.format === "six" || c.format === "hu") &&
    RATES.some((r) => r.id === c.rate) &&
    (CPU_SPIRIT_IDS as readonly string[]).includes(c.opponent ?? "")
  );
}

export function loadTableChoice(): TableChoice {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return isChoice(parsed) ? parsed : DEFAULT_CHOICE;
  } catch {
    return DEFAULT_CHOICE;
  }
}

export function saveTableChoice(choice: TableChoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // storage unavailable: the choice lasts this session only
  }
}
