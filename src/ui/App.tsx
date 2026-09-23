import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18next, { detectLanguage, initI18n, type Language } from "../i18n";
import type { SessionSource } from "../jev/gameBackend";
import { defaultSessionSource } from "../jev/session";
import { GameScreen } from "./GameScreen";
import { SettingsDialog } from "./SettingsDialog";
import {
  forgetOldCredentials,
  loadLanguage,
  loadSettings,
  type Settings,
  saveLanguage,
  saveSettings,
} from "./storage";
import { TableSetup } from "./TableSetup";
import { TitleScreen } from "./TitleScreen";
import {
  loadTableChoice,
  saveTableChoice,
  settingsFor,
  type TableChoice,
  type TableMode,
} from "./tableChoice";

type Screen = "title" | "setup" | "table";

// Only an explicit pick in the settings is ever stored; a first visit follows the browser.
const initialLanguage = detectLanguage(loadLanguage(), globalThis.navigator);
initI18n(initialLanguage);
// Players once brought their own key; the operator holds it now, so none may linger here.
forgetOldCredentials();

/** One pass for the whole visit: Turnstile runs when it is first needed and again on expiry. */
const session: SessionSource = defaultSessionSource();

export function App() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [screen, setScreen] = useState<Screen>("title");
  const [mode, setMode] = useState<TableMode>("play");
  const [choice, setChoice] = useState<TableChoice>(() => loadTableChoice());
  /** The sound settings; the table's own shape comes from `choice` and `mode`. */
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One object per change, not per render: the table reads its seats from it.
  const tableSettings = useMemo(
    () => settingsFor(choice, mode, settings),
    [choice, mode, settings],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    saveLanguage(next);
    void i18next.changeLanguage(next);
  };

  const changeSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  const openSetup = (next: TableMode) => {
    setMode(next);
    setError(null);
    setScreen("setup");
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await session.token();
      setScreen("table");
    } catch {
      setError(t("tableSetup.turnstileFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      {/* The title screen is its own header; elsewhere the name stays, small. */}
      {screen !== "title" && (
        <header className="topbar">
          <h1>{t("app.title")}</h1>
        </header>
      )}

      <main>
        {screen === "title" && (
          <TitleScreen
            onPlay={() => openSetup("play")}
            onWatch={() => openSetup("watch")}
            onSettings={() => setSettingsOpen(true)}
          />
        )}
        {screen === "setup" && (
          <TableSetup
            mode={mode}
            choice={choice}
            language={language}
            busy={busy}
            error={error}
            onChange={(next) => {
              setChoice(next);
              saveTableChoice(next);
            }}
            onStart={() => void start()}
            onBack={() => setScreen("title")}
          />
        )}
        {screen === "table" && (
          <GameScreen
            settings={tableSettings}
            language={language}
            session={session}
            recording={new URLSearchParams(location.search).has("rec")}
            onOpenSettings={() => setSettingsOpen(true)}
            onLeave={() => setScreen("title")}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          {t("app.fanworkNotice")}{" "}
          <a href="https://vibe.co.jp/luna-occulta/fanworks" target="_blank" rel="noreferrer">
            {t("app.fanworksLink")}
          </a>
          {" · "}
          <a href="https://www.ninja-dao.com/guidelines" target="_blank" rel="noreferrer">
            {t("app.guidelineLink")}
          </a>
          {" · "}
          <a href="https://github.com/nft-syou/luna-occulta-poker" target="_blank" rel="noreferrer">
            {t("app.source")}
          </a>
          {" · "}
          {t("app.hashtag")}
          {" · "}
          {t("app.poweredBy")}
        </p>
      </footer>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        language={language}
        onChange={changeSettings}
        onLanguage={changeLanguage}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
