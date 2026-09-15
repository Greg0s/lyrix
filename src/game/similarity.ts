// Semantic proximity scoring, shared by the offline build (which turns an
// embedding model into scores), the Worker (which answers every guess with
// one) and the frontend (which colours and sorts the tried-word list, and the
// close words shown in the lyrics, from it). Framework-agnostic and free of
// any embedding maths: the vectors only ever exist in the offline build script
// (see scripts/build-similarity-table.ts), never here and never in the hot path.

/** Scores are integers on a 0-100 scale: 100 means "this word is in the song". */
export const MAX_PROXIMITY_SCORE = 100;

/** The best a word that is *not* in the song can score, so a close guess never reads as a found one. */
export const MAX_MISSED_SCORE = MAX_PROXIMITY_SCORE - 1;

/**
 * Closeness becomes a score by rank, not by raw cosine. For each hidden word,
 * the build ranks the reference vocabulary from closest to farthest, and a
 * guess scores 100 minus this many points per tenfold step down that list: the
 * hidden word's nearest neighbour scores 99, its 10th 80, its 100th 60 and its
 * 1000th 40.
 *
 * A rank means the same thing for every hidden word, which a cosine doesn't:
 * measured on frWac2Vec, a word's 1000th neighbour sat anywhere between 0.29
 * and 0.46 depending on the word, so any single cosine cut-off was too strict
 * for some hidden words and too loose for others (docs/LEARNINGS.md,
 * 2026-09-15). It also keeps the scale steady if the model is ever swapped.
 */
export const RANK_DECADE_POINTS = 20;

// Tier cut-offs, on the rank scale above: hot means among a hidden word's 100
// nearest neighbours, warm among its 1000.
export const HOT_SCORE = 60;
export const WARM_SCORE = 40;

// A missed guess is shown in place of a hidden word once it is at least this
// close to it (see NearSlot in types.ts). Pegged to the warm tier, so a guess
// whose chip is warm or hot always lands somewhere in the lyrics, unless every
// word it is close to is already revealed. The offline build drops pairs below
// it, so lowering it means rebuilding the tables; raising it doesn't, since
// the Worker checks it again on every read.
export const NEAR_SCORE = WARM_SCORE;

export type ProximityTier = "found" | "hot" | "warm" | "cold" | "unknown";

export interface ProximityScored {
  found: boolean;
  /** null when the word is outside the reference vocabulary, or when no table is available for the song. */
  score: number | null;
}

/** The score of a guess that is the `rank`-th closest word to a hidden word (1 being its nearest neighbour). */
export function scoreFromRank(rank: number): number {
  if (Number.isNaN(rank)) return 0;
  const score = MAX_PROXIMITY_SCORE - RANK_DECADE_POINTS * Math.log10(Math.max(1, rank));
  return Math.min(MAX_MISSED_SCORE, Math.max(0, Math.round(score)));
}

// How many ranks a gap between two numbers is worth, as a fraction of the
// larger one: a 10% gap counts as the 1000th neighbour, right on NEAR_SCORE.
const NUMBER_GAP_RANKS = 10_000;

/**
 * Closeness of two numbers, on the same scale as words. The embedding model
 * has no vector for "2015", so numbers are compared by value: the gap relative
 * to the larger of the two, so years a few apart are close while 5 and 20 are
 * not, and the +10 keeps small numbers from being all-or-nothing. For example
 * 1789 and 1790 score 84, 2000 and 2015 62, 3 and 4 43, 20 and 30 32.
 */
export function numberProximityScore(guess: string, target: string): number {
  const a = Number(guess);
  const b = Number(target);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const gap = Math.abs(a - b) / (Math.max(a, b) + 10);
  return scoreFromRank(1 + NUMBER_GAP_RANKS * gap);
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(MAX_PROXIMITY_SCORE, Math.max(0, Math.round(score)));
}

export function proximityTier(word: ProximityScored): ProximityTier {
  if (word.found) return "found";
  if (word.score === null) return "unknown";
  if (word.score >= HOT_SCORE) return "hot";
  if (word.score >= WARM_SCORE) return "warm";
  return "cold";
}

// The colour ramp's ends: a score of HEAT_FLOOR or less is as cold as it gets,
// HEAT_CEILING or more as hot, and every score between gets its own shade.
const HEAT_FLOOR = 10;
const HEAT_CEILING = 90;

/**
 * Where a score sits on the cold-to-hot colour ramp, from 0 to 1 in
 * hundredths (see game.css). The tiers only name three bands; the ramp tells
 * a 41 from a 58, and a 62 from a 95.
 */
export function proximityHeat(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const heat = (score - HEAT_FLOOR) / (HEAT_CEILING - HEAT_FLOOR);
  return Math.round(Math.min(1, Math.max(0, heat)) * 100) / 100;
}

// Found words rank first even if they carry no score, so a round saved
// before scoring existed still sorts sensibly after an update.
function rank(word: ProximityScored): number {
  if (word.found) return MAX_PROXIMITY_SCORE;
  return word.score ?? -1;
}

/** Highest score first, unscored words last. Stable, so equally-scored words keep their original (most recent first) order. */
export function sortByProximity<T extends ProximityScored>(words: readonly T[]): T[] {
  return [...words].sort((a, b) => rank(b) - rank(a));
}
