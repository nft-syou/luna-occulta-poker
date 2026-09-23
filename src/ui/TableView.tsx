import type { HandSnapshot, SeatId } from "@jev-poker/engine";
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Gate } from "../characters/gate";
import { pickLine, rollFrom } from "../characters/lines";
import type { SoundPlayer } from "../characters/sound";
import { CPU_SPIRIT_IDS, spirit } from "../characters/spirits";
import type { VoicePlayer } from "../characters/voice";
import type { Language } from "../i18n";
import type { StopReason } from "../jev/gameBackend";
import { ActionBar } from "./ActionBar";
import { ActionFeed } from "./ActionFeed";
import { CardView } from "./CardView";
import { ChipStack } from "./ChipStack";
import { CutInLayer } from "./CutInLayer";
import { DecisionBubble } from "./DecisionBubble";
import { cardText } from "./format";
import { handsPerMinute, type Speech } from "./fx";
import { HistoryPanel } from "./HistoryPanel";
import { OpeningLayer, SEAT_LIT_STAGGER_MS } from "./OpeningLayer";
import { RulesDialog } from "./RulesDialog";
import { SeatSpeech, SeatView } from "./SeatView";
import { ShowcasePanel } from "./ShowcasePanel";
import { StatsPanel } from "./StatsPanel";
import { compactBubble } from "./showcase";
import { markRulesSeen, rulesSeen, type Speed } from "./storage";
import { TableFxLayer } from "./TableFxLayer";
import { Ticker } from "./Ticker";
import { presentationTimings } from "./timings";
import { useCountUp } from "./useCountUp";
import { type GameController, NO_BACKEND_ERROR } from "./useGame";

interface Props {
  game: GameController;
  speed: Speed;
  startingStack: number;
  language: Language;
  onLeave: () => void;
  /** Opens the settings dialog (sound and language), which lives above the table. */
  onOpenSettings: () => void;
  /** Whether the recording-mode button is offered: only on a `?rec` URL. */
  recording: boolean;
  /** Why the server stopped the table, if it did; names the paused badge. */
  stopReason?: StopReason | null;
  /** Persona name per seat, for the recording overlays; the seat's own name otherwise. */
  personaNames?: Record<SeatId, string>;
  /** Says the 御霊's lines aloud. Absent, the table is silent and the bubbles still show. */
  voice?: VoicePlayer;
  /** Whether the voices go on in a hand the player is out of; see `playerOutOfHand`. */
  voiceWhenOut?: boolean;
  /** The table's own sounds: cards, 勾玉, the cut-in. */
  sound?: SoundPlayer;
  /** Held by the cut-in while it is up, and by the opening. */
  gate?: Gate;
  /**
   * Plays 開帳 as the table mounts: the veil, the eclipse, the doors, the seats lighting one
   * by one. Once per mount, so once per sitting; the greetings and the music wait for it.
   */
  opening?: boolean;
  /**
   * Opens the rules by themselves once the opening is over, unless this browser has seen them:
   * a first table starts with how to play, and the first hand waits for it.
   */
  autoRules?: boolean;
}

/** How long a bubble with a spoken line stays: long enough to read and to hear it out. */
const SPEECH_MS = 4200;

/** How long after the table opens its one greeting is said. */
const GREET_GAP_MS = 600;

/**
 * How the seats are lit as the table opens: dark under the veil, lit one after another as
 * the doors part, or simply as they always are.
 */
type SeatLight = "dim" | "lit" | null;

/** What the drawer beside the table is showing, if it is open. */
type Drawer = "stats" | "log";

const PHONE_QUERY = "(max-width: 720px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * How far from the rail a seat's chips sit, as a fraction of the seat's own distance from
 * the middle: the bet lands well inside, between the player and the pot. The seats carry a
 * face now and lean out over the rail, so the chips of a seat on the top or bottom rail
 * have to come this far in to clear its box — and they are still outside the board and
 * the pot in the middle at every seat count the table allows.
 */
