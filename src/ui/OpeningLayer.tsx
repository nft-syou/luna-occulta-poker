import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Gate } from "../characters/gate";
import type { SoundPlayer } from "../characters/sound";

/** The key the opening holds the table's gate under. */
export const OPENING_GATE_KEY = "opening";
/** When the eclipse rises out of the dark. */
export const OPENING_ECLIPSE_AT_MS = 120;
/** When the gold light starts round the rim, and how long it takes to close the ring. */
export const OPENING_RING_AT_MS = 480;
export const OPENING_RING_MS = 620;
/** When 「開帳」 is brushed across the moon, and how long the stroke takes. */
export const OPENING_WORD_AT_MS = 900;
export const OPENING_WORD_MS = 460;
/** When the lacquer doors part, and how long they take to open. */
export const OPENING_DOORS_AT_MS = 1500;
export const OPENING_DOORS_MS = 420;
/** The gap between one seat lighting and the next once the doors are open. */
export const SEAT_LIT_STAGGER_MS = 80;
/** How long one seat takes to light. */
export const SEAT_LIT_MS = 240;
/** The whole opening where motion is not wanted: a plain fade. */
export const OPENING_REDUCED_MS = 300;
/** How loud the blackout's strike is, against the effects' own volume: low, not a cut-in. */
export const OPENING_SE_GAIN = 0.45;

/** How long the opening holds the table: until the last seat has started to light. */
export function openingHoldMs(seatCount: number): number {
  return (
    OPENING_DOORS_AT_MS +
    OPENING_DOORS_MS +
    SEAT_LIT_STAGGER_MS * Math.max(0, seatCount - 1) +
    SEAT_LIT_MS / 2
  );
}

type Phase = "veil" | "doors" | "gone";

interface Props {
  /** Held for the whole opening, so the first hand is not dealt underneath it. */
  gate?: Gate;
  /** The blackout's strike, and the music, which starts as the doors part. */
  sound?: SoundPlayer;
  /** How many seats light up after the doors, which sets how long the table is held. */
  seatCount: number;
  /** Read once, at the start: a plain fade instead of the eclipse and the doors. */
  reducedMotion: boolean;
  /**
   * The veil is gone and the seats may light. `instant` when there is no time for the
   * stagger: the opening was skipped, or motion is reduced.
   */
  onOpened?: (instant: boolean) => void;
}

/**
 * 開帳: the table opening as the player sits down, before the first hand.
 *
 * The screen goes dark, the eclipse of the logo rises in the middle — a black moon in its
 * crimson corona — a gold light runs once round its rim, 「開帳」 is brushed across it, and
 * two lacquer doors part from the middle onto the table. Then the seats light one by one
 * (the table does that, on `onOpened`) and the first hand is dealt.
 *
 * Staged like the cut-in: every bit of the motion is CSS, timed from the constants above;
 * this component only holds the gate and turns the phases. A click, a tap or any key ends
 * it at once.
 */
export function OpeningLayer({ gate, sound, seatCount, reducedMotion, onOpened }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("veil");
  // Fixed for the sitting: a preference flipped halfway does not restart anything.
  const [reduced] = useState(reducedMotion);
  const doneRef = useRef(false);
  const skipRef = useRef<() => void>(() => {});
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  const svgId = useId().replace(/:/g, "");

  // A layout effect, so the gate is held before the game loop (a passive effect of the
  // screen above) first looks at it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per sitting, on mount
  useLayoutEffect(() => {
    if (doneRef.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, run: () => void) => {
      timers.push(setTimeout(run, ms));
    };
    const clear = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.length = 0;
    };
    let bgm = false;
    let opened = false;
    const startBgm = () => {
      if (bgm) return;
      bgm = true;
      sound?.startBgm();
    };
    const open = (instant: boolean) => {
      if (opened) return;
      opened = true;
      setPhase("gone");
      onOpenedRef.current?.(instant);
    };
    const release = () => {
      doneRef.current = true;
      gate?.release(OPENING_GATE_KEY);
    };

    if (reduced) {
      gate?.hold(OPENING_GATE_KEY, OPENING_REDUCED_MS);
      startBgm();
      later(OPENING_REDUCED_MS, () => {
        open(true);
        release();
      });
    } else {
      gate?.hold(OPENING_GATE_KEY, openingHoldMs(seatCount));
      sound?.se("cutin", OPENING_SE_GAIN);
      later(OPENING_DOORS_AT_MS, () => {
        setPhase("doors");
        startBgm();
      });
      later(OPENING_DOORS_AT_MS + OPENING_DOORS_MS, () => open(false));
      later(openingHoldMs(seatCount), release);
    }
    skipRef.current = () => {
      clear();
      startBgm();
      open(true);
      release();
    };
    return () => {
      clear();
      skipRef.current = () => {};
      gate?.release(OPENING_GATE_KEY);
    };
  }, []);

  // Any key ends it; a click or a tap lands on the veil itself.
  useEffect(() => {
    if (phase === "gone") return;
    const onKey = (event: KeyboardEvent) => {
      // The key is spent on the opening: Enter must not also press a button underneath.
      event.preventDefault();
      skipRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "gone") return null;
  const skip = () => skipRef.current();
  if (reduced) {
    return <div className="opening reduced" aria-hidden="true" onClick={skip} />;
  }
  const timing = {
    "--opening-eclipse-at": `${OPENING_ECLIPSE_AT_MS}ms`,
    "--opening-ring-at": `${OPENING_RING_AT_MS}ms`,
    "--opening-ring-ms": `${OPENING_RING_MS}ms`,
    "--opening-word-at": `${OPENING_WORD_AT_MS}ms`,
    "--opening-word-ms": `${OPENING_WORD_MS}ms`,
    "--opening-doors-ms": `${OPENING_DOORS_MS}ms`,
  } as CSSProperties;
  return (
    <div
      className={phase === "doors" ? "opening opening-doors" : "opening"}
      style={timing}
      aria-hidden="true"
      onClick={skip}
    >
      <span className="opening-door left" />
      <span className="opening-door right" />
      <div className="opening-eclipse">
        {/* The logo's eclipse: the corona, a crescent of light on the right, the black moon,
            and the gold ring the light draws round it. */}
        <svg className="opening-moon" viewBox="0 0 200 200" role="presentation">
          <defs>
            <filter id={`${svgId}-corona`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <filter id={`${svgId}-edge`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>
          <circle
            className="opening-corona"
            cx="100"
            cy="100"
            r="74"
            fill="#961c34"
            filter={`url(#${svgId}-corona)`}
          />
          <circle
            className="opening-crescent"
            cx="100"
            cy="100"
            r="70"
            fill="#e8c478"
            filter={`url(#${svgId}-edge)`}
          />
          <circle cx="95.5" cy="100" r="68" fill="#0a0a12" />
          <circle
            className="opening-ring"
            cx="100"
            cy="100"
            r="69.5"
            fill="none"
            stroke="#f0ce7e"
            strokeWidth="2.2"
            pathLength={100}
            filter={`url(#${svgId}-edge)`}
          />
        </svg>
        <span className="opening-word">{t("table.opening")}</span>
      </div>
    </div>
  );
}
