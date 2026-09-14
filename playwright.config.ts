import { defineConfig, devices } from "@playwright/test";

// Ports only the e2e suite uses. `npm run dev:all` holds Vite's 5173 and
// wrangler's 8787 (inspector 9229) — in this checkout or any other clone or
// worktree on the machine — and both tools slide to the next few ports when
// theirs is taken; the same numbers + 10000 stay clear of all of it.
const WEB_PORT = 15173;
const WORKER_PORT = 18787;
const WORKER_INSPECTOR_PORT = 19229;

const webUrl = `http://localhost:${WEB_PORT}`;
const workerUrl = `http://localhost:${WORKER_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  // Two separate entries so Playwright waits for each server on its own
  // port: a single combined command + one URL check only proves Vite is
  // up (it's ready in ~200ms), while wrangler's local Worker runtime can
  // take a few seconds to boot — tests would start firing /api/round
  // requests through Vite's proxy before wrangler is listening, getting a
  // 502 back instead of round data.
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
      command: `npm run dev:worker -- --port ${WORKER_PORT} --inspector-port ${WORKER_INSPECTOR_PORT}`,
      url: `${workerUrl}/api/round`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  use: {
    baseURL: webUrl,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
