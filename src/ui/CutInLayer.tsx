import { useEffect, useRef, useState } from "react";
import type { Gate } from "../characters/gate";
import type { Spirit } from "../characters/spirits";
import type { CutIn } from "./fx";

/** How long a cut-in stays if its video never says it ended (a still, a stalled load). The
 * longest showcase runs ten seconds; a still gets the shorter of the two holds below. */
export const CUT_IN_HOLD_MS = 10_500;
/** A still (reduced motion, or a video that fails) does not need the full ten seconds. */
export const CUT_IN_STILL_MS = 4000;
/** The 羽二重 fade on the way out; the dialog's own duration from the tone sheet. */
export const CUT_IN_LEAVE_MS = 280;

interface Props {
  /** The table's current cut-in. Only a *new* id plays; the same one re-rendered does not. */
  cutIn: CutIn | null;
  /** The 御霊 in the cut-in's seat; null for a seat with no video (nothing is shown). */
  spirit: Spirit | null;
  /** Under reduced motion the standing art takes the video's place. */
  reducedMotion?: boolean;
  /** Held while the cut-in is up, so the hand does not move on underneath it. */
  gate?: Gate;
}

/**
 * The showcase over the middle of the felt for the three moments that earn it: a 御霊's
 * all-in, a big pot, a bust. Her official showcase video plays once inside a 羽二重 panel
 * with her line under it, then the panel fades in 280 ms. The effects reducer drops any
 * second moment that arrives while one is up, so this only ever plays what it is handed,
 * and it owns its own lifetime: the state keeps the last cut-in around for the voice and
 * the log, and this layer decides when it has been seen.
 */
export function CutInLayer({ cutIn, spirit, reducedMotion = false, gate }: Props) {
  const [active, setActive] = useState<{ cutIn: CutIn; spirit: Spirit } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const shownRef = useRef<number | null>(null);

  useEffect(() => {
    if (cutIn === null || spirit === null || cutIn.id === shownRef.current) return;
    shownRef.current = cutIn.id;
    if (spirit.showcase === null) return;
    setActive({ cutIn, spirit });
    setLeaving(false);
  }, [cutIn, spirit]);

  // The hold is the ceiling; a video that ends sooner takes the panel down with it. The
  // table waits at the gate for as long as the panel is up.
  useEffect(() => {
    if (active === null || leaving) return;
    const still = reducedMotion || active.spirit.showcase === null;
    const holdMs = still ? CUT_IN_STILL_MS : CUT_IN_HOLD_MS;
    gate?.hold("cutin", holdMs + CUT_IN_LEAVE_MS);
    const timer = setTimeout(() => setLeaving(true), holdMs);
    return () => clearTimeout(timer);
  }, [active, leaving, reducedMotion, gate]);

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
  return (
    <div className={leaving ? "cutin leaving" : "cutin"} aria-hidden="true">
      <div className={`cutin-panel habutae cutin-${shown.kind}`}>
        {reducedMotion || who.showcase === null ? (
          <img className="cutin-still" src={who.canon} alt="" />
        ) : (
          <video
            className="cutin-video"
            src={who.showcase}
            muted
            playsInline
            autoPlay
            preload="auto"
            onEnded={() => setLeaving(true)}
            onError={() => setLeaving(true)}
          />
        )}
        <div className="cutin-caption">
          <span className="cutin-name">{who.name.ja}</span>
          {shown.line !== null && <span className="cutin-line">{shown.line.text}</span>}
        </div>
      </div>
    </div>
  );
}
