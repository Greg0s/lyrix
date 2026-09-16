import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { normalize } from "../src/game/normalize";
import { MAX_PROXIMITY_SCORE, NEAR_SCORE, proximityTier } from "../src/game/similarity";
import { isNumberWord } from "../src/game/tokenize";
import {
  nearTargetsFromTable,
  parseSimilarityTable,
  scoreFromTable,
  SIMILARITY_TABLE_VERSION,
} from "../worker/src/similarity";

/**
 * Prints what a built similarity table answers for a few guesses: each one's
 * score, and the song words it would be shown on, closest first. For checking a
 * table against real data after building it or tuning the scoring. It prints
 * the hidden words themselves, which the Worker never sends anywhere.
 *
 *   npm run similarity:inspect -- --song papaoutai amour papa
 *   npm run similarity:inspect -- --table data/similarity/demo.json amour
 */

const DEFAULT_TABLE_DIR = "data/similarity";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      song: { type: "string" },
      table: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help || (!values.song && !values.table) || positionals.length === 0) {
    console.log(
      [
        "usage: inspect-similarity-table (--song <id> | --table <file>) <guess> [guess…]",
        "",
        `  --song <id>      read ${DEFAULT_TABLE_DIR}/<id>.json, as written by npm run similarity:build`,
        "  --table <file>   read this table instead",
      ].join("\n")
    );
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const path = values.table ?? join(DEFAULT_TABLE_DIR, `${values.song}.json`);
  const table = parseSimilarityTable(JSON.parse(await readFile(path, "utf8")) as unknown);
  if (!table) {
    throw new Error(`${path} is not a version ${SIMILARITY_TABLE_VERSION} table, rebuild it with npm run similarity:build`);
  }
  console.log(
    `${table.songId} (${table.model}): ${Object.keys(table.scores).length} words, ` +
      `${table.targets.length} song words to point at`
  );

  for (const guess of positionals) {
    const key = normalize(guess);
    const score = scoreFromTable(table, key);
    if (isNumberWord(key)) {
      console.log(`${guess}: a number, compared by value with the song's own numbers rather than through the table`);
    } else if (score === null) {
      console.log(`${guess}: no score (unknown to the model, or a function word)`);
    } else if (score === MAX_PROXIMITY_SCORE) {
      console.log(`${guess}: in the song`);
    } else {
      const placed = nearTargetsFromTable(table, key).filter((near) => near.score >= NEAR_SCORE);
      const where = placed.length > 0 ? placed.map((near) => `${near.target} ${near.score}`).join(", ") : "nowhere";
      console.log(`${guess}: ${score} (${proximityTier({ found: false, score })}) -> ${where}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
