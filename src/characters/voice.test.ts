import { describe, expect, it, vi } from "vitest";
import { createGate } from "./gate";
import type { SpeechLine } from "./lines";
import { type AudioLike, createVoicePlayer } from "./voice";

class FakeAudio implements AudioLike {
  volume = 1;
  currentTime = 0;
  preload = "";
  played = 0;
  paused = 0;
  constructor(public src: string) {}
  play() {
    this.played += 1;
    return Promise.resolve();
  }
  pause() {
    this.paused += 1;
  }
}

const LINE_A: SpeechLine = { id: "sakuya.raise.1", text: "レイズ。あたしの番だ" };
const LINE_B: SpeechLine = { id: "sakuya.fold.1", text: "これは、ないね。降りる" };
const LINE_M: SpeechLine = { id: "mami.win.1", text: "化かすのはね" };

function player(enabled = true, volume = 0.8) {
  const made: FakeAudio[] = [];
  const p = createVoicePlayer({
    enabled,
    volume,
    audio: (src) => {
      const a = new FakeAudio(src);
      made.push(a);
      return a;
    },
  });
  return { p, made };
}

describe("createVoicePlayer", () => {
  it("plays the clip named by the line, at the set volume", () => {
    const { p, made } = player();
    p.play("sakuya", LINE_A);
    expect(made).toHaveLength(1);
    expect(made[0]?.src).toBe("/kitan/voice/sakuya/sakuya.raise.1.mp3");
    expect(made[0]?.volume).toBe(0.8);
    expect(made[0]?.played).toBe(1);
    expect(made[0]?.preload).toBe("auto");
  });

  it("keeps one element per clip and rewinds it to say the line again", () => {
    const { p, made } = player();
    p.play("sakuya", LINE_A);
    if (made[0] === undefined) throw new Error("no clip");
    made[0].currentTime = 3;
    p.play("sakuya", LINE_A);
    expect(made).toHaveLength(1);
    expect(made[0].played).toBe(2);
    expect(made[0].currentTime).toBe(0);
  });

  it("stops a spirit's previous line when she says a new one, and leaves the others be", () => {
    const { p, made } = player();
    p.play("sakuya", LINE_A);
    p.play("mami", LINE_M);
    p.play("sakuya", LINE_B);
    expect(made.map((a) => a.paused)).toEqual([1, 0, 0]);
  });

  it("silences everyone for a priority line", () => {
    const { p, made } = player();
    p.play("sakuya", LINE_A);
    p.play("mami", LINE_M);
    p.play("sakuya", LINE_B, { priority: true });
    expect(made.map((a) => a.paused)).toEqual([1, 1, 0]);
  });

  it("does nothing while disabled, and stops what is playing when switched off", () => {
    const { p, made } = player(false);
    p.play("sakuya", LINE_A);
    expect(made).toHaveLength(0);
    p.setEnabled(true);
    p.play("sakuya", LINE_A);
    expect(made[0]?.played).toBe(1);
    p.setEnabled(false);
    expect(made[0]?.paused).toBe(1);
  });

  it("changes the volume of what is playing and clamps it", () => {
    const { p, made } = player();
    p.play("sakuya", LINE_A);
    p.setVolume(2);
    expect(made[0]?.volume).toBe(1);
    p.setVolume(-1);
    expect(made[0]?.volume).toBe(0);
  });

  it("swallows a play() that rejects and one that throws", async () => {
    const rejecting = createVoicePlayer({
      enabled: true,
      volume: 1,
      audio: (src) => ({
        src,
        volume: 1,
        currentTime: 0,
        preload: "",
        play: () => Promise.reject(new Error("NotAllowedError")),
        pause: () => {},
      }),
    });
    expect(() => rejecting.play("sakuya", LINE_A)).not.toThrow();
    await Promise.resolve();
    const throwing = createVoicePlayer({
      enabled: true,
      volume: 1,
      audio: () => {
        throw new Error("no Audio here");
      },
    });
    expect(() => throwing.play("sakuya", LINE_A)).not.toThrow();
  });

  it("preloads without playing", () => {
    const { p, made } = player();
    p.preload("mami", LINE_M);
    expect(made).toHaveLength(1);
    expect(made[0]?.played).toBe(0);
    const spy = vi.spyOn(made[0] as FakeAudio, "play");
    p.play("mami", LINE_M);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(1);
  });
});

describe("createVoicePlayer at the gate", () => {
  class GatedAudio extends FakeAudio {
    listeners = new Map<string, () => void>();
    duration = 2;
    addEventListener(type: string, listener: () => void) {
      this.listeners.set(type, listener);
    }
    fire(type: string) {
      this.listeners.get(type)?.();
    }
  }

  function gated() {
    const made: GatedAudio[] = [];
    const gate = createGate();
    const p = createVoicePlayer({
      enabled: true,
      volume: 1,
      gate,
      audio: (src) => {
        const a = new GatedAudio(src);
        made.push(a);
        return a;
      },
    });
    return { p, made, gate };
  }

  it("holds the table while a line plays and lets go when it ends", () => {
    const { p, made, gate } = gated();
    p.play("sakuya", LINE_A);
    expect(gate.busy()).toBe(true);
    made[0]?.fire("ended");
    expect(gate.busy()).toBe(false);
  });

  it("lets go when the line is cut off by another, and when play() is refused", async () => {
    const { p, made, gate } = gated();
    p.play("sakuya", LINE_A);
    p.play("sakuya", LINE_B);
    // The first clip was paused (released); the second holds.
    expect(gate.busy()).toBe(true);
    made[1]?.fire("ended");
    expect(gate.busy()).toBe(false);

    const refusing = createGate();
    const r = createVoicePlayer({
      enabled: true,
      volume: 1,
      gate: refusing,
      audio: (src) => ({
        src,
        volume: 1,
        currentTime: 0,
        preload: "",
        play: () => Promise.reject(new Error("NotAllowedError")),
        pause: () => {},
      }),
    });
    r.play("mami", LINE_M);
    expect(refusing.busy()).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(refusing.busy()).toBe(false);
  });

  it("never holds longer than the clip plus a breath", () => {
    vi.useFakeTimers();
    try {
      const { p, gate } = gated();
      p.play("sakuya", LINE_A);
      vi.advanceTimersByTime(2400);
      expect(gate.busy()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
