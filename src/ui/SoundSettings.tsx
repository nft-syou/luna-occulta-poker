import { useTranslation } from "react-i18next";
import type { Settings } from "./storage";
import { VoiceSettings } from "./VoiceSettings";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

/**
 * Everything the table can be heard doing: the loop under it, its own sounds, and the
 * 御霊's voices. The same form serves the setup screen and the dialog at the table, so a
 * player can quiet the room mid-hand without leaving it.
 */
export function SoundSettings({ settings, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="sound-settings">
      <label className="field">
        <span>
          <input
            type="checkbox"
            checked={settings.bgm}
            onChange={(e) => onChange({ ...settings, bgm: e.target.checked })}
          />{" "}
          {t("voice.bgm")}
        </span>
      </label>
      {settings.bgm && (
        <label className="field">
          <span>{t("voice.bgmVolume")}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.bgmVolume}
            onChange={(e) => onChange({ ...settings, bgmVolume: Number(e.target.value) })}
          />
        </label>
      )}

      <label className="field">
        <span>
          <input
            type="checkbox"
            checked={settings.se}
            onChange={(e) => onChange({ ...settings, se: e.target.checked })}
          />{" "}
          {t("voice.se")}
        </span>
      </label>
      {settings.se && (
        <label className="field">
          <span>{t("voice.seVolume")}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.seVolume}
            onChange={(e) => onChange({ ...settings, seVolume: Number(e.target.value) })}
          />
        </label>
      )}

      <VoiceSettings settings={settings} onChange={onChange} />
    </div>
  );
}
