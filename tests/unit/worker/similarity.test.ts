import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOT_SCORE, NEAR_SCORE, WARM_SCORE } from "../../../src/game/similarity";
import { wordPositions } from "../../../src/game/slots";
import type { Song } from "../../../src/game/types";
import { SAMPLE_SIMILARITY_SCORES, sampleNearTable } from "../../../worker/src/sampleSimilarity";
import {
  loadSimilarityTable,
  nearSlotsFromTable,
  parseSimilarityTable,
  proximityHint,
  resetSimilarityMemo,
  scoreFromTable,
  SIMILARITY_TABLE_VERSION,
  type SimilarityEnv,
  type SimilarityKv,
  type SimilarityTable,
} from "../../../worker/src/similarity";

// Word positions: Orage (0) | La (1) pluie (2) et (3) l (4) orage (5) | Encore (6) la (7) pluie (8)
const song: Song = {
  id: "orage-fixture",
  title: "Orage",
  artist: "Fixture",
  sections: [{ label: "Couplet 1", lines: ["La pluie et l'orage", "Encore la pluie"] }],
};

function table(scores: Record<string, number>, near: Record<string, Record<string, number>> = {}): string {
  return JSON.stringify({ version: SIMILARITY_TABLE_VERSION, songId: song.id, model: "test-model", scores, near });
}

function parsed(scores: Record<string, number>, near: Record<string, unknown> = {}): SimilarityTable | null {
  return parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: song.id, model: "test-model", scores, near });
}

function fakeKv(entries: Record<string, string>): SimilarityKv {
  return { get: async (key: string) => entries[key] ?? null };
}

// Sample mode announces its vocabulary on stdout; silence it here so the
// suite's output stays readable.
let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logged = vi.spyOn(console, "log").mockImplementation(() => {});
  // Each test starts from a cold isolate: a parsed table is memoized for the
  // isolate's lifetime (see loadSimilarityTable), so a test counting KV reads
  // would otherwise be answered from the previous test's table.
  resetSimilarityMemo();
});

afterEach(() => {
  logged.mockRestore();
});

describe("parseSimilarityTable", () => {
  it("accepts a well-formed table", () => {
    const loaded = parsed({ orage: 42 }, { averse: { pluie: 72 } });
    expect(loaded?.songId).toBe(song.id);
    expect(loaded?.scores.orage).toBe(42);
    expect(loaded?.near.averse).toEqual({ pluie: 72 });
  });

  it("rejects a table built for another format version", () => {
    expect(parseSimilarityTable({ version: 99, songId: "x", scores: {}, near: {} })).toBeNull();
  });

  // Version 1 tables carry scores but no placements: they are stale, and
  // ignored as a whole rather than half-read.
  it("ignores a table built before close words were placed", () => {
    expect(parseSimilarityTable({ version: 1, songId: "x", model: "m", scores: { orage: 42 } })).toBeNull();
  });

  it("rejects malformed shapes instead of trusting them", () => {
    expect(parseSimilarityTable(null)).toBeNull();
    expect(parseSimilarityTable("nope")).toBeNull();
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: 12, scores: {}, near: {} })).toBeNull();
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: "x", near: {} })).toBeNull();
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: "x", scores: [], near: {} })).toBeNull();
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: "x", scores: {} })).toBeNull();
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: "x", scores: {}, near: [] })).toBeNull();
  });

  it("falls back to an unknown model name rather than rejecting the table", () => {
    expect(parseSimilarityTable({ version: SIMILARITY_TABLE_VERSION, songId: "x", scores: {}, near: {} })?.model).toBe(
      "unknown"
    );
  });
});

describe("scoreFromTable", () => {
  const scored = parsed({ orage: 42, pluie: 200, vent: Number.NaN });

  it("returns the stored score", () => {
    expect(scoreFromTable(scored, "orage")).toBe(42);
  });

  it("returns null for a word the table doesn't cover", () => {
    expect(scoreFromTable(scored, "xylophoneinexistant")).toBeNull();
  });

  it("returns null when there is no table at all", () => {
    expect(scoreFromTable(null, "orage")).toBeNull();
  });

  it("clamps an out-of-range score and ignores a non-numeric one", () => {
    expect(scoreFromTable(scored, "pluie")).toBe(100);
    expect(scoreFromTable(scored, "vent")).toBeNull();
  });

  it("does not mistake an inherited Object property for a score", () => {
    // The lookup key is normalized player input, so "__proto__",
    // "constructor" and friends all reach this function verbatim.
    expect(scoreFromTable(scored, "constructor")).toBeNull();
    expect(scoreFromTable(scored, "tostring")).toBeNull();
    expect(scoreFromTable(scored, "__proto__")).toBeNull();
  });
});

