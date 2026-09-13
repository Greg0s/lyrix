import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOT_SCORE, WARM_SCORE } from "../../../src/game/similarity";
import { SAMPLE_SIMILARITY_SCORES } from "../../../worker/src/sampleSimilarity";
import {
  loadSimilarityTable,
  parseSimilarityTable,
  proximityScore,
  scoreFromTable,
  SIMILARITY_TABLE_VERSION,
  type SimilarityEnv,
  type SimilarityKv,
} from "../../../worker/src/similarity";

function table(scores: Record<string, number>, songId = "papaoutai"): string {
  return JSON.stringify({ version: SIMILARITY_TABLE_VERSION, songId, model: "test-model", scores });
}

function fakeKv(entries: Record<string, string>): SimilarityKv {
  return { get: async (key: string) => entries[key] ?? null };
}

// Sample mode announces its vocabulary on stdout; silence it here so the
// suite's output stays readable.
let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logged = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe("parseSimilarityTable", () => {
  it("accepts a well-formed table", () => {
    const parsed = parseSimilarityTable(JSON.parse(table({ orage: 42 })) as unknown);
    expect(parsed?.songId).toBe("papaoutai");
    expect(parsed?.scores.orage).toBe(42);
  });

  it("rejects a table built for another format version", () => {
    expect(parseSimilarityTable({ version: 99, songId: "x", scores: {} })).toBeNull();
  });

  it("rejects malformed shapes instead of trusting them", () => {
    expect(parseSimilarityTable(null)).toBeNull();
    expect(parseSimilarityTable("nope")).toBeNull();
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: 12, scores: {} })).toBeNull();
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: "x" })).toBeNull();
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: "x", scores: [] })).toBeNull();
  });

  it("falls back to an unknown model name rather than rejecting the table", () => {
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: "x", scores: {} })?.model).toBe("unknown");
  });
});

describe("scoreFromTable", () => {
  const parsed = parseSimilarityTable(JSON.parse(table({ orage: 42, pluie: 200, vent: Number.NaN })) as unknown);

  it("returns the stored score", () => {
    expect(scoreFromTable(parsed, "orage")).toBe(42);
  });

  it("returns null for a word the table doesn't cover", () => {
    expect(scoreFromTable(parsed, "xylophoneinexistant")).toBeNull();
  });

  it("returns null when there is no table at all", () => {
    expect(scoreFromTable(null, "orage")).toBeNull();
  });

  it("clamps an out-of-range score and ignores a non-numeric one", () => {
    expect(scoreFromTable(parsed, "pluie")).toBe(100);
    expect(scoreFromTable(parsed, "vent")).toBeNull();
  });

  it("does not mistake an inherited Object property for a score", () => {
    // The lookup key is normalized player input, so "__proto__",
    // "constructor" and friends all reach this function verbatim.
    expect(scoreFromTable(parsed, "constructor")).toBeNull();
    expect(scoreFromTable(parsed, "tostring")).toBeNull();
    expect(scoreFromTable(parsed, "__proto__")).toBeNull();
  });
});

