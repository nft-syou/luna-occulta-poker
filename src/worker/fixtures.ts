import { PROSE } from "./prose";
import type { DecideRequest } from "./schema";

const TASK = Object.keys(PROSE.tasks)[0] as string;

/** A real-looking, fully valid decide request; shared by tests. */
export const VALID: DecideRequest = {
  spirit: "sakuya",
  legal: { fold: true, checkOrCall: true, betOrRaise: true },
  task: TASK,
  importantContext: PROSE.lines.slice(0, 2),
  hand: {
    street: "flop",
    holeCards: "As Kd",
    board: "Ah 7c 2d",
    madeHand: "pair",
    pairKind: "top_pair",
    draws: [],
    preflopStrength: "premium",
    equityVsRandomPct: 81,
    beatsPctOfHands: 92,
    board_texture: { paired: false, flushPossible: false, straightPossible: false },
  },
  table: {
    position: "BTN",
    playersInHand: 2,
    opponentsNotAllIn: 1,
    potBB: 6.5,
    toCallBB: 2,
    potOddsPct: 24,
    requiredEquityPct: 24,
    effectiveStackBB: 95,
    stackToPotRatio: 14.6,
    raisesThisStreet: 1,
    myBetWasRaisedThisStreet: false,
    opponentTypes: [{ seat: 1, type: "nit" }],
    stacksBB: [
      { seat: 0, isMe: true, stackBB: 95, isAllIn: false, folded: false },
      { seat: 1, stackBB: 97, isAllIn: false, folded: false },
      { seat: 2, stackBB: 100, isAllIn: false, folded: true },
    ],
  },
  history: [
    { street: "preflop", seat: 0, isMe: true, action: "raise", amountBB: 2.5 },
    { street: "flop", seat: 1, action: "bet", amountBB: 2 },
  ],
};
