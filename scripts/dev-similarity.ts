import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { pickDailyEntry } from "../worker/src/catalog";
import { ensureFileFromExample } from "./lib/devVars";
import {
  buildTableArgs,
  BUILD_SCRIPT,
  bulkEntries,
  everySongId,
  findModel,
  kvBulkPutArgs,
  LOCAL_SIMILARITY_PERSIST_DIR,
  modelSearchDirs,
  readTableFile,
  tablePath,
  wranglerDevArgs,
  type LoadedTable,
} from "./lib/localSimilarity";

/**
 * Plays today's song locally against a real similarity table, in one command:
 * builds the table for the day's song, loads it into a KV namespace that only
 * exists on this machine, and starts Vite and the Worker against it.
 *
 *   npm run dev:similarity
 *   npm run dev:similarity -- --model data/models/frwac.vecbin
 *   npm run dev:similarity -- --table data/similarity/papaoutai.json --reveal
 *
 * None of it is ever deployed: the binding lives in its own wrangler
 * configuration (see scripts/lib/localSimilarity.ts). Without a model this
 * command says so and stops - npm run dev:all is the one that needs nothing,
 * and plays the same game on placeholder scores.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const resolveFrom = createRequire(import.meta.url);

interface PackageManifest {
  bin?: string | Record<string, string>;
}

/**
 * A dependency's CLI entry point, taken from its own manifest: both of these
 * are run as `node <script>` rather than through node_modules/.bin, which is a
 * shell shim on Windows and needs a shell to spawn.
 */
function binOf(packageName: string, binName: string = packageName): string {
  const manifestPath = resolveFrom.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[binName];
  if (bin === undefined) throw new Error(`${packageName} ships no ${binName} command to run`);
  return join(dirname(manifestPath), bin);
}

const WRANGLER = binOf("wrangler");
const VITE = binOf("vite");

// wrangler's and Vite's own defaults, so this mode opens on the address
// npm run dev:all uses - and collides with it rather than quietly running beside it.
const DEFAULT_WEB_PORT = 5173;
const DEFAULT_WORKER_PORT = 8787;
const DEFAULT_INSPECTOR_PORT = 9229;

const USAGE = [
  "usage: dev-similarity [options]",
  "",
  "Builds today's similarity table, loads it into a local-only KV namespace, and",
  "starts the game against it. It needs an embedding model (see CLAUDE.md); without",
  "one, npm run dev:all plays the same game on placeholder scores.",
  "",
  "  --model <file>        model to build today's table from",
  "                        (default: the first one in data/models, here or in the main checkout)",
  "  --table <file>        load this already-built table instead of building one",
  "  --reveal              show every hidden word faintly, as npm run dev:all does",
  "  --worker-only         start the API alone, without the Vite dev server",
  "  --every-song          store the table under every song id, not just today's (the e2e suite does this)",
  `  --web-port <n>        Vite port (default ${DEFAULT_WEB_PORT})`,
  `  --port <n>            Worker port (default ${DEFAULT_WORKER_PORT})`,
  `  --inspector-port <n>  Worker inspector port (default ${DEFAULT_INSPECTOR_PORT})`,
  `  --persist-to <dir>    local state directory (default ${LOCAL_SIMILARITY_PERSIST_DIR})`,
].join("\n");

function port(value: string | undefined, fallback: number, flag: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`${flag} must be a port number, got ${value}`);
  }
  return parsed;
}

/** Runs a command to completion, its output going straight to this terminal. */
function run(file: string, args: string[], label: string): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(file, args, { cwd: REPO_ROOT, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolveRun() : reject(new Error(`${label} failed (exit code ${code})`))));
  });
}

/**
 * The copy npm run dev:worker gets from its predev hook. This command starts
 * wrangler itself, so it does the copy itself too: without it the Worker fails
 * every request deep inside Web Crypto, saying nothing about the missing file
 * (see docs/LEARNINGS.md).
 */
function ensureDevVars(): void {
  const example = join(REPO_ROOT, "worker/.dev.vars.example");
  const target = join(REPO_ROOT, "worker/.dev.vars");
  const result = ensureFileFromExample(example, target);
  if (result === "created") console.log("created worker/.dev.vars from worker/.dev.vars.example (local dev defaults)");
  if (result === "no-example") {
    throw new Error("worker/.dev.vars.example is missing - the Worker has no STATE_SECRET to sign round state with");
  }
}

/** The checkout the repository was cloned into: where data/models lives, since worktrees never have it. */
function mainWorktree(): string | null {
  try {
    const listed = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const first = listed.split("\n").find((line) => line.startsWith("worktree "));
    return first ? first.slice("worktree ".length).trim() : null;
  } catch {
    return null;
  }
}

async function buildTodaysTable(songId: string, model: string | undefined): Promise<LoadedTable> {
  const searched = modelSearchDirs(REPO_ROOT, mainWorktree());
  const chosen = model ?? findModel(searched);
  if (!chosen) {
    throw new Error(
      [
        "no embedding model found, so today's table can't be built.",
        `  looked in: ${searched.join(", ")}`,
        "  name one with:  npm run dev:similarity -- --model <model.vecbin|.bin>",
        `  or play a table you already built:  npm run dev:similarity -- --table ${tablePath(songId)}`,
        '  a model is never downloaded automatically - see "Semantic Proximity Scoring" in CLAUDE.md.',
        "  npm run dev:all needs none of this: it plays the same game on placeholder scores.",
      ].join("\n")
    );
  }

  console.log(`building today's table from ${chosen}...`);
  const args = ["--import", "tsx", BUILD_SCRIPT, ...buildTableArgs({ model: chosen, songId })];
  await run(process.execPath, args, "similarity:build");
  return readTableFile(tablePath(songId));
}

