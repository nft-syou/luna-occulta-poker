import { type Card, formatCard, parseCards } from "@jev-poker/engine";
import { Fragment, useId } from "react";
import { useTranslation } from "react-i18next";
import { spiritById } from "../characters/spirits";
import { CardView } from "./CardView";

/*
 * The four tabs of 「遊び方」, drawn rather than written: every diagram is inline SVG or the
 * felt's own CSS, in the kitan tokens. Each one is a <figure> named for a screen reader; the
 * drawing inside is hidden and the few visible words are real text.
 */

/** The nine hands, strongest first; `made` is how many of the five cards make the hand. */
export const HAND_RANKINGS: readonly { id: string; cards: readonly Card[]; made: number }[] = (
  [
    ["straight_flush", "9h 8h 7h 6h 5h", 5],
    ["four_of_a_kind", "Qs Qh Qd Qc 7s", 4],
    ["full_house", "Ks Kh Kd 4c 4s", 5],
    ["flush", "Ad Jd 8d 5d 2d", 5],
    ["straight", "Tc 9d 8s 7h 6c", 5],
    ["three_of_a_kind", "7c 7d 7s Kh 2c", 3],
    ["two_pair", "Jh Js 5c 5d Ac", 4],
    ["pair", "Ah Ad Ks 9c 4h", 2],
    ["high_card", "As Qd 9h 6c 3s", 1],
  ] as const
).map(([id, cards, made]) => ({ id, cards: parseCards(cards), made }));

const key = (card: Card) => formatCard(card);

/** A card of the felt, bright when it plays and dimmed when it does not. */
function RulesCard({ card, lit }: { card: Card; lit: boolean }) {
  return (
    <span className={lit ? "rules-card is-made" : "rules-card is-dim"}>
      <CardView card={card} />
    </span>
  );
}

// --- The flow -----------------------------------------------------------------

const STREETS = [
  { id: "deal", label: "rules.flow.deal", board: 0 },
  { id: "flop", label: "streets.flop", board: 3 },
  { id: "turn", label: "streets.turn", board: 4 },
  { id: "river", label: "streets.river", board: 5 },
  { id: "showdown", label: "streets.showdown", board: 5 },
] as const;

const SLOTS = [0, 1, 2, 3, 4] as const;

const BEST = {
  hole: parseCards("Jh 9c"),
  board: parseCards("Tc Kd 8d 7s 2h"),
  unused: new Set(["Kd", "2h"]),
};

/** Six seats round an oval, the button at the foot; clockwise on screen is "to the left". */
const SEATS = [0, 1, 2, 3, 4, 5].map((i) => {
  const angle = ((90 + 60 * i) * Math.PI) / 180;
  return { i, cos: Math.cos(angle), sin: Math.sin(angle) };
});
const TABLE = { cx: 120, cy: 72, rx: 78, ry: 44, seatRx: 98, seatRy: 60 };
const at = (cos: number, sin: number, scale: number) => ({
  x: TABLE.cx + TABLE.seatRx * cos * scale,
  y: TABLE.cy + TABLE.seatRy * sin * scale,
});
const arcPoint = (degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  return `${(TABLE.cx + 44 * Math.cos(a)).toFixed(1)} ${(TABLE.cy + 22 * Math.sin(a)).toFixed(1)}`;
};

