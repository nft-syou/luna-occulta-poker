import type { GameEvent, SeatId, Street } from "@jev-poker/engine";
import { pickLine, rollFrom, type SpeechLine } from "../characters/lines";
import type { SpiritId } from "../characters/spirits";

/** The shout that flashes at a seat the moment it acts. */
export type CalloutKind = "fold" | "check" | "call" | "bet" | "raise" | "allin";

export interface Callout {
  /** Monotonic, so the same seat shouting twice in a row still counts as two callouts. */
  readonly id: number;
  readonly seat: SeatId;
  readonly kind: CalloutKind;
  /** Chips called, or the total bet/raise. Zero where the callout carries no number. */
  readonly amount: number;
  readonly at: number;
  /** What the 御霊 said as she did it; null for a human seat and for あるじどの. */
  readonly line: SpeechLine | null;
}

/** A line spoken outside an action: a pot won or lost, a stack gone. */
export type SpeechSituation = "win" | "bigwin" | "lose" | "bust";

export interface Speech {
  readonly id: number;
  readonly seat: SeatId;
  readonly situation: SpeechSituation;
  readonly line: SpeechLine;
  readonly at: number;
}

/** The three moments worth a cut-in: an all-in, a big pot, a bust. */
export type CutInKind = "allin" | "bigwin" | "bust";

export interface CutIn {
  readonly id: number;
  readonly seat: SeatId;
  readonly kind: CutInKind;
  readonly line: SpeechLine | null;
  readonly at: number;
}

/**
 * What the reducer needs to know about the table that the event does not say: who sits
 * where, whether the acting seat was bluffing, how big a blind is. All optional, so the
 * effects still reduce without it — they just stay silent.
 */
export interface FxContext {
  /** The 御霊 in a seat, or null for a human's. */
  readonly spiritOf: (seat: SeatId) => SpiritId | null;
  /** For an `ActionTaken`: Jev meant it as a bluff. Drives 咲耶's tell. */
  readonly bluff?: boolean;
  /** For sizing a pot in blinds; zero or absent means no win lines. */
  readonly bigBlind?: number;
}

const NO_CONTEXT: FxContext = { spiritOf: () => null };

/** A pot this many blinds or more is a big win: a cut-in and the loud line. */
export const BIG_WIN_BB = 40;
/** A pot this many blinds or more is worth a word at all; below it the 御霊 stay quiet. */
export const WIN_BB = 8;
/** How long a cut-in holds the middle; another one arriving inside this window is dropped. */
export const CUT_IN_MS = 3200;

/** Where a handful of chips is travelling: out to a bet, into the pot, or home to a winner. */
export type ChipMoveKind = "toBet" | "toPot" | "toSeat";

export interface ChipMove {
  readonly id: number;
  readonly seat: SeatId;
  readonly kind: ChipMoveKind;
  readonly amount: number;
  readonly at: number;
}

export type FeedEntry =
  | {
      readonly id: number;
      readonly type: "action";
      readonly seat: SeatId;
      readonly kind: CalloutKind;
      readonly amount: number;
      readonly at: number;
    }
  | { readonly id: number; readonly type: "street"; readonly street: Street; readonly at: number };

/**
 * Everything the table shows that is an *event* rather than a *state*: the shouts, the chips
 * in flight, who just won. It is derived from the engine's events and nothing else, and it
 * is built by a pure function — every timestamp is stamped by the caller, so the reducer
 * that owns this slice never reads the clock.
 *
 * Entries are never removed on a timer. They are capped by count and expire visually, by a
 * CSS animation that ends where it started; that keeps a table running at max speed from
 * needing a React re-render per effect just to make one disappear.
 */
export interface TableFx {
  /** Next id to hand out. Part of the state so `reduceFx` stays a pure function of it. */
  readonly nextId: number;
  readonly callouts: readonly Callout[];
  readonly chipMoves: readonly ChipMove[];
  /** Seats that took a share of the last pot. */
  readonly winners: readonly SeatId[];
  /** When they won it, which is what restarts their glow. */
  readonly winnersAt: number;
  /**
   * True from the moment the pot starts flying to its winners until the next hand begins.
   * The engine leaves `contributed` — and so the snapshot's pot — standing until then, but
   * as far as the felt is concerned the middle is empty the instant it has been paid.
   */
  readonly potPaid: boolean;
  /** When hole cards were last revealed, which is what restarts the card flip. */
  readonly flipAt: number;
  readonly feed: readonly FeedEntry[];
  /** When each of the last few hands ended, for the hands/minute readout. */
  readonly handTimes: readonly number[];
  /** Chips currently in front of each seat, so a new street knows what to sweep in. */
  readonly streetBets: Readonly<Record<SeatId, number>>;
  /** Lines said outside an action. Capped by count like the callouts. */
  readonly speech: readonly Speech[];
  /** The cut-in on screen, or the last one; `at` says whether it is still playing. */
  readonly cutIn: CutIn | null;
  /** Who turned their cards over at the last showdown, so the losers can be named. */
  readonly showdownSeats: readonly SeatId[];
}

