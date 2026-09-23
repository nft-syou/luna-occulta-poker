import { type Card, parseCards } from "@jev-poker/engine";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CardView } from "./CardView";

interface Props {
  open: boolean;
  /** Opened by the table itself on a first visit: offers a skip beside the close. */
  auto?: boolean;
  onClose: () => void;
}

const TABS = ["flow", "actions", "hands", "house"] as const;
type Tab = (typeof TABS)[number];

/** The nine hands, strongest first, each with an example drawn as it would be on the felt. */
export const HAND_RANKINGS: readonly { id: string; cards: readonly Card[] }[] = [
  ["straight_flush", "9h 8h 7h 6h 5h"],
  ["four_of_a_kind", "Qs Qh Qd Qc 7s"],
  ["full_house", "Ks Kh Kd 4c 4s"],
  ["flush", "Ad Jd 8d 5d 2d"],
  ["straight", "Tc 9d 8s 7h 6c"],
  ["three_of_a_kind", "7c 7d 7s Kh 2c"],
  ["two_pair", "Jh Js 5c 5d Ac"],
  ["pair", "Ah Ad Ks 9c 4h"],
  ["high_card", "As Qd 9h 6c 3s"],
].map(([id, cards]) => ({ id: id as string, cards: parseCards(cards as string) }));

const FLOW = ["cards", "streets", "showdown", "blinds", "order", "headsUp"] as const;
const ACTIONS = ["fold", "check", "call", "bet", "raise", "allin"] as const;
const BAR = ["bar", "barSizes", "barFine", "barCommit"] as const;
const HOUSE = ["stakes", "rebuy", "spirits", "sakuya", "tonight", "voices"] as const;

/**
 * How to play, in four short tabs: from the title screen, from the table's 「？」, and once by
 * itself at a first table. Escape and the close button shut it; the focus comes back to
 * whatever had it before.
 */
export function RulesDialog({ open, auto = false, onClose }: Props) {
  if (!open) return null;
  return <RulesBody auto={auto} onClose={onClose} />;
}

function RulesBody({ auto, onClose }: { auto: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [tab, setTab] = useState<Tab>("flow");
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // In as it opens; back to the opener as it closes.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    tabRefs.current.get("flow")?.focus();
    return () => before?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.indexOf(tab);
    const target: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    const to = target[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = TABS[(to + TABS.length) % TABS.length] ?? "flow";
    setTab(next);
    tabRefs.current.get(next)?.focus();
  };

  const tabId = (key: Tab) => `${id}-tab-${key}`;
  const panelId = (key: Tab) => `${id}-panel-${key}`;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal rules" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`}>{t("rules.title")}</h2>
        {auto && <p className="rules-first muted">{t("rules.firstVisit")}</p>}
        <div className="rules-tabs" role="tablist" aria-label={t("rules.title")}>
          {TABS.map((key) => (
            <button
              key={key}
              ref={(node) => {
                if (node === null) tabRefs.current.delete(key);
                else tabRefs.current.set(key, node);
              }}
              id={tabId(key)}
              type="button"
              role="tab"
              className={tab === key ? "rules-tab" : "rules-tab secondary"}
              aria-selected={tab === key}
              aria-controls={panelId(key)}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              onKeyDown={onTabKey}
            >
              {t(`rules.tabs.${key}`)}
            </button>
          ))}
        </div>
        <div
          className="rules-panel"
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a tab panel takes the focus so its text can be scrolled by keyboard.
          tabIndex={0}
        >
          {tab === "flow" && (
            <ul className="rules-list">
              {FLOW.map((key) => (
                <li key={key}>{t(`rules.flow.${key}`)}</li>
              ))}
            </ul>
          )}
          {tab === "actions" && (
            <>
              <dl className="rules-terms">
                {ACTIONS.map((key) => (
                  <div key={key}>
                    <dt>{t(`rules.terms.${key}`)}</dt>
                    <dd>{t(`rules.actions.${key}`)}</dd>
                  </div>
                ))}
              </dl>
              <h3>{t("rules.actions.barTitle")}</h3>
              <ul className="rules-list">
                {BAR.map((key) => (
                  <li key={key}>{t(`rules.actions.${key}`)}</li>
                ))}
              </ul>
            </>
          )}
          {tab === "hands" && (
            <>
              <ol className="rules-hands" aria-label={t("rules.tabs.hands")}>
                {HAND_RANKINGS.map(({ id: hand, cards }) => (
                  <li key={hand} className="rules-hand">
                    <span className="rules-hand-cards" aria-hidden="true">
                      {cards.map((card) => (
                        <CardView key={`${card.rank}${card.suit}`} card={card} />
                      ))}
                    </span>
                    <span className="rules-hand-text">
                      <strong className="rules-hand-name">{t(`hands.${hand}`)}</strong>
                      <span className="rules-hand-desc">{t(`rules.hands.${hand}`)}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="rules-note">{t("rules.hands.royal")}</p>
              <p className="rules-note">{t("rules.hands.ties")}</p>
            </>
          )}
          {tab === "house" && (
            <ul className="rules-list">
              {HOUSE.map((key) => (
                <li key={key}>{t(`rules.house.${key}`)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="row rules-foot">
          {auto && (
            <button type="button" className="secondary" onClick={onClose}>
              {t("rules.skip")}
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            {t("rules.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