function TableDiagram() {
  const { t } = useTranslation();
  const arrow = `${useId()}-arrow`;
  const marker = (i: number, scale: number) => {
    const seat = SEATS[i] ?? { cos: 0, sin: 1 };
    return at(seat.cos, seat.sin, scale);
  };
  const button = marker(0, 0.66);
  const small = marker(1, 0.64);
  const big = marker(2, 0.64);
  return (
    <figure className="rules-fig rules-table" aria-label={t("rules.flow.tableLabel")}>
      <h3 className="rules-fig-title">{t("rules.flow.tableTitle")}</h3>
      <svg viewBox="0 0 240 144" width="240" height="144" aria-hidden="true" focusable="false">
        <defs>
          <marker
            id={arrow}
            viewBox="0 0 8 8"
            refX="4"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L8 4 L0 8 z" className="rules-svg-gold-fill" />
          </marker>
        </defs>
        <ellipse
          cx={TABLE.cx}
          cy={TABLE.cy}
          rx={TABLE.rx}
          ry={TABLE.ry}
          className="rules-svg-felt"
        />
        <path
          d={`M ${arcPoint(125)} A 44 22 0 1 1 ${arcPoint(55)}`}
          className="rules-svg-arrow"
          markerEnd={`url(#${arrow})`}
        />
        {SEATS.map(({ i, cos, sin }) => {
          const p = at(cos, sin, 1);
          return <circle key={i} cx={p.x} cy={p.y} r="10" className="rules-svg-seat" />;
        })}
        <circle cx={button.x} cy={button.y} r="8" className="rules-svg-button" />
        <text x={button.x} y={button.y + 4} className="rules-svg-label" textAnchor="middle">
          D
        </text>
        <circle cx={small.x} cy={small.y} r="5" className="rules-svg-chip" />
        <text x={small.x + 9} y={small.y + 4} className="rules-svg-label">
          SB 1
        </text>
        <circle cx={big.x} cy={big.y} r="5" className="rules-svg-chip" />
        <text x={big.x + 9} y={big.y + 4} className="rules-svg-label">
          BB 2
        </text>
      </svg>
      <figcaption className="rules-caption">{t("rules.flow.tableCaption")}</figcaption>
    </figure>
  );
}