describe("loadSimilarityTable", () => {
  it("reads the table stored for the song being played", async () => {
    const env: SimilarityEnv = { SIMILARITY: fakeKv({ papaoutai: table({ orage: 42 }) }) };
    expect((await loadSimilarityTable(env, "papaoutai"))?.scores.orage).toBe(42);
  });

  it("returns null when the namespace isn't bound", async () => {
    expect(await loadSimilarityTable({}, "papaoutai")).toBeNull();
  });

  it("returns null when the song has no table yet", async () => {
    const env: SimilarityEnv = { SIMILARITY: fakeKv({}) };
    expect(await loadSimilarityTable(env, "papaoutai")).toBeNull();
  });

  it("survives a KV read that throws", async () => {
    const env: SimilarityEnv = {
      SIMILARITY: {
        get: () => Promise.reject(new Error("KV unavailable")),
      },
    };
    expect(await loadSimilarityTable(env, "papaoutai")).toBeNull();
  });

  it("survives a stored value that isn't valid JSON", async () => {
    const env: SimilarityEnv = { SIMILARITY: fakeKv({ papaoutai: "{not json" }) };
    expect(await loadSimilarityTable(env, "papaoutai")).toBeNull();
  });

  it("serves the dev placeholder table only when explicitly enabled", async () => {
    expect(await loadSimilarityTable({ SIMILARITY_SAMPLE: "1" }, "papaoutai")).not.toBeNull();
    expect(await loadSimilarityTable({ SIMILARITY_SAMPLE: "0" }, "papaoutai")).toBeNull();
    expect(await loadSimilarityTable({}, "papaoutai")).toBeNull();
  });

  it("prefers a real KV table over the dev placeholder", async () => {
    const env: SimilarityEnv = {
      SIMILARITY: fakeKv({ papaoutai: table({ chanson: 7 }) }),
      SIMILARITY_SAMPLE: "1",
    };
    const loaded = await loadSimilarityTable(env, "papaoutai");
    expect(loaded?.model).toBe("test-model");
    expect(loaded?.scores.chanson).toBe(7);
  });
});

describe("proximityScore", () => {
  it("reads the KV namespace once per guess and nothing else", async () => {
    const get = vi.fn(async () => table({ orage: 42 }));
    expect(await proximityScore({ SIMILARITY: { get } }, "papaoutai", "orage")).toBe(42);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("papaoutai");
  });

  it("scores a word from the dev placeholder table", async () => {
    expect(await proximityScore({ SIMILARITY_SAMPLE: "1" }, "papaoutai", "clavecin")).toBe(
      SAMPLE_SIMILARITY_SCORES.clavecin
    );
  });

  it("returns null rather than failing when scoring is unavailable", async () => {
    expect(await proximityScore({}, "papaoutai", "orage")).toBeNull();
  });
});

describe("the dev placeholder table", () => {
  it("only holds normalized keys, so lookups can match a player's guess", () => {
    for (const key of Object.keys(SAMPLE_SIMILARITY_SCORES)) {
      expect(key).toMatch(/^[a-z]+$/);
    }
  });

  // It is the only way to see the colours without the real model, so every
  // tier has to be reachable — a table that scored nothing above 60 would
  // leave the "hot" chip untested and unseen.
  it("covers every colour tier with several words each", () => {
    const scores = Object.values(SAMPLE_SIMILARITY_SCORES);
    expect(scores.filter((score) => score >= HOT_SCORE).length).toBeGreaterThanOrEqual(3);
    expect(scores.filter((score) => score >= WARM_SCORE && score < HOT_SCORE).length).toBeGreaterThanOrEqual(3);
    expect(scores.filter((score) => score < WARM_SCORE).length).toBeGreaterThanOrEqual(3);
  });

  it("stays inside the 0-100 scale", () => {
    for (const score of Object.values(SAMPLE_SIMILARITY_SCORES)) {
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  // Regression test: the placeholder words used to be discoverable only by
  // reading the source, so every guess outside the list looked like a broken
  // feature rather than an out-of-vocabulary word.
  it("names its words once, so they don't have to be looked up in the source", async () => {
    vi.resetModules();
    const fresh = await import("../../../worker/src/similarity");

    await fresh.loadSimilarityTable({ SIMILARITY_SAMPLE: "1" }, "papaoutai");
    await fresh.loadSimilarityTable({ SIMILARITY_SAMPLE: "1" }, "papaoutai");

    expect(logged).toHaveBeenCalledTimes(1);
    const message = String(logged.mock.calls[0][0]);
    expect(message).toContain("SIMILARITY_SAMPLE");
    expect(message).toContain("clavecin");
  });

  it("stays quiet when sample mode is off", async () => {
    vi.resetModules();
    const fresh = await import("../../../worker/src/similarity");

    await fresh.loadSimilarityTable({}, "papaoutai");

    expect(logged).not.toHaveBeenCalled();
  });
});
