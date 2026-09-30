import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CELEBRATION_MS,
  CONFETTI_SHAPES,
  CONFETTI_TONES,
  confettiPieces,
  type ConfettiPiece,
} from "../../../src/components/confetti";

const gameCss = readFileSync(resolve(__dirname, "../../../src/styles/game.css"), "utf8");

/** A random source stuck at one end of its range, then the other: every value a piece can take is between. */
const extremes: [string, () => number][] = [
  ["lowest", () => 0],
  ["highest", () => 0.999999],
  ["Math.random", Math.random],
];

describe.each(extremes)("a confetti burst, with the %s draws", (_, random) => {
  const pieces: ConfettiPiece[] = confettiPieces(200, random);

  it("has every piece land and fade out before the layer is taken away", () => {
    expect(pieces).toHaveLength(200);
    for (const piece of pieces) expect(piece.delay + piece.time).toBeLessThanOrEqual(CELEBRATION_MS);
  });

  it("takes off along the title, flies up, then falls", () => {
    for (const piece of pieces) {
      expect(piece.x).toBeGreaterThanOrEqual(0);
      expect(piece.x).toBeLessThanOrEqual(1);
      expect(piece.rise).toBeLessThan(0);
      expect(piece.fall).toBeGreaterThan(0);
      expect(piece.delay).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the confetti's paper", () => {
  // A tone or shape game.css doesn't style is a piece nobody sees.
  it.each(CONFETTI_TONES)("comes in the %s accent tone, which game.css paints", (tone) => {
    expect(gameCss).toMatch(new RegExp(`\\.lyrix-confetti-paper\\.tone-${tone} \\{\\s*background: var\\(--accent-`));
  });

  it.each(CONFETTI_SHAPES)("comes as a %s, which game.css sizes", (shape) => {
    expect(gameCss).toContain(`.lyrix-confetti-paper.is-${shape} {`);
  });

  it("can be cut from the first tone and shape as well as the last", () => {
    const [first] = confettiPieces(1, () => 0);
    const [last] = confettiPieces(1, () => 0.999999);
    expect([first?.tone, first?.shape]).toEqual([CONFETTI_TONES[0], CONFETTI_SHAPES[0]]);
    expect([last?.tone, last?.shape]).toEqual([CONFETTI_TONES.at(-1), CONFETTI_SHAPES.at(-1)]);
  });
});
