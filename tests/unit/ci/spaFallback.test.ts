import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../../..");

/**
 * The archives have addresses of their own (/archives, /archives/2026-09-26,
 * src/routes.ts) that no file answers to. Cloudflare Pages serves the root
 * index.html for any such path, its SPA fallback, as long as the site has no
 * 404.html; and a _redirects rewrite to /index.html would be redirected to /
 * by Pages' pretty URLs, losing the address. So: neither.
 */
describe("the archives' addresses on Pages", () => {
  it("are answered by the app, the site having no 404 page", () => {
    expect(existsSync(join(root, "public/404.html"))).toBe(false);
    expect(existsSync(join(root, "404.html"))).toBe(false);
  });

  it("are left to that fallback by _redirects", () => {
    const rules = readFileSync(join(root, "public/_redirects"), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));
    expect(rules.some((rule) => rule.startsWith("/archives") || rule.startsWith("/*"))).toBe(false);
  });
});
