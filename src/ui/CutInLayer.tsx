import { useEffect, useRef, useState } from "react";
import type { Gate } from "../characters/gate";
import type { Spirit } from "../characters/spirits";
import type { CutIn } from "./fx";

/** The beat of silence before the band opens: the 間 the tone sheet asks for. */
export const CUT_IN_BEAT_MS = 120;
/** How long the cut-in holds the middle once it has opened. */
export const CUT_IN_HOLD_MS = 2600;
/** The sweep out; the 羽二重 dialog's own duration from the tone sheet. */
export const CUT_IN_LEAVE_MS = 320;

interface Props {
  /** The table's current cut-in. Only a *new* id plays; the same one re-rendered does not. */
  cutIn: CutIn | null;
  /** The 御霊 in the cut-in's seat; null for a seat with no cut-in art (nothing is shown). */
  spirit: Spirit | null;
  /** Held while the cut-in is up, so the hand does not move on underneath it. */
  gate?: Gate;
}

/**
 * The cut-in: the three moments that earn the middle of the felt — a 御霊's all-in, a pot
 * worth forty blinds, a stack gone.
 *
 * It is staged rather than played: the felt dims, a beat of silence passes, a lacquer band
 * cuts across the table, and her 必殺カットイン drawing bursts out of it over drifting
 * light, with her name and her line beneath. The drawing is one frame — every bit of the
 * motion is here, which is why the whole thing weighs about a tenth of a video and moves
 * like a cut-in instead of a clip.
 *
 * It owns its own lifetime: the state keeps the last cut-in around for the voice and the
 * log, and this layer decides when it has been seen.
 */
export function CutInLayer({ cutIn, spirit, gate }: Props) {
  const [active, setActive] = useState<{ cutIn: CutIn; spirit: Spirit } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const shownRef = useRef<number | null>(null);

  useEffect(() => {
    if (cutIn === null || spirit === null || cutIn.id === shownRef.current) return;
    shownRef.current = cutIn.id;
    if (spirit.cutin === null) return;
    setActive({ cutIn, spirit });
    setLeaving(false);
    setFailed(false);
  }, [cutIn, spirit]);

  // The table waits at the gate for as long as the cut-in is up.
  useEffect(() => {
    if (active === null || leaving) return;
    const total = CUT_IN_BEAT_MS + CUT_IN_HOLD_MS;
    gate?.hold("cutin", total + CUT_IN_LEAVE_MS);
    const timer = setTimeout(() => setLeaving(true), total);
    return () => clearTimeout(timer);
  }, [active, leaving, gate]);

  useEffect(() => {
    if (!leaving) return;
    gate?.release("cutin");
    const timer = setTimeout(() => {
      setActive(null);
      setLeaving(false);
    }, CUT_IN_LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving, gate]);

  if (active === null) return null;
  const { spirit: who, cutIn: shown } = active;
  // The drawing, or her standing art if it will not load: the staging still reads.
  const art = failed || who.cutin === null ? who.canon : who.cutin;
  return (
    <div className={leaving ? "cutin leaving" : "cutin"} data-kind={shown.kind} aria-hidden="true">
      <span className="cutin-veil" />
      <div className="cutin-band">
        <span className="cutin-rays" />
      </div>
      <div className="cutin-art-slot">
        <img className="cutin-art" src={art} alt="" onError={() => setFailed(true)} />
      </div>
      <div className="cutin-caption">
        <span className="cutin-name">{who.name.ja}</span>
        {shown.line !== null && <span className="cutin-line">{shown.line.text}</span>}
      </div>
      <span className="cutin-flash" />
    </div>
  );
}
