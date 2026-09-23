import type { FeaturesHand, FeaturesHistoryEntry, FeaturesTable } from "@jev-poker/agent";
import { isSpiritId, type SpiritId } from "../characters/spirits";
import { allowedLines, PROSE, type ProseAllowlist, styleOfTask } from "./prose";

export interface DecideLegal {
  fold: boolean;
  checkOrCall: boolean;
  betOrRaise: boolean;
}

export interface DecideRequest {
  spirit: SpiritId;
  legal: DecideLegal;
  task: string;
  importantContext: string[];
  hand: FeaturesHand;
  table: FeaturesTable;
  history: FeaturesHistoryEntry[];
}

export const MAX_BODY_BYTES = 16384;

const STREETS = ["preflop", "flop", "turn", "river", "showdown"] as const;
const POSITIONS = ["BTN", "SB", "BB", "UTG", "MP", "CO"] as const;
const HAND_CATEGORIES = [
  "high_card",
  "pair",
  "two_pair",
  "three_of_a_kind",
  "straight",
  "flush",
  "full_house",
  "four_of_a_kind",
  "straight_flush",
] as const;
const PAIR_KINDS = [
  "overpair",
  "top_pair",
  "middle_pair",
  "bottom_pair",
  "underpair",
  "board_pair",
] as const;
const DRAWS = ["flush_draw", "open_ended", "gutshot"] as const;
const STRENGTHS = ["premium", "strong", "medium", "weak", "trash"] as const;
const ACTIONS = ["fold", "check", "call", "bet", "raise", "allin"] as const;
const OPPONENT_TYPES = ["calling_station", "nit", "maniac", "regular"] as const;
const CARD = /^[2-9TJQKA][shdc]$/;

/** Thrown inside the parser and caught once at the top: any problem means "no". */
class Reject extends Error {}
const reject = (): never => {
  throw new Reject();
};

type Obj = Record<string, unknown>;

function object(v: unknown, required: readonly string[], optional: readonly string[] = []): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v)) reject();
  const o = v as Obj;
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(o)) if (!allowed.has(key)) reject();
  for (const key of required) if (!(key in o)) reject();
  return o;
}

function num(v: unknown, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) reject();
  return v as number;
}

function int(v: unknown, min: number, max: number): number {
  const n = num(v, min, max);
  if (!Number.isInteger(n)) reject();
  return n;
}

function bool(v: unknown): boolean {
  if (typeof v !== "boolean") reject();
  return v as boolean;
}

function oneOf<T extends string>(v: unknown, values: readonly T[]): T {
  if (typeof v !== "string" || !(values as readonly string[]).includes(v)) reject();
  return v as T;
}

function cards(v: unknown, min: number, max: number): string {
  if (typeof v !== "string") reject();
  const s = v as string;
  const parts = s === "" ? [] : s.split(" ");
  if (parts.length < min || parts.length > max || !parts.every((c) => CARD.test(c))) reject();
  return s;
}

function list<T>(v: unknown, max: number, item: (x: unknown) => T): T[] {
  if (!Array.isArray(v) || v.length > max) reject();
  return (v as unknown[]).map(item);
}

const PCT: [number, number] = [0, 100];
const BB: [number, number] = [0, 10000];
const SEAT: [number, number] = [0, 9];

function hand(v: unknown): FeaturesHand {
  const o = object(
    v,
    ["street", "holeCards", "board", "preflopStrength", "equityVsRandomPct"],
    ["madeHand", "pairKind", "draws", "equityVsRangePct", "beatsPctOfHands", "board_texture"],
  );
  const out: FeaturesHand = {
    street: oneOf(o.street, STREETS),
    holeCards: cards(o.holeCards, 2, 2),
    board: cards(o.board, 0, 5),
    preflopStrength: oneOf(o.preflopStrength, STRENGTHS),
    equityVsRandomPct: num(o.equityVsRandomPct, ...PCT),
  };
  if (o.madeHand !== undefined) out.madeHand = oneOf(o.madeHand, HAND_CATEGORIES);
  if (o.pairKind !== undefined) out.pairKind = oneOf(o.pairKind, PAIR_KINDS);
  if (o.draws !== undefined) out.draws = list(o.draws, 3, (d) => oneOf(d, DRAWS));
  if (o.equityVsRangePct !== undefined) out.equityVsRangePct = num(o.equityVsRangePct, ...PCT);
  if (o.beatsPctOfHands !== undefined) out.beatsPctOfHands = num(o.beatsPctOfHands, ...PCT);
  if (o.board_texture !== undefined) {
    const t = object(o.board_texture, ["paired", "flushPossible", "straightPossible"]);
    out.board_texture = {
      paired: bool(t.paired),
      flushPossible: bool(t.flushPossible),
      straightPossible: bool(t.straightPossible),
    };
  }
  return out;
}

