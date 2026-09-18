import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression test for a production outage: Pages (lyrix-eyg.pages.dev) and the
// Worker (lyrix-api.lyrix.workers.dev) are different origins, so the frontend
// build must be told the Worker's absolute URL via VITE_API_BASE_URL. Without
// it, client.ts falls back to relative /api/* calls against the Pages origin,
// which has no Worker behind it, and the deployed game fails to load its round.
/** The wrangler configuration a command works on, whether it deploys it or only builds it. */
function configOf(command: string): string | undefined {
  return /--config\s+(\S+)/.exec(command)?.[1];
}

describe("CI deploy workflow", () => {
  const workflow = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf-8");

  it("sets VITE_API_BASE_URL to an absolute Worker URL before building the frontend", () => {
    const buildStep = workflow.match(/run: npm run build\s*\n(\s*env:[\s\S]*?)(?=\n\s*- name:|\n\s*- run:|$)/);
    expect(buildStep, "expected a `run: npm run build` step with an env block in the deploy job").not.toBeNull();
    expect(buildStep?.[1]).toMatch(/VITE_API_BASE_URL:\s*https:\/\/\S+/);
  });
  // The Worker gained a second wrangler configuration, for local play against a
  // real similarity table (worker/wrangler.similarity.toml). Only one of the two
  // is ever deployed, and the deploy job is only reached once a change is on
  // main - so the configuration it ships is built on every run instead, before
  // anything can be merged.
  it("builds the deployed Worker configuration on every run, not only on main", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf-8")) as {
      scripts: Record<string, string>;
    };

    expect(workflow).toMatch(/run: npm run deploy:check/);
    expect(manifest.scripts["deploy:check"]).toContain("--dry-run");
    expect(configOf(manifest.scripts["deploy:check"]), "the dry run must target what the deploy job ships").toBe(
      configOf(/command: (deploy .*)/.exec(workflow)?.[1] ?? "")
    );
  });
});
