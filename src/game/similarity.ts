// Semantic proximity scoring, shared by the Worker (which produces a score
// for every guess) and the frontend (which colours and sorts the tried-word
// list, and the close words shown in the lyrics, from it). Framework-agnostic
// and free of any embedding maths: the vectors only ever exist in the offline
// build script (see scripts/build-similarity-table.ts), never here and never
// in the hot path.

/** Scores are integers on a 0-100 scale: 100 means "this word is in the song". */
export const MAX_PROXIMITY_SCORE = 100;

// Tier cut-offs. Tuned by hand against the "max cosine over every word of the
// song" scale, which sits well above raw word-to-word cosine similarity (a
// random word is close to *something* in a few hundred lyric words), so
// "cold" reaches higher than it would for a plain pairwise comparison.
export const HOT_SCORE = 60;
export const WARM_SCORE = 30;

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

/** Maps a cosine similarity in [-1, 1] onto the 0-100 score scale (negative similarities all collapse to 0). */
export function scoreFromCosine(cosine: number): number {
  if (!Number.isFinite(cosine)) return 0;
  return Math.round(Math.min(1, Math.max(0, cosine)) * MAX_PROXIMITY_SCORE);
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