/** At most one callout per seat is ever visible; the rest are kept only so keys stay stable. */
const MAX_CALLOUTS = 12;
/** Simultaneous flying chips. Past this the felt is noise, and so is the compositor's job. */
export const MAX_CHIP_MOVES = 12;
/** Feed entries kept; the strip itself shows fewer. */
const MAX_FEED = 24;
/** Hand timestamps kept, which is the window the hands/minute figure is measured over. */
const MAX_HAND_TIMES = 24;
/** Speech entries kept; one per seat is ever visible. */
const MAX_SPEECH = 12;

export const EMPTY_FX: TableFx = {
  nextId: 1,
  callouts: [],
  chipMoves: [],
  winners: [],
  winnersAt: 0,
  potPaid: false,
  flipAt: 0,
  feed: [],
  handTimes: [],
  streetBets: {},
  speech: [],
  cutIn: null,
  showdownSeats: [],
};

/** The last `max` entries of a list, as a new array. */
function tail<T>(list: readonly T[], extra: readonly T[], max: number): T[] {
  const all = extra.length === 0 ? [...list] : [...list, ...extra];
  return all.length > max ? all.slice(all.length - max) : all;
}

/** What a seat just did, as one of the six things the table shouts about. */
function calloutKind(action: GameEvent & { type: "ActionTaken" }): CalloutKind {
  if (action.allIn) return "allin";
  switch (action.action.type) {
    case "fold":
      return "fold";
    case "check":
      return "check";
    case "call":
      return "call";
    case "bet":
      return "bet";
    case "raise":
      return "raise";
    case "allin":
      return "allin";
  }
}

/**
 * Folds one engine event into the effects layer. Pure: `at` is the clock reading the caller
 * took when the event arrived, and nothing in here reads a clock or a random number.
 */
