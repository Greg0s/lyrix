import { describe, expect, it } from "vitest";
import { MAX_PROXIMITY_SCORE } from "../../../src/game/similarity";
import type { Song } from "../../../src/game/types";
import { songWordKeys } from "../../../src/game/mask";
import { l2NormalizeRows, type EmbeddingModel } from "../../../scripts/lib/embeddings";
import { buildSimilarityScores, MAX_NEAR_TARGETS } from "../../../scripts/lib/similarityTable";
import { indexByKey, isReferenceCandidate, selectReferenceKeys } from "../../../scripts/lib/vocabulary";

/**
 * A three-dimension stand-in for a real French embedding model, so the maths
 * can be asserted exactly: the axes are "music", "weather" and "machinery".
 * The real 200-dimension model is never needed here, or in CI.
 */
const FIXTURE: Record<string, [number, number, number]> = {
  chanson: [1, 0, 0],
  mélodie: [0.95, 0.05, 0],
  refrain: [0.9, 0, 0.1],
  orage: [0, 1, 0],
  pluie: [0.05, 0.95, 0],
  parapluie: [0, 0.8, 0.2],
  tracteur: [0, 0, 1],
  boulon: [0.05, 0, 0.95],
  Renaud: [1, 0, 0],
  été: [0, 0.6, 0],
  ÉTÉ: [0, 0, 0.6],
};

function fixtureModel(source: Record<string, number[]> = FIXTURE): EmbeddingModel {
  const words = Object.keys(source);
  const dim = source[words[0]].length;
  const vectors = new Float32Array(words.length * dim);
  words.forEach((word, row) => vectors.set(source[word], row * dim));
  l2NormalizeRows(vectors, dim);
  return { dim, words, vectors };
}

const model = fixtureModel();
const index = indexByKey(model.words);

function scoresFor(targetKeys: string[], referenceKeys?: string[]) {
  return buildSimilarityScores({
    model,
    index,
    targetKeys,
    referenceKeys: referenceKeys ?? selectReferenceKeys(index, { maxWords: 100, required: targetKeys }),
  });
}

describe("isReferenceCandidate", () => {
  it("keeps ordinary lowercase French words", () => {
    expect(isReferenceCandidate("chanson")).toBe(true);
    expect(isReferenceCandidate("mélodie")).toBe(true);
  });

  it("drops proper nouns and anything that isn't a single word", () => {
    expect(isReferenceCandidate("Renaud")).toBe(false);
    expect(isReferenceCandidate("Édith")).toBe(false);
    expect(isReferenceCandidate("rock'n'roll")).toBe(false);
    expect(isReferenceCandidate("2024")).toBe(false);
    expect(isReferenceCandidate("saint-tropez")).toBe(false);
  });
});

describe("indexByKey", () => {
  it("keys the model the way the game does, accents and case removed", () => {
    expect(index.rowsByKey.has("melodie")).toBe(true);
    expect(index.rowsByKey.has("mélodie")).toBe(false);
  });

  it("keeps every model form of a key, so the best one can win", () => {
    expect(index.rowsByKey.get("ete")).toHaveLength(2);
  });

  it("leaves proper nouns out of the reference order but still indexes them", () => {
    expect(index.rowsByKey.has("renaud")).toBe(true);
    expect(index.keysByFrequency).not.toContain("renaud");
  });
});

describe("selectReferenceKeys", () => {
  it("defaults to the model's own frequency order", () => {
    expect(selectReferenceKeys(index, { maxWords: 3 })).toEqual(["chanson", "melodie", "refrain"]);
  });

  it("intersects a common-word list with the model's vocabulary", () => {
    const keys = selectReferenceKeys(index, { words: ["Pluie", "kryptonite", "orage"], maxWords: 100 });
    expect(keys).toEqual(["pluie", "orage"]);
  });

  it("always includes the song's own words, however rare", () => {
    const keys = selectReferenceKeys(index, { words: ["chanson"], maxWords: 1, required: ["boulon", "parapluie"] });
    expect(keys).toContain("boulon");
    expect(keys).toContain("parapluie");
  });

  it("never returns the same key twice", () => {
    const keys = selectReferenceKeys(index, { words: ["orage", "Orage", "orage"], maxWords: 100, required: ["orage"] });
    expect(keys).toEqual(["orage"]);
  });
});

describe("buildSimilarityScores", () => {
  it("scores a word by its closest song word, not by an average", () => {
    // "pluie" is nearly identical to the "orage" target; averaging it against
    // the unrelated "tracteur" target would bury that.
    const { scores } = scoresFor(["orage", "tracteur"]);
    expect(scores.pluie).toBeGreaterThan(90);
    expect(scores.parapluie).toBeGreaterThan(scores.chanson);
  });

  it("ranks an unrelated word far below a related one", () => {
    const { scores } = scoresFor(["orage", "pluie"]);
    expect(scores.parapluie).toBeGreaterThan(scores.chanson);
    expect(scores.chanson).toBeLessThan(20);
    expect(scores.tracteur).toBe(0);
  });

  it("gives the song's own words the top score", () => {
    const { scores } = scoresFor(["orage", "chanson"]);
    expect(scores.orage).toBe(MAX_PROXIMITY_SCORE);
    expect(scores.chanson).toBe(MAX_PROXIMITY_SCORE);
  });

  it("still scores a song word the model has never seen, and reports it", () => {
    const { scores, missingTargets } = scoresFor(["orage", "zzzzinconnu"]);
    expect(scores.zzzzinconnu).toBe(MAX_PROXIMITY_SCORE);
    expect(missingTargets).toEqual(["zzzzinconnu"]);
  });

  it("takes the best of several model forms of the same key", () => {
    // "ete" exists twice in the fixture: one form points at the weather axis,
    // the other at machinery. Against a weather target, the first must win.
    const { scores } = scoresFor(["orage"], ["ete"]);
    expect(scores.ete).toBe(MAX_PROXIMITY_SCORE);
  });

  it("only emits integer scores inside the 0-100 scale", () => {
    const { scores } = scoresFor(["orage", "chanson"]);
    for (const score of Object.values(scores)) {
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(MAX_PROXIMITY_SCORE);
    }
  });

  it("covers exactly the reference words plus the song's own", () => {
    const { scores } = scoresFor(["boulon"], ["chanson", "orage"]);
    expect(Object.keys(scores).sort()).toEqual(["boulon", "chanson", "orage"]);
  });

  it("skips a reference word the model doesn't know rather than scoring it zero", () => {
    const { scores } = scoresFor(["orage"], ["pluie", "kryptonite"]);
    expect(scores.kryptonite).toBeUndefined();
  });
});

