import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { songWordKeys } from "../src/game/mask";
import type { Song } from "../src/game/types";
import { catalog, pickDailyEntry, type CatalogEntry } from "../worker/src/catalog";
import { parseSections } from "../worker/src/lyrics";
import { resolveFromLrclib } from "../worker/src/resolveSong";
import { SIMILARITY_TABLE_VERSION, type SimilarityTable } from "../worker/src/similarity";
import { loadEmbeddings } from "./lib/embeddings";
import { buildSimilarityScores } from "./lib/similarityTable";
import { indexByKey, selectReferenceKeys } from "./lib/vocabulary";

/**
 * Builds the precomputed similarity table(s) the Worker reads from KV.
 *
 * This is the only place embeddings are ever loaded: it runs offline, on a
 * developer machine, when a song enters the catalog — never per guess, and
 * never inside the Worker. See CLAUDE.md ("Semantic proximity scoring") for
 * the full pipeline and the KV upload command.
 *
 *   npm run similarity:build -- --model data/models/frwac.vecbin --all
 *   npm run similarity:build -- --model data/models/frwac.vecbin --song papaoutai
 *   npm run similarity:build -- --model data/models/frwac.vecbin --song demo --lyrics ./demo.txt
 */

const DEFAULT_MAX_VOCABULARY = 50_000;
const DEFAULT_OUT_DIR = "data/similarity";

interface BuildOptions {
  modelPath: string;
  modelId: string;
  vocabularyPath?: string;
  maxVocabulary: number;
  outDir: string;
  bulk: boolean;
}

async function readVocabulary(path: string): Promise<string[]> {
  const content = await readFile(path, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim().split(/[\s,;\t]/)[0] ?? "")
    .filter((word) => word.length > 0);
}

function catalogEntry(id: string): CatalogEntry {
  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`unknown catalog id "${id}" — see worker/src/catalog.ts`);
  return entry;
}

/** A local lyrics file, so a table can be built (and the pipeline exercised) without going out to LRCLIB. */
async function songFromLyricsFile(id: string, path: string): Promise<Song> {
  const text = await readFile(path, "utf8");
  const sections = parseSections(text);
  if (sections.length === 0) throw new Error(`${path} holds no usable lyrics`);
  // The first line doubles as the title, matching how a catalog entry pairs a
  // title with its lyrics.
  const title = sections[0].lines[0];
  return { id, title, artist: "unknown", sections };
}

async function resolveSongs(values: { song?: string; all?: boolean; lyrics?: string }): Promise<Song[]> {
  if (values.lyrics) {
    if (!values.song) throw new Error("--lyrics also needs --song <id>");
    return [await songFromLyricsFile(values.song, values.lyrics)];
  }

  const wanted = values.all ? catalog : [catalogEntry(values.song ?? pickDailyEntry().id)];
  const songs: Song[] = [];
  for (const entry of wanted) {
    // Sequential on purpose: LRCLIB asks clients not to fire parallel requests.
    const song = await resolveFromLrclib(entry);
    if (!song) {
      console.warn(`  ! ${entry.id}: no lyrics resolved, skipping`);
      continue;
    }
    songs.push(song);
  }
  if (songs.length === 0) throw new Error("no songs could be resolved");
  return songs;
}

async function build(songs: Song[], options: BuildOptions): Promise<void> {
  console.log(`reading ${options.modelPath}…`);
  const model = await loadEmbeddings(options.modelPath);
  console.log(`  ${model.words.length} words, ${model.dim} dimensions`);

  const index = indexByKey(model.words);
  const vocabulary = options.vocabularyPath ? await readVocabulary(options.vocabularyPath) : undefined;
  await mkdir(options.outDir, { recursive: true });

  const bulk: { key: string; value: string }[] = [];
  for (const song of songs) {
    const targetKeys = [...songWordKeys(song)];
    const referenceKeys = selectReferenceKeys(index, {
      words: vocabulary,
      maxWords: options.maxVocabulary,
      required: targetKeys,
    });

    const started = Date.now();
    const { scores, missingTargets } = buildSimilarityScores({ model, index, targetKeys, referenceKeys });
    const table: SimilarityTable = {
      version: SIMILARITY_TABLE_VERSION,
      songId: song.id,
      model: options.modelId,
      scores,
    };

    const serialized = JSON.stringify(table);
    await writeFile(join(options.outDir, `${song.id}.json`), serialized);
    bulk.push({ key: song.id, value: serialized });

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `${song.id}: ${Object.keys(scores).length} words, ${targetKeys.length} targets ` +
        `(${missingTargets.length} unknown to the model), ${(serialized.length / 1000).toFixed(0)} kB, ${seconds}s`
    );
  }

  if (options.bulk) {
    const path = join(options.outDir, "bulk.json");
    await writeFile(path, JSON.stringify(bulk));
    console.log(`wrote ${path} — upload with: npx wrangler kv bulk put ${path} --binding SIMILARITY --remote`);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      "model-id": { type: "string" },
      song: { type: "string" },
      all: { type: "boolean", default: false },
      lyrics: { type: "string" },
      vocabulary: { type: "string" },
      "max-vocabulary": { type: "string" },
      out: { type: "string" },
      bulk: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help || !values.model) {
    console.log(
      [
        "usage: build-similarity-table --model <model.vecbin|.bin|.vec> [options]",
        "",
        "  --song <id>            build one catalog song (default: today's pick)",
        "  --all                  build every song in the catalog",
        "  --lyrics <file>        use a local lyrics file instead of LRCLIB (needs --song)",
        "  --vocabulary <file>    reference word list, one word per line (default: the model's own frequency order)",
        `  --max-vocabulary <n>   reference words to keep (default: ${DEFAULT_MAX_VOCABULARY})`,
        `  --out <dir>            output directory (default: ${DEFAULT_OUT_DIR})`,
        "  --model-id <name>      model name recorded in the table (default: the model file name)",
        "  --bulk                 also write bulk.json, ready for `wrangler kv bulk put`",
      ].join("\n")
    );
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const maxVocabulary = values["max-vocabulary"] ? Number(values["max-vocabulary"]) : DEFAULT_MAX_VOCABULARY;
  if (!Number.isInteger(maxVocabulary) || maxVocabulary <= 0) {
    throw new Error(`--max-vocabulary must be a positive integer, got ${values["max-vocabulary"]}`);
  }

  const songs = await resolveSongs(values);
  await build(songs, {
    modelPath: values.model,
    modelId: values["model-id"] ?? basename(values.model),
    vocabularyPath: values.vocabulary,
    maxVocabulary,
    outDir: values.out ?? DEFAULT_OUT_DIR,
    bulk: values.bulk,
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
