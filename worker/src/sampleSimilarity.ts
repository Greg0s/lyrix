import { isFunctionWord } from "../../src/game/functionWords";
import { NEAR_SCORE } from "../../src/game/similarity";
import { wordPositions } from "../../src/game/slots";
import { isNumberWord } from "../../src/game/tokenize";
import type { Song } from "../../src/game/types";

/**
 * Placeholder similarity scores for local development and the e2e suite.
 *
 * These numbers are hand-written, NOT produced by the embedding model: they
 * exist so the proximity UI (colours, score chips, sorting, close words shown
 * in the lyrics) can be exercised end to end without a 200-dimension French
 * embedding model on disk and without a populated KV namespace. The same fixed
 * table is served for every song, which is fine for a UI fixture and
 * meaningless as a real hint.
 *
 * Gated on the `SIMILARITY_SAMPLE` var, which `npm run dev:worker` passes via
 * `wrangler dev --var` and which is never set in production — so a deployment
 * without a KV namespace returns no score at all rather than fake ones. A real
 * KV table always takes precedence (see loadSimilarityTable).
 *
 * The words are grouped the way a real table would rank them for a song — the
 * vocabulary of music first, other arts next, mundane and technical words last
 * — and deliberately avoid words likely to appear in the lyrics themselves,
 * since a word that *is* in the song is revealed instead of scored. Anything
 * outside this list scores `null`, which is its own UI state ("unknown word"),
 * so keep a few nonsense guesses handy when testing that one.
 *
 * Keys must be normalized (lowercase, accent-free) like every other lookup key.
 */
export const SAMPLE_SIMILARITY_SCORES: Record<string, number> = {
  // "hot" tier (>= 60): music itself
  chanson: 82,
  refrain: 78,
  melodie: 76,
  couplet: 74,
  parole: 72,
  musique: 71,
  clavecin: 71,
  guitare: 69,
  piano: 68,
  harmonica: 66,
  accordeon: 65,
  violoncelle: 64,
  saxophone: 63,
  partition: 62,
  orchestre: 61,
  symphonie: 60,

  // "warm" tier (>= 40): neighbouring arts and lyrical imagery
  tambourin: 59,
  opera: 58,
  poeme: 56,
  poesie: 55,
  rime: 54,
  danse: 52,
  theatre: 48,
  ballet: 47,
  roman: 45,
  silence: 44,
  peinture: 43,
  aquarelle: 42,
  cinema: 41,

  // "cold" tier (< 40): too far to be shown anywhere
  sculpture: 36,
  calligraphie: 34,
  sourire: 31,
  algorithme: 12,
  engrenage: 11,
  carburateur: 10,
  tracteur: 9,
  radiateur: 9,
  betterave: 8,
  aspirateur: 7,
  boulon: 6,
  perceuse: 6,
  plomberie: 5,
  tournevis: 5,
  chlorophylle: 4,
  comptabilite: 4,
  fiscalite: 3,
  astrophysique: 2,
  tableur: 2,
};

/** How many song words a sample word is shown on at most: enough to see one guess spread over the lyrics in several shades. */
const SAMPLE_PLACEMENTS = 4;

/** How much lower each further placement of a sample word scores than the one before. */
const PLACEMENT_STEP = 8;

// FNV-1a: tiny, and stable from one run to the next, which is all the
// placement below needs from a hash.
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** The placement half of a table, in the same shape as SimilarityTable's `targets` and `near`. */
export interface SampleNearTable {
  targets: string[];
  near: Record<string, number[]>;
}

/**
 * Placeholder placements to go with the placeholder scores: which words of the
 * song each sample word is "close to". A fixed word list served for every song
 * has no real neighbours to offer, so they are picked by hashing the word —
 * arbitrary, but the same on every guess and every reload of a given song.
 *
 * A word lands at its own score on one song word, then PLACEMENT_STEP lower on
 * each further one while that is still close enough, so a single guess spreads
 * over several words and shades the way a real table's does. Like a real
 * table, it points at neither function words nor numbers whenever the song has
 * anything else.
 */
export function sampleNearTable(song: Song): SampleNearTable {
  const words = [...wordPositions(song).keys()];
  const meaningful = words.filter((word) => !isFunctionWord(word) && !isNumberWord(word));
  const targets = meaningful.length > 0 ? meaningful : words;

  const near: Record<string, number[]> = {};
  if (targets.length === 0) return { targets, near };

  for (const [word, score] of Object.entries(SAMPLE_SIMILARITY_SCORES)) {
    const pairs: number[] = [];
    const taken = new Set<number>();
    for (let step = 0; step < SAMPLE_PLACEMENTS && taken.size < targets.length; step += 1) {
      const placed = score - step * PLACEMENT_STEP;
      if (placed < NEAR_SCORE) break;
      // Hash-picked, then moved along past any song word this one already sits on.
      let index = hash(`${word}:${step}`) % targets.length;
      while (taken.has(index)) index = (index + 1) % targets.length;
      taken.add(index);
      pairs.push(index, placed);
    }
    if (pairs.length > 0) near[word] = pairs;
  }
  return { targets, near };
}
