import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { catalog, FALLBACK_SONG_ID } from "../../worker/src/catalog";
import { parseSimilarityTable, SIMILARITY_TABLE_VERSION, type SimilarityTable } from "../../worker/src/similarity";

/**
 * Debug mode: playing today's song locally against a real similarity table.
 *
 * The Worker reads its tables from a KV namespace, and the configuration this
 * repository deploys binds none (see worker/wrangler.toml): production and
 * `npm run dev:all` alike answer from the placeholder table, or not at all.
 * `npm run dev:debug` (scripts/dev-debug.ts) builds the day's table,
 * loads it into a KV namespace that only exists on this machine, and starts
 * the game against it.
 *
 * Whatever the two halves of that have to agree on lives here — which
 * configuration file, which binding, which local state directory. They are two
 * separate wrangler invocations, and a table written where the Worker doesn't
 * look is silent: no error, no scores, nothing to tell them apart.
 */

/** Wrangler configuration binding SIMILARITY locally. Never deployed — see its own header. */
export const DEBUG_CONFIG = "worker/wrangler.debug.toml";

/** The binding name in both wrangler configurations, and in the Worker's SimilarityEnv. */
export const SIMILARITY_BINDING = "SIMILARITY";

/**
 * Where a loaded table lives. Deliberately not wrangler's default
 * (worker/.wrangler/state, which `npm run dev:all` keeps its cached songs in)
 * and deliberately not either of the e2e directories in playwright.config.ts:
 * the suite asserts on the placeholder's scores, so a table loaded for local
 * play must never be able to reach it. Delete this directory to forget every
 * table that was ever loaded.
 */
export const DEBUG_PERSIST_DIR = "worker/.wrangler/debug-state";

/** Where scripts/build-similarity-table.ts writes its tables. */
export const TABLE_DIR = "data/similarity";

/** Gitignored, and never filled automatically — see "Model licensing" in CLAUDE.md. */
export const MODEL_DIR = "data/models";

/** The offline builder, run through tsx exactly as `npm run similarity:build` runs it. */
export const BUILD_SCRIPT = "scripts/build-similarity-table.ts";

/** Model files worth picking up, best first: the compact form `npm run similarity:convert` writes, then raw word2vec. */
export const MODEL_EXTENSIONS = [".vecbin", ".bin", ".vec", ".txt"];

/** `wrangler dev` on the local binding. Ports left out default to wrangler's own. */
export function wranglerDevArgs(
  options: { persistTo?: string; port?: number; inspectorPort?: number; reveal?: boolean } = {}
): string[] {
  const args = [
    "dev",
    "--config",
    DEBUG_CONFIG,
    "--persist-to",
    options.persistTo ?? DEBUG_PERSIST_DIR,
  ];
  if (options.port !== undefined) args.push("--port", String(options.port));
  if (options.inspectorPort !== undefined) args.push("--inspector-port", String(options.inspectorPort));
  // No SIMILARITY_SAMPLE, on purpose: this mode exists to see the real table,
  // and a silent fall back to the placeholder would look exactly like it.
  if (options.reveal) args.push("--var", "DEV_REVEAL_LYRICS:1");
  return args;
}

/** `wrangler kv bulk put` into that same namespace: `--local`, never `--remote`. */
export function kvBulkPutArgs(bulkFile: string, persistTo: string = DEBUG_PERSIST_DIR): string[] {
  return [
    "kv",
    "bulk",
    "put",
    bulkFile,
    "--binding",
    SIMILARITY_BINDING,
    "--local",
    "--persist-to",
    persistTo,
    "--config",
    DEBUG_CONFIG,
  ];
}

/** Flags for BUILD_SCRIPT, i.e. what `npm run similarity:build --` would be given. */
export function buildTableArgs(options: { model: string; songId: string; outDir?: string }): string[] {
  return ["--model", options.model, "--song", options.songId, "--out", options.outDir ?? TABLE_DIR];
}

/** Where a built table for `songId` is written, and where --table looks by default. */
export function tablePath(songId: string, dir: string = TABLE_DIR): string {
  return join(dir, `${songId}.json`);
}

function extensionRank(file: string): number {
  const rank = MODEL_EXTENSIONS.indexOf(extname(file).toLowerCase());
  return rank === -1 ? MODEL_EXTENSIONS.length : rank;
}

/** Usable model files in `dir`, best first. Empty for a directory that doesn't exist — nobody has to have a model. */
export function modelsIn(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => extensionRank(name) < MODEL_EXTENSIONS.length)
    .sort((a, b) => extensionRank(a) - extensionRank(b) || a.localeCompare(b))
    .map((name) => join(dir, name));
}

/**
 * Where to look for a model when none was named. A worktree never has one:
 * data/ is gitignored, so the model only exists in the checkout it was
 * downloaded into — looking next door saves passing an absolute --model from
 * every worktree on the machine.
 */
export function modelSearchDirs(repoRoot: string, mainWorktree?: string | null): string[] {
  const dirs = [join(repoRoot, MODEL_DIR)];
  if (mainWorktree && resolve(mainWorktree) !== resolve(repoRoot)) dirs.push(join(mainWorktree, MODEL_DIR));
  return dirs;
}

/** The first model found across `dirs`, or null when there is none to find. */
export function findModel(dirs: readonly string[]): string | null {
  for (const dir of dirs) {
    const [best] = modelsIn(dir);
    if (best) return best;
  }
  return null;
}

export interface LoadedTable {
  path: string;
  /** The bytes as stored, so the table goes into KV exactly as it was built. */
  json: string;
  table: SimilarityTable;
}

/**
 * Reads a built table, refusing anything the Worker would refuse. Checked here
 * rather than left to the Worker, which answers an unreadable table with silence
 * — the same silence as a table that was never loaded.
 */
export async function readTableFile(path: string): Promise<LoadedTable> {
  let json: string;
  try {
    json = await readFile(path, "utf8");
  } catch {
    throw new Error(`no similarity table at ${path} — build one with npm run similarity:build`);
  }

  let table: SimilarityTable | null;
  try {
    table = parseSimilarityTable(JSON.parse(json) as unknown);
  } catch {
    table = null;
  }
  if (!table) {
    throw new Error(
      `${path} is not a version ${SIMILARITY_TABLE_VERSION} similarity table, so the Worker would ignore it — ` +
        "rebuild it with npm run similarity:build"
    );
  }
  return { path, json, table };
}

/** One `wrangler kv bulk put` payload: the same table stored under each of `songIds`. */
export function bulkEntries(json: string, songIds: readonly string[]): { key: string; value: string }[] {
  return songIds.map((key) => ({ key, value: json }));
}

/**
 * Every song id the Worker can put in play: the catalog, plus the song it falls
 * back to when LRCLIB can't be reached at all. Used to store one table under all
 * of them, so a run doesn't depend on which song today happens to be.
 */
export function everySongId(): string[] {
  return [...catalog.map((entry) => entry.id), FALLBACK_SONG_ID];
}
