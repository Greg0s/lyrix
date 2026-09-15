import { isFunctionWord } from "../../src/game/functionWords";
import { MAX_PROXIMITY_SCORE, NEAR_SCORE, scoreFromRank } from "../../src/game/similarity";
import { isNumberWord } from "../../src/game/tokenize";
import { dotProduct, type EmbeddingModel } from "./embeddings";
import type { KeyIndex } from "./vocabulary";

/**
 * Turning "a song" plus "an embedding model" into the table the Worker serves:
 * a flat word -> score map, plus, for each word, the song words it is close
 * to. Pure and synchronous, so it can be unit-tested against a handful of
 * hand-written vectors instead of a 200-dimension French model.
 *
 * Closeness is judged from each song word's side. For a song word, the most
 * frequent reference words are ranked from closest to farthest, and any word's
 * score against it comes from where it would fall in that list (see
 * scoreFromRank): being among a hidden word's thousand nearest neighbours is
 * what makes a guess worth showing in its place. A word's overall score is its
 * best score against any word of the song; its placements are every song word
 * it scores at least NEAR_SCORE against, closest first.
 *
 * Two kinds of song words are never pointed at: function words (see
 * src/game/functionWords.ts), which sit close to everything and used to soak up
 * the placements, and numbers, which have no vector and are compared by value
 * in the Worker instead.
 */

/**
 * How many different song words one guess can be shown on (at every
 * occurrence of each). Rich words land on a dozen words of a song, which is
 * the point; this only stops the rare hub that would land on dozens, and bounds
 * the table the Worker parses.
 */
export const MAX_NEAR_TARGETS = 16;

/**
 * How many of the most frequent reference words a rank is counted among.
 * Fixed rather than tied to the table's size, so covering more guesses with
 * --max-vocabulary doesn't quietly change what a score means.
 */
export const RANK_VOCABULARY_SIZE = 50_000;

/**
 * Under this cosine a word is never shown in a song word's place, whatever its
 * rank: a small vocabulary, or a song word with no real neighbours, can rank an
 * unrelated word high. Unrelated pairs measured in frWac2Vec sat under 0.2.
 */
export const MIN_NEAR_COSINE = 0.2;

export interface BuildTableOptions {
  model: EmbeddingModel;
  index: KeyIndex;
  /** Normalized keys of every word in the song (title included). */
  targetKeys: Iterable<string>;
  /** Normalized keys the table should cover, most frequent first — see vocabulary.ts's selectReferenceKeys. */
  referenceKeys: Iterable<string>;
  /** Defaults to MAX_NEAR_TARGETS. */
  maxNearTargets?: number;
  /** Defaults to RANK_VOCABULARY_SIZE. */
  rankVocabularySize?: number;
}

export interface BuildTableResult {
  scores: Record<string, number>;
  /** The song words `near` points at, by index. See SimilarityTable in worker/src/similarity.ts. */
  targets: string[];
  /** Reference word -> [targetIndex, score, targetIndex, score, …], closest first. */
  near: Record<string, number[]>;
  /** Song words the model has no vector for; they still score 100, but nothing can be shown in their place. */
  missingTargets: string[];
  /** Song words deliberately never pointed at: function words and numbers. */
  skippedTargets: string[];
}

interface Targets {
  keys: string[];
  missing: string[];
  skipped: string[];
}

function classifyTargets(songWords: ReadonlySet<string>, index: KeyIndex): Targets {
  const targets: Targets = { keys: [], missing: [], skipped: [] };
  for (const key of songWords) {
    if (isFunctionWord(key) || isNumberWord(key)) targets.skipped.push(key);
    else if (index.rowsByKey.has(key)) targets.keys.push(key);
    else targets.missing.push(key);
  }
  return targets;
}

/** 1 + how many values of an ascending list are strictly greater than `value`. */
function rankAmong(ascending: Float32Array, value: number): number {
  let low = 0;
  let high = ascending.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ascending[middle] > value) high = middle;
    else low = middle + 1;
  }
  return ascending.length - low + 1;
}

/**
 * A pair's score: its rank decides, except under MIN_NEAR_COSINE, where the
 * score also shrinks with the cosine so it stays short of NEAR_SCORE. Such a
 * pair is never placed, and never makes a chip look warm.
 */
