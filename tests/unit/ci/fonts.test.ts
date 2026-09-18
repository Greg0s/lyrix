import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * How the web fonts are fetched is a build-config detail nothing else would
 * catch: an `@import` inside the app's stylesheet works perfectly, it just
 * costs an extra round trip before the browser even asks for the fonts, which
 * shows up as text that swaps in late rather than as a failure.
 */

const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const css = ["global", "tokens", "game"].map((name) =>
  readFileSync(new URL(`../../../src/styles/${name}.css`, import.meta.url), "utf8")
);

describe("web font loading", () => {
  it("links the font stylesheet from the HTML", () => {
    expect(html).toMatch(/<link[^>]*rel="stylesheet"[^>]*fonts\.googleapis\.com/s);
  });

  it("never puts it behind an @import in the app's own stylesheets", () => {
    for (const sheet of css) {
      expect(sheet).not.toMatch(/@import[^;]*fonts\.googleapis\.com/);
    }
  });

  it("preconnects to both hosts Google Fonts uses", () => {
    expect(html).toMatch(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
    // The font files come from a second origin, and it needs `crossorigin` to
    // be the same connection the font fetch will use.
    expect(html).toMatch(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  });

  it("keeps display=swap, so the page never hides its text waiting for a font", () => {
    expect(html).toContain("display=swap");
  });
});
