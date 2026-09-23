import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BGM_SRC, createSoundPlayer, type LoopingAudio, SOUND_IDS, sePath } from "./sound";

class FakeAudio implements LoopingAudio {
  volume = 1;
  currentTime = 0;
  preload = "";
  loop = false;
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

function player(over: Partial<Parameters<typeof createSoundPlayer>[0]> = {}) {
  const made: FakeAudio[] = [];
  const p = createSoundPlayer({
    bgm: true,
    bgmVolume: 0.4,
    se: true,
    seVolume: 0.6,
    audio: (src) => {
      const a = new FakeAudio(src);
      made.push(a);
      return a;
    },
    ...over,
  });
  return { p, made };
}

const bgmOf = (made: FakeAudio[]) => made.find((a) => a.src === BGM_SRC);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createSoundPlayer", () => {
  it("names a file for every sound the table can make", () => {
    expect(SOUND_IDS.map(sePath)).toEqual([
      "/kitan/sound/deal.mp3",
      "/kitan/sound/chip.mp3",
      "/kitan/sound/pot.mp3",
      "/kitan/sound/cutin.mp3",
      "/kitan/sound/bigwin.mp3",
      "/kitan/sound/bust.mp3",
      "/kitan/sound/tap.mp3",
    ]);
  });

  it("plays a one-shot at the set volume and rewinds it to play again", () => {
    const { p, made } = player();
    p.se("chip");
    expect(made).toHaveLength(1);
    expect(made[0]?.src).toBe("/kitan/sound/chip.mp3");
    expect(made[0]?.volume).toBe(0.6);
    expect(made[0]?.played).toBe(1);
    if (made[0] === undefined) throw new Error("no clip");
    made[0].currentTime = 0.2;
    p.se("chip");
    expect(made).toHaveLength(1);
    expect(made[0].played).toBe(2);
    expect(made[0].currentTime).toBe(0);
  });

  it("plays a sound quieter when asked, never louder than the effects' volume", () => {
    const { p, made } = player();
    p.se("cutin", 0.5);
    expect(made[0]?.volume).toBeCloseTo(0.3, 5);
    p.se("cutin", 4);
    expect(made[0]?.volume).toBeCloseTo(0.6, 5);
  });

  it("says nothing while the effects are off", () => {
    const { p, made } = player({ se: false });
    p.se("deal");
    expect(made).toHaveLength(0);
    p.setSe(true);
    p.se("deal");
    expect(made).toHaveLength(1);
  });

  it("brings the loop up from silence rather than starting on top of the player", () => {
    const { p, made } = player();
    p.startBgm();
    const loop = bgmOf(made);
    expect(loop?.loop).toBe(true);
    expect(loop?.played).toBe(1);
    expect(loop?.volume).toBe(0);
    vi.advanceTimersByTime(1400);
    expect(loop?.volume).toBeCloseTo(0.4, 5);
  });

  it("does not start the music before the table asks for it, or while it is off", () => {
    const quiet = player({ bgm: false });
    quiet.p.startBgm();
    expect(bgmOf(quiet.made)).toBeUndefined();
    quiet.p.setBgm(true);
    expect(bgmOf(quiet.made)?.played).toBe(1);

    const unasked = player();
    unasked.p.setBgm(true);
    expect(bgmOf(unasked.made)).toBeUndefined();
  });

  it("stops the loop when the music is switched off and on again", () => {
    const { p, made } = player();
    p.startBgm();
    vi.advanceTimersByTime(1400);
    p.setBgm(false);
    expect(bgmOf(made)?.paused).toBe(1);
    p.setBgm(true);
    expect(bgmOf(made)?.played).toBe(2);
  });

  it("changes the loop's volume, but leaves a fade in flight alone", () => {
    const { p, made } = player();
    p.startBgm();
    p.setBgmVolume(0.9);
    // Mid-fade: the fade owns the volume and lands on the new level.
    vi.advanceTimersByTime(1400);
    expect(bgmOf(made)?.volume).toBeCloseTo(0.9, 5);
    p.setBgmVolume(0.2);
    expect(bgmOf(made)?.volume).toBe(0.2);
    p.setBgmVolume(4);
    expect(bgmOf(made)?.volume).toBe(1);
  });

  it("silences everything on the way out", () => {
    const { p, made } = player();
    p.startBgm();
    p.se("pot");
    p.stopAll();
    expect(bgmOf(made)?.paused).toBe(1);
    expect(made.find((a) => a.src.endsWith("pot.mp3"))?.paused).toBe(1);
    // And stays quiet: the table has to ask again.
    p.setBgm(true);
    expect(bgmOf(made)?.played).toBe(1);
  });

  it("swallows a refused play and an Audio that cannot be made", async () => {
    const refusing = createSoundPlayer({
      bgm: true,
      bgmVolume: 1,
      se: true,
      seVolume: 1,
      audio: (src) => ({
        src,
        volume: 1,
        currentTime: 0,
        preload: "",
        play: () => Promise.reject(new Error("NotAllowedError")),
        pause: () => {},
      }),
    });
    expect(() => refusing.se("tap")).not.toThrow();
    refusing.startBgm();
    await Promise.resolve();

    const broken = createSoundPlayer({
      bgm: true,
      bgmVolume: 1,
      se: true,
      seVolume: 1,
      audio: () => {
        throw new Error("no Audio here");
      },
    });
    expect(() => broken.se("tap")).not.toThrow();
    expect(() => broken.startBgm()).not.toThrow();
  });
});
