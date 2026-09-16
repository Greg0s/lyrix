import { describe, expect, it } from "vitest";
import {
  clampScore,
  HOT_SCORE,
  MAX_MISSED_SCORE,
  MAX_PROXIMITY_SCORE,
  NEAR_SCORE,
  numberProximityScore,
  proximityHeat,
  proximityTier,
  scoreFromRank,
  sortByProximity,
  WARM_SCORE,
} from "../../../src/game/similarity";

describe("scoreFromRank", () => {
  it("gives a hidden word's nearest neighbour the best score a missed word can get", () => {
    expect(scoreFromRank(1)).toBe(MAX_MISSED_SCORE);
  });

  it("takes the same number of points off for every tenfold step down the neighbour list", () => {
    expect(scoreFromRank(10)).toBe(80);
    expect(scoreFromRank(100)).toBe(60);
    expect(scoreFromRank(1000)).toBe(40);
    expect(scoreFromRank(10_000)).toBe(20);
  });

  it("puts a hidden word's thousandth neighbour on the placement threshold, and not much further", () => {
    expect(scoreFromRank(1000)).toBe(NEAR_SCORE);
    expect(scoreFromRank(1100)).toBeLessThan(NEAR_SCORE);
  });

  it("never goes below zero, however far down the list", () => {
    expect(scoreFromRank(1e9)).toBe(0);
    expect(scoreFromRank(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("treats a nonsense rank safely", () => {
    expect(scoreFromRank(Number.NaN)).toBe(0);
    expect(scoreFromRank(0)).toBe(MAX_MISSED_SCORE);
  });

  it("only returns integers", () => {
    for (const rank of [2, 3, 7, 42, 999, 31_415]) expect(Number.isInteger(scoreFromRank(rank))).toBe(true);
  });
});

describe("numberProximityScore", () => {
  it("counts years a few apart as close", () => {
    expect(numberProximityScore("1789", "1790")).toBe(84);
    expect(numberProximityScore("2000", "2015")).toBe(62);
    expect(numberProximityScore("2000", "2015")).toBeGreaterThanOrEqual(HOT_SCORE);
  });

  it("judges a gap against the size of the numbers", () => {
    expect(numberProximityScore("3", "4")).toBeGreaterThanOrEqual(NEAR_SCORE);
    expect(numberProximityScore("20", "30")).toBeLessThan(NEAR_SCORE);
    expect(numberProximityScore("100", "1000")).toBeLessThan(numberProximityScore("20", "30"));
  });

  it("does not care which number is the guess", () => {
    expect(numberProximityScore("2015", "2000")).toBe(numberProximityScore("2000", "2015"));
  });

  it("scores the same value written differently as close as a missed word can be", () => {
    expect(numberProximityScore("007", "7")).toBe(MAX_MISSED_SCORE);
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

  it("makes any score close enough to be placed at least warm", () => {
    expect(proximityTier({ found: false, score: NEAR_SCORE })).toBe("warm");
  });

  it("distinguishes a word the model doesn't know from a very distant one", () => {
    expect(proximityTier({ found: false, score: null })).toBe("unknown");
  });
});

describe("proximityHeat", () => {
  it("runs from 0 to 1 across the scale", () => {
    expect(proximityHeat(0)).toBe(0);
    expect(proximityHeat(50)).toBe(0.5);
    expect(proximityHeat(MAX_MISSED_SCORE)).toBe(1);
  });

  it("gives scores within one tier shades of their own", () => {
    expect(proximityHeat(41)).toBeLessThan(proximityHeat(58));
    expect(proximityHeat(62)).toBeLessThan(proximityHeat(85));
  });

  it("rounds to hundredths, so the inline style stays short", () => {
    expect(proximityHeat(71)).toBe(0.76);
  });

  it("treats a non-finite score as the coldest", () => {
    expect(proximityHeat(Number.NaN)).toBe(0);
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