export function FlowTab() {
  const { t } = useTranslation();
  return (
    <div className="rules-flow">
      <figure className="rules-fig" aria-label={t("rules.flow.stripLabel")}>
        <ol className="rules-strip">
          {STREETS.map((street, index) => (
            <Fragment key={street.id}>
              {index > 0 && (
                <li className="rules-strip-arrow" aria-hidden="true">
                  →
                </li>
              )}
              <li className="rules-step">
                <span className="rules-step-name">{t(street.label)}</span>
                <span className="rules-mini-board" aria-hidden="true">
                  {SLOTS.map((slot) => (
                    <span
                      key={slot}
                      className={slot < street.board ? "rules-slot lit" : "rules-slot"}
                    />
                  ))}
                </span>
                <span className="rules-mini-hole" aria-hidden="true">
                  {street.id === "deal" && (
                    <>
                      <span className="card back" />
                      <span className="card back" />
                    </>
                  )}
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
        <figcaption className="rules-caption">{t("rules.flow.roundEach")}</figcaption>
      </figure>
      <div className="rules-flow-row">
        <figure className="rules-fig rules-best" aria-label={t("rules.flow.bestLabel")}>
          <h3 className="rules-fig-title">{t("rules.flow.bestTitle")}</h3>
          <div className="rules-best-cards" aria-hidden="true">
            <span className="rules-best-group">
              <span className="rules-best-tag">{t("rules.flow.hole")}</span>
              <span className="rules-cards">
                {BEST.hole.map((card) => (
                  <RulesCard key={key(card)} card={card} lit={!BEST.unused.has(key(card))} />
                ))}
              </span>
            </span>
            <span className="rules-best-group">
              <span className="rules-best-tag">{t("rules.flow.board")}</span>
              <span className="rules-cards">
                {BEST.board.map((card) => (
                  <RulesCard key={key(card)} card={card} lit={!BEST.unused.has(key(card))} />
                ))}
              </span>
            </span>
          </div>
          <figcaption className="rules-best-hand">{t("rules.flow.bestHand")}</figcaption>
        </figure>
        <TableDiagram />
      </div>
    </div>
  );
}

// --- Actions ------------------------------------------------------------------

const ACTIONS = ["fold", "check", "call", "bet", "raise", "allin"] as const;
const PRESETS = ["min", "x2_5", "x3", "x4", "allin"] as const;
const PINS = [
  { n: 1, label: "rules.actions.barSizes" },
  { n: 2, label: "rules.actions.barFine" },
  { n: 3, label: "rules.actions.barCommit" },
] as const;

function Pin({ n }: { n: number }) {
  return (
    <span className="rules-pin" aria-hidden="true">
      {n}
    </span>
  );
}

/**
 * The action bar as it looks preflop, facing the big blind: the real bar's classes on a
 * copy that cannot be focused or pressed, with a numbered pin beside each row.
 */
function ActionBarMock() {
  const { t } = useTranslation();
  return (
    <figure className="rules-fig rules-bar" aria-label={t("rules.actions.barLabel")}>
      <h3 className="rules-fig-title">{t("rules.actions.barTitle")}</h3>
      <div className="rules-bar-mock action-bar" inert aria-hidden="true">
        <div className="rules-bar-row">
          <Pin n={1} />
          <div className="sizing-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={preset === "x3" ? "preset active" : "preset"}
              >
                {t(`actions.size.${preset}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="rules-bar-row">
          <Pin n={2} />
          <div className="sizing-fine">
            <button type="button" className="secondary stepper">
              −
            </button>
            <input type="number" value={6} readOnly tabIndex={-1} />
            <button type="button" className="secondary stepper">
              +
            </button>
            <input type="range" min={4} max={200} value={6} readOnly tabIndex={-1} />
          </div>
        </div>
        <div className="rules-bar-row">
          <Pin n={3} />
          <div className="action-main">
            <button type="button" className="secondary fold">
              {t("actions.fold")}
            </button>
            <button type="button" className="passive">
              <span className="act-name">{t("actions.short.call")}</span>
              <span className="act-amount">2</span>
            </button>
            <button type="button" className="aggressive">
              <span className="act-name">{t("actions.short.raise")}</span>
              <span className="act-amount">6</span>
            </button>
          </div>
        </div>
      </div>
      <figcaption>
        <ol className="rules-pins">
          {PINS.map((pin) => (
            <li key={pin.n}>
              <Pin n={pin.n} />
              {t(pin.label)}
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

export function ActionsTab() {
  const { t } = useTranslation();
  return (
    <div className="rules-actions">
      <dl className="rules-acts">
        {ACTIONS.map((action) => (
          <div key={action} className="rules-act">
            <dt>
              <span className={`callout callout-${action}`}>{t(`rules.terms.${action}`)}</span>
            </dt>
            <dd>{t(`rules.actions.${action}`)}</dd>
          </div>
        ))}
      </dl>
      <ActionBarMock />
    </div>
  );
}

// --- Hand rankings ------------------------------------------------------------

export function HandsTab() {
  const { t } = useTranslation();
  return (
    <div className="rules-hands-wrap">
      <div className="rules-ladder">
        <div className="rules-scale" aria-hidden="true">
          <span>{t("rules.hands.strong")}</span>
          <span className="rules-scale-bar" />
          <span>{t("rules.hands.weak")}</span>
        </div>
        <ol className="rules-hands" aria-label={t("rules.tabs.hands")}>
          {HAND_RANKINGS.map(({ id, cards, made }) => (
            <li key={id} className="rules-hand">
              <span className="rules-cards" aria-hidden="true">
                {cards.map((card, index) => (
                  <RulesCard key={key(card)} card={card} lit={index < made} />
                ))}
              </span>
              <span className="rules-hand-text">
                <strong className="rules-hand-name">{t(`hands.${id}`)}</strong>
                <span className="rules-hand-desc">{t(`rules.hands.${id}`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="rules-note">{t("rules.hands.royal")}</p>
      <p className="rules-note">{t("rules.hands.ties")}</p>
    </div>
  );
}

// --- House rules --------------------------------------------------------------

/** A pile of chips seen from the side: `discs` gold-rimmed ellipses, or a dashed ring for none. */
function ChipPile({ discs, max = 6 }: { discs: number; max?: number }) {
  const height = 12 + max * 6;
  const base = height - 7;
  return (
    <svg
      className="rules-pile"
      viewBox={`0 0 36 ${height}`}
      width="36"
      height={height}
      aria-hidden="true"
      focusable="false"
    >
      {discs === 0 ? (
        <ellipse cx="18" cy={base} rx="14" ry="5" className="rules-svg-empty" />
      ) : (
        Array.from({ length: discs }, (_, i) => i).map((i) => (
          <ellipse key={i} cx="18" cy={base - i * 6} rx="14" ry="5" className="rules-svg-disc" />
        ))
      )}
    </svg>
  );
}

const STAKES = [
  { id: "yoi", discs: 6, bb: 100 },
  { id: "shinkou", discs: 4, bb: 50 },
  { id: "shoku", discs: 2, bb: 25 },
] as const;

function MoonIcon() {
  const mask = `${useId()}-moon`;
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      <defs>
        <mask id={mask}>
          <rect width="48" height="48" fill="white" />
          <circle cx="31" cy="19" r="15" fill="black" />
        </mask>
      </defs>
      <circle cx="24" cy="24" r="17" className="rules-svg-moon" mask={`url(#${mask})`} />
      <circle cx="24" cy="24" r="17" className="rules-svg-ring" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      <path d="M9 19 H17 L27 10 V38 L17 29 H9 Z" className="rules-svg-speaker" />
      <path d="M32 18 Q36 24 32 30" className="rules-svg-wave" />
      <path d="M36 13 Q43 24 36 35" className="rules-svg-wave" />
    </svg>
  );
}

export function HouseTab() {
  const { t } = useTranslation();
  const sakuya = spiritById("sakuya");
  return (
    <div className="rules-house">
      <figure className="rules-tile" aria-label={t("rules.house.stakesLabel")}>
        <h3 className="rules-fig-title">{t("tableSetup.rate")}</h3>
        <div className="rules-stakes" aria-hidden="true">
          {STAKES.map((stake) => (
            <span key={stake.id} className="rules-stake">
              <ChipPile discs={stake.discs} />
              <span className="rules-stake-name">{t(`tableSetup.rate_${stake.id}`)}</span>
              <span className="rules-num">{stake.bb}BB</span>
            </span>
          ))}
        </div>
        <figcaption className="rules-caption">{t("rules.house.blinds")}</figcaption>
      </figure>
      <figure className="rules-tile" aria-label={t("rules.house.refillLabel")}>
        <h3 className="rules-fig-title">{t("rules.house.refillTitle")}</h3>
        <div className="rules-refill" aria-hidden="true">
          <span className="rules-stake">
            <ChipPile discs={0} />
            <span className="rules-num">0</span>
          </span>
          <span className="rules-refill-arrow">→</span>
          <span className="rules-stake">
            <ChipPile discs={6} />
            <span className="rules-num">100BB</span>
          </span>
        </div>
        <figcaption className="rules-caption">
          {t("rules.house.refill")}
          <span className="rules-subcaption">{t("rules.house.refillNote")}</span>
        </figcaption>
      </figure>
      <figure className="rules-tile rules-tile-icon">
        <MoonIcon />
        <figcaption>
          <h3 className="rules-fig-title">{t("rules.house.budgetTitle")}</h3>
          <span className="rules-caption">{t("rules.house.budget")}</span>
          <span className="rules-subcaption">{t("rules.house.budgetNote")}</span>
        </figcaption>
      </figure>
      <figure className="rules-tile rules-tile-icon">
        <SpeakerIcon />
        <figcaption>
          <h3 className="rules-fig-title">{t("rules.house.voicesTitle")}</h3>
          <span className="rules-caption">{t("rules.house.voices")}</span>
        </figcaption>
      </figure>
      <figure className="rules-tile rules-tile-icon rules-tell">
        {sakuya !== undefined && (
          <img className="rules-face" src={sakuya.icon} alt="" width="48" height="48" />
        )}
        <figcaption>
          <h3 className="rules-fig-title">{t("rules.house.sakuyaName")}</h3>
          <span className="rules-caption">{t("rules.house.sakuya")}</span>
        </figcaption>
      </figure>
    </div>
  );
}
