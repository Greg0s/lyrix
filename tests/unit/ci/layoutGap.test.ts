import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The page's cards sit the same distance apart whichever way they are laid
 * out: on a desktop, the song card was 32px from the side column while the
 * side column's cards were 16px apart, and the song card 20px from the dock.
 * jsdom lays nothing out, so the stylesheet itself is pinned: on a phone and
 * on a desktop, every gap between the page's cards is the same one.
 */

const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");

const DESKTOP = "@media (min-width: 880px) {";
const desktopStart = game.indexOf(DESKTOP);
/** The desktop media block: from its opening to the first line closing it at column 0. */
const desktop = game.slice(desktopStart, game.indexOf("\n}\n", desktopStart));
const phone = game.slice(0, desktopStart);

const LAYOUT = [".lyrix-main", ".lyrix-game-col", ".lyrix-aside", ".lyrix-main.has-day-bar"];

/** Every gap (row-gap, column-gap included) of the layout's rules in this stretch of the stylesheet. */
function gaps(css: string): string[] {
  const values: string[] = [];
  for (const [, selectors, body] of css.matchAll(/(?:^|\n)\s*([^{}\n][^{}]*?)\s*\{([^{}]*)\}/g)) {
    const list = selectors.split(",").map((s) => s.trim());
    if (!list.some((s) => LAYOUT.includes(s))) continue;
    for (const [, value] of body.matchAll(/(?:^|[\s;])(?:row-|column-)?gap:\s*([^;]+);/g)) values.push(value.trim());
  }
  return values;
}

describe("the gap between the page's cards", () => {
  it.each([
    ["a phone", phone],
    ["a desktop", desktop],
  ])("is one and the same on %s", (_, css) => {
    const values = gaps(css);
    expect(values.length).toBeGreaterThan(0);
    expect(new Set(values).size, values.join(", ")).toBe(1);
  });

  it("sets every column's gap on a desktop, not only the grid's", () => {
    expect(desktop).toMatch(/\.lyrix-game-col,\s*\.lyrix-aside\s*\{[^}]*gap:/);
  });
});
