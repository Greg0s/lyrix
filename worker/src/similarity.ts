import { clampScore, NEAR_SCORE } from "../../src/game/similarity";
import { wordPositions } from "../../src/game/slots";
import type { NearSlot, Song } from "../../src/game/types";
import { SAMPLE_SIMILARITY_SCORES, sampleNearTable } from "./sampleSimilarity";

/**
 * Precomputed per-song similarity tables, read from Workers KV.
 *
 * Nothing is computed here: the whole point of the design is that the
 * embedding maths happens offline (scripts/build-similarity-table.ts) and the
 * request path is a single KV read plus a couple of property lookups. See
 * CLAUDE.md ("Semantic proximity scoring") for the pipeline.
 */

/** Bump whenever the stored shape changes, so stale tables are ignored rather than misread. */
export const SIMILARITY_TABLE_VERSION = 2;

/** The slice of a Workers `KVNamespace` we use — narrow on purpose, so tests can pass a plain fake. */
export interface SimilarityKv {
  get(key: string, options?: { cacheTtl?: number }): Promise<string | null>;
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
  /**
   * Normalized word -> the song words it is close to, each with its own 0-100
   * score (at least NEAR_SCORE, closest first, a few at most). A word close to
   * no song word has no entry, and neither do the song's own words: guessing
   * one reveals it instead.
   */
  near: Record<string, Record<string, number>>;
}

/** What a missed guess is told: how close it is overall, and which hidden words it is close to. */
export interface ProximityHint {
  score: number | null;
  near: NearSlot[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSimilarityTable(value: unknown): SimilarityTable | null {
  if (!isRecord(value)) return null;
  if (value.version !== SIMILARITY_TABLE_VERSION) return null;
  if (typeof value.songId !== "string") return null;
  if (!isRecord(value.scores) || !isRecord(value.near)) return null;

  return {
    version: SIMILARITY_TABLE_VERSION,
    songId: value.songId,
    model: typeof value.model === "string" ? value.model : "unknown",
    // Entries are validated lazily on lookup instead of up front: a production
    // table holds ~50k words and walking it on every guess would defeat the
    // "no work in the hot path" design.
    scores: value.scores as Record<string, number>,
    near: value.near as Record<string, Record<string, number>>,
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
      `Those scoring ${NEAR_SCORE} or more also show up in place of one or two hidden words, picked arbitrarily. ` +
      "Anything else scores null, and a word that is in the lyrics is revealed instead."
  );
}

/**
 * How long KV may answer a read from the colo's cache instead of going to a
 * central store. Tables are rebuilt only when a song joins the catalog, so an
 * hour costs nothing and spares a cold isolate the slow path.
 */
const KV_CACHE_TTL_SECONDS = 3600;

/**
 * How long this isolate keeps a table it has already parsed. A production
 * table holds tens of thousands of entries, and JSON.parse of the whole thing
 * ran on *every* guess — by far the most expensive thing in the request path,
 * for a value that is the same for every player all day. Kept short enough
 * that re-uploading a table still takes effect the same session.
 */
const TABLE_MEMO_TTL_MS = 5 * 60 * 1000;

/**
 * A miss is remembered too, so a song with no table doesn't pay a KV read per
 * guess — but only briefly, so a table uploaded mid-round shows up quickly.
 */
const MISS_MEMO_TTL_MS = 60 * 1000;

interface MemoizedTable {
  /**
   * What the entry was produced from. Deliberately *not* the binding object
   * itself: a Worker has one SIMILARITY namespace, so identity would add no
   * safety in production, and keying on it would silently disable the memo for
   * good if the runtime ever handed out a fresh binding object per request.
   * Tests get their isolation from resetSimilarityMemo() instead.
   */
  bound: boolean;
  sample: boolean;
  songId: string;
  table: SimilarityTable | null;
  expiresAt: number;
}

// One slot: a given day has one song in play, so anything more would only hold
// on to tables nobody is going to ask for again.
let memoized: MemoizedTable | null = null;

/** Drops the isolate's parsed table. For tests; production relies on the TTLs above. */
export function resetSimilarityMemo(): void {
  memoized = null;
}

function memoizedFor(env: SimilarityEnv, song: Song, now: number): MemoizedTable | null {
  if (!memoized || memoized.expiresAt <= now) return null;
  if (memoized.songId !== song.id) return null;
  if (memoized.bound !== (env.SIMILARITY !== undefined)) return null;
  if (memoized.sample !== (env.SIMILARITY_SAMPLE === "1")) return null;
  return memoized;
}

async function readTable(env: SimilarityEnv, song: Song): Promise<SimilarityTable | null> {
  if (env.SIMILARITY) {
    let raw: string | null;
    try {
      raw = await env.SIMILARITY.get(song.id, { cacheTtl: KV_CACHE_TTL_SECONDS });
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
    return {
      version: SIMILARITY_TABLE_VERSION,
      songId: song.id,
      model: "sample",
      scores: SAMPLE_SIMILARITY_SCORES,
      near: sampleNearTable(song),
    };
  }
  return null;
}

/** Never throws: a KV hiccup or a malformed table degrades to "no score", never to a failed guess. */
export async function loadSimilarityTable(env: SimilarityEnv, song: Song): Promise<SimilarityTable | null> {
  const now = Date.now();
  const hit = memoizedFor(env, song, now);
  if (hit) return hit.table;

  const table = await readTable(env, song);
  memoized = {
    bound: env.SIMILARITY !== undefined,
    sample: env.SIMILARITY_SAMPLE === "1",
    songId: song.id,
    table,
    expiresAt: now + (table ? TABLE_MEMO_TTL_MS : MISS_MEMO_TTL_MS),
  };
  return table;
}

/** `null` for a word the table doesn't cover, so the UI can tell "far away" from "unknown word". */
export function scoreFromTable(table: SimilarityTable | null, key: string): number | null {
  if (!table) return null;
  if (!Object.prototype.hasOwnProperty.call(table.scores, key)) return null;
  const raw = table.scores[key];
  return typeof raw === "number" && Number.isFinite(raw) ? clampScore(raw) : null;
}

/**
 * Where a missed guess shows up: every position of every still-hidden song
 * word the table says it is close to, in reading order. Only positions and
 * numbers come out — which word sits at a position is exactly what the player
 * is trying to find.
 */
export function nearSlotsFromTable(
  table: SimilarityTable | null,
  key: string,
  song: Song,
  foundKeys: ReadonlySet<string>
): NearSlot[] {
  if (!table || !Object.prototype.hasOwnProperty.call(table.near, key)) return [];
  const targets: unknown = table.near[key];
  if (!isRecord(targets)) return [];

  // Only built for a guess that has somewhere to go, which most don't.
  const positions = wordPositions(song);
  const slots: NearSlot[] = [];
  for (const [target, raw] of Object.entries(targets)) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const score = clampScore(raw);
    // Checked again here, not only at build time, so raising NEAR_SCORE needs no rebuild.
    if (score < NEAR_SCORE || foundKeys.has(target)) continue;
    // A target the song doesn't hold (its lyrics changed on LRCLIB since the
    // table was built) simply has no position to point at.
    for (const position of positions.get(target) ?? []) slots.push({ position, score });
  }
  return slots.sort((a, b) => a.position - b.position);
}

/** One KV read per guess, for both halves of the hint. */
export async function proximityHint(
  env: SimilarityEnv,
  song: Song,
  key: string,
  foundKeys: ReadonlySet<string>
): Promise<ProximityHint> {
  const table = await loadSimilarityTable(env, song);
  return { score: scoreFromTable(table, key), near: nearSlotsFromTable(table, key, song, foundKeys) };
}
