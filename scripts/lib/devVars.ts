import { copyFileSync, existsSync } from "node:fs";

/**
 * Creating the Worker's local `.dev.vars` from its committed example.
 *
 * `worker/.dev.vars` is gitignored (it is where STATE_SECRET lives in local
 * dev), so a fresh clone never has it — and without it `wrangler dev` boots
 * fine and then fails every request deep inside Web Crypto with an opaque
 * "Imported HMAC key length (0)" DataError. That has cost real time twice
 * (once in CI, once locally, see docs/LEARNINGS.md), so the copy is scripted
 * rather than left as a step in the README for a human to remember.
 *
 * Node's own fs rather than `cp`: contributors are on Windows too.
 */
export type EnsureResult = "created" | "already-present" | "no-example";

export function ensureFileFromExample(examplePath: string, targetPath: string): EnsureResult {
  if (existsSync(targetPath)) return "already-present";
  if (!existsSync(examplePath)) return "no-example";
  copyFileSync(examplePath, targetPath);
  return "created";
}
