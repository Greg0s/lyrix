import { MAX_PROXIMITY_SCORE, NEAR_SCORE, scoreFromCosine } from "../../src/game/similarity";
import { dotProduct, type EmbeddingModel } from "./embeddings";
import type { KeyIndex } from "./vocabulary";

/**
 * Turning "a song" plus "an embedding model" into the table the Worker serves:
 * a flat word -> score map, plus, for each word, the song words it is close
 * to. Pure and synchronous, so it can be unit-tested against a handful of
 * hand-written vectors instead of a 200-dimension French model.
 *
 * A word's score is its *maximum* cosine similarity against any word of the
 * song, not an average: being very close to one lyric word is the signal the
 * player is after, and averaging would drown it in the hundreds of others.
 * Its placements come from the same comparison, kept per song word: every song
 * word it scores at least NEAR_SCORE against, closest first.
 */

/**
 * How many different song words one guess can be shown on (at every
 * occurrence of each). A vague word can be "close" to dozens of lyric words and
 * only the nearest few say anything — and each extra one grows every table,
 * which the Worker parses on every guess.
 */
export const MAX_NEAR_TARGETS = 3;

export interface BuildTableOptions {
  model: EmbeddingModel;
  index: KeyIndex;
  /** Normalized keys of every word in the song (title included). */
  targetKeys: Iterable<string>;
  /** Normalized keys the table should cover — see vocabulary.ts's selectReferenceKeys. */
  referenceKeys: Iterable<string>;
  /** Defaults to MAX_NEAR_TARGETS. */
  maxNearTargets?: number;
}

export interface BuildTableResult {
  scores: Record<string, number>;
  /** Reference word -> the song words it is close to, closest first. See SimilarityTable in worker/src/similarity.ts. */
  near: Record<string, Record<string, number>>;
  /** Song words the model has no vector for; they still score 100, but they can't pull neighbours up, nor show a close guess. */
  missingTargets: string[];
}

interface TargetRows {
  /** Song words the model has at least one vector for. */
  keys: string[];
  /** Model row of every form of those words… */
  rows: number[];
  /** …and, for each of those rows, the index in `keys` of the word it is a form of. */
  owners: number[];
  missing: string[];
}

function targetRows(targetKeys: readonly string[], index: KeyIndex): TargetRows {
  const result: TargetRows = { keys: [], rows: [], owners: [], missing: [] };
  for (const key of targetKeys) {
    const rows = index.rowsByKey.get(key);
    if (!rows) {
      result.missing.push(key);
      continue;
    }
    const owner = result.keys.length;
    result.keys.push(key);
    for (const row of rows) {
      result.rows.push(row);
      result.owners.push(owner);
    }
  }
  return result;
}

export function buildSimilarityScores(options: BuildTableOptions): BuildTableResult {
  const { model, index } = options;
  const { dim } = model;
  const maxNearTargets = options.maxNearTargets ?? MAX_NEAR_TARGETS;
  const targetKeys = [...new Set(options.targetKeys)];
  const songWords = new Set(targetKeys);
  const targets = targetRows(targetKeys, index);

  // Copied into one contiguous block: the inner loop below runs
  // referenceKeys x targetRows x dim times, so locality matters.
  const block = new Float32Array(targets.rows.length * dim);
  targets.rows.forEach((row, i) => block.set(model.vectors.subarray(row * dim, (row + 1) * dim), i * dim));

  const scores: Record<string, number> = {};
  const near: Record<string, Record<string, number>> = {};
  // Best similarity against each song word, reset for every reference word.
  const bestByWord = new Float64Array(targets.keys.length);

  for (const key of options.referenceKeys) {
    const rows = index.rowsByKey.get(key);
    if (!rows) continue;

    bestByWord.fill(Number.NEGATIVE_INFINITY);
    for (const row of rows) {
      for (let t = 0; t < targets.rows.length; t += 1) {
        const similarity = dotProduct(model.vectors, row * dim, block, t * dim, dim);
        const owner = targets.owners[t];
        if (similarity > bestByWord[owner]) bestByWord[owner] = similarity;
      }
    }

    let best = Number.NEGATIVE_INFINITY;
    const close: [string, number][] = [];
    targets.keys.forEach((target, owner) => {
      const similarity = bestByWord[owner];
      if (similarity > best) best = similarity;
      const score = scoreFromCosine(similarity);
      if (score >= NEAR_SCORE) close.push([target, score]);
    });
    scores[key] = scoreFromCosine(best);

    // A song word is revealed when guessed, so where it would be shown is never asked.
    if (close.length === 0 || songWords.has(key)) continue;
    close.sort((a, b) => b[1] - a[1]);
    near[key] = Object.fromEntries(close.slice(0, maxNearTargets));
  }

  // The song's own words are the perfect match by definition, including the
  // ones the model never saw. It costs nothing and keeps the table consistent
  // with what /api/guess answers for a word it finds in the lyrics.
  for (const key of targetKeys) scores[key] = MAX_PROXIMITY_SCORE;

  return { scores, near, missingTargets: targets.missing };
}
