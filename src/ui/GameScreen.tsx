import type { SeatId } from "@jev-poker/engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createGate } from "../characters/gate";
import { createSoundPlayer } from "../characters/sound";
import { spirit, spiritPersonas } from "../characters/spirits";
import { createVoicePlayer } from "../characters/voice";
import type { Language } from "../i18n";
import { createGameBackend, type SessionSource, type StopReason } from "../jev/gameBackend";
import type { Settings } from "./storage";
import { TableView } from "./TableView";
import { TonightOverDialog } from "./TonightOverDialog";
import { useGame } from "./useGame";

interface Props {
  settings: Settings;
  language: Language;
  /** The pass the table shows the Worker with every question. */
  session: SessionSource;
  /** Whether the page was opened for recording (`?rec`): offers recording mode. */
  recording: boolean;
  onOpenSettings: () => void;
  onLeave: () => void;
}

/** One persona per 御霊, built once: the same object every sitting. */
const PERSONAS = spiritPersonas();

export function GameScreen({
  settings,
  language,
  session,
  recording,
  onOpenSettings,
  onLeave,
}: Props) {
  const [stopReason, setStopReason] = useState<StopReason | null>(null);
  const [backend] = useState(() => createGameBackend({ session, onStop: setStopReason }));
  const model = settings.model;
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
  const waitForTable = useCallback(() => gate.wait(), [gate]);
  useEffect(() => voice.setEnabled(settings.voice), [voice, settings.voice]);
  useEffect(() => voice.setVolume(settings.voiceVolume), [voice, settings.voiceVolume]);
  useEffect(() => () => voice.stopAll(), [voice]);
  const game = useGame({
    settings,
    personas: PERSONAS,
    backend,
    model,
    // The game backend turns a refused pass into a stop of its own; should the agent still
    // report one, the table cannot go on either.
    onAuthFailed: () => setStopReason("unavailable"),
    // The dialog is driven by `stopReason`, which `onStop` above already set.
    onTonightOver: () => {},
    gate: waitForTable,
  });
  // A stop can arrive on any request, a speculated one included, whose answer the loop may
  // never read: the table halts on the server's word, not on the loop noticing it.
  const halt = game.halt;
  useEffect(() => {
    if (stopReason !== null) halt();
  }, [stopReason, halt]);
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
        voice={voice}
        sound={sound}
        gate={gate}
        recording={recording}
        stopReason={stopReason}
        onOpenSettings={onOpenSettings}
        onLeave={onLeave}
      />
      <TonightOverDialog reason={stopReason} onLeave={onLeave} />
    </>
  );
}
