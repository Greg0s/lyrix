import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPUTER_LAYOUT_MEDIA, PHONE_LAYOUT_MEDIA } from "../../../src/layout";

/**
 * The phone's layout holds on every touch screen, not only below 880px: a
 * phone turned sideways (915px wide, 412px tall) got the computer's, its tab
 * bar gone and its dock over most of the screen. Every media query of
 * game.css that switches layout spells out one of the two, never the width
 * alone, and the two cover every screen once.
 */

const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");
const queries = [...game.matchAll(/@media ([^{]+?)\s*\{/g)].map(([, query]) => query);

describe("the layout's media queries", () => {
  it("never switch on the width alone at 880px", () => {
    const bare = queries.filter((query) => /8(79|80)px/.test(query) && !query.includes("pointer"));
    expect(bare).toEqual([]);
  });

  it("use the phone's and the computer's queries as src/layout.ts spells them", () => {
    const layout = queries.filter((query) => /8(79|80)px/.test(query));
    expect(layout.length).toBeGreaterThan(0);
    for (const query of layout) {
      const ok =
        query === PHONE_LAYOUT_MEDIA ||
        query === COMPUTER_LAYOUT_MEDIA ||
        query === "(max-width: 879px) and (pointer: coarse), (hover: none) and (pointer: coarse)";
      expect(ok, query).toBe(true);
    }
  });

  it("cover every screen exactly once", () => {
    // Each screen: a width, whether it hovers, and its pointer.
    for (const width of [360, 879, 880, 1280])
      for (const hover of ["hover", "none"] as const)
        for (const pointer of ["fine", "coarse", "none"] as const) {
          const phone = width < 880 || (hover === "none" && pointer === "coarse");
          const computer = width >= 880 && (hover === "hover" || pointer === "fine" || pointer === "none");
          expect(phone !== computer, `${width}px, hover: ${hover}, pointer: ${pointer}`).toBe(true);
        }
    // The two strings say just that.
    expect(PHONE_LAYOUT_MEDIA).toBe("(max-width: 879px), (hover: none) and (pointer: coarse)");
    expect(COMPUTER_LAYOUT_MEDIA.split(", ").every((part) => part.startsWith("(min-width: 880px) and "))).toBe(true);
  });
});