async function loadIntoLocalKv(json: string, songIds: readonly string[], persistTo: string): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "lyrix-kv-"));
  const bulkFile = join(directory, "bulk.json");
  try {
    await writeFile(bulkFile, JSON.stringify(bulkEntries(json, songIds)));
    await run(process.execPath, [WRANGLER, ...kvBulkPutArgs(bulkFile, persistTo)], "wrangler kv bulk put");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Refuses to start on a port something else already holds. Sliding to the next
 * one is how an e2e run once tested another checkout's code (docs/LEARNINGS.md):
 * a frontend that moved on still proxies /api to whatever answers on the
 * Worker's port, and another checkout's placeholder scores look much like this
 * table's.
 */
async function claimPort(value: number, what: string): Promise<void> {
  const free = await new Promise<boolean>((resolveFree) => {
    const probe = createServer();
    probe.once("error", () => resolveFree(false));
    probe.once("listening", () => probe.close(() => resolveFree(true)));
    probe.listen(value, "127.0.0.1");
  });
  if (!free) {
    throw new Error(
      `port ${value} is already in use, so ${what} can't start there.\n` +
        "  another checkout's npm run dev:all is the usual culprit - stop it, or pass --port/--web-port."
    );
  }
}

/**
 * Whole tree, not just the child: on Windows a plain kill() leaves wrangler's
 * workerd behind, still holding the Worker's port for the next run.
 */
function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform !== "win32") {
    child.kill();
    return;
  }
  try {
    execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    // Already gone, which is the outcome this wanted anyway.
  }
}

/** Both servers under one terminal: when either stops, so does the other. */
function startServers(servers: { label: string; file: string; args: string[] }[]): Promise<number> {
  const children = servers.map((server) => ({
    label: server.label,
    child: spawn(server.file, server.args, { cwd: REPO_ROOT, stdio: ["ignore", "inherit", "inherit"] }),
  }));

  let stopping = false;
  let exitCode = 0;
  const stopAll = (): void => {
    stopping = true;
    for (const { child } of children) killTree(child);
  };
  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);

  return new Promise((resolveAll) => {
    let alive = children.length;
    for (const { label, child } of children) {
      child.on("close", (code) => {
        if (!stopping) {
          console.log(`${label} stopped (exit code ${code}) - stopping the rest`);
          exitCode = code ?? 0;
          stopAll();
        }
        alive -= 1;
        if (alive === 0) resolveAll(exitCode);
      });
    }
  });
}

function report(loaded: LoadedTable, songIds: readonly string[], persistTo: string, reveal: boolean): void {
  const words = Object.keys(loaded.table.scores).length;
  const where =
    songIds.length === 1
      ? `stored as "${songIds[0]}"`
      : `stored under all ${songIds.length} song ids`;
  console.log(
    [
      `loaded ${loaded.path} (${words} words, model ${loaded.table.model})`,
      `  ${where} in the local SIMILARITY namespace`,
      `  kept in ${persistTo} - local only, never uploaded`,
      reveal
        ? "  hidden words are shown faintly (--reveal)"
        : "  hidden words stay hidden - pass --reveal to show them faintly, as npm run dev:all does",
    ].join("\n")
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      table: { type: "string" },
      reveal: { type: "boolean", default: false },
      "worker-only": { type: "boolean", default: false },
      "every-song": { type: "boolean", default: false },
      "web-port": { type: "string" },
      port: { type: "string" },
      "inspector-port": { type: "string" },
      "persist-to": { type: "string" },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const webPort = port(values["web-port"], DEFAULT_WEB_PORT, "--web-port");
  const workerPort = port(values.port, DEFAULT_WORKER_PORT, "--port");
  const inspectorPort = port(values["inspector-port"], DEFAULT_INSPECTOR_PORT, "--inspector-port");
  const persistTo = values["persist-to"] ?? LOCAL_SIMILARITY_PERSIST_DIR;
  const workerOnly = values["worker-only"];

  const entry = pickDailyEntry();
  console.log(`today's song is "${entry.title}" - ${entry.artist} (${entry.id})`);

  ensureDevVars();
  const loaded = values.table ? await readTableFile(values.table) : await buildTodaysTable(entry.id, values.model);
  const songIds = values["every-song"] ? everySongId() : [entry.id];
  if (!values["every-song"] && loaded.table.songId !== entry.id) {
    console.warn(`warning: ${loaded.path} was built for "${loaded.table.songId}", and is loaded here as today's "${entry.id}"`);
  }

  await loadIntoLocalKv(loaded.json, songIds, persistTo);
  report(loaded, songIds, persistTo, values.reveal);

  await claimPort(workerPort, "the Worker");
  if (!workerOnly) await claimPort(webPort, "the Vite dev server");

  const servers = [
    {
      label: "the Worker",
      file: process.execPath,
      args: [WRANGLER, ...wranglerDevArgs({ persistTo, port: workerPort, inspectorPort, reveal: values.reveal })],
    },
  ];
  if (!workerOnly) {
    servers.push({
      label: "the Vite dev server",
      file: process.execPath,
      // --strictPort for the same reason as claimPort: a frontend that slid to
      // another port would still proxy /api to whatever holds the Worker's.
      args: [VITE, "--port", String(webPort), "--strictPort"],
    });
  }

  process.exitCode = await startServers(servers);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
