import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadEmbeddings, writeCompact } from "./lib/embeddings";

/**
 * Converts a word2vec model (text or binary) into the compact `.vecbin`
 * format the table builder reads — see scripts/lib/embeddings.ts for the
 * layout, and CLAUDE.md for where the model itself comes from.
 *
 * The conversion is what makes repeated builds cheap: rows come out already
 * L2-normalized (so scoring is a plain dot product), the vocabulary is a
 * single indexable block, and `--max-words` drops the rare tail that a word
 * game never needs.
 *
 *   npm run similarity:convert -- --input data/models/frWac_no_postag_no_phrase_200_cut100.bin \
 *                                 --output data/models/frwac.vecbin --max-words 200000
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      output: { type: "string" },
      "max-words": { type: "string" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help || !values.input || !values.output) {
    console.log("usage: convert-embeddings --input <model.bin|.vec|.txt> --output <model.vecbin> [--max-words N]");
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const maxWords = values["max-words"] ? Number(values["max-words"]) : undefined;
  if (maxWords !== undefined && (!Number.isInteger(maxWords) || maxWords <= 0)) {
    throw new Error(`--max-words must be a positive integer, got ${values["max-words"]}`);
  }

  console.log(`reading ${values.input}…`);
  const model = await loadEmbeddings(values.input, { maxWords });
  console.log(`  ${model.words.length} words, ${model.dim} dimensions`);

  await mkdir(dirname(values.output), { recursive: true });
  await writeCompact(values.output, model);
  const { size } = await stat(values.output);
  console.log(`wrote ${values.output} (${(size / 1_000_000).toFixed(1)} MB)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
