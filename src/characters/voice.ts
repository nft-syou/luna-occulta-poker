import type { Gate } from "./gate";
import { audioPath, type Situation, type SpeechLine } from "./lines";
import type { SpiritId } from "./spirits";

/** The slice of `HTMLAudioElement` the player uses, so a test can hand in a fake. */
export interface AudioLike {
  src: string;
  volume: number;
  currentTime: number;
  preload: string;
  play(): Promise<void> | void;
  pause(): void;
  /** Seconds, once known; NaN before the metadata loads. */
  duration?: number;
  addEventListener?(type: string, listener: () => void): void;
}

export interface VoicePlayer {
  /**
   * Says a line. A spirit already speaking stops; with `priority` everyone else does too.
   * A `situation` the player has switched off is not said at all.
   */
  play(
    spiritId: SpiritId,
    line: SpeechLine,
    opts?: { priority?: boolean; situation?: Situation },
  ): void;
  /** Asks the browser to fetch a clip ahead of time. */
  preload(spiritId: SpiritId, line: SpeechLine): void;
  setEnabled(enabled: boolean): void;
  setVolume(volume: number): void;
  /** Which situations are spoken; absent situations stay as they were. */
  setSituations(situations: Partial<Record<Situation, boolean>>): void;
  stopAll(): void;
}

export interface VoicePlayerInit {
  enabled: boolean;
  /** 0–1. */
  volume: number;
  /** How to make an audio element; defaults to `new Audio(src)`. */
  audio?: (src: string) => AudioLike;
  /** Held while a clip plays, so the table waits for the line to end. */
  gate?: Gate;
  /** Situations to keep quiet from the start; everything is spoken by default. */
  situations?: Partial<Record<Situation, boolean>>;
}

/** A clip that never reports its end holds the table this long at most. */
const CLIP_MAX_MS = 9000;

function defaultAudio(src: string): AudioLike {
  return new Audio(src);
}

/**
 * Plays the generated clips. One element per clip, made on first use and kept, so a line
 * said twice is fetched once; one voice per spirit at a time, so she never talks over
 * herself; a cut-in's line silences the table. Every failure — a missing file, a browser
 * that refuses to play before a gesture, no audio at all — is swallowed: the bubble still
 * shows the words, and the game never waits on a sound.
 */
export function createVoicePlayer(init: VoicePlayerInit): VoicePlayer {
  const make = init.audio ?? defaultAudio;
  let enabled = init.enabled;
  let volume = clamp(init.volume);
  const situations: Partial<Record<Situation, boolean>> = { ...init.situations };
  const clips = new Map<string, AudioLike>();
  const speaking = new Map<SpiritId, AudioLike>();
  const gate = init.gate;
  const holdKey = (audio: AudioLike) => `voice:${audio.src}`;

  const clip = (spiritId: SpiritId, line: SpeechLine): AudioLike | null => {
    const src = audioPath(spiritId, line);
    const cached = clips.get(src);
    if (cached !== undefined) return cached;
    try {
      const audio = make(src);
      audio.preload = "auto";
      // The gate is released when the clip ends or stops, however that happens.
      if (gate !== undefined && typeof audio.addEventListener === "function") {
        for (const type of ["ended", "pause", "error"]) {
          audio.addEventListener(type, () => gate.release(holdKey(audio)));
        }
      }
      clips.set(src, audio);
      return audio;
    } catch {
      return null;
    }
  };

  const stop = (audio: AudioLike) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // A detached or never-loaded element: nothing to stop.
    }
    gate?.release(holdKey(audio));
  };

  return {
    play(spiritId, line, opts) {
      if (!enabled) return;
      if (opts?.situation !== undefined && situations[opts.situation] === false) return;
      if (opts?.priority === true) {
        for (const audio of speaking.values()) stop(audio);
        speaking.clear();
      } else {
        const current = speaking.get(spiritId);
        if (current !== undefined) stop(current);
      }
      const audio = clip(spiritId, line);
      if (audio === null) return;
      audio.volume = volume;
      audio.currentTime = 0;
      speaking.set(spiritId, audio);
      // Hold the table for the clip: its own length plus a breath when known, a ceiling
      // when not. A refused play() lets go at once.
      const seconds = audio.duration;
      const maxMs =
        typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
          ? Math.min(CLIP_MAX_MS, seconds * 1000 + 400)
          : CLIP_MAX_MS;
      gate?.hold(holdKey(audio), maxMs);
      try {
        const result = audio.play();
        if (result !== undefined) result.catch(() => gate?.release(holdKey(audio)));
      } catch {
        // Autoplay refused or no audio device: the words are on screen anyway.
        gate?.release(holdKey(audio));
      }
    },
    preload(spiritId, line) {
      clip(spiritId, line);
    },
    setEnabled(next) {
      enabled = next;
      if (!next) this.stopAll();
    },
    setVolume(next) {
      volume = clamp(next);
      for (const audio of speaking.values()) audio.volume = volume;
    },
    setSituations(next) {
      Object.assign(situations, next);
    },
    stopAll() {
      for (const audio of speaking.values()) stop(audio);
      speaking.clear();
    },
  };
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
