import { parseArgs } from "node:util";
import { catalog, type CatalogEntry } from "../worker/src/catalog";
import { resolveFromLrclib } from "../worker/src/resolveSong";
import {
  auditSong,
  duplicateCatalogIds,
  failureAdvice,
  formatAudit,
  summarizeAudits,
  type CatalogAudit,
} from "./lib/catalogAudit";

/**
 * Asks LRCLIB for every song in the catalog, through the exact path the Worker
 * uses, and reports what comes back.
 *
 * The catalog is hand-written and LRCLIB is crowd-sourced, so an entry can stop
 * resolving without a single line of this repository changing — and no test can
 * catch that, since the unit suite mocks the network on purpose and CI has no
 * business hammering a free API. This is the scripted stand-in for checking by
 * hand: run it after editing worker/src/catalog.ts, and whenever a day's round
 * looks wrong.
 *
 *   npm run catalog:check
 *   npm run catalog:check -- --song papaoutai
 */

// LRCLIB asks clients to send requests one at a time rather than in parallel
// (https://lrclib.net/docs); this also spaces them out.
const DEFAULT_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function audit(entries: CatalogEntry[], delayMs: number): Promise<CatalogAudit[]> {
  const audits: CatalogAudit[] = [];
  for (const [index, entry] of entries.entries()) {
    if (index > 0) await sleep(delayMs);
    const result = auditSong(entry, await resolveFromLrclib(entry));
    console.log(formatAudit(result));
    audits.push(result);
  }
  return audits;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      song: { type: "string" },
      delay: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    console.log(
      [
        "usage: check-catalog [options]",
        "",
        "  --song <id>     check one catalog entry instead of all of them",
        `  --delay <ms>    pause between LRCLIB calls (default: ${DEFAULT_DELAY_MS})`,
      ].join("\n")
    );
    return;
  }

  const delayMs = values.delay ? Number(values.delay) : DEFAULT_DELAY_MS;
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error(`--delay must be a non-negative integer, got ${values.delay}`);
  }

  const duplicates = duplicateCatalogIds(catalog);
  if (duplicates.length > 0) {
    console.error(`duplicate catalog ids, which would make two entries share one round: ${duplicates.join(", ")}`);
    process.exitCode = 1;
  }

  let entries = catalog;
  if (values.song) {
    entries = catalog.filter((entry) => entry.id === values.song);
    if (entries.length === 0) throw new Error(`unknown catalog id "${values.song}" — see worker/src/catalog.ts`);
  }

  console.log(`checking ${entries.length} catalog ${entries.length === 1 ? "entry" : "entries"} against LRCLIB…`);
  const audits = await audit(entries, delayMs);
  const { resolved, failed, warned } = summarizeAudits(audits);
  console.log(`\n${resolved} resolved, ${failed} unresolved, ${warned} with warnings`);

  const advice = failureAdvice(audits);
  if (advice) {
    console.log(advice);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
