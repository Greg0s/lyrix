// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVinylSpin, SPIN_DOWN_MS, SPIN_TURN_MS, SPIN_UP_MS } from "../../../src/components/vinylSpin";

/** What the record's label is asked to do: jsdom has no Web Animations. */
class FakeAnimation {
  playbackRate = 1;
  playState: "running" | "paused" | "idle" = "running";
  readonly rates: number[] = [];
  play = vi.fn(() => {
    this.playState = "running";
  });
  pause = vi.fn(() => {
    this.playState = "paused";
  });
  cancel = vi.fn(() => {
    this.playState = "idle";
  });
}

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let animations: FakeAnimation[];
let keyframes: unknown[];
let options: unknown[];

/** Runs the frames asked for, one every `step` ms from `from`, until none is asked for. */
function runFrames(from: number, step = 16): number {
  let now = from;
  while (frames.size > 0) {
    runFrame(now);
    now += step;
  }
  return now;
}

/** Runs the frames asked for at `now`, once. */
function runFrame(now: number): void {
  const pending = [...frames.values()];
  frames.clear();
  for (const frame of pending) frame(now);
}

function label(): HTMLElement {
  const element = document.createElement("span");
  element.animate = ((frames: Keyframe[], timing: KeyframeAnimationOptions) => {
    keyframes.push(frames);
    options.push(timing);
    const animation = new FakeAnimation();
    animation.rates.push(animation.playbackRate);
    // Every rate the ramp sets, in order: the speed never jumps.
    let rate = animation.playbackRate;
    Object.defineProperty(animation, "playbackRate", {
      get: () => rate,
      set: (value: number) => {
        rate = value;
        animation.rates.push(value);
      },
    });
    animations.push(animation);
    return animation as unknown as Animation;
  }) as HTMLElement["animate"];
  return element;
}

function reducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reduce && query.includes("reduce") }) as MediaQueryList)
  );
}

beforeEach(() => {
  frames = new Map();
  nextFrame = 1;
  animations = [];
  keyframes = [];
  options = [];
  reducedMotion(false);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(nextFrame, callback);
    return nextFrame++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createVinylSpin", () => {
  it("turns the label slowly, on rotate so the hover's transform adds to it", () => {
    createVinylSpin(label()).to(1);
    expect(keyframes).toEqual([[{ rotate: "0turn" }, { rotate: "1turn" }]]);
    expect(options).toEqual([{ duration: SPIN_TURN_MS, iterations: Infinity }]);
    expect(SPIN_TURN_MS).toBeGreaterThanOrEqual(4000);
  });

  it("comes up to speed gradually, from still", () => {
    createVinylSpin(label()).to(1);
    const end = runFrames(0);
    const [animation] = animations;
    expect(animation.play).toHaveBeenCalled();
    expect(animation.rates[1]).toBe(0);
    expect(animation.playbackRate).toBe(1);
    expect(end).toBeGreaterThanOrEqual(SPIN_UP_MS);
    // Never more than a small step at a time.
    const steps = animation.rates.slice(1).map((rate, index, rates) => rate - (rates[index - 1] ?? rate));
    expect(Math.max(...steps)).toBeLessThan(0.1);
  });

  it("slows to a stop where it is on pause, never snapping back to its first angle", () => {
    const spin = createVinylSpin(label());
    spin.to(1);
    runFrames(0);
    const [animation] = animations;
    const rampUp = animation.rates.length;

    spin.to(0);
    const end = runFrames(1000);
    const rampDown = animation.rates.slice(rampUp);
    expect(end - 1000).toBeGreaterThanOrEqual(SPIN_DOWN_MS);
    expect(rampDown.length).toBeGreaterThan(10);
    expect(rampDown.every((rate, index) => index === 0 || rate <= rampDown[index - 1])).toBe(true);
    expect(animation.playbackRate).toBe(0);
    expect(animation.pause).toHaveBeenCalledTimes(1);
    expect(animation.cancel).not.toHaveBeenCalled();
  });

  it("picks up from the speed it had when played again mid-stop, on the same animation", () => {
    const spin = createVinylSpin(label());
    spin.to(1);
    runFrames(0);
    spin.to(0);
    // Halfway through slowing down, played again.
    for (let now = 0; now < SPIN_DOWN_MS / 2; now += 16) runFrame(now);
    const [animation] = animations;
    const reached = animation.playbackRate;
    expect(reached).toBeGreaterThan(0);
    expect(reached).toBeLessThan(1);

    spin.to(1);
    runFrame(0);
    expect(animation.playbackRate).toBe(reached);
    runFrames(16);
    expect(animation.playbackRate).toBe(1);
    expect(animations).toHaveLength(1);
  });

  it("lets the label go at once for another song", () => {
    const spin = createVinylSpin(label());
    spin.to(1);
    spin.dispose();
    expect(frames.size).toBe(0);
    expect(animations[0].cancel).toHaveBeenCalled();
  });

  it("doesn't turn at all under reduced motion", () => {
    reducedMotion(true);
    createVinylSpin(label()).to(1);
    expect(animations).toHaveLength(0);
    expect(frames.size).toBe(0);
  });
});
