/**
 * Placeholder similarity scores for local development and the e2e suite.
 *
 * These numbers are hand-written, NOT produced by the embedding model: they
 * exist so the proximity UI (colours, score chips, sorting) can be exercised
 * end to end without a 200-dimension French embedding model on disk and
 * without a populated KV namespace. The same fixed table is served for every
 * song, which is fine for a UI fixture and meaningless as a real hint.
 *
 * Gated on the `SIMILARITY_SAMPLE` var, which `npm run dev:worker` passes via
 * `wrangler dev --var` and which is never set in production — so a deployment
 * without a KV namespace returns no score at all rather than fake ones. A real
 * KV table always takes precedence (see loadSimilarityTable).
 *
 * Keys must be normalized (lowercase, accent-free) like every other lookup key.
 */
export const SAMPLE_SIMILARITY_SCORES: Record<string, number> = {
  // "hot" tier (>= 60)
  chanson: 74,
  melodie: 71,
  clavecin: 71,
  refrain: 68,
  guitare: 63,
  musique: 61,
  // "warm" tier (>= 30)
  poeme: 52,
  silence: 44,
  danse: 38,
  sourire: 33,
  // "cold" tier
  tracteur: 9,
  boulon: 6,
  chlorophylle: 4,
  astrophysique: 2,
};
