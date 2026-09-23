import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionsTab, FlowTab, HandsTab, HouseTab } from "./RulesDiagrams";

interface Props {
  open: boolean;
  /** Opened by the table itself on a first visit: offers a skip beside the close. */
  auto?: boolean;
  onClose: () => void;
}

const TABS = ["flow", "actions", "hands", "house"] as const;
type Tab = (typeof TABS)[number];

/**
 * How to play, in four tabs of diagrams: from the title screen, from the table's 「？」, and once by
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
          {tab === "flow" && <FlowTab />}
          {tab === "actions" && <ActionsTab />}
          {tab === "hands" && <HandsTab />}
          {tab === "house" && <HouseTab />}
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
