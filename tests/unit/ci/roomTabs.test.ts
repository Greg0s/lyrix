import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * "Jouer à plusieurs" switches between « Rejoindre » and « Créer un salon »
 * by cross-fading their panes, each sliding on its tab's side. jsdom runs no
 * transitions, so the stylesheet itself is what we pin.
 */

const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");

/** The declarations of a rule, by its exact selector (the first one at the top level). */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(game);
  if (!match) throw new Error(`no ${selector} rule in game.css`);
  return match[1];
}

describe("multiplayer dialog tabs", () => {
  it("fades the old pane out as well as the new one in, rather than hiding it at once", () => {
    const pane = rule(".lyrix-mp-pane");
    expect(pane).toMatch(/opacity:\s*0/);
    // Hidden only once faded out, or the leaving pane would vanish on the spot.
    expect(pane).toMatch(/visibility 0s linear 0\.\d+s/);
    expect(rule(".lyrix-mp-pane.is-active")).toMatch(/opacity:\s*1/);
  });

  it("uses transitions, not a keyframe animation that restarts on a quick back-and-forth", () => {
    expect(rule(".lyrix-mp-pane.is-active")).not.toMatch(/animation/);
    expect(rule(".lyrix-mp-pane.is-active")).toMatch(/transition:/);
  });

  it("slides each pane on its tab's side, the way the indicator moves", () => {
    expect(rule(".lyrix-mp-pane.is-join")).toMatch(/transform:\s*translateX\(-\d+px\)/);
    expect(rule(".lyrix-mp-pane.is-create")).toMatch(/transform:\s*translateX\(\d+px\)/);
    expect(rule(".lyrix-mp-pane.is-active")).toMatch(/transform:\s*none/);
  });

  it("swaps the panes in place, at once, under reduced motion", () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.lyrix-mp-pane\.is-active\s*\{([^}]*)\}/.exec(game);
    expect(reduced?.[1]).toMatch(/transform:\s*none/);
    expect(reduced?.[1]).toMatch(/transition-delay:\s*0s/);
  });
});