describe("nearSlotsFromTable", () => {
  const nothingFound = new Set<string>();

  it("points at every position of every song word the guess is close to, in reading order", () => {
    const close = parsed({}, { averse: { pluie: 72, orage: 41 } });
    expect(nearSlotsFromTable(close, "averse", song, nothingFound)).toEqual([
      { position: 0, score: 41 },
      { position: 2, score: 72 },
      { position: 5, score: 41 },
      { position: 8, score: 72 },
    ]);
  });

  it("leaves out the words the player has already found", () => {
    const close = parsed({}, { averse: { pluie: 72, orage: 41 } });
    expect(nearSlotsFromTable(close, "averse", song, new Set(["pluie"]))).toEqual([
      { position: 0, score: 41 },
      { position: 5, score: 41 },
    ]);
  });

  it("drops a pair below the placement threshold, even when the table kept it", () => {
    const close = parsed({}, { averse: { pluie: NEAR_SCORE - 1, orage: NEAR_SCORE } });
    expect(nearSlotsFromTable(close, "averse", song, nothingFound)).toEqual([
      { position: 0, score: NEAR_SCORE },
      { position: 5, score: NEAR_SCORE },
    ]);
  });

  it("skips a song word the lyrics no longer hold", () => {
    const close = parsed({}, { averse: { grele: 80 } });
    expect(nearSlotsFromTable(close, "averse", song, nothingFound)).toEqual([]);
  });

  it("has nothing for a word without placements, or without a table", () => {
    const close = parsed({ tracteur: 9 }, { averse: { pluie: 72 } });
    expect(nearSlotsFromTable(close, "tracteur", song, nothingFound)).toEqual([]);
    expect(nearSlotsFromTable(null, "averse", song, nothingFound)).toEqual([]);
  });

  it("survives malformed placements", () => {
    const close = parsed({}, { liste: ["pluie"], texte: "pluie", chaine: { pluie: "72" }, nan: { pluie: Number.NaN } });
    for (const key of ["liste", "texte", "chaine", "nan"]) {
      expect(nearSlotsFromTable(close, key, song, nothingFound)).toEqual([]);
    }
  });

  it("clamps an out-of-range score", () => {
    const close = parsed({}, { averse: { pluie: 250 } });
    expect(nearSlotsFromTable(close, "averse", song, nothingFound).map((slot) => slot.score)).toEqual([100, 100]);
  });

  it("does not mistake an inherited Object property for placements", () => {
    const close = parsed({}, { averse: { pluie: 72 } });
    expect(nearSlotsFromTable(close, "constructor", song, nothingFound)).toEqual([]);
    expect(nearSlotsFromTable(close, "tostring", song, nothingFound)).toEqual([]);
    expect(nearSlotsFromTable(close, "__proto__", song, nothingFound)).toEqual([]);
  });
});

describe("loadSimilarityTable", () => {
  it("reads the table stored for the song being played", async () => {
    const env: SimilarityEnv = { SIMILARITY: fakeKv({ [song.id]: table({ orage: 42 }) }) };
    expect((await loadSimilarityTable(env, song))?.scores.orage).toBe(42);
  });

  it("returns null when the namespace isn't bound", async () => {
    expect(await loadSimilarityTable({}, song)).toBeNull();
  });

  it("returns null when the song has no table yet", async () => {
    const env: SimilarityEnv = { SIMILARITY: fakeKv({}) };
    expect(await loadSimilarityTable(env, song)).toBeNull();
  });

  it("survives a KV read that throws", async () => {
    const env: SimilarityEnv = {
      SIMILARITY: {
        get: () => Promise.reject(new Error("KV unavailable")),
      },
    };
    expect(await loadSimilarityTable(env, song)).toBeNull();
  });

  it("survives a stored value that isn't valid JSON", async () => {
    const env: SimilarityEnv = { SIMILARITY: fakeKv({ [song.id]: "{not json" }) };
    expect(await loadSimilarityTable(env, song)).toBeNull();
  });

  it("serves the dev placeholder table only when explicitly enabled", async () => {
    expect(await loadSimilarityTable({ SIMILARITY_SAMPLE: "1" }, song)).not.toBeNull();
    expect(await loadSimilarityTable({ SIMILARITY_SAMPLE: "0" }, song)).toBeNull();
    expect(await loadSimilarityTable({}, song)).toBeNull();
  });

  it("prefers a real KV table over the dev placeholder", async () => {
    const env: SimilarityEnv = {
      SIMILARITY: fakeKv({ [song.id]: table({ chanson: 7 }) }),
      SIMILARITY_SAMPLE: "1",
    };
    const loaded = await loadSimilarityTable(env, song);
    expect(loaded?.model).toBe("test-model");
    expect(loaded?.scores.chanson).toBe(7);
    expect(loaded?.near).toEqual({});
  });
});

