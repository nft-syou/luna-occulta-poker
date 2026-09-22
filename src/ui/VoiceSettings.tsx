import { useTranslation } from "react-i18next";
import { SITUATIONS, type Situation } from "../characters/lines";
import type { Settings } from "./storage";

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

/** The situations grouped the way a player thinks of them: sitting down, acting, the result. */
const GROUPS: readonly { key: string; situations: readonly Situation[] }[] = [
  { key: "table", situations: ["greet"] },
  { key: "actions", situations: ["fold", "check", "call", "bet", "raise", "allin"] },
  { key: "results", situations: ["win", "bigwin", "lose", "bust"] },
];

/**
 * Everything about the 御霊's voices: the master switch, the volume, and one switch per
 * situation so a player can keep the greetings and the big moments and silence the folds.
 * The same form serves the setup screen and the dialog at the table.
 */
export function VoiceSettings({ settings, onChange }: Props) {
  const { t } = useTranslation();
  const setSituation = (situation: Situation, on: boolean) =>
    onChange({
      ...settings,
      voiceSituations: { ...settings.voiceSituations, [situation]: on },
    });
  const allOn = SITUATIONS.every((s) => settings.voiceSituations[s]);
  return (
    <div className="voice-settings">
      <label className="field">
        <span>
          <input
            type="checkbox"
            checked={settings.voice}
            onChange={(e) => onChange({ ...settings, voice: e.target.checked })}
          />{" "}
          {t("setup.voice")}
        </span>
      </label>
      {settings.voice && (
        <>
          <label className="field">
            <span>{t("setup.voiceVolume")}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.voiceVolume}
              onChange={(e) => onChange({ ...settings, voiceVolume: Number(e.target.value) })}
            />
          </label>
          <div className="voice-situations">
            <div className="voice-group-head">
              <span className="muted">{t("voice.situations")}</span>
              <button
                type="button"
                className="link"
                onClick={() =>
                  onChange({
                    ...settings,
                    voiceSituations: Object.fromEntries(
                      SITUATIONS.map((s) => [s, !allOn]),
                    ) as Settings["voiceSituations"],
                  })
                }
              >
                {allOn ? t("voice.allOff") : t("voice.allOn")}
              </button>
            </div>
            {GROUPS.map((group) => (
              <fieldset key={group.key} className="voice-group">
                <legend>{t(`voice.group_${group.key}`)}</legend>
                {group.situations.map((situation) => (
                  <label key={situation} className="voice-switch">
                    <input
                      type="checkbox"
                      checked={settings.voiceSituations[situation]}
                      onChange={(e) => setSituation(situation, e.target.checked)}
                    />{" "}
                    {t(`voice.situation_${situation}`)}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
