import { clampScore } from "../../src/game/similarity";
import { SAMPLE_SIMILARITY_SCORES } from "./sampleSimilarity";

/**
 * Precomputed per-song similarity tables, read from Workers KV.
 *
 * Nothing is computed here: the whole point of the design is that the
 * embedding maths happens offline (scripts/build-similarity-table.ts) and the
 * request path is a single KV read plus one property lookup. See CLAUDE.md
 * ("Semantic proximity scoring") for the pipeline.
 */

/** Bump whenever the stored shape changes, so stale tables are ignored rather than misread. */
export const SIMILARITY_TABLE_VERSION = 1;

/** The slice of a Workers `KVNamespace` we use — narrow on purpose, so tests can pass a plain fake. */
export interface SimilarityKv {
  get(key: string): Promise<string | null>;
}

export interface SimilarityEnv {
  /** Optional: when the namespace isn't bound, guesses simply come back without a score. */
  SIMILARITY?: SimilarityKv;
  /** Dev/e2e only — see sampleSimilarity.ts. Never set in production. */
  SIMILARITY_SAMPLE?: string;
}

export interface SimilarityTable {
  version: number;
  songId: string;
  /** Identifier of the embedding model the table was built from, for traceability. */
  model: string;
  /** Normalized word -> 0-100 score. Hundreds of thousands of entries in production. */
  scores: Record<string, number>;
}

export function parseSimilarityTable(value: unknown): SimilarityTable | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== SIMILARITY_TABLE_VERSION) return null;
  if (typeof candidate.songId !== "string") return null;
  if (typeof candidate.scores !== "object" || candidate.scores === null || Array.isArray(candidate.scores)) return null;

  return {
    version: SIMILARITY_TABLE_VERSION,
    songId: candidate.songId,
    model: typeof candidate.model === "string" ? candidate.model : "unknown",
    // Entries are validated lazily on lookup instead of up front: a production
    // table holds ~50k words and walking it on every guess would defeat the
    // "no work in the hot path" design.
    scores: candidate.scores as Record<string, number>,
  };
}

// Dev-only, once per isolate: without this, the placeholder table's handful of
// scored words is only discoverable by reading sampleSimilarity.ts, and every
// other guess looks like the feature is broken rather than out of vocabulary.
let sampleModeAnnounced = false;

function announceSampleMode(): void {
  if (sampleModeAnnounced) return;
  sampleModeAnnounced = true;
  console.log(
    "similarity: SIMILARITY_SAMPLE is on — placeholder scores, not real embeddings. " +
      `Words that carry a score: ${Object.keys(SAMPLE_SIMILARITY_SCORES).join(", ")}. ` +
      "Anything else scores null, and a word that is in the lyrics is revealed instead."
  );
}

/** Never throws: a KV hiccup or a malformed table degrades to "no score", never to a failed guess. */
export async function loadSimilarityTable(env: SimilarityEnv, songId: string): Promise<SimilarityTable | null> {
  if (env.SIMILARITY) {
    let raw: string | null;
    try {
      raw = await env.SIMILARITY.get(songId);
    } catch {
      return null;
    }
    if (raw !== null) {
      try {
        return parseSimilarityTable(JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    }
  }

  if (env.SIMILARITY_SAMPLE === "1") {
    announceSampleMode();
    return { version: SIMILARITY_TABLE_VERSION, songId, model: "sample", scores: SAMPLE_SIMILARITY_SCORES };
  }
  return null;
}

/** `null` for a word the table doesn't cover, so the UI can tell "far away" from "unknown word". */
export function scoreFromTable(table: SimilarityTable | null, key: string): number | null {
  if (!table) return null;
  if (!Object.prototype.hasOwnProperty.call(table.scores, key)) return null;
  const raw = table.scores[key];
  return typeof raw === "number" && Number.isFinite(raw) ? clampScore(raw) : null;
}

export async function proximityScore(env: SimilarityEnv, songId: string, key: string): Promise<number | null> {
  return scoreFromTable(await loadSimilarityTable(env, songId), key);
}
