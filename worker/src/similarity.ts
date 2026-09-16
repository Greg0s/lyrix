import { songNumberKeys } from "../../src/game/mask";
import { clampScore, NEAR_SCORE, numberProximityScore } from "../../src/game/similarity";
import { wordPositions } from "../../src/game/slots";
import { isNumberWord } from "../../src/game/tokenize";
import type { NearSlot, Song } from "../../src/game/types";
import { SAMPLE_SIMILARITY_SCORES, sampleNearTable } from "./sampleSimilarity";

/**
 * Precomputed per-song similarity tables, read from Workers KV.
 *
 * Nothing is computed here: the whole point of the design is that the
 * embedding maths happens offline (scripts/build-similarity-table.ts) and the
 * request path is a single KV read plus a couple of property lookups. See
 * CLAUDE.md ("Semantic proximity scoring") for the pipeline. The one thing
 * worked out per guess is how close a guessed number is to the song's own
 * numbers, which is arithmetic, not embeddings (see numberHint).
 */

/** Bump whenever the stored shape, or what its scores mean, changes, so stale tables are ignored rather than misread. */
export const SIMILARITY_TABLE_VERSION = 3;

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
  /** Normalized word -> 0-100 score. Tens of thousands of entries in production. */
  scores: Record<string, number>;
  /** The song words `near` points at, by index: each one is written once, however many words are close to it. */
  targets: string[];
  /**
   * Normalized word -> the song words it is close to, as flat
   * [targetIndex, score, targetIndex, score, …] pairs, closest first, each
   * score at least NEAR_SCORE. A word close to no song word has no entry, and
   * neither do the song's own words (guessing one reveals it) nor function
   * words (see src/game/functionWords.ts).
   */
  near: Record<string, number[]>;
}

/** What a missed guess is told: how close it is overall, and which hidden words it is close to. */
export interface ProximityHint {
  score: number | null;
  near: NearSlot[];
}

