import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dropKnownFalseEdges } from "./lib/graphFixes";

/**
 * Brings graphify-out/ up to date with the code: `graphify update .`
 * re-extracts every code file (AST only — free, a few seconds, no LLM), then
 * the edges graphify is known to get wrong here are dropped and the HTML view
 * re-exported from the corrected graph. Doc changes still need a semantic
 * re-extraction (`/graphify . --update` in Claude Code).
 *
 *   npm run graph:update
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const graphPath = fileURLToPath(new URL("../graphify-out/graph.json", import.meta.url));

function graphify(...args: string[]): void {
  const result = spawnSync("graphify", args, { cwd: root, stdio: "inherit" });
  if (result.error && "code" in result.error && result.error.code === "ENOENT") {
    throw new Error("graphify CLI not found on PATH — install it with `uv tool install graphifyy`");
  }
  if (result.status !== 0) {
    throw new Error(`graphify ${args.join(" ")} exited with status ${String(result.status)}`);
  }
}

graphify("update", ".");

const { graph, dropped } = dropKnownFalseEdges(JSON.parse(readFileSync(graphPath, "utf8")));
if (dropped > 0) {
  writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
  console.log(`dropped ${dropped} known false edge(s) from graphify-out/graph.json`);
  graphify("export", "html");
}