function table(v: unknown): FeaturesTable {
  const o = object(
    v,
    [
      "position",
      "playersInHand",
      "opponentsNotAllIn",
      "potBB",
      "toCallBB",
      "potOddsPct",
      "requiredEquityPct",
      "effectiveStackBB",
      "stackToPotRatio",
      "raisesThisStreet",
      "myBetWasRaisedThisStreet",
      "stacksBB",
    ],
    ["unopenedPot", "opponentStats", "opponentTypes"],
  );
  const out: FeaturesTable = {
    position: oneOf(o.position, POSITIONS),
    playersInHand: int(o.playersInHand, 1, 10),
    opponentsNotAllIn: int(o.opponentsNotAllIn, 0, 9),
    potBB: num(o.potBB, ...BB),
    toCallBB: num(o.toCallBB, ...BB),
    potOddsPct: num(o.potOddsPct, ...PCT),
    requiredEquityPct: num(o.requiredEquityPct, ...PCT),
    effectiveStackBB: num(o.effectiveStackBB, ...BB),
    stackToPotRatio: num(o.stackToPotRatio, 0, 10000),
    raisesThisStreet: int(o.raisesThisStreet, 0, 50),
    myBetWasRaisedThisStreet: bool(o.myBetWasRaisedThisStreet),
    stacksBB: list(o.stacksBB, 10, (s) => {
      const r = object(s, ["seat", "stackBB", "isAllIn", "folded"], ["isMe"]);
      return {
        seat: int(r.seat, ...SEAT),
        stackBB: num(r.stackBB, ...BB),
        isAllIn: bool(r.isAllIn),
        folded: bool(r.folded),
        ...(r.isMe === undefined ? {} : { isMe: bool(r.isMe) }),
      };
    }),
  };
  if (o.unopenedPot !== undefined) out.unopenedPot = bool(o.unopenedPot);
  if (o.opponentStats !== undefined) {
    out.opponentStats = list(o.opponentStats, 9, (s) => {
      const r = object(
        s,
        ["seat", "hands", "vpipPct", "pfrPct", "postflopAggressionPct"],
        ["foldToBetPct"],
      );
      return {
        seat: int(r.seat, ...SEAT),
        hands: int(r.hands, 0, 1_000_000),
        vpipPct: num(r.vpipPct, ...PCT),
        pfrPct: num(r.pfrPct, ...PCT),
        postflopAggressionPct: num(r.postflopAggressionPct, ...PCT),
        ...(r.foldToBetPct === undefined ? {} : { foldToBetPct: num(r.foldToBetPct, ...PCT) }),
      };
    });
  }
  if (o.opponentTypes !== undefined) {
    out.opponentTypes = list(o.opponentTypes, 9, (s) => {
      const r = object(s, ["seat", "type"]);
      return { seat: int(r.seat, ...SEAT), type: oneOf(r.type, OPPONENT_TYPES) };
    });
  }
  return out;
}

function history(v: unknown): FeaturesHistoryEntry[] {
  return list(v, 80, (e) => {
    const r = object(e, ["street", "seat", "action"], ["isMe", "amountBB"]);
    return {
      street: oneOf(r.street, STREETS),
      seat: int(r.seat, ...SEAT),
      action: oneOf(r.action, ACTIONS),
      ...(r.isMe === undefined ? {} : { isMe: bool(r.isMe) }),
      ...(r.amountBB === undefined ? {} : { amountBB: num(r.amountBB, ...BB) }),
    };
  });
}

export function parseDecideRequest(
  value: unknown,
  prose: ProseAllowlist = PROSE,
): DecideRequest | null {
  try {
    const o = object(value, [
      "spirit",
      "legal",
      "task",
      "importantContext",
      "hand",
      "table",
      "history",
    ]);
    if (!isSpiritId(o.spirit)) reject();
    const l = object(o.legal, ["fold", "checkOrCall", "betOrRaise"]);
    const legal = {
      fold: bool(l.fold),
      checkOrCall: bool(l.checkOrCall),
      betOrRaise: bool(l.betOrRaise),
    };
    if (!legal.fold && !legal.checkOrCall && !legal.betOrRaise) reject();
    if (typeof o.task !== "string" || styleOfTask(o.task, prose) === null) reject();
    if (!allowedLines(o.importantContext, prose)) reject();
    return {
      spirit: o.spirit as SpiritId,
      legal,
      task: o.task as string,
      importantContext: [...(o.importantContext as string[])],
      hand: hand(o.hand),
      table: table(o.table),
      history: history(o.history),
    };
  } catch (error) {
    if (error instanceof Reject) return null;
    throw error;
  }
}
