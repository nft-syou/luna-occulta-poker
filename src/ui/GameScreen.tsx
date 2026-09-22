import type { JevBackend } from "@jev-poker/agent";
import type { SeatId } from "@jev-poker/engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createGate } from "../characters/gate";
import { createSoundPlayer } from "../characters/sound";
import { spirit, spiritPersonas } from "../characters/spirits";
import { createVoicePlayer } from "../characters/voice";
import type { Language } from "../i18n";
import { createProxyBackend } from "../jev/backend";
import { type Connection, modelFor } from "../jev/connection";
import { BillingModal } from "./BillingModal";
import { SoundSettings } from "./SoundSettings";
import type { Settings } from "./storage";
import { TableView } from "./TableView";
import { useGame } from "./useGame";

interface Props {
  settings: Settings;
  connection: Connection | null;
  language: Language;
  onSettingsChange: (settings: Settings) => void;
  onLeave: () => void;
  onAuthFailed: () => void;
}

/** One persona per 御霊, built once: the same object every sitting. */
const PERSONAS = spiritPersonas();

export function GameScreen({
  settings,
  connection,
  language,
  onSettingsChange,
  onLeave,
  onAuthFailed,
}: Props) {
  const { t } = useTranslation();
  const backend: JevBackend | null = useMemo(
    () =>
      connection === null
        ? null
        : createProxyBackend({
            connection,
            baseURL: `${window.location.origin}/api/jev`,
            model: settings.model,
          }),
    [connection, settings.model],
  );
  // The Vercel gateway answers as `typesafe-ai/jev`, so that is what the table should say.
  const model = connection === null ? settings.model : modelFor(connection, settings.model);
  // One player per sitting; the settings' switch and slider reach it through effects.
  // The gate the loop waits at: held by a line being said and by a cut-in on screen.
  const [gate] = useState(() => createGate());
  const [voice] = useState(() =>
    createVoicePlayer({
      enabled: settings.voice,
      volume: settings.voiceVolume,
      gate,
      situations: settings.voiceSituations,
    }),
  );
  useEffect(() => voice.setSituations(settings.voiceSituations), [voice, settings.voiceSituations]);
  const [sound] = useState(() =>
    createSoundPlayer({
      bgm: settings.bgm,
      bgmVolume: settings.bgmVolume,
      se: settings.se,
      seVolume: settings.seVolume,
    }),
  );
  useEffect(() => sound.setBgm(settings.bgm), [sound, settings.bgm]);
  useEffect(() => sound.setBgmVolume(settings.bgmVolume), [sound, settings.bgmVolume]);
  useEffect(() => sound.setSe(settings.se), [sound, settings.se]);
  useEffect(() => sound.setSeVolume(settings.seVolume), [sound, settings.seVolume]);
  // The table was opened by a click, so the browser lets the loop start.
  useEffect(() => {
    sound.startBgm();
    return () => sound.stopAll();
  }, [sound]);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const waitForTable = useCallback(() => gate.wait(), [gate]);
  useEffect(() => voice.setEnabled(settings.voice), [voice, settings.voice]);
  useEffect(() => voice.setVolume(settings.voiceVolume), [voice, settings.voiceVolume]);
  useEffect(() => () => voice.stopAll(), [voice]);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const onBillingFailed = useCallback(() => setBillingModalOpen(true), []);
  const game = useGame({
    settings,
    personas: PERSONAS,
    backend,
    model,
    onAuthFailed,
    onBillingFailed,
    gate: waitForTable,
  });
  // A 御霊's seat is named after her in the current language; a human keeps their own name.
  const personaNames = useMemo(() => {
    const names: Record<SeatId, string> = {};
    settings.seats.forEach((seat, id) => {
      names[id] = seat.kind === "cpu" ? spirit(seat.spiritId).name[language] : seat.name;
    });
    return names;
  }, [language, settings.seats]);

  return (
    <>
      <TableView
        game={game}
        speed={settings.speed}
        startingStack={settings.startingStack}
        language={language}
        personaNames={personaNames}
        model={model}
        prefetch={settings.prefetch}
        voice={voice}
        sound={sound}
        gate={gate}
        onOpenVoice={() => setVoiceModalOpen(true)}
        onSpeedChange={(speed) => onSettingsChange({ ...settings, speed })}
        onPrefetchChange={(prefetch) => onSettingsChange({ ...settings, prefetch })}
        onLeave={onLeave}
      />
      {voiceModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-modal-title"
          >
            <h2 id="voice-modal-title">{t("voice.title")}</h2>
            <SoundSettings settings={settings} onChange={onSettingsChange} />
            <div className="row">
              <button type="button" className="secondary" onClick={() => setVoiceModalOpen(false)}>
                {t("voice.close")}
              </button>
            </div>
          </div>
        </div>
      )}
      <BillingModal
        open={billingModalOpen}
        route={connection?.route ?? "typesafe"}
        onResume={() => {
          if (game.state.paused) game.togglePause();
          setBillingModalOpen(false);
        }}
        onClose={() => setBillingModalOpen(false)}
      />
    </>
  );
}