function pairScore(rank: number, cosine: number): number {
  const score = scoreFromRank(rank);
  if (cosine >= MIN_NEAR_COSINE) return score;
  return Math.min(score, Math.floor(((NEAR_SCORE - 1) * Math.max(0, cosine)) / MIN_NEAR_COSINE));
}

export function buildSimilarityScores(options: BuildTableOptions): BuildTableResult {
  const { model, index } = options;
  const { dim, vectors } = model;
  const maxNearTargets = options.maxNearTargets ?? MAX_NEAR_TARGETS;
  const songWords = new Set(options.targetKeys);
  const targets = classifyTargets(songWords, index);

  // Function words get no entry: a grammatical word says nothing about
  // meaning, so it shows no score rather than a misleading one. The song's own
  // function words still score 100 below, like every word of the song.
  const references = [...new Set(options.referenceKeys)].filter(
    (key) => index.rowsByKey.has(key) && !isFunctionWord(key)
  );
  const ownerOf = new Map(references.map((key, owner) => [key, owner]));
  const rows: number[] = [];
  const owners: number[] = [];
  references.forEach((key, owner) => {
    for (const row of index.rowsByKey.get(key) ?? []) {
      rows.push(row);
      owners.push(owner);
    }
  });
  const referenceRows = Int32Array.from(rows);
  const referenceOwners = Int32Array.from(owners);
  const rankVocabularySize = Math.min(options.rankVocabularySize ?? RANK_VOCABULARY_SIZE, references.length);

  // Per reference word: its best score against any song word, and the song
  // words it is close enough to be shown on, as flat [targetIndex, score] pairs.
  const best = new Int32Array(references.length);
  const close = new Map<number, number[]>();
  const cosines = new Float32Array(references.length);
  const neighbourhood = new Float32Array(rankVocabularySize);

  targets.keys.forEach((target, targetIndex) => {
    // How close every reference word is to this song word, best form against best form.
    cosines.fill(Number.NEGATIVE_INFINITY);
    for (const row of index.rowsByKey.get(target) ?? []) {
      const offset = row * dim;
      for (let i = 0; i < referenceRows.length; i += 1) {
        const cosine = dotProduct(vectors, offset, vectors, referenceRows[i] * dim, dim);
        if (cosine > cosines[referenceOwners[i]]) cosines[referenceOwners[i]] = cosine;
      }
    }

    // Its neighbours among the most frequent words, itself left out, sorted so
    // that any word's rank is a binary search away.
    neighbourhood.set(cosines.subarray(0, rankVocabularySize));
    const self = ownerOf.get(target);
    if (self !== undefined && self < rankVocabularySize) neighbourhood[self] = Number.NEGATIVE_INFINITY;
    neighbourhood.sort();

    for (let owner = 0; owner < references.length; owner += 1) {
      if (owner === self) continue;
      const score = pairScore(rankAmong(neighbourhood, cosines[owner]), cosines[owner]);
      if (score > best[owner]) best[owner] = score;
      // A song word is revealed when guessed, so where it would be shown is never asked.
      if (score < NEAR_SCORE || songWords.has(references[owner])) continue;
      const pairs = close.get(owner);
      if (pairs) pairs.push(targetIndex, score);
      else close.set(owner, [targetIndex, score]);
    }
  });

  const scores: Record<string, number> = {};
  references.forEach((key, owner) => {
    scores[key] = best[owner];
  });

  const near: Record<string, number[]> = {};
  for (const [owner, flat] of close) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]]);
    // Closest first; equally close song words keep their reading order.
    pairs.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    near[references[owner]] = pairs.slice(0, maxNearTargets).flat();
  }

  // The song's own words are the perfect match by definition, including the
  // ones the model never saw and the ones never pointed at. It costs nothing
  // and keeps the table consistent with what /api/guess answers for a word it
  // finds in the lyrics. Numbers are left out: the Worker never looks one up here.
  for (const key of songWords) {
    if (!isNumberWord(key)) scores[key] = MAX_PROXIMITY_SCORE;
  }

  return { scores, targets: targets.keys, near, missingTargets: targets.missing, skippedTargets: targets.skipped };
}
