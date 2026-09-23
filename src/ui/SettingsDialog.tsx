import { useId } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "../i18n";
import { SoundSettings } from "./SoundSettings";
import type { Settings } from "./storage";

interface Props {
  open: boolean;
  settings: Settings;
  language: Language;
  onChange: (settings: Settings) => void;
  onLanguage: (language: Language) => void;
  onClose: () => void;
}

/** Sound and language, reachable from the title screen and from the table alike. */
export function SettingsDialog({ open, settings, language, onChange, onLanguage, onClose }: Props) {
  const { t } = useTranslation();
  const id = useId();
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`}>{t("settings.title")}</h2>
        <label className="field" htmlFor={`${id}-language`}>
          <span>{t("settings.language")}</span>
          <select
            id={`${id}-language`}
            value={language}
            onChange={(e) => onLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((lng) => (
              <option key={lng} value={lng}>
                {lng === "ja" ? "日本語" : "English"}
              </option>
            ))}
          </select>
        </label>
        <SoundSettings settings={settings} onChange={onChange} />
        <div className="row">
          <button type="button" className="secondary" onClick={onClose}>
            {t("settings.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
