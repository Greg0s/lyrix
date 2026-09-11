import { defineConfig, devices } from "@playwright/test";

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
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev:worker",
      url: "http://localhost:8787/api/round",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
