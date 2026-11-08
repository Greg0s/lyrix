import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A dialog is centred in its fixed backdrop, so one taller than the backdrop
 * overflows it at both ends, its title above the top of the screen where no
 * scroll reaches it. Sized on 100vh, it was: on Android, 100vh is the viewport
 * with the browser's bars hidden, taller than the screen while they show
 * (Brave on a Pixel 9, the multiplayer dialog), and the keyboard shrinks the
 * page further (interactive-widget=resizes-content). No desktop browser
 * reproduces that, so the stylesheet itself is what we pin.
 */

const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");

/** The declarations of a rule, by its exact selector. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(game);
  if (!match) throw new Error(`no ${selector} rule in game.css`);
  return match[1];
}

describe("dialog height", () => {
  it("keeps a dialog within its backdrop, whatever the browser's bars and keyboard do", () => {
    const backdrop = rule(".lyrix-modal-backdrop");
    expect(backdrop).toMatch(/position:\s*fixed/);
    expect(backdrop).toMatch(/inset:\s*0/);
    expect(rule(".lyrix-modal")).toMatch(/max-height:\s*100%;/);
  });

  it("never caps a height on the large viewport (vh), which outgrows the screen while the bars show", () => {
    const caps = [...game.matchAll(/max-height:[^;]*;/g)].map((match) => match[0]);
    expect(caps.filter((cap) => /\d(?:vh|lvh)\b/.test(cap))).toEqual([]);
  });
});
