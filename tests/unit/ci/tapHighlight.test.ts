import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Mobile Chromium draws a blue box over every tapped element unless told not
 * to, and jsdom has no notion of it, so the stylesheet itself is what we pin.
 * Hiding it must never cost keyboard users their focus ring.
 */

const global = readFileSync(new URL("../../../src/styles/global.css", import.meta.url), "utf8");
const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");

describe("tap highlight", () => {
  it("turns off mobile Chromium's tap highlight for the whole page", () => {
    expect(global).toMatch(/html\s*\{[^}]*-webkit-tap-highlight-color:\s*transparent/);
  });

  it("keeps a visible outline on keyboard focus", () => {
    expect(global).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus\)/);
  });

  it("never removes the outline from :focus-visible", () => {
    for (const sheet of [global, game]) {
      expect(sheet).not.toMatch(/:focus-visible[^{]*\{[^}]*outline:\s*(none|0)\b/);
    }
  });
});