export function reduceFx(
  fx: TableFx,
  event: GameEvent,
  at: number,
  ctx: FxContext = NO_CONTEXT,
): TableFx {
  let nextId = fx.nextId;
  const id = () => nextId++;
  /** A cut-in only starts when the middle is free; a second big moment is simply not shown. */
  const cutInFree = fx.cutIn === null || at - fx.cutIn.at >= CUT_IN_MS;
  const cutIn = (seat: SeatId, kind: CutInKind, line: SpeechLine | null): CutIn | null =>
    cutInFree ? { id: id(), seat, kind, line, at } : fx.cutIn;
  /** The chips sitting in front of the seats, on their way into the middle. */
  const sweep = (): ChipMove[] =>
    Object.entries(fx.streetBets)
      .filter(([, amount]) => amount > 0)
      .map(([seat, amount]) => ({
        id: id(),
        seat: Number(seat),
        kind: "toPot" as const,
        amount,
        at,
      }));

  switch (event.type) {
    case "HandStarted":
      return {
        ...fx,
        nextId: nextId + 1,
        streetBets: {},
        potPaid: false,
        showdownSeats: [],
        feed: tail(fx.feed, [{ id: nextId, type: "street", street: "preflop", at }], MAX_FEED),
      };

    case "BlindsPosted": {
      const posts = event.posts.filter((post) => post.amount > 0);
      if (posts.length === 0) return fx;
      const streetBets = { ...fx.streetBets };
      const moves = posts.map((post) => {
        // Antes go to the middle directly; blinds sit in front of the seat that posted them.
        const toPot = post.kind === "ante";
        if (!toPot) streetBets[post.seat] = (streetBets[post.seat] ?? 0) + post.amount;
        return {
          id: id(),
          seat: post.seat,
          kind: toPot ? ("toPot" as const) : ("toBet" as const),
          amount: post.amount,
          at,
        };
      });
      return {
        ...fx,
        nextId,
        streetBets,
        chipMoves: tail(fx.chipMoves, moves, MAX_CHIP_MOVES),
      };
    }

    case "ActionTaken": {
      const kind = calloutKind(event);
      const total = event.action.type === "bet" || event.action.type === "raise";
      const amount = total ? event.action.amount : event.amount;
      const calloutId = id();
      // The roll is a hash of the callout's own id: pure, and different for every shout.
      const line = pickLine(ctx.spiritOf(event.seat), kind, rollFrom(calloutId), ctx.bluff);
      const callout: Callout = { id: calloutId, seat: event.seat, kind, amount, at, line };
      const feed: FeedEntry = {
        id: id(),
        type: "action",
        seat: event.seat,
        kind,
        amount,
        at,
      };
      const moved = event.amount > 0;
      const streetBets = moved
        ? { ...fx.streetBets, [event.seat]: (fx.streetBets[event.seat] ?? 0) + event.amount }
        : fx.streetBets;
      const moves: ChipMove[] = moved
        ? [{ id: id(), seat: event.seat, kind: "toBet", amount: event.amount, at }]
        : [];
      // An all-in by a 御霊 is a cut-in; the shout and the cut-in share the one line.
      const shove = kind === "allin" && ctx.spiritOf(event.seat) !== null;
      return {
        ...fx,
        nextId,
        streetBets,
        callouts: tail(fx.callouts, [callout], MAX_CALLOUTS),
        chipMoves: tail(fx.chipMoves, moves, MAX_CHIP_MOVES),
        feed: tail(fx.feed, [feed], MAX_FEED),
        cutIn: shove ? cutIn(event.seat, "allin", line) : fx.cutIn,
      };
    }

    case "StreetDealt": {
      const moves = sweep();
      const separator: FeedEntry = { id: id(), type: "street", street: event.street, at };
      return {
        ...fx,
        nextId,
        streetBets: {},
        chipMoves: tail(fx.chipMoves, moves, MAX_CHIP_MOVES),
        feed: tail(fx.feed, [separator], MAX_FEED),
      };
    }

    case "Showdown":
      return { ...fx, flipAt: at, showdownSeats: event.hands.map((h) => h.seat) };

    case "PotAwarded": {
      // Whatever was still in front of the seats goes in first, then the middle pays out.
      const moves = [
        ...sweep(),
        ...event.awards
          .filter((award) => award.amount > 0)
          .map((award) => ({
            id: id(),
            seat: award.seat,
            kind: "toSeat" as const,
            amount: award.amount,
            at,
          })),
      ];
      const winners = [...new Set(event.awards.filter((a) => a.amount > 0).map((a) => a.seat))];
      // What each winner took home, in blinds, decides whether — and how loudly — she speaks.
      const bb = ctx.bigBlind ?? 0;
      const speech: Speech[] = [];
      let nextCutIn = fx.cutIn;
      for (const seat of winners) {
        const spiritId = ctx.spiritOf(seat);
        if (spiritId === null || bb <= 0) continue;
        const won = event.awards
          .filter((a) => a.seat === seat)
          .reduce((sum, a) => sum + a.amount, 0);
        const situation: SpeechSituation | null =
          won >= BIG_WIN_BB * bb ? "bigwin" : won >= WIN_BB * bb ? "win" : null;
        if (situation === null) continue;
        const speechId = id();
        const line = pickLine(spiritId, situation, rollFrom(speechId));
        if (line === null) continue;
        speech.push({ id: speechId, seat, situation, line, at });
        if (situation === "bigwin" && nextCutIn === fx.cutIn)
          nextCutIn = cutIn(seat, "bigwin", line);
      }
      // Whoever showed a hand and took nothing lost it in front of everyone.
      for (const seat of fx.showdownSeats) {
        if (winners.includes(seat)) continue;
        const speechId = id();
        const line = pickLine(ctx.spiritOf(seat), "lose", rollFrom(speechId));
        if (line !== null) speech.push({ id: speechId, seat, situation: "lose", line, at });
      }
      return {
        ...fx,
        nextId,
        streetBets: {},
        potPaid: true,
        chipMoves: tail(fx.chipMoves, moves, MAX_CHIP_MOVES),
        winners: winners.length === 0 ? fx.winners : winners,
        winnersAt: winners.length === 0 ? fx.winnersAt : at,
        speech: tail(fx.speech, speech, MAX_SPEECH),
        cutIn: nextCutIn,
      };
    }

    case "HandEnded": {
      // A 御霊 whose stack is gone says so; the first of them gets the cut-in.
      const speech: Speech[] = [];
      let nextCutIn = fx.cutIn;
      for (const { id: seat, stack } of event.stacks) {
        if (stack > 0) continue;
        const speechId = id();
        const line = pickLine(ctx.spiritOf(seat), "bust", rollFrom(speechId));
        if (line === null) continue;
        speech.push({ id: speechId, seat, situation: "bust", line, at });
        if (nextCutIn === fx.cutIn) nextCutIn = cutIn(seat, "bust", line);
      }
      return {
        ...fx,
        nextId,
        streetBets: {},
        handTimes: tail(fx.handTimes, [at], MAX_HAND_TIMES),
        speech: tail(fx.speech, speech, MAX_SPEECH),
        cutIn: nextCutIn,
      };
    }

    default:
      return fx;
  }
}

/** A gap between two hands longer than this was a pause, not play, and does not count. */
export const PAUSE_GAP_MS = 120_000;

/**
 * Hands per minute over the window `handTimes` covers, or null before there are two. The
 * table can sit paused for as long as the player likes; that time is left out, or one long
 * break would read as a crawl for the next hundred hands.
 */
export function handsPerMinute(handTimes: readonly number[]): number | null {
  let hands = 0;
  let span = 0;
  for (let i = 1; i < handTimes.length; i++) {
    const gap = (handTimes[i] ?? 0) - (handTimes[i - 1] ?? 0);
    if (gap <= 0 || gap > PAUSE_GAP_MS) continue;
    hands += 1;
    span += gap;
  }
  if (hands === 0) return null;
  return Math.round((hands / span) * 60_000);
}
