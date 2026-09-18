import { defineConfig, devices } from "@playwright/test";

// Ports only the e2e suite uses. `npm run dev:all` holds Vite's 5173 and
// wrangler's 8787 (inspector 9229) — in this checkout or any other clone or
// worktree on the machine — and both tools slide to the next few ports when
// theirs is taken; the same numbers + 10000 stay clear of all of it.
const WEB_PORT = 15173;
const WORKER_PORT = 18787;
const WORKER_INSPECTOR_PORT = 19229;
const SIMILARITY_WORKER_PORT = 18788;
const SIMILARITY_WORKER_INSPECTOR_PORT = 19230;

// Local state (cached songs, and KV for the Worker that has a namespace bound)
// for each Worker the suite starts. Each gets its own, and neither gets
// wrangler's default worker/.wrangler/state — which is where `npm run dev:all`
// and `npm run dev:debug` keep theirs in this same checkout. The suite
// asserts on the placeholder table's scores, so a real table loaded for local
// play must not be able to reach it.
const WORKER_STATE_DIR = "worker/.wrangler/e2e-state";
const DEBUG_WORKER_STATE_DIR = "worker/.wrangler/e2e-debug-state";

// Stands in for a table built from the real embedding model, which no CI
// machine has: a handful of scores, deliberately unlike the placeholder's, so
// a test can tell which of the two answered a guess.
export const similarityTableFixture = "tests/e2e/fixtures/similarity-table.json";

const webUrl = `http://localhost:${WEB_PORT}`;
/** The Worker the game is played against: placeholder scores, no KV namespace bound. */
export const workerUrl = `http://localhost:${WORKER_PORT}`;
/** The Worker serving a real table out of a local KV namespace, as `npm run dev:debug` does. */
export const similarityWorkerUrl = `http://localhost:${SIMILARITY_WORKER_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  // One entry per port, so Playwright waits for each server on its own: a
  // single combined command + one URL check only proves Vite is up (it's ready
  // in ~200ms), while wrangler's local Worker runtime can take a few seconds to
  // boot — tests would start firing /api/round requests through Vite's proxy
  // before wrangler is listening, getting a 502 back instead of round data.
  //
  // Neither server is ever reused, locally included: the readiness check
  // only proves that *something* answers on the URL, not which checkout
  // started it, and reuse once ran the whole suite against another
  // worktree's servers (see docs/LEARNINGS.md). A busy port fails the run
  // up front with "... is already used" — stop whatever holds it, usually an
  // interrupted e2e run, rather than turning reuse back on.
  webServer: [
    {
      // --strictPort: exit on a busy port instead of moving to the next one
      // while Playwright keeps polling whatever holds this one.
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: webUrl,
      // Read by vite.config.ts: proxy /api to the Worker below, not dev:all's.
      env: { API_PROXY_TARGET: workerUrl },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // Through the npm script rather than wrangler itself, so the Worker
      // starts exactly as `npm run dev:all` starts it, npm hooks included.
      command: `npm run dev:worker -- --port ${WORKER_PORT} --inspector-port ${WORKER_INSPECTOR_PORT} --persist-to ${WORKER_STATE_DIR}`,
      url: `${workerUrl}/api/round`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // The command a developer runs to play today's song against a real table,
      // given the fixture above instead of one built from a model nobody has in
      // CI. It covers what a configuration test cannot see: that a table loaded
      // with `wrangler kv bulk put --local` is the one `wrangler dev` then
      // serves. Longer timeout than the others: it loads the table before the
      // Worker starts.
      command:
        `npm run dev:debug -- --worker-only --table ${similarityTableFixture} --every-song` +
        ` --port ${SIMILARITY_WORKER_PORT} --inspector-port ${SIMILARITY_WORKER_INSPECTOR_PORT}` +
        ` --persist-to ${DEBUG_WORKER_STATE_DIR}`,
      url: `${similarityWorkerUrl}/api/round`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  use: {
    baseURL: webUrl,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
