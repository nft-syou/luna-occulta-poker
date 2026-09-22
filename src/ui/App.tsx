import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18next, { detectLanguage, initI18n, type Language } from "../i18n";
import type { Connection } from "../jev/connection";
import { ConnectionModal } from "./ConnectionModal";
import { GameScreen } from "./GameScreen";
import { LanguageSwitch } from "./LanguageSwitch";
import { Setup } from "./Setup";
import {
  clearConnection,
  loadConnection,
  loadLanguage,
  loadSettings,
  type Settings,
  saveConnection,
  saveLanguage,
  saveSettings,
} from "./storage";

type Screen = "setup" | "table";

const initialLanguage = detectLanguage(loadLanguage(), globalThis.navigator?.language);
initI18n(initialLanguage);

export function App() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [connection, setConnection] = useState<Connection | null>(() => loadConnection());
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyModalOpen, setKeyModalOpen] = useState(connection === null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [screen, setScreen] = useState<Screen>("setup");

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const onAuthFailed = useCallback(() => {
    // Deliberately generic: which of the services refused is not ours to guess.
    setKeyError(t("connection.invalid"));
    setKeyModalOpen(true);
  }, [t]);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    saveLanguage(next);
    void i18next.changeLanguage(next);
  };

  const changeSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>{t("app.title")}</h1>
          <p className="muted">{t("app.subtitle")}</p>
        </div>
        <nav className="row">
          <button type="button" className="secondary" onClick={() => setKeyModalOpen(true)}>
            {connection === null ? t("app.connection") : t(`connection.route_${connection.route}`)}
          </button>
          <LanguageSwitch language={language} onChange={changeLanguage} />
          <a href="https://github.com/nft-syou/luna-occulta-poker" target="_blank" rel="noreferrer">
            {t("app.source")}
          </a>
        </nav>
      </header>

      <main>
        {screen === "setup" && (
          <Setup
            settings={settings}
            language={language}
            hasConnection={connection !== null}
            onChange={changeSettings}
            onStart={() => setScreen("table")}
            onOpenConnection={() => setKeyModalOpen(true)}
          />
        )}
        {screen === "table" && (
          <GameScreen
            settings={settings}
            connection={connection}
            language={language}
            onSettingsChange={changeSettings}
            onLeave={() => setScreen("setup")}
            onAuthFailed={onAuthFailed}
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
          {t("app.hashtag")}
        </p>
        <p>{t("app.poweredBy")}</p>
      </footer>

      <ConnectionModal
        open={keyModalOpen}
        connection={connection}
        error={keyError}
        onSave={(next) => {
          saveConnection(next);
          setConnection(next);
          setKeyError(null);
          setKeyModalOpen(false);
        }}
        onRemove={() => {
          clearConnection();
          setConnection(null);
          setKeyError(null);
          setScreen("setup");
        }}
        onClose={() => {
          setKeyError(null);
          setKeyModalOpen(false);
        }}
      />
    </div>
  );
}
