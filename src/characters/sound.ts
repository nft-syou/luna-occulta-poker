import type { AudioLike } from "./voice";

/**
 * The table's own sounds, apart from the 御霊's voices.
 *
 * The tone sheet asks for silence as the ground: one quiet loop under the table and a few
 * short, low sounds on the moments that matter. Nothing plays on every action.
 */
export const SOUND_IDS = ["deal", "chip", "pot", "cutin", "bigwin", "bust", "tap"] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export const BGM_SRC = "/kitan/sound/bgm-yoiyami.mp3";

export function sePath(id: SoundId): string {
  return `/kitan/sound/${id}.mp3`;
}

/** An element that can also loop, which the BGM needs and a one-shot does not. */
export interface LoopingAudio extends AudioLike {
  loop?: boolean;
}

export interface SoundPlayer {
  /** Plays a one-shot. A sound already ringing is restarted rather than layered. */
  se(id: SoundId): void;
  /** Starts the loop if music is on; safe to call again while it is already playing. */
  startBgm(): void;
  setBgm(on: boolean): void;
  setBgmVolume(volume: number): void;
  setSe(on: boolean): void;
  setSeVolume(volume: number): void;
  stopAll(): void;
}

export interface SoundPlayerInit {
  bgm: boolean;
  bgmVolume: number;
  se: boolean;
  seVolume: number;
  /** How to make an audio element; defaults to `new Audio(src)`. */
  audio?: (src: string) => LoopingAudio;
}

/** How long the loop takes to come up, so it never starts on top of the player. */
const FADE_MS = 1400;
const FADE_STEPS = 14;

function defaultAudio(src: string): LoopingAudio {
  return new Audio(src);
}

/**
 * Plays the table's sounds. Every failure — a missing file, a browser that refuses to play
 * before a gesture, no audio at all — is swallowed: sound is decoration, and the game must
 * never wait on it or break for want of it.
 */
export function createSoundPlayer(init: SoundPlayerInit): SoundPlayer {
  const make = init.audio ?? defaultAudio;
  let bgmOn = init.bgm;
  let bgmVolume = clamp(init.bgmVolume);
  let seOn = init.se;
  let seVolume = clamp(init.seVolume);
  let bgm: LoopingAudio | null = null;
  let fade: ReturnType<typeof setInterval> | null = null;
  let wanted = false;
  const shots = new Map<SoundId, LoopingAudio>();

  const stopFade = () => {
    if (fade === null) return;
    clearInterval(fade);
    fade = null;
  };

  const loop = (): LoopingAudio | null => {
    if (bgm !== null) return bgm;
    try {
      const audio = make(BGM_SRC);
      audio.loop = true;
      audio.preload = "auto";
      bgm = audio;
      return audio;
    } catch {
      return null;
    }
  };

  const play = (audio: LoopingAudio) => {
    try {
      const result = audio.play();
      if (result !== undefined) result.catch(() => {});
    } catch {
      // Autoplay refused or no audio device.
    }
  };

  const start = () => {
    if (!bgmOn || !wanted) return;
    const audio = loop();
    if (audio === null) return;
    stopFade();
    audio.volume = 0;
    play(audio);
    let step = 0;
    fade = setInterval(() => {
      step += 1;
      audio.volume = clamp((bgmVolume * step) / FADE_STEPS);
      if (step >= FADE_STEPS) stopFade();
    }, FADE_MS / FADE_STEPS);
  };

  const stopLoop = () => {
    stopFade();
    if (bgm === null) return;
    try {
      bgm.pause();
      bgm.currentTime = 0;
    } catch {
      // Never loaded; nothing to stop.
    }
  };

  return {
    se(id) {
      if (!seOn) return;
      let audio = shots.get(id);
      if (audio === undefined) {
        try {
          audio = make(sePath(id));
          audio.preload = "auto";
        } catch {
          return;
        }
        shots.set(id, audio);
      }
      audio.volume = seVolume;
      try {
        audio.currentTime = 0;
      } catch {
        // Not seekable yet; it will play from wherever it is.
      }
      play(audio);
    },
    startBgm() {
      wanted = true;
      start();
    },
    setBgm(on) {
      bgmOn = on;
      if (on) start();
      else stopLoop();
    },
    setBgmVolume(volume) {
      bgmVolume = clamp(volume);
      // A fade in flight owns the volume until it lands.
      if (bgm !== null && fade === null) bgm.volume = bgmVolume;
    },
    setSe(on) {
      seOn = on;
    },
    setSeVolume(volume) {
      seVolume = clamp(volume);
    },
    stopAll() {
      wanted = false;
      stopLoop();
      for (const audio of shots.values()) {
        try {
          audio.pause();
        } catch {
          // ignore
        }
      }
    },
  };
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
