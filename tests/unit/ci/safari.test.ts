import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Safari on iOS lays out and types differently from the Chromium the e2e suite runs, and neither jsdom nor the
 * cloud sessions have a WebKit to check it in, so what we pin is the stylesheet and the markup.
 */

const global = readFileSync(new URL("../../../src/styles/global.css", import.meta.url), "utf8");
const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");

/** The declarations of a rule, by its exact selector. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(game);
  if (!match) throw new Error(`no ${selector} rule in game.css`);
  return match[1];
}

describe("Safari on iOS", () => {
  it("keeps the Salon card's players as tall as their content", () => {
    // A flex item of the card with a max-height and a scroll of its own: WebKit stretched its rows to fill it.
    const grid = rule(".lyrix-members.is-grid");
    expect(grid).toMatch(/grid-auto-rows:\s*max-content/);
    expect(grid).toMatch(/align-content:\s*start/);
  });

  it("never lets a short page scroll by the height of the toolbars", () => {
    expect(rule(".lyrix-app")).toMatch(/min-height:\s*100vh;\s*min-height:\s*100svh/);
  });

  it("keeps text its size when a phone turns to landscape", () => {
    expect(global).toMatch(/html\s*\{[^}]*-webkit-text-size-adjust:\s*100%/);
  });

  it("never autocorrects a word typed into the game", () => {
    const dir = new URL("../../../src/components/", import.meta.url);
    const inputs = readdirSync(dir)
      .filter((name) => name.endsWith(".tsx"))
      .flatMap((name) => readFileSync(new URL(name, dir), "utf8").match(/<input\b[\s\S]*?\/>/g) ?? [])
      .filter((input) => input.includes('type="text"'));
    expect(inputs.length).toBeGreaterThanOrEqual(3);
    for (const input of inputs) expect(input).toContain('autoCorrect="off"');
  });
});
