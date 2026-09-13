import { fileURLToPath } from "node:url";
import { ensureFileFromExample } from "./lib/devVars";

/**
 * Runs automatically before `npm run dev:worker` (npm's `pre` hook), so the
 * local Worker always has a STATE_SECRET to sign round state with. Safe to
 * run repeatedly: an existing worker/.dev.vars is never overwritten.
 */
const example = fileURLToPath(new URL("../worker/.dev.vars.example", import.meta.url));
const target = fileURLToPath(new URL("../worker/.dev.vars", import.meta.url));

switch (ensureFileFromExample(example, target)) {
  case "created":
    console.log("created worker/.dev.vars from worker/.dev.vars.example (local dev defaults)");
    break;
  case "no-example":
    console.error("worker/.dev.vars.example is missing — the Worker has no STATE_SECRET to sign round state with");
    process.exitCode = 1;
    break;
  case "already-present":
    break;
}