/** A song word a table says a guess is close to. Worker and tooling only: `target` is exactly what the player is looking for. */
export interface NearTarget {
  target: string;
  score: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSimilarityTable(value: unknown): SimilarityTable | null {
  if (!isRecord(value)) return null;
  if (value.version !== SIMILARITY_TABLE_VERSION) return null;
  if (typeof value.songId !== "string") return null;
  if (!isRecord(value.scores) || !isRecord(value.near)) return null;
  // A few hundred song words at most, so they are checked whole, unlike the maps.
  const targets: unknown = value.targets;
  if (!Array.isArray(targets) || !targets.every((target: unknown) => typeof target === "string")) return null;

  return {
    version: SIMILARITY_TABLE_VERSION,
    songId: value.songId,
    model: typeof value.model === "string" ? value.model : "unknown",
    // Entries are validated lazily on lookup instead of up front: a production
    // table holds ~50k words and walking it on every guess would defeat the
    // "no work in the hot path" design.
    scores: value.scores as Record<string, number>,
    targets: targets as string[],
    near: value.near as Record<string, number[]>,
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
      `Those scoring ${NEAR_SCORE} or more also show up in place of a few hidden words, picked arbitrarily. ` +
      "A number is compared by value with the song's numbers, if it has any. " +
      "Anything else scores null, and a word that is in the lyrics is revealed instead."
  );
}

/**
 * A bound namespace with nothing usable in it for the song in play is the one
 * failure this feature cannot show: every guess simply comes back unscored,
 * exactly as if scoring were switched off. So it says so itself, once per song
 * per isolate, rather than leaving it to be guessed from silence.
 */
const announcedTables = new Set<string>();

function announceTableProblem(songId: string, problem: string): void {
  if (announcedTables.has(songId)) return;
  announcedTables.add(songId);
  console.warn(
    `similarity: ${problem} Guesses for it come back without a score. ` +
      "Locally, npm run dev:similarity builds today's table and loads it; " +
      "for production, npm run similarity:build then wrangler kv bulk put --remote (see CLAUDE.md)."
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

/** Drops the isolate's parsed table, and what it has already said about it. For tests; production relies on the TTLs above. */
export function resetSimilarityMemo(): void {
  memoized = null;
  announcedTables.clear();
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
    if (raw === null) {
      announceTableProblem(song.id, `the SIMILARITY namespace holds no table for "${song.id}".`);
    } else {
      let stored: SimilarityTable | null;
      try {
        stored = parseSimilarityTable(JSON.parse(raw) as unknown);
      } catch {
        stored = null;
      }
      if (stored) return stored;
      // A table that can't be read is not a reason to serve the placeholder in
      // its place: a wrong score is worse than none, and the log says which.
      announceTableProblem(
        song.id,
        `the table stored for "${song.id}" isn't a readable version ${SIMILARITY_TABLE_VERSION} table, so it is ignored.`
      );
      return null;
    }
  }

  if (env.SIMILARITY_SAMPLE === "1") {
    announceSampleMode();
    return {
      version: SIMILARITY_TABLE_VERSION,
      songId: song.id,
      model: "sample",
      scores: SAMPLE_SIMILARITY_SCORES,
      ...sampleNearTable(song),
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

/** The song words a table says `key` is close to, closest first, with any malformed pair dropped. */
export function nearTargetsFromTable(table: SimilarityTable | null, key: string): NearTarget[] {
  if (!table || !Object.prototype.hasOwnProperty.call(table.near, key)) return [];
  const pairs: unknown = table.near[key];
  if (!Array.isArray(pairs)) return [];

  const targets: NearTarget[] = [];
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const index: unknown = pairs[i];
    const raw: unknown = pairs[i + 1];
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= table.targets.length) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    targets.push({ target: table.targets[index], score: clampScore(raw) });
  }
  return targets;
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
  const targets = nearTargetsFromTable(table, key);
  if (targets.length === 0) return [];

  // Only built for a guess that has somewhere to go.
  const positions = wordPositions(song);
  const slots: NearSlot[] = [];
  for (const { target, score } of targets) {
    // Checked again here, not only at build time, so raising NEAR_SCORE needs no rebuild.
    if (score < NEAR_SCORE || foundKeys.has(target)) continue;
    // A target the song doesn't hold (its lyrics changed on LRCLIB since the
    // table was built) simply has no position to point at.
    for (const position of positions.get(target) ?? []) slots.push({ position, score });
  }
  return slots.sort((a, b) => a.position - b.position);
}

/**
 * The hint for a guessed number. The model behind the tables has no vector for
 * "2015", so a number is compared by value with the song's own numbers instead
 * (see numberProximityScore): a list worked out once per song, a handful of
 * entries at most, and plain arithmetic per guess. `null` when the song has no
 * number to compare with, like any word the table doesn't cover.
 */
export function numberHint(song: Song, key: string, foundKeys: ReadonlySet<string>): ProximityHint {
  const numbers = songNumberKeys(song);
  if (numbers.length === 0) return { score: null, near: [] };

  const positions = wordPositions(song);
  let score = 0;
  const near: NearSlot[] = [];
  for (const target of numbers) {
    const closeness = numberProximityScore(key, target);
    score = Math.max(score, closeness);
    if (closeness < NEAR_SCORE || foundKeys.has(target)) continue;
    for (const position of positions.get(target) ?? []) near.push({ position, score: closeness });
  }
  return { score, near: near.sort((a, b) => a.position - b.position) };
}

/** One KV read per guess, for both halves of the hint. */
export async function proximityHint(
  env: SimilarityEnv,
  song: Song,
  key: string,
  foundKeys: ReadonlySet<string>
): Promise<ProximityHint> {
  const table = await loadSimilarityTable(env, song);
  // No table, no hint of any kind, numbers included: the feature is simply off.
  if (!table) return { score: null, near: [] };
  if (isNumberWord(key)) return numberHint(song, key, foundKeys);
  return { score: scoreFromTable(table, key), near: nearSlotsFromTable(table, key, song, foundKeys) };
}
