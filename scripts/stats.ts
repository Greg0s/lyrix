import { daysFromArgs, formatTable, runQuery, statsConfig, statsQueries } from "./lib/stats";

/**
 * `npm run stats [-- --days N]`: the last N days (7 by default) of visits
 * and play, from Workers Analytics Engine (worker/src/events.ts). Needs
 * CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, in .env or the
 * environment; says which is missing and how to get it otherwise.
 */
async function main(): Promise<void> {
  const days = daysFromArgs(process.argv.slice(2));
  const config = statsConfig(process.env);
  console.log(`Lyrix, the last ${days} day${days === 1 ? "" : "s"} (UTC)\n`);
  for (const { title, sql } of statsQueries(days)) {
    console.log(`${formatTable(title, await runQuery(sql, config))}\n`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
