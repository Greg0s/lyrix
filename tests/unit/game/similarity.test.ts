import { describe, expect, it } from "vitest";
import {
  clampScore,
  HOT_SCORE,
  MAX_PROXIMITY_SCORE,
  proximityTier,
  scoreFromCosine,
  sortByProximity,
  WARM_SCORE,
} from "../../../src/game/similarity";

describe("scoreFromCosine", () => {
  it("maps a perfect match to the top of the scale", () => {
    expect(scoreFromCosine(1)).toBe(MAX_PROXIMITY_SCORE);
  });

  it("collapses negative similarities to zero", () => {
    expect(scoreFromCosine(-0.4)).toBe(0);
    expect(scoreFromCosine(-1)).toBe(0);
  });

  it("rounds to an integer score", () => {
    expect(scoreFromCosine(0.4242)).toBe(42);
    expect(scoreFromCosine(0.567)).toBe(57);
  });

  it("treats a non-finite similarity as zero rather than propagating NaN", () => {
    expect(scoreFromCosine(Number.NaN)).toBe(0);
    expect(scoreFromCosine(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("clampScore", () => {
  it("keeps a stored score inside the scale", () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(250)).toBe(MAX_PROXIMITY_SCORE);
    expect(clampScore(63.6)).toBe(64);
  });
});

describe("proximityTier", () => {
  it("marks a word found in the lyrics regardless of its score", () => {
    expect(proximityTier({ found: true, score: null })).toBe("found");
    expect(proximityTier({ found: true, score: 100 })).toBe("found");
  });

  it("separates hot, warm and cold at the documented cut-offs", () => {
    expect(proximityTier({ found: false, score: HOT_SCORE })).toBe("hot");
    expect(proximityTier({ found: false, score: HOT_SCORE - 1 })).toBe("warm");
    expect(proximityTier({ found: false, score: WARM_SCORE })).toBe("warm");
    expect(proximityTier({ found: false, score: WARM_SCORE - 1 })).toBe("cold");
    expect(proximityTier({ found: false, score: 0 })).toBe("cold");
  });

  it("distinguishes a word the model doesn't know from a very distant one", () => {
    expect(proximityTier({ found: false, score: null })).toBe("unknown");
  });
});

describe("sortByProximity", () => {
  it("orders by descending score, unscored words last", () => {
    const words = [
      { key: "a", found: false, score: 12 },
      { key: "b", found: false, score: null },
      { key: "c", found: false, score: 71 },
      { key: "d", found: true, score: 100 },
      { key: "e", found: false, score: 40 },
    ];
    expect(sortByProximity(words).map((word) => word.key)).toEqual(["d", "c", "e", "a", "b"]);
  });

  it("keeps equally-scored words in their original order", () => {
    const words = [
      { key: "newest", found: false, score: 30 },
      { key: "middle", found: false, score: 30 },
      { key: "oldest", found: false, score: 30 },
    ];
    expect(sortByProximity(words).map((word) => word.key)).toEqual(["newest", "middle", "oldest"]);
  });

  it("ranks a found word first even when it carries no score", () => {
    const words = [
      { key: "close", found: false, score: 90 },
      { key: "legacy", found: true, score: null },
    ];
    expect(sortByProximity(words).map((word) => word.key)).toEqual(["legacy", "close"]);
  });

  it("does not mutate the list it was given", () => {
    const words = [
      { found: false, score: 1 },
      { found: false, score: 99 },
    ];
    sortByProximity(words);
    expect(words.map((word) => word.score)).toEqual([1, 99]);
  });
});
