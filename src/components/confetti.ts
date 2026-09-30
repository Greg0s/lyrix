/**
 * The pieces of the win's confetti burst (Celebration.tsx), drawn once per
 * win. Pure but for its random source, so a test can check that every piece
 * has landed before the layer is taken away.
 */

/** From the win to the confetti layer leaving the DOM: every piece has faded out by then. */
export const CELEBRATION_MS = 3000;

/** The accent tokens a piece is cut from (game.css's `tone-*`): the v3 palette, not a rainbow. */
export const CONFETTI_TONES = ["solid", "hover", "soft", "deep", "near-hot"] as const;

/** Bars like the ones hiding the words, a square chip, and a thin strip (game.css's `is-*`). */
export const CONFETTI_SHAPES = ["bar", "chip", "strip"] as const;

export interface ConfettiPiece {
  /** Where along the title it takes off: 0 at its left end, 1 at its right. */
  x: number;
  /** How far it drifts sideways over its flight, in vw; negative is to the left. */
  dx: number;
  /** How high it flies before it falls, in vh; negative, since up is. */
  rise: number;
  /** How far below its take-off point it ends, in vh. */
  fall: number;
  /** How far it turns over its flight, in degrees; negative is anticlockwise. */
  spin: number;
  /** How long one flip of the paper takes, in ms. */
  flip: number;
  /** When it takes off after the win, in ms. */
  delay: number;
  /** How long it flies, in ms. */
  time: number;
  tone: (typeof CONFETTI_TONES)[number];
  shape: (typeof CONFETTI_SHAPES)[number];
}

/** One decimal is plenty for a style, and keeps the DOM readable. */
function tenths(value: number): number {
  return Math.round(value * 10) / 10;
}

/** `count` pieces, each with its own flight. `random` returns a number in [0, 1), like Math.random. */
export function confettiPieces(count: number, random: () => number = Math.random): ConfettiPiece[] {
  const between = (min: number, max: number) => tenths(min + random() * (max - min));
  const pick = <T>(options: readonly T[]): T => options[Math.floor(random() * options.length)] as T;
  return Array.from({ length: count }, () => {
    // To the hundredth: it becomes a percentage of the title's width.
    const x = Math.round(random() * 100) / 100;
    return {
      x,
      // Outwards from the middle of the title, give or take.
      dx: tenths((x - 0.5) * 36 + (random() - 0.5) * 16),
      rise: -between(10, 24),
      fall: between(55, 100),
      spin: pick([-1, 1]) * between(240, 900),
      flip: between(260, 620),
      delay: between(0, 260),
      time: between(1900, 2600),
      tone: pick(CONFETTI_TONES),
      shape: pick(CONFETTI_SHAPES),
    };
  });
}
