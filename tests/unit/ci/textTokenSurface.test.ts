import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A text token is never a surface (CLAUDE.md, "Theming"). Two elements once
 * broke that rule, a light fill in the dark theme under text in the page's own
 * colour: the rules' header mark and a bar's "N lettres" tip. Samsung Internet's
 * dark mode recolours text towards light but leaves such small fills alone, so
 * their text vanished into a white shape (docs/LEARNINGS.md, 2026-11-15).
 * Light surfaces are --color-surface*, dark ones --color-solid*.
 */

const sheets = ["global.css", "game.css"].map((name) => ({
  name,
  css: readFileSync(new URL(`../../../src/styles/${name}`, import.meta.url), "utf8"),
}));

// The tokens meant for text on the page's own surfaces (light ones in the light
// theme, light text in the dark one), and the page's background as a text colour.
const TEXT_TOKEN = /var\(--color-(ink|ink-muted|ink-soft|ink-faint|link|link-hover|error)\)/;

describe("text tokens are never surfaces", () => {
  it.each(sheets)("$name fills nothing with a text token", ({ css }) => {
    const fills = css.match(/background(-color)?:[^;]*;/g) ?? [];
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill).not.toMatch(TEXT_TOKEN);
  });

  it.each(sheets)("$name writes no text in the page's background colour", ({ css }) => {
    expect(css).not.toMatch(/(^|[\s;{])color:\s*var\(--color-page-bg\)/);
  });
});
