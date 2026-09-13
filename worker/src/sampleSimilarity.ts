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

  // "warm" tier (>= 30): neighbouring arts and lyrical imagery
  tambourin: 59,
  opera: 58,
  poeme: 56,
  poesie: 55,
  rime: 54,
  danse: 52,
  ballet: 47,
  theatre: 48,
  roman: 45,
  silence: 44,
  peinture: 42,
  aquarelle: 40,
  cinema: 38,
  sculpture: 36,
  calligraphie: 34,
  sourire: 33,

  // "cold" tier (< 30): mundane, technical, administrative
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