describe("proximityHint", () => {
  it("reads the KV namespace once per guess, for the score and the placements alike", async () => {
    const get = vi.fn(async () => table({ averse: 72 }, { averse: { pluie: 72 } }));
    expect(await proximityHint({ SIMILARITY: { get } }, song, "averse", new Set())).toEqual({
      score: 72,
      near: [
        { position: 2, score: 72 },
        { position: 8, score: 72 },
      ],
    });
    expect(get).toHaveBeenCalledTimes(1);
    // The read asks KV to serve from the colo cache when it can; the table
    // changes only when a song is rebuilt.
    expect(get).toHaveBeenCalledWith(song.id, { cacheTtl: expect.any(Number) });
  });

  // A production table holds tens of thousands of entries, and it used to be
  // read from KV and JSON.parsed again on every single guess of the day.
  it("parses the table once, then answers later guesses from the isolate", async () => {
    const get = vi.fn(async () => table({ averse: 72, orage: 40 }, { averse: { pluie: 72 } }));
    const env: SimilarityEnv = { SIMILARITY: { get } };

    const first = await proximityHint(env, song, "averse", new Set());
    const second = await proximityHint(env, song, "orage", new Set());

    expect(get).toHaveBeenCalledTimes(1);
    expect(first.score).toBe(72);
    expect(second.score).toBe(40);
  });

  it("re-reads the table once the memo is dropped", async () => {
    const first = vi.fn(async () => table({ averse: 72 }));
    const second = vi.fn(async () => table({ averse: 11 }));

    expect((await proximityHint({ SIMILARITY: { get: first } }, song, "averse", new Set())).score).toBe(72);
    resetSimilarityMemo();
    expect((await proximityHint({ SIMILARITY: { get: second } }, song, "averse", new Set())).score).toBe(11);
  });

  it("never answers an unbound request from a table read through a binding", async () => {
    const get = vi.fn(async () => table({ averse: 72 }));

    expect((await proximityHint({ SIMILARITY: { get } }, song, "averse", new Set())).score).toBe(72);
    // No namespace and no sample table: the feature is simply off, and a
    // memoized table must not bring it back.
    expect(await proximityHint({}, song, "averse", new Set())).toEqual({ score: null, near: [] });
  });

  it("does not answer one song's guess from another song's table", async () => {
    const get = vi.fn(async (key: string) => (key === song.id ? table({ averse: 72 }) : table({ averse: 3 })));
    const env: SimilarityEnv = { SIMILARITY: { get } };
    const other: Song = { ...song, id: "another-song" };

    expect((await proximityHint(env, song, "averse", new Set())).score).toBe(72);
    expect((await proximityHint(env, other, "averse", new Set())).score).toBe(3);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("scores and places a word from the dev placeholder table", async () => {
    const hint = await proximityHint({ SIMILARITY_SAMPLE: "1" }, song, "clavecin", new Set());
    expect(hint.score).toBe(SAMPLE_SIMILARITY_SCORES.clavecin);
    expect(hint.near.length).toBeGreaterThan(0);
    expect(Math.max(...hint.near.map((slot) => slot.score))).toBe(SAMPLE_SIMILARITY_SCORES.clavecin);
  });

  it("returns neither a score nor a placement when scoring is unavailable", async () => {
    expect(await proximityHint({}, song, "averse", new Set())).toEqual({ score: null, near: [] });
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

  describe("placements", () => {
    const placements = sampleNearTable(song);
    const songWords = new Set(wordPositions(song).keys());

    it("places every word close enough on words of the song, at its own score first", () => {
      for (const [word, score] of Object.entries(SAMPLE_SIMILARITY_SCORES)) {
        if (score < NEAR_SCORE) {
          expect(placements[word]).toBeUndefined();
          continue;
        }
        const targets = placements[word];
        expect(Object.keys(targets).every((target) => songWords.has(target))).toBe(true);
        expect(Math.max(...Object.values(targets))).toBe(score);
        expect(Object.values(targets).every((value) => value >= NEAR_SCORE)).toBe(true);
      }
    });

    it("gives a song the same placements every time", () => {
      expect(sampleNearTable(song)).toEqual(placements);
    });

    it("prefers words of three letters or more, and makes do with shorter ones", () => {
      const targets = Object.values(placements).flatMap((entry) => Object.keys(entry));
      expect(targets.every((target) => target.length >= 3)).toBe(true);

      const shortWords: Song = { ...song, title: "Ah", sections: [{ label: "Refrain", lines: ["Oh la la, on y va"] }] };
      expect(Object.keys(sampleNearTable(shortWords)).length).toBeGreaterThan(0);
    });

    it("places nothing on a song without a single word", () => {
      const wordless: Song = { ...song, title: "...", sections: [{ label: "Pont", lines: ["!!!"] }] };
      expect(sampleNearTable(wordless)).toEqual({});
    });
  });

  // Regression test: the placeholder words used to be discoverable only by
  // reading the source, so every guess outside the list looked like a broken
  // feature rather than an out-of-vocabulary word.
  it("names its words once, so they don't have to be looked up in the source", async () => {
    vi.resetModules();
    const fresh = await import("../../../worker/src/similarity");

    await fresh.loadSimilarityTable({ SIMILARITY_SAMPLE: "1" }, song);
    await fresh.loadSimilarityTable({ SIMILARITY_SAMPLE: "1" }, song);

    expect(logged).toHaveBeenCalledTimes(1);
    const message = String(logged.mock.calls[0][0]);
    expect(message).toContain("SIMILARITY_SAMPLE");
    expect(message).toContain("clavecin");
  });

  it("stays quiet when sample mode is off", async () => {
    vi.resetModules();
    const fresh = await import("../../../worker/src/similarity");

    await fresh.loadSimilarityTable({}, song);

    expect(logged).not.toHaveBeenCalled();
  });
});
