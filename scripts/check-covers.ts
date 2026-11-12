import { parseArgs } from "node:util";
import { catalog } from "../worker/src/catalog";
import { bestDeezerMatch, searchDeezer } from "../worker/src/deezer";

/**
 * Asks Deezer for every catalog song, through the exact lookup the Worker
 * uses (worker/src/deezer.ts), and says which track and cover it would keep.
 * The suite mocks the network on purpose, so this is how a new month of the
 * catalog is checked for covers, like `npm run catalog:check` for lyrics.
 * A song with none still plays: its victory panel shows the year alone.
 *
 *   npm run covers:check
 *   npm run covers:check -- --song papaoutai
 */

// Deezer allows 50 requests every 5 seconds; this stays well under it.
const DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { song: { type: "string" } } });
  const entries = values.song ? catalog.filter((entry) => entry.id === values.song) : catalog;
  if (entries.length === 0) throw new Error(`unknown catalog id "${values.song}" — see worker/src/catalog.ts`);

  let missing = 0;
  for (const [index, entry] of entries.entries()) {
    if (index > 0) await sleep(DELAY_MS);
    const track = bestDeezerMatch(await searchDeezer(entry), entry);
    if (track?.cover) {
      console.log(`ok    ${entry.id}: "${track.title}" by ${track.artist} (track ${track.id}) ${track.cover}`);
    } else {
      missing += 1;
      console.log(`none  ${entry.id}: ${track ? `track ${track.id} has no cover` : "no track by this artist"}`);
    }
  }
  console.log(`\n${entries.length - missing} with a cover, ${missing} without`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
