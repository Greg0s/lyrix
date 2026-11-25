import { prefersReducedMotion } from "../reducedMotion";

/** One turn of the record's label at full speed: slow enough to read the cover going round. */
export const SPIN_TURN_MS = 4500;
/** How long the record takes to come up to speed once played. */
export const SPIN_UP_MS = 700;
/** How long it takes to slow to a stop once paused. */
export const SPIN_DOWN_MS = 1200;

export interface VinylSpin {
  /** Brings the label up to speed (1) or slows it to a stop where it is (0). */
  to(speed: 0 | 1): void;
  /** Stops at once and lets the label go: another song, or the record gone. */
  dispose(): void;
}

const NO_SPIN: VinylSpin = { to() {}, dispose() {} };

/** Eases in and out: no jolt when the record starts or stops. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * The label of VictoryPreview's record, turning like a turntable's: it comes
 * up to speed when played and slows to a stop when paused, staying at the
 * angle it stopped at (decided with the developer: a CSS animation taken off
 * on pause snapped back to its first angle). Driven through the Web
 * Animations API, its speed eased frame by frame: playing re-renders nothing.
 * It spins on the `rotate` property, so the hover's own `transform` (game.css)
 * adds to it instead of fighting it. None under reduced motion.
 */
export function createVinylSpin(label: HTMLElement): VinylSpin {
  if (typeof label.animate !== "function" || prefersReducedMotion()) return NO_SPIN;
  let animation: Animation | null = null;
  let frame: number | null = null;

  const cancelRamp = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };

  return {
    to(speed) {
      cancelRamp();
      if (animation === null) {
        if (speed === 0) return;
        animation = label.animate([{ rotate: "0turn" }, { rotate: "1turn" }], {
          duration: SPIN_TURN_MS,
          iterations: Infinity,
        });
        // A playback rate change keeps the angle reached: the ramp never makes it jump.
        animation.playbackRate = 0;
      }
      const spin = animation;
      const from = spin.playbackRate;
      const duration = speed === 1 ? SPIN_UP_MS : SPIN_DOWN_MS;
      if (speed === 1) spin.play();
      let start: number | null = null;
      const step = (now: number) => {
        start ??= now;
        const t = Math.min(1, (now - start) / duration);
        spin.playbackRate = from + (speed - from) * smoothstep(t);
        if (t < 1) {
          frame = requestAnimationFrame(step);
        } else {
          frame = null;
          if (speed === 0) spin.pause();
        }
      };
      frame = requestAnimationFrame(step);
    },
    dispose() {
      cancelRamp();
      animation?.cancel();
      animation = null;
    },
  };
}
