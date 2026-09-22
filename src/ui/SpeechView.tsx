import type { TFunction } from "i18next";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { SpeechLine } from "../characters/lines";
import type { CalloutKind } from "./fx";
import { showNumber, toBB } from "./showcase";

/**
 * What the table shouts: "FOLD", "CALL 3 BB", "RAISE 12 BB", "ALL IN". Amounts are in big
 * blinds, which is the only unit that means the same thing at every table.
 */
export function calloutText(
  t: TFunction,
  kind: CalloutKind,
  amount: number,
  bigBlind: number,
): string {
  switch (kind) {
    case "fold":
      return t("callout.fold");
    case "check":
      return t("callout.check");
    case "allin":
      return t("callout.allin");
    case "call":
      return t("callout.call", { bb: showNumber(toBB(amount, bigBlind)) });
    case "bet":
      return t("callout.bet", { bb: showNumber(toBB(amount, bigBlind)) });
    case "raise":
      return t("callout.raise", { bb: showNumber(toBB(amount, bigBlind)) });
  }
}

/** The unit direction from a seat towards the middle of the felt. */
export interface Inward {
  x: number;
  y: number;
}

/** Straight up, which is where a seat with no angle of its own points. */
export const INWARD_UP: Inward = { x: 0, y: -1 };

interface Props {
  /** The action shouted, or null for a line said outside an action. */
  kind: CalloutKind | null;
  amount?: number;
  bigBlind?: number;
  /** What the 御霊 said. Null for a seat that has no lines: the shout stands alone. */
  line: SpeechLine | null;
  /** Which way the middle of the table is from this seat. */
  inward?: Inward;
}

/**
 * The bubble at a seat the moment it acts or reacts: the 御霊's line in a 羽二重 bubble with
 * the action underneath as a small label — or, for a seat with nothing to say, the label
 * alone, as the table shouted before the 御霊 came.
 *
 * It is placed *inwards*, along the seat's own line to the middle, rather than below the
 * seat: a seat on the bottom rail has nothing below it but the felt's edge, the action feed
 * and — for a human — their own buttons, and a bubble there would cover all three. Inwards
 * there is always table. The offset is short enough to stay nearer the seat than its chip
 * stack and clear of the recording-mode bubble, which grows the other way.
 *
 * Decoration only: the action is in the feed, the log and the seat's own state, so the
 * bubble is hidden from the accessibility tree rather than read out on every single action.
 */
export function SpeechView({ kind, amount = 0, bigBlind = 0, line, inward = INWARD_UP }: Props) {
  const { t } = useTranslation();
  const label = kind === null ? null : calloutText(t, kind, amount, bigBlind);
  return (
    <div
      className="callout-spot"
      aria-hidden="true"
      style={{ "--in-x": inward.x, "--in-y": inward.y } as CSSProperties}
    >
      {line === null ? (
        label !== null && <div className={`callout callout-${kind}`}>{label}</div>
      ) : (
        <div className={`speech ${kind === null ? "" : `speech-${kind}`}`}>
          <span className="speech-text">{line.text}</span>
          {label !== null && <span className={`callout callout-${kind}`}>{label}</span>}
        </div>
      )}
    </div>
  );
}