describe("buildSimilarityScores — close words", () => {
  it("lists the song words a word is close to, with a score for each", () => {
    const { near } = scoresFor(["orage", "tracteur", "chanson"]);
    expect(near.pluie).toEqual({ orage: 100 });
    expect(near.boulon).toEqual({ tracteur: 100 });
    // 97 against "orage", but only 24 against "tracteur": below the threshold.
    expect(near.parapluie).toEqual({ orage: 97 });
  });

  it("measures each song word against the form of a word closest to it", () => {
    // One form of "ete" sits on the weather axis, the other on machinery: each
    // song word gets the form nearest to it, not a single overall winner.
    const { near } = scoresFor(["orage", "tracteur", "chanson"], ["ete"]);
    expect(near.ete).toEqual({ orage: 100, tracteur: 100 });
  });

  it("lists the closest song words first, and only as many as asked", () => {
    const spread = fixtureModel({ centre: [3, 2, 1], musique: [1, 0, 0], meteo: [0, 1, 0], machine: [0, 0, 1] });
    const build = (maxNearTargets?: number) =>
      buildSimilarityScores({
        model: spread,
        index: indexByKey(spread.words),
        targetKeys: ["machine", "meteo", "musique"],
        referenceKeys: ["centre"],
        maxNearTargets,
      }).near;

    // "centre" scores 80 against musique, 53 against meteo and 27 against machine.
    expect(Object.entries(build().centre)).toEqual([
      ["musique", 80],
      ["meteo", 53],
    ]);
    expect(build(1).centre).toEqual({ musique: 80 });
  });

  it("caps how many song words one word is placed on", () => {
    const hub = fixtureModel({
      hub: [1, 1, 1, 1, 1],
      a: [1, 0, 0, 0, 0],
      b: [0, 1, 0, 0, 0],
      c: [0, 0, 1, 0, 0],
      d: [0, 0, 0, 1, 0],
      e: [0, 0, 0, 0, 1],
    });
    const { near } = buildSimilarityScores({
      model: hub,
      index: indexByKey(hub.words),
      targetKeys: ["a", "b", "c", "d", "e"],
      referenceKeys: ["hub"],
    });
    expect(Object.keys(near.hub)).toHaveLength(MAX_NEAR_TARGETS);
  });

  it("gives a word's best placement the word's own score", () => {
    const { scores, near } = scoresFor(["orage", "tracteur", "chanson"]);
    expect(Object.keys(near).length).toBeGreaterThan(0);
    for (const [key, targets] of Object.entries(near)) {
      expect(Math.max(...Object.values(targets))).toBe(scores[key]);
    }
  });

  it("places nothing for a word close to no song word", () => {
    const { near } = scoresFor(["orage"]);
    expect(near.tracteur).toBeUndefined();
    expect(near.chanson).toBeUndefined();
  });

  it("never places a song word, since guessing one reveals it", () => {
    const { near } = scoresFor(["orage", "pluie"]);
    expect(near.orage).toBeUndefined();
    expect(near.pluie).toBeUndefined();
    expect(near.parapluie).toEqual({ orage: 97, pluie: 97 });
  });

  it("never points at a song word the model doesn't know", () => {
    const { near } = scoresFor(["orage", "zzzzinconnu"]);
    for (const targets of Object.values(near)) expect(targets).not.toHaveProperty("zzzzinconnu");
  });
});

describe("building a table for a whole song", () => {
  const song: Song = {
    id: "orage-fixture",
    title: "Orage",
    artist: "Fixture",
    sections: [{ label: "Couplet 1", lines: ["La pluie et l'orage", "Un vieux tracteur"] }],
  };

  it("covers every word of the title and the lyrics", () => {
    const targetKeys = [...songWordKeys(song)];
    const { scores, near } = buildSimilarityScores({
      model,
      index,
      targetKeys,
      referenceKeys: selectReferenceKeys(index, { maxWords: 100, required: targetKeys }),
    });

    // Including the short function words a tokenizer keeps ("la", "et", "l", "un").
    for (const key of targetKeys) expect(scores[key]).toBe(MAX_PROXIMITY_SCORE);
    expect(scores.parapluie).toBeGreaterThan(scores.chanson);
    // And every placement points back at a word of that song.
    for (const targets of Object.values(near)) {
      for (const target of Object.keys(targets)) expect(targetKeys).toContain(target);
    }
  });
});
