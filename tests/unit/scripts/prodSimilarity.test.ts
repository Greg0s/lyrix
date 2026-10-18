import { describe, expect, it } from "vitest";
import { normalize } from "../../../src/game/normalize";
import { isFunctionWord } from "../../../src/game/functionWords";
import {
  formatVerdict,
  judgeProbes,
  parseProbeAnswer,
  PROBE_WORDS,
  type ProbeAnswer,
} from "../../../scripts/lib/prodSimilarity";

function miss(word: string, score: number | null, near = 0): ProbeAnswer {
  return { word, found: false, score, near: Array.from({ length: near }, (_, position) => ({ position, score: 50 })) };
}

describe("judgeProbes", () => {
  it("passes once a single missed probe is scored", () => {
    expect(judgeProbes([miss("maison", null), miss("temps", 42, 2), miss("monde", 12)])).toEqual({
      kind: "scored",
      scored: 2,
      misses: 3,
      placed: 1,
    });
  });

  it("fails when every missed probe is unscored: the song has no usable table", () => {
    const verdict = judgeProbes([miss("maison", null), miss("temps", null)]);
    expect(verdict).toEqual({ kind: "unscored", misses: 2 });
    expect(formatVerdict(verdict)).toContain("kv bulk put");
  });

  it("ignores found probes, and can't judge when every probe was found", () => {
    const found: ProbeAnswer = { word: "nuit", found: true, score: 100, near: [] };
    expect(judgeProbes([found, miss("maison", null)])).toEqual({ kind: "unscored", misses: 1 });
    expect(judgeProbes([found])).toEqual({ kind: "inconclusive" });
  });
});

describe("parseProbeAnswer", () => {
  it("reads a delta and a full view alike", () => {
    const delta = { kind: "delta", state: "s", found: false, score: 37, near: [{ position: 4, score: 41 }], reveal: [] };
    expect(parseProbeAnswer("ville", delta)).toEqual({ word: "ville", found: false, score: 37, near: [{ position: 4, score: 41 }] });
    expect(parseProbeAnswer("ville", { lines: [], found: true, score: null, near: [] }).found).toBe(true);
  });

  it("refuses an answer that isn't a guess's", () => {
    expect(() => parseProbeAnswer("ville", { error: "invalid or expired round state" })).toThrow(/unexpected answer/);
  });
});

describe("PROBE_WORDS", () => {
  it("are content words, already normalized: a function word is never scored", () => {
    for (const word of PROBE_WORDS) {
      expect(normalize(word)).toBe(word);
      expect(isFunctionWord(word)).toBe(false);
    }
  });
});
