import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dropKnownFalseEdges } from "./lib/graphFixes";
import { seedGraphFromSemanticCache } from "./lib/graphSeed";

/**
 * Rebuilds graphify-out/ from committed inputs only: graph.json is seeded
 * with the semantic cache (the LLM extraction of the docs), then
 * `graphify update .` adds every code file (AST only — free, a few seconds,
 * no LLM), then the edges graphify is known to get wrong here are dropped and
 * the HTML view re-exported from the corrected graph. The outputs are
 * machine-local and not committed. Doc changes still need a semantic
 * re-extraction (`/graphify . --update` in Claude Code), whose cache is.
 *
 *   npm run graph:update
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "graphify-out");
const graphPath = join(outDir, "graph.json");
const semanticCacheDir = join(outDir, "cache", "semantic");

function graphify(...args: string[]): void {
  const result = spawnSync("graphify", args, { cwd: root, stdio: "inherit" });
  if (result.error && "code" in result.error && result.error.code === "ENOENT") {
    throw new Error("graphify CLI not found on PATH — install it with `uv tool install graphifyy`");
  }
  if (result.status !== 0) {
    throw new Error(`graphify ${args.join(" ")} exited with status ${String(result.status)}`);
  }
}

function readSemanticCache(): Map<string, unknown> {
  const entries = new Map<string, unknown>();
  if (!existsSync(semanticCacheDir)) return entries;
  for (const file of readdirSync(semanticCacheDir, { recursive: true, encoding: "utf8" })) {
    if (!file.endsWith(".json")) continue;
    entries.set(file, JSON.parse(readFileSync(join(semanticCacheDir, file), "utf8")));
  }
  return entries;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(graphPath, `${JSON.stringify(seedGraphFromSemanticCache(readSemanticCache()))}\n`);

graphify("update", ".");

const { graph, dropped } = dropKnownFalseEdges(JSON.parse(readFileSync(graphPath, "utf8")));
if (dropped > 0) {
  writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
  console.log(`dropped ${dropped} known false edge(s) from graphify-out/graph.json`);
  graphify("export", "html");
}
