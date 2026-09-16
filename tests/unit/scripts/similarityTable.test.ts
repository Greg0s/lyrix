import { describe, expect, it } from "vitest";
import { isFunctionWord } from "../../../src/game/functionWords";
import { songWordKeys } from "../../../src/game/mask";
import { MAX_MISSED_SCORE, MAX_PROXIMITY_SCORE, NEAR_SCORE, scoreFromRank } from "../../../src/game/similarity";
import type { Song } from "../../../src/game/types";
import { l2NormalizeRows, type EmbeddingModel } from "../../../scripts/lib/embeddings";
import {
  buildSimilarityScores,
  MAX_NEAR_TARGETS,
  type BuildTableOptions,
  type BuildTableResult,
} from "../../../scripts/lib/similarityTable";
import { indexByKey, isReferenceCandidate, selectReferenceKeys } from "../../../scripts/lib/vocabulary";

/**
 * A three-dimension stand-in for a real French embedding model, so the maths
 * can be asserted exactly: the axes are "music", "weather" and "machinery".
 * The real 200-dimension model is never needed here, or in CI.
 */
const FIXTURE: Record<string, number[]> = {
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

function scoresFor(targetKeys: string[], referenceKeys?: string[]): BuildTableResult {
  return buildSimilarityScores({
    model,
    index,
    targetKeys,
    referenceKeys: referenceKeys ?? selectReferenceKeys(index, { maxWords: 100, required: targetKeys }),
  });
}

/** A table built straight from hand-written vectors, every word of that model a reference word, in model order. */
function buildFrom(
  source: Record<string, number[]>,
  targetKeys: string[],
  options: Pick<BuildTableOptions, "maxNearTargets" | "rankVocabularySize"> = {}
): BuildTableResult {
  const fixture = fixtureModel(source);
  const fixtureIndex = indexByKey(fixture.words);
  return buildSimilarityScores({
    model: fixture,
    index: fixtureIndex,
    targetKeys,
    referenceKeys: fixtureIndex.keysByFrequency,
    ...options,
  });
}

/** A word's placements the readable way round: [song word, score] pairs, in the table's order. */
function placements(result: BuildTableResult, key: string): [string, number][] {
  const flat = result.near[key] ?? [];
  const pairs: [string, number][] = [];
  for (let i = 0; i < flat.length; i += 2) pairs.push([result.targets[flat[i]], flat[i + 1]]);
  return pairs;
}

/** A unit vector at `degrees` from [1, 0], so its cosine with that one is exactly cos(degrees). */
function atAngle(degrees: number): number[] {
  const radians = (degrees * Math.PI) / 180;
  return [Math.cos(radians), Math.sin(radians)];
}

describe("isReferenceCandidate", () => {
  it("keeps ordinary French words", () => {
    expect(isReferenceCandidate("chanson")).toBe(true);
    expect(isReferenceCandidate("mélodie")).toBe(true);
    expect(isReferenceCandidate("cœur")).toBe(true);
  });

  it("keeps proper nouns, which make perfectly good hints", () => {
    expect(isReferenceCandidate("Renaud")).toBe(true);
    expect(isReferenceCandidate("Allemagne")).toBe(true);
  });

  it("drops anything a player can't type as one word, numbers included", () => {
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

  it("lists proper nouns in the reference order like any other word", () => {
    expect(index.keysByFrequency).toContain("renaud");
  });

  it("files a model's œ spelling under the same key as its oe spelling", () => {
    expect(indexByKey(["cœur", "coeur"]).rowsByKey.get("coeur")).toEqual([0, 1]);
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

describe("buildSimilarityScores — scores", () => {
  // "mer" and words at a growing angle from it: ocean is its nearest neighbour,
  // then vague, plage, sable, while brume and impot are barely related at all.
  const SEA: Record<string, number[]> = {
    mer: atAngle(0),
    ocean: atAngle(10),
    vague: atAngle(25),
    plage: atAngle(40),
    sable: atAngle(60),
    brume: atAngle(84.26),
    impot: atAngle(90),
  };
  const sea = buildFrom(SEA, ["mer"]);

  it("scores a word by its rank among the song word's neighbours", () => {
    expect(sea.scores.ocean).toBe(scoreFromRank(1));
    expect(sea.scores.vague).toBe(scoreFromRank(2));
    expect(sea.scores.plage).toBe(scoreFromRank(3));
    expect(sea.scores.sable).toBe(scoreFromRank(4));
  });

  it("keeps a barely related word short of a placement, however high it ranks", () => {
    // Fifth closest in this tiny vocabulary, so its rank alone would place it.
    expect(scoreFromRank(5)).toBeGreaterThanOrEqual(NEAR_SCORE);
    expect(sea.scores.brume).toBeLessThan(NEAR_SCORE);
    expect(sea.near.brume).toBeUndefined();
    // And the less related, the lower.
    expect(sea.scores.impot).toBe(0);
    expect(sea.scores.brume).toBeGreaterThan(sea.scores.impot);
  });

  it("counts ranks among the most frequent words only", () => {
    // With "mer" itself and "ocean" as the whole neighbour list, every other
    // word ranks second at worst, however many rarer words sit between them.
    const frequentOnly = buildFrom(SEA, ["mer"], { rankVocabularySize: 2 });
    expect(frequentOnly.scores.ocean).toBe(scoreFromRank(1));
    expect(frequentOnly.scores.sable).toBe(scoreFromRank(2));
  });

  it("scores a word by its closest song word, not by an average", () => {
    // "pluie" is right next to the "orage" target; averaging it against the
    // unrelated "tracteur" target would bury that.
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
    const { scores } = scoresFor(["orage"], ["ete", "chanson"]);
    expect(scores.ete).toBe(MAX_MISSED_SCORE);
    expect(scores.chanson).toBe(0);
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
  // Two song words on two axes: ocean belongs to "mer", sommet to "montagne",
  // falaise sits halfway between them, and impot has nothing to do with either.
  const RIDGE: Record<string, number[]> = {
    mer: [1, 0, 0],
    montagne: [0, 1, 0],
    ocean: [0.95, 0.1, 0.1],
    sommet: [0.1, 0.95, 0.1],
    falaise: [0.7, 0.7, 0.14],
    impot: [0, 0, 1],
  };
  const ridge = buildFrom(RIDGE, ["mer", "montagne"]);

  it("lists the song words a word is close to, with a score for each", () => {
    expect(ridge.targets).toEqual(["mer", "montagne"]);
    expect(placements(ridge, "ocean")).toEqual([["mer", 99]]);
    expect(placements(ridge, "sommet")).toEqual([["montagne", 99]]);
  });

  it("keeps equally close song words in reading order", () => {
    expect(placements(ridge, "falaise")).toEqual([
      ["mer", 94],
      ["montagne", 94],
    ]);
  });

  it("lists the closest song words first", () => {
    // "crete" is nearer "mer" as the crow flies, but "colline" is nearer still,
    // while nothing stands between "crete" and "montagne".
    const hills = buildFrom(
      { mer: atAngle(0), montagne: atAngle(90), colline: atAngle(15), crete: atAngle(30) },
      ["mer", "montagne"]
    );
    expect(placements(hills, "crete")).toEqual([
      ["montagne", 99],
      ["mer", 94],
    ]);
  });

  it("caps how many song words one word is placed on", () => {
    const axes = Object.fromEntries(
      Array.from({ length: 20 }, (_, axis) => [
        `axe${String.fromCharCode(97 + axis)}`,
        Array.from({ length: 20 }, (_, d) => (d === axis ? 1 : 0)),
      ])
    );
    const hubModel = { ...axes, hub: new Array<number>(20).fill(1) };
    expect(buildFrom(hubModel, Object.keys(axes)).near.hub).toHaveLength(2 * MAX_NEAR_TARGETS);
    expect(buildFrom(hubModel, Object.keys(axes), { maxNearTargets: 3 }).near.hub).toHaveLength(6);
  });

  it("gives a word's best placement the word's own score", () => {
    expect(Object.keys(ridge.near).length).toBeGreaterThan(0);
    for (const [key, flat] of Object.entries(ridge.near)) {
      expect(Math.max(...flat.filter((_, i) => i % 2 === 1))).toBe(ridge.scores[key]);
    }
  });

  it("places nothing for a word close to no song word", () => {
    expect(ridge.near.impot).toBeUndefined();
  });

  it("never places a song word, since guessing one reveals it", () => {
    expect(ridge.near.mer).toBeUndefined();
    expect(ridge.near.montagne).toBeUndefined();
  });

  it("never points at a song word the model doesn't know", () => {
    const { targets } = scoresFor(["orage", "zzzzinconnu"]);
    expect(targets).toEqual(["orage"]);
  });
});

describe("buildSimilarityScores — words that carry no meaning", () => {
  // "la" and "les" sit right next to "mer" here, the way function words sit
  // next to nearly everything in a real model.
  const GRAMMAR: Record<string, number[]> = {
    mer: [1, 0, 0],
    la: [0.8, 0.6, 0],
    les: [0.8, 0.55, 0.2],
    vague: [0.9, 0.4, 0.1],
  };
  const grammar = buildFrom(GRAMMAR, ["mer", "la", "2015"]);

  it("never points at a function word or a number, however close", () => {
    expect(grammar.targets).toEqual(["mer"]);
    expect(grammar.skippedTargets).toEqual(["la", "2015"]);
    expect(placements(grammar, "vague")).toEqual([["mer", 99]]);
  });

  it("gives a function word no score at all, unless it is in the song", () => {
    expect(grammar.scores.les).toBeUndefined();
    expect(grammar.near.les).toBeUndefined();
    expect(grammar.scores.la).toBe(MAX_PROXIMITY_SCORE);
  });

  it("leaves numbers to the Worker", () => {
    expect(grammar.scores["2015"]).toBeUndefined();
  });
});

describe("building a table for a whole song", () => {
  const song: Song = {
    id: "orage-fixture",
    title: "Orage",
    artist: "Fixture",
    sections: [{ label: "Couplet 1", lines: ["La pluie et l'orage", "Un vieux tracteur en 2015"] }],
  };

  it("covers every word of the title and the lyrics, and only points at words that mean something", () => {
    const targetKeys = [...songWordKeys(song)];
    const { scores, targets } = buildSimilarityScores({
      model,
      index,
      targetKeys,
      referenceKeys: selectReferenceKeys(index, { maxWords: 100, required: targetKeys }),
    });

    // Including the short function words a tokenizer keeps ("la", "et", "l", "un", "en").
    for (const key of targetKeys.filter((key) => key !== "2015")) expect(scores[key]).toBe(MAX_PROXIMITY_SCORE);
    expect(scores.parapluie).toBeGreaterThan(scores.chanson);
    // "vieux" has no vector in the fixture, and the rest carry no meaning.
    expect(targets).toEqual(["orage", "pluie", "tracteur"]);
    for (const target of targets) expect(isFunctionWord(target)).toBe(false);
  });
});
