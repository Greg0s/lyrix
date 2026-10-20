import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf-8");

/**
 * The daily production check (.github/workflows/canary.yml) only helps if it
 * checks what is actually deployed: the same Worker the deploy job builds
 * the frontend against, and the site the link previews name.
 */
describe("the canary workflow", () => {
  const canary = read(".github/workflows/canary.yml");
  const ci = read(".github/workflows/ci.yml");

  it("runs every day just after UTC midnight, when the song changes, and on demand", () => {
    expect(canary).toMatch(/- cron: "(\d+) 0 \* \* \*"/);
    expect(Number(/- cron: "(\d+) 0/.exec(canary)?.[1])).toBeLessThan(60);
    expect(canary).toContain("workflow_dispatch:");
  });

  it("checks the Worker the deploy job ships, and the site the link previews point at", () => {
    const deployedApi = /VITE_API_BASE_URL:\s*(https:\/\/\S+)/.exec(ci)?.[1];
    expect(deployedApi).toBeDefined();
    expect(canary).toContain(`CANARY_API_URL: ${deployedApi}`);
    const site = /<link rel="canonical" href="(https:\/\/[^"]+?)\/?"/.exec(read("index.html"))?.[1];
    expect(site).toBeDefined();
    expect(canary).toContain(`CANARY_SITE_URL: ${site}`);
  });

  it("runs the canary script", () => {
    const manifest = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(canary).toMatch(/run: npm run canary/);
    expect(manifest.scripts.canary).toBe("tsx scripts/canary.ts");
  });
});
