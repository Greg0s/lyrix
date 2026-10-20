import { canaryConfig, formatResults, runCanary } from "./lib/canary";

/**
 * `npm run canary`: checks the production site and Worker (scripts/lib/canary.ts).
 * Exits 1 when a check still fails after one retry, which fails the daily
 * workflow (.github/workflows/canary.yml) and has GitHub email the owner.
 */
async function main(): Promise<void> {
  const results = await runCanary(canaryConfig(process.env));
  console.log(formatResults(results));
  if (!results.every((check) => check.ok)) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
