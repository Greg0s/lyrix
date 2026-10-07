import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * An installed Lyrix (#79) fills a phone's screen, notch and home indicator
 * included (viewport-fit=cover). jsdom has no safe areas and no desktop
 * browser has a notch, so the stylesheet itself is what we pin: whatever
 * sticks to an edge of the screen keeps its content out of them.
 */

const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");

/** The declarations of a rule, by its exact selector. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(game);
  if (!match) throw new Error(`no ${selector} rule in game.css`);
  return match[1];
}

describe("safe areas", () => {
  it("lets the page reach under a notch and a home indicator", () => {
    expect(html).toMatch(/<meta name="viewport" content="[^"]*viewport-fit=cover[^"]*"/);
  });

  it("keeps the page's content off the sides and the bottom", () => {
    const app = rule(".lyrix-app");
    for (const side of ["left", "right", "bottom"]) expect(app).toContain(`env(safe-area-inset-${side}`);
  });

  it("keeps the sticky header's content below a status bar", () => {
    expect(rule(".lyrix-topbar")).toMatch(/padding-top:\s*env\(safe-area-inset-top/);
  });

  it("keeps the sticky guess dock above the home indicator", () => {
    expect(rule(".lyrix-dock")).toMatch(/bottom:\s*calc\([^;]*env\(safe-area-inset-bottom/);
  });

  it("keeps a dialog inside them all", () => {
    const backdrop = rule(".lyrix-modal-backdrop");
    for (const side of ["top", "right", "bottom", "left"]) expect(backdrop).toContain(`env(safe-area-inset-${side}`);
  });
});
