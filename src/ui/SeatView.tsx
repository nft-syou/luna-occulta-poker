import type { HandPlayerSnapshot } from "@jev-poker/engine";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { spirit } from "../characters/spirits";
import { CardView } from "./CardView";
import type { Callout, Speech } from "./fx";
import { INWARD_UP, type Inward, SpeechView } from "./SpeechView";
import type { GameSeat } from "./useGame";

interface Props {
  seat: GameSeat;
  player: HandPlayerSnapshot | undefined;
  isButton: boolean;
  isActing: boolean;
  isThinking: boolean;
  revealCards: boolean;
  style: CSSProperties;
  /** Rendered inside the seat, which is the positioning context for a decision bubble. */
  overlay?: ReactNode;
  /** The seat's most recent shout, if it still has one: the seat flashes in its colour. */
  callout?: Callout | null;
  /** When this seat last won a pot; a new value restarts its glow. Zero for never. */
  winnerAt?: number;
  /** When cards were last revealed at showdown; a new value restarts the flip. */
  flipAt?: number;
}

export function SeatView({
  seat,
  player,
  isButton,
  isActing,
  isThinking,
  revealCards,
  style,
  overlay,
  callout = null,
  winnerAt = 0,
  flipAt = 0,
}: Props) {
  const { t, i18n } = useTranslation();
  const folded = player?.folded ?? false;
  const classes = ["seat", isActing ? "acting" : "", folded ? "folded" : ""].join(" ");
  const who = spirit(seat.spiritId);
  const lang = i18n.language === "ja" ? "ja" : "en";
  return (
    <div className={classes} style={style}>
      {/* Keyed by the callout, so a seat that acts twice running flashes twice. */}
      {callout !== null && (
        <span key={callout.id} className={`seat-flash flash-${callout.kind}`} aria-hidden="true" />
      )}
      {winnerAt > 0 && <span key={winnerAt} className="winner-glow" aria-hidden="true" />}
      {/* The face on the 式札. Decorative: the name below it carries the meaning. */}
      <img className="seat-face" src={who.icon} alt="" width={56} height={56} />
      <div className={flipAt > 0 ? "seat-cards flipping" : "seat-cards"} key={flipAt}>
        {player !== undefined && !folded ? (
          <>
            <CardView card={player.holeCards[0]} hidden={!revealCards} />
            <CardView card={player.holeCards[1]} hidden={!revealCards} />
          </>
        ) : (
          <>
            <CardView card={null} />
            <CardView card={null} />
          </>
        )}
      </div>
      <div className="seat-name">
        {isButton && <span className="dealer-button">{t("table.dealer")}</span>}
        {seat.kind === "cpu" ? who.name[lang] : seat.name}
      </div>
      <div className="seat-tagline">{who.tagline[lang]}</div>
      <div className="seat-stack">{player?.stack ?? seat.stack}</div>
      <div className="seat-status">
        {isThinking && t("table.thinking")}
        {player?.allIn && t("table.allIn")}
        {folded && t("table.folded")}
      </div>
      {overlay}
    </div>
  );
}

interface SeatSpeechProps {
  /** The seat's centre on the felt, as the seat itself is placed. */
  style: CSSProperties;
  /** The seat's most recent shout, if it still has one. */
  callout?: Callout | null;
  /** The seat's most recent line outside an action (a pot won or lost, a bust). */
  speech?: Speech | null;
  bigBlind?: number;
  /** Which way the middle of the felt is, so the callout can be thrown that way. */
  inward?: Inward;
}

/**
 * A seat's bubble, drawn in the felt's speech layer rather than inside the seat. The seat is
 * transformed (and a folded one faded and filtered), so it is a stacking context of its own:
 * a bubble inside it could only ever rise above the seat's own contents, and every chip stack
 * and chip flight — placed in the felt, above the seats — was painted over it. Here the
 * bubble is anchored to the same point as the seat, in a layer above the chips.
 */
export function SeatSpeech({
  style,
  callout = null,
  speech = null,
  bigBlind = 0,
  inward = INWARD_UP,
}: SeatSpeechProps) {
  // Whichever is newer speaks: the shout that came with an action, or the word after.
  const bubble =
    speech !== null && (callout === null || speech.at >= callout.at) ? (
      <SpeechView key={`s${speech.id}`} kind={null} line={speech.line} inward={inward} />
    ) : callout !== null ? (
      <SpeechView
        key={callout.id}
        kind={callout.kind}
        amount={callout.amount}
        bigBlind={bigBlind}
        line={callout.line}
        inward={inward}
      />
    ) : null;
  if (bubble === null) return null;
  return (
    <div className="speech-anchor" style={style}>
      {bubble}
    </div>
  );
}
