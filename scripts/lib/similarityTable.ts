import { MAX_PROXIMITY_SCORE, scoreFromCosine } from "../../src/game/similarity";
import { dotProduct, type EmbeddingModel } from "./embeddings";
import type { KeyIndex } from "./vocabulary";

/**
 * Turning "a song" plus "an embedding model" into the flat word -> score table
 * the Worker serves. Pure and synchronous, so it can be unit-tested against a
 * handful of hand-written vectors instead of a 200-dimension French model.
 *
 * A word's score is its *maximum* cosine similarity against any word of the
 * song, not an average: being very close to one lyric word is the signal the
 * player is after, and averaging would drown it in the hundreds of others.
 */

export interface BuildTableOptions {
  model: EmbeddingModel;
  index: KeyIndex;
  /** Normalized keys of every word in the song (title included). */
  targetKeys: Iterable<string>;
  /** Normalized keys the table should cover — see vocabulary.ts's selectReferenceKeys. */
  referenceKeys: Iterable<string>;
}

export interface BuildTableResult {
  scores: Record<string, number>;
  /** Song words the model has no vector for; they still score 100, but they can't pull neighbours up. */
  missingTargets: string[];
}

function uniqueRows(keys: Iterable<string>, index: KeyIndex): { rows: number[]; missing: string[] } {
  const rows = new Set<number>();
  const missing: string[] = [];
  for (const key of keys) {
    const found = index.rowsByKey.get(key);
    if (!found) {
      missing.push(key);
      continue;
    }
    found.forEach((row) => rows.add(row));
  }
  return { rows: [...rows], missing };
}

export function buildSimilarityScores(options: BuildTableOptions): BuildTableResult {
  const { model, index } = options;
  const { dim } = model;
  const targetKeys = [...options.targetKeys];
  const { rows: targetRows, missing } = uniqueRows(targetKeys, index);

  // Copied into one contiguous block: the inner loop below runs
  // referenceKeys x targetRows x dim times, so locality matters.
  const targets = new Float32Array(targetRows.length * dim);
  targetRows.forEach((row, i) => targets.set(model.vectors.subarray(row * dim, (row + 1) * dim), i * dim));

  const scores: Record<string, number> = {};
  for (const key of options.referenceKeys) {
    const rows = index.rowsByKey.get(key);
    if (!rows) continue;

    let best = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      for (let t = 0; t < targetRows.length; t += 1) {
        const similarity = dotProduct(model.vectors, row * dim, targets, t * dim, dim);
        if (similarity > best) best = similarity;
      }
    }
    scores[key] = scoreFromCosine(best);
  }

  // The song's own words are the perfect match by definition, including the
  // ones the model never saw. It costs nothing and keeps the table consistent
  // with what /api/guess answers for a word it finds in the lyrics.
  for (const key of targetKeys) scores[key] = MAX_PROXIMITY_SCORE;

  return { scores, missingTargets: missing };
}