const BET_SPOT = 0.6;
/** The same for a seat on the top or bottom rail, whose tall box the chips must clear. */
const BET_SPOT_VERTICAL = 0.41;

/**
 * Whether a seated player is out of the hand being played: folded, or not dealt into it.
 * A table with no human seat (watching) has nobody to be out, and before the first deal
 * everyone is still in — which is what lets the greetings through as the player sits down.
 */
export function playerOutOfHand(
  snapshot: HandSnapshot | null,
  humanSeats: readonly SeatId[],
): boolean {
  if (humanSeats.length === 0 || snapshot === null) return false;
  return !snapshot.players.some((p) => humanSeats.includes(p.seat) && !p.folded);
}

function mediaMatches(query: string): boolean {
  // jsdom (and any non-browser host) has no matchMedia; treat those as a wide, moving screen.
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : false;
}

/** Tracks one media query. Used for the phone layout and for reduced motion. */
function useMediaQuery(query: string): boolean {
  const [on, setOn] = useState(() => mediaMatches(query));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const onChange = () => setOn(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return on;
}

interface PotViewProps {
  /** Chips already swept into the middle. */
  pot: number;
  /** The same plus every bet still in front of a seat: what a caller is really playing for. */
  total: number;
  bigBlind: number;
  ms: number;
}

/**
 * The pot, drawn as chips, with its number rolling to whatever the last sweep made it. Only
 * collected chips count here: a bet still out on the felt is drawn in front of its seat, and
 * counting it in the middle as well showed the same chips twice. The total is spelled out
 * underneath while the two differ, because that is the number pot odds are worked from.
 */
function PotView({ pot, total, bigBlind, ms }: PotViewProps) {
  const { t } = useTranslation();
  const shown = useCountUp(pot, ms);
  const label = `${t("table.pot")}: ${shown}`;
  return (
    <>
      {pot <= 0 ? (
        <div className="pot">{label}</div>
      ) : (
        <ChipStack className="pot" amount={pot} bigBlind={bigBlind} label={label} />
      )}
      {total > pot && <div className="pot-total">{`${t("table.potTotal")}: ${total}`}</div>}
    </>
  );
}

export function TableView({
  game,
  speed,
  startingStack,
  language,
  onLeave,
  onOpenSettings,
  recording,
  stopReason = null,
  personaNames,
  voice,
  voiceWhenOut = false,
  sound,
  gate,
  opening = false,
  autoRules = false,
}: Props) {
  const { t } = useTranslation();
  const phone = useMediaQuery(PHONE_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const timings = presentationTimings(speed);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  /** The header button that opened the drawer, which gets the focus back when it closes. */
  const openerRef = useRef<HTMLElement | null>(null);
  /** Set by a close the player asked for; a turn closing the drawer leaves the focus be. */
  const refocusRef = useRef(false);
  const closeDrawer = () => {
    refocusRef.current = true;
    setDrawer(null);
  };
  const toggleDrawer = (key: Drawer, opener: HTMLElement) => {
    openerRef.current = opener;
    if (drawer === key) closeDrawer();
    else setDrawer(key);
  };
  // Focus goes into the drawer as it opens (or changes panel). On close it goes back to the
  // opener — after the render that lifts `inert` from the header, or it would not take it.
  useEffect(() => {
    if (drawer !== null) {
      drawerRef.current?.focus();
      return;
    }
    if (refocusRef.current) openerRef.current?.focus();
    refocusRef.current = false;
  }, [drawer]);
  // Escape closes the drawer, unless a dialog above it (the settings, the night's end) is
  // what the key is meant for: those live outside the table, over the drawer.
  useEffect(() => {
    if (drawer === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector(".modal-backdrop") !== null) return;
      refocusRef.current = true;
      setDrawer(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);
  /** Recording mode: the table alone, narrated. Kept here, and only for this sitting. */
  const [showcase, setShowcase] = useState(false);

  // The body carries the mode, so the chrome outside this component can step aside too.
  useEffect(() => {
    if (!showcase) return;
    document.body.classList.add("showcase");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowcase(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("showcase");
      document.removeEventListener("keydown", onKey);
    };
  }, [showcase]);

  const { state } = game;
  const snapshot = state.snapshot;

  /** The rules, when they are up: asked for from the header, or opened by the table itself. */
  const [rules, setRules] = useState<"asked" | "auto" | null>(null);
  /** Set when the rules paused the table, so closing them resumes it and nothing else does. */
  const rulesPausedRef = useRef(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const stoppedRef = useRef(stopReason !== null);
  stoppedRef.current = stopReason !== null;
  // Synchronous on purpose: called from the opening's own callback, the pause has to land
  // before the gate lets the loop deal the first hand.
  const openRules = (how: "asked" | "auto") => {
    const current = gameRef.current;
    // One overlay at a time: the drawer steps aside for the rules.
    setDrawer(null);
    if (!current.state.paused && !current.state.gameOver && !stoppedRef.current) {
      current.togglePause();
      rulesPausedRef.current = true;
    }
    setRules(how);
  };
  const closeRules = () => {
    markRulesSeen();
    setRules(null);
    const current = gameRef.current;
    if (rulesPausedRef.current && current.state.paused && !stoppedRef.current) {
      current.togglePause();
    }
    rulesPausedRef.current = false;
  };
  // The server's stop has a dialog of its own, and the table stays stopped under it.
  useEffect(() => {
    if (stopReason === null) return;
    rulesPausedRef.current = false;
    setRules(null);
  }, [stopReason]);

  // On a phone the action bar is fixed over the bottom of the page, which is exactly where
  // the player's own seat is drawn: left alone it hid their cards on their own turn. So the
  // page keeps room for the bar below the felt, and a turn scrolls the felt clear of it. The
  // room is never given back while the table is up — a page that grew and shrank with every
  // turn would jump under the thumb.
  const screenRef = useRef<HTMLElement>(null);
  const feltRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const legalForHuman = game.legalForHuman;
  // The player's turn closes the drawer: it covers the action bar, on a phone all of it.
  useEffect(() => {
    if (legalForHuman !== null) setDrawer(null);
  }, [legalForHuman]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new turn is a new `legalForHuman`, and the bar is as tall as what it offers.
  useLayoutEffect(() => {
    const bar = turnRef.current;
    if (!phone || bar === null || screenRef.current === null) return;
    screenRef.current.style.setProperty("--turn-bar-height", `${bar.offsetHeight}px`);
    const felt = feltRef.current;
    if (felt === null || typeof felt.scrollIntoView !== "function") return;
    if (felt.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top) return;
    // Instant on purpose. With the room kept this happens once per sitting, and a smooth
    // scroll is an animation: a tab that is not painting never finishes it, and the cards
    // stay under the bar.
    felt.scrollIntoView({ block: "end" });
  }, [phone, legalForHuman]);
  const names = new Map(state.seats.map((s) => [s.id, s.name]));
  // Once the player is out of the hand the 御霊 keep their lines to the bubbles, unless the
  // player asked to hear them anyway. Music and the table's own sounds are not affected.
  const quiet = !voiceWhenOut && playerOutOfHand(snapshot, game.humanSeats);
  const quietRef = useRef(quiet);
  quietRef.current = quiet;

  // A greeting as the table opens: one 御霊, picked at random, a beat after the doors. Six in
  // a row only talked over each other. Local, not an effect of the game, because no engine
  // event says "we sat down".
  const [greetings, setGreetings] = useState<ReadonlyMap<SeatId, Speech>>(new Map());
  const seatsRef = useRef(state.seats);
  seatsRef.current = state.seats;
  const [seatLight, setSeatLight] = useState<SeatLight>(opening ? "dim" : null);
  // The table is open once the veil is gone; `seatLight` never goes back to "dim".
  const opened = seatLight !== "dim";
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per sitting, as the table opens
  useEffect(() => {
    if (!opened) return;
    const seated = seatsRef.current.filter((s) => s.kind === "cpu" && !spirit(s.spiritId).silent);
    const seat = seated[Math.floor(Math.random() * seated.length)];
    if (seat === undefined) return;
    const timer = setTimeout(() => {
      const line = pickLine(seat.spiritId, "greet", rollFrom(Date.now()));
      if (line === null) return;
      const at = Date.now();
      setGreetings(new Map([[seat.id, { id: -1, seat: seat.id, situation: "win", line, at }]]));
      if (!quietRef.current) voice?.play(seat.spiritId, line, { situation: "greet" });
    }, GREET_GAP_MS);
    return () => clearTimeout(timer);
  }, [opened]);

  // The table's own sounds follow the same effects, each played once: a street dealt, chips
  // out to a bet, a pot coming home, and the cut-in's own strike.
  const soundRef = useRef<{ feed: number; move: number; cutIn: number }>({
    feed: 0,
    move: 0,
    cutIn: 0,
  });
  const fxFeed = state.fx.feed;
  const fxMoves = state.fx.chipMoves;
  useEffect(() => {
    if (sound === undefined) return;
    const street = [...fxFeed].reverse().find((e) => e.type === "street");
    if (street !== undefined && street.id > soundRef.current.feed) {
      soundRef.current.feed = street.id;
      sound.se("deal");
    }
    const move = fxMoves[fxMoves.length - 1];
    if (move !== undefined && move.id > soundRef.current.move) {
      soundRef.current.move = move.id;
      if (move.kind === "toBet") sound.se("chip");
      else if (move.kind === "toSeat") sound.se("pot");
    }
  }, [sound, fxFeed, fxMoves]);
  // Voices follow the effects: the newest shout, word or cut-in, each said once. A line that
  // comes while the table is quiet is marked as said, so it is not said late when the
  // player is dealt back in.
  const spokenRef = useRef<{ callout: number; speech: number; cutIn: number }>({
    callout: 0,
    speech: 0,
    cutIn: 0,
  });
  const fxCallouts = state.fx.callouts;
  const fxSpeech = state.fx.speech;
  const fxCutIn = state.fx.cutIn;
  useEffect(() => {
    if (voice === undefined) return;
    const spiritOf = (seat: SeatId) => seatsRef.current.find((s) => s.id === seat)?.spiritId;
    const last = fxCallouts[fxCallouts.length - 1];
    if (last !== undefined && last.id > spokenRef.current.callout) {
      spokenRef.current.callout = last.id;
      const who = spiritOf(last.seat);
      // An all-in's line belongs to the cut-in, which says it with priority below.
      if (!quiet && last.line !== null && who !== undefined && last.kind !== "allin") {
        voice.play(who, last.line, { situation: last.kind });
      }
    }
    const word = fxSpeech[fxSpeech.length - 1];
    if (word !== undefined && word.id > spokenRef.current.speech) {
      spokenRef.current.speech = word.id;
      const who = spiritOf(word.seat);
      if (!quiet && who !== undefined && word.situation !== "bigwin" && word.situation !== "bust") {
        voice.play(who, word.line, { situation: word.situation });
      }
    }
    if (fxCutIn !== null && fxCutIn.id > spokenRef.current.cutIn) {
      spokenRef.current.cutIn = fxCutIn.id;
      const who = spiritOf(fxCutIn.seat);
      if (!quiet && fxCutIn.line !== null && who !== undefined) {
        voice.play(who, fxCutIn.line, { priority: true, situation: fxCutIn.kind });
      }
    }
  }, [voice, quiet, fxCallouts, fxSpeech, fxCutIn]);
  useEffect(() => {
    if (sound === undefined || fxCutIn === null) return;
    if (fxCutIn.id <= soundRef.current.cutIn) return;
    soundRef.current.cutIn = fxCutIn.id;
    sound.se(fxCutIn.kind === "allin" ? "cutin" : fxCutIn.kind);
  }, [sound, fxCutIn]);
  // Warm the cut-in drawings while the first hand is dealt, so one never pops in blank.
  useEffect(() => {
    const warm: HTMLImageElement[] = [];
    for (const id of CPU_SPIRIT_IDS) {
      const url = spirit(id).cutin;
      if (url === null) continue;
      const image = new Image();
      image.src = url;
      warm.push(image);
    }
    return () => {
      for (const image of warm) image.removeAttribute("src");
    };
  }, []);
  const count = state.seats.length;
  // Put the first human seat (or seat 0) at the bottom of the table.
  const anchor = game.humanSeats[0] ?? 0;
  const anchorIndex = state.seats.findIndex((s) => s.id === anchor);
  const revealAll = game.spectator || snapshot?.street === "showdown";
  // A taller felt needs a narrower, taller ellipse to keep the seats on the rail.
  const radiusX = phone ? 40 : 42;
  const radiusY = phone ? 42 : 40;

  const last = state.lastDecision;
  const nameOf = (seat: SeatId) => personaNames?.[seat] ?? names.get(seat) ?? `#${seat}`;
  const bigBlind = snapshot?.bigBlind ?? 0;

  // Where each seat sits on the ellipse, and where its chips go: both are wanted by the
  // seats, by the bet stacks and by anything flying between them, so they are worked out
  // once here rather than three times over.
  const layout = state.seats.map((seat, index) => {
    const angle = ((index - anchorIndex) / count) * 2 * Math.PI + Math.PI / 2;
    const dx = radiusX * Math.cos(angle);
    const dy = radiusY * Math.sin(angle);
    const spot = BET_SPOT_VERTICAL + (BET_SPOT - BET_SPOT_VERTICAL) * Math.abs(Math.cos(angle));
    return {
      seat,
      player: snapshot?.players.find((p) => p.seat === seat.id),
      x: 50 + dx,
      y: 50 + dy,
      // Chips sit well in front of a side seat and further in for a top or bottom one:
      // the fraction slides with the seat's angle, so nothing jumps between the two.
      betX: 50 + dx * spot,
      betY: 50 + dy * spot,
      // Unit vector from the seat towards the middle. A seat only ever has felt on this
      // side of it, which is why the callout is thrown this way and never downwards.
      inward: { x: -Math.cos(angle), y: -Math.sin(angle) },
    };
  });
  const spots = new Map(
    layout.map(({ seat, x, y, betX, betY }) => [seat.id, { x, y, betX, betY }]),
  );

  // The effects layer keeps a short history; only each seat's newest shout is on screen.
  const fx = state.fx;
  const calloutBySeat = new Map<SeatId, (typeof fx.callouts)[number]>();
  for (const callout of fx.callouts) calloutBySeat.set(callout.seat, callout);
  const speechBySeat = new Map<SeatId, (typeof fx.speech)[number]>();
  for (const speech of fx.speech) speechBySeat.set(speech.seat, speech);
  // What each seat's bubble is made of: its newest shout and its newest word (or greeting).
  const bubbleOf = (seat: SeatId) => ({
    callout: calloutBySeat.get(seat) ?? null,
    speech: speechBySeat.get(seat) ?? greetings.get(seat) ?? null,
  });
  // A phone has no room for two: the bubbles all lean towards the middle of a narrow felt and
  // piled up on each other and the board. There only the newest one shows, and it replaces
  // any other at once. A wider felt keeps one per seat.
  let newestSeat: SeatId | null = null;
  if (phone) {
    let newestAt = Number.NEGATIVE_INFINITY;
    for (const { seat } of layout) {
      const { callout, speech } = bubbleOf(seat.id);
      const at = Math.max(
        callout?.at ?? Number.NEGATIVE_INFINITY,
        speech?.at ?? Number.NEGATIVE_INFINITY,
      );
      if (at > Number.NEGATIVE_INFINITY && at >= newestAt) {
        newestAt = at;
        newestSeat = seat.id;
      }
    }
  }
  const shownBubble = (seat: SeatId) =>
    phone && seat !== newestSeat ? { callout: null, speech: null } : bubbleOf(seat);
  const cutInSeat = fx.cutIn === null ? null : state.seats.find((s) => s.id === fx.cutIn?.seat);
  const cutInSpirit =
    cutInSeat === null || cutInSeat === undefined ? null : spirit(cutInSeat.spiritId);
  const rate = handsPerMinute(fx.handTimes);
  // The engine keeps `contributed` — and so `snapshot.pot` — until the next hand starts, but
  // the chips have visibly flown to the winner by then. Once the pot is paid the middle is
  // empty and the seats have nothing in front of them, whatever the snapshot still says.
  const total = fx.potPaid ? 0 : (snapshot?.pot ?? 0);
  // `snapshot.pot` is everything contributed, this street's bets included, and those are still
  // drawn in front of their seats until the street ends: the middle holds only the rest.
  const outstanding = snapshot?.players.reduce((sum, p) => sum + p.streetBet, 0) ?? 0;
  const pot = Math.max(0, total - outstanding);
  /** Durations the felt's animations read; one place to change, one place to speed up. */
  const feltVars = {
    "--callout-ms": `${timings.calloutMs}ms`,
    "--chip-ms": `${timings.chipMoveMs}ms`,
    "--glow-ms": `${timings.winnerGlowMs}ms`,
    "--flip-ms": `${timings.cardFlipMs}ms`,
    // A spoken line outlasts the plain shout: the loop waits for the voice, so can the bubble.
    "--speech-ms": `${Math.max(timings.calloutMs, SPEECH_MS)}ms`,
  } as CSSProperties;

  return (
    <section ref={screenRef} className={showcase ? "table-screen showcase-mode" : "table-screen"}>
      {/* Behind an open drawer the table is inert: Tab cannot wander under the backdrop. */}
      <div className="table-main" inert={(drawer !== null && !showcase) || rules !== null}>
        {/* The hand and its badges on the left; every control together on the right. */}
        <div className="table-header">
          <div className="table-header-info row">
            <span>{snapshot !== null && t("table.hand", { number: snapshot.handNumber + 1 })}</span>
            {game.spectator && !phone && !showcase && (
              <span className="badge">{t("table.spectating")}</span>
            )}
            {game.spectator && !phone && rate !== null && (
              <span className="badge">{t("table.handsPerMin", { rate })}</span>
            )}
            {state.pauseReason === "tonight" && !showcase && (
              <span className="badge">
                {stopReason === "unavailable" ? t("table.paused") : t("tonight.title")}
              </span>
            )}
          </div>
          <div className="table-header-actions row">
            <button
              type="button"
              className="secondary"
              onClick={game.togglePause}
              // A server stop is final for the sitting: the dialog covers the table, but the
              // keyboard can still reach this button behind it.
              disabled={state.gameOver || stopReason !== null}
            >
              {state.paused ? t("table.resume") : t("table.pause")}
            </button>
            {showcase ? (
              <button
                type="button"
                className="secondary showcase-exit"
                aria-label={t("showcase.exit")}
                onClick={() => setShowcase(false)}
              >
                ×
              </button>
            ) : (
              <>
                {(["log", "stats"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={drawer === key ? "" : "secondary"}
                    aria-expanded={drawer === key}
                    aria-haspopup="dialog"
                    onClick={(event) => toggleDrawer(key, event.currentTarget)}
                  >
                    {t(`tabs.${key}`)}
                  </button>
                ))}
                <button type="button" className="secondary" onClick={onOpenSettings}>
                  {t("title.settings")}
                </button>
                <button
                  type="button"
                  className="secondary rules-open"
                  aria-label={t("rules.open")}
                  aria-haspopup="dialog"
                  disabled={stopReason !== null}
                  onClick={() => openRules("asked")}
                >
                  ?
                </button>
                {recording && (
                  <button type="button" className="secondary" onClick={() => setShowcase(true)}>
                    {t("showcase.toggle")}
                  </button>
                )}
                <button type="button" className="secondary" onClick={onLeave}>
                  {t("table.leave")}
                </button>
              </>
            )}
          </div>
        </div>

        {/* The felt is always up, on a phone too: the log and stats open over it. */}
        <div
          ref={feltRef}
          className={seatLight === null ? "felt" : `felt seats-${seatLight}`}
          style={feltVars}
        >
          {layout.map(({ seat, player, x, y, inward }, index) => {
            // Lit round the table from the player's own seat, one after another.
            const order = (index - anchorIndex + count) % count;
            const style =
              seatLight === "lit"
                ? ({
                    left: `${x}%`,
                    top: `${y}%`,
                    "--lit-delay": `${order * SEAT_LIT_STAGGER_MS}ms`,
                  } as CSSProperties)
                : { left: `${x}%`, top: `${y}%` };
            const thinking = state.thinkingSeat === seat.id;
            // A seat is narrated while it thinks, and for a moment after it has decided.
            const decided = last !== null && last.seat === seat.id ? last : null;
            const bubble =
              showcase && (thinking || decided !== null) ? (
                <DecisionBubble
                  seat={seat.id}
                  personaName={nameOf(seat.id)}
                  thinking={thinking}
                  decision={decided?.record ?? null}
                  features={decided?.features ?? null}
                  bigBlind={snapshot?.bigBlind ?? 0}
                  visibleUntil={decided === null ? null : decided.at + timings.decisionHoldMs}
                  speed={speed}
                  compact={compactBubble(inward)}
                />
              ) : null;
            return (
              <SeatView
                key={seat.id}
                seat={seat}
                player={player}
                isButton={snapshot?.button === seat.id}
                isActing={snapshot?.actingSeat === seat.id && !snapshot.complete}
                isThinking={thinking}
                revealCards={revealAll || game.humanSeats.includes(seat.id)}
                style={style}
                overlay={bubble}
                callout={calloutBySeat.get(seat.id) ?? null}
                winnerAt={fx.winners.includes(seat.id) ? fx.winnersAt : 0}
                flipAt={revealAll ? fx.flipAt : 0}
              />
            );
          })}

          {/* Chips on their way out to a bet, into the pot, or home to a winner. */}
          <TableFxLayer moves={fx.chipMoves} spots={spots} bigBlind={bigBlind} />

          {/* A 御霊's all-in, big pot or bust, over the middle. */}
          <CutInLayer cutIn={fx.cutIn} spirit={cutInSpirit} gate={gate} />

          {/* Each seat's live bet, drawn as chips between the player and the middle. */}
          {layout.map(({ seat, player, betX, betY }) => (
            <ChipStack
              key={seat.id}
              className="bet-stack"
              amount={fx.potPaid ? 0 : (player?.streetBet ?? 0)}
              bigBlind={bigBlind}
              style={{ left: `${betX}%`, top: `${betY}%` }}
            />
          ))}

          {/* Every seat's bubble, in one layer above the chips and below the cut-in. */}
          <div className="speech-layer">
            {layout.map(({ seat, x, y, inward }) => (
              <SeatSpeech
                key={seat.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                {...shownBubble(seat.id)}
                bigBlind={bigBlind}
                inward={inward}
              />
            ))}
          </div>

          <div className="board">
            <div className="board-cards">
              {[0, 1, 2, 3, 4].map((i) => {
                const card = snapshot?.board[i] ?? null;
                // Keying on the card itself remounts only the slots that just changed, so
                // a new street's cards pop in and the ones already out stay put.
                return <CardView key={`${i}:${card === null ? "" : cardText(card)}`} card={card} />;
              })}
            </div>
            {snapshot !== null && (
              <PotView
                pot={pot}
                total={total}
                bigBlind={bigBlind}
                ms={reducedMotion ? 0 : timings.potCountMs}
              />
            )}
          </div>
        </div>

        {/* The strip belongs to the felt; a phone has no room for it unless it is the shot. */}
        {(!phone || showcase) && (
          <ActionFeed entries={fx.feed} nameOf={nameOf} bigBlind={bigBlind} />
        )}

        {state.gameOver && (
          <p className="error">
            {t("table.gameOver")}{" "}
            {state.error === NO_BACKEND_ERROR ? t("table.noBackend") : state.error}
          </p>
        )}

        {game.legalForHuman !== null && snapshot !== null && (
          <div ref={turnRef} className="your-turn">
            <strong>{t("table.yourTurn")}</strong>
            <ActionBar
              legal={game.legalForHuman}
              currentBet={snapshot.currentBet}
              pot={snapshot.pot}
              bigBlind={bigBlind}
              preflop={snapshot.street === "preflop"}
              onAct={(action) => {
                sound?.se("tap");
                game.humanAct(action);
              }}
            />
          </div>
        )}
      </div>

      {/* Recording mode keeps a column of its own for the decision being narrated. */}
      {showcase && (
        <div className="table-side">
          <ShowcasePanel
            last={last}
            personaName={last === null ? "" : nameOf(last.seat)}
            bigBlind={snapshot?.bigBlind ?? 0}
          />
        </div>
      )}

      {/* The log and the stats slide in over the table from the right, one at a time. */}
      {drawer !== null && !showcase && (
        <>
          <div className="drawer-backdrop" aria-hidden="true" onClick={closeDrawer} />
          <div
            ref={drawerRef}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={drawer === "stats" ? t("stats.title") : t("history.title")}
            tabIndex={-1}
          >
            <div className="drawer-head">
              {/* The backdrop covers the header, so the drawer switches panels itself. */}
              <div className="row drawer-tabs">
                {(["log", "stats"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={drawer === key ? "" : "secondary"}
                    aria-pressed={drawer === key}
                    onClick={() => setDrawer(key)}
                  >
                    {t(`tabs.${key}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="secondary drawer-close"
                aria-label={t("settings.close")}
                onClick={closeDrawer}
              >
                ×
              </button>
            </div>
            {drawer === "stats" ? (
              <StatsPanel
                seats={state.seats}
                session={state.stats}
                cumulative={game.cumulative}
                keys={game.statsKeys}
                startingStack={startingStack}
                bigBlind={bigBlind}
                onResetCumulative={game.resetCumulative}
                language={language}
              />
            ) : (
              <HistoryPanel log={state.log} names={names} />
            )}
          </div>
        </>
      )}

      {opening && (
        <OpeningLayer
          gate={gate}
          sound={sound}
          seatCount={count}
          reducedMotion={reducedMotion}
          onOpened={(instant) => {
            setSeatLight(instant ? null : "lit");
            if (autoRules && !rulesSeen()) openRules("auto");
          }}
        />
      )}

      <RulesDialog open={rules !== null} auto={rules === "auto"} onClose={closeRules} />

      {showcase && (
        <div className="showcase-bottom">
          <Ticker
            stats={state.stats}
            prefetch={state.prefetch}
            handsPlayed={state.handsPlayed}
            maxPot={state.maxPot}
          />
          <p className="showcase-corner">{t("showcase.poweredBy")}</p>
        </div>
      )}
    </section>
  );
}
