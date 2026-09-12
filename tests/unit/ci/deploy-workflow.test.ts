import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression test for a production outage: Pages (lyrix-eyg.pages.dev) and the
// Worker (lyrix-api.lyrix.workers.dev) are different origins, so the frontend
// build must be told the Worker's absolute URL via VITE_API_BASE_URL. Without
// it, client.ts falls back to relative /api/* calls against the Pages origin,
// which has no Worker behind it, and the deployed game fails to load its round.
describe("CI deploy workflow", () => {
  const workflow = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf-8");

  it("sets VITE_API_BASE_URL to an absolute Worker URL before building the frontend", () => {
    const buildStep = workflow.match(/run: npm run build\s*\n(\s*env:[\s\S]*?)(?=\n\s*- name:|\n\s*- run:|$)/);
    expect(buildStep, "expected a `run: npm run build` step with an env block in the deploy job").not.toBeNull();
    expect(buildStep?.[1]).toMatch(/VITE_API_BASE_URL:\s*https:\/\/\S+/);
  });
});
