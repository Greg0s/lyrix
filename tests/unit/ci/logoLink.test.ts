import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOGO_EXIT_MS } from "../../../src/components/Logo";

/**
 * A tap on a phone leaves :hover on the header's logo until the next tap
 * elsewhere, and global.css's a:hover (0,1,1) outranks a lone .lyrix-logo-link
 * (0,1,0): the wordmark stayed tinted in the link colour. jsdom has no :hover,
 * so the stylesheet itself is what we pin.
 */

const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");
const global = readFileSync(new URL("../../../src/styles/global.css", import.meta.url), "utf8");

describe("header logo link", () => {
  it("keeps the logo's own colour while hovered", () => {
    expect(game).toMatch(/\.lyrix-logo-link:hover\s*[,{][^}]*\{?[^}]*color:\s*inherit/);
  });

  // The logo's entrance (Logo.tsx): never played under reduced motion.
  it("animates the logo only for players who haven't asked for reduced motion", () => {
    const motion = /@media \(prefers-reduced-motion: no-preference\)\s*\{([\s\S]*?)\r?\n\}/.exec(game);
    expect(motion).not.toBeNull();
    const outside = game.replace(motion?.[0] ?? "", "");
    for (const name of [
      "lyrix-logo-mark-in",
      "lyrix-logo-grow",
      "lyrix-logo-mask",
      "lyrix-logo-letter",
      "lyrix-logo-dot-drop",
      "lyrix-logo-level",
      "lyrix-logo-row-out",
      "lyrix-logo-mark-out",
      "lyrix-logo-letter-out",
      "lyrix-logo-dot-out",
    ]) {
      expect(global).toContain(`@keyframes ${name} `);
      expect(motion?.[1]).toContain(name);
      expect(outside).not.toContain(name);
    }
  });

  // Under a mouse, the mark's rows move (Logo.tsx). Composited only while they
  // move, their 4.2px bars were drawn on other pixels as it started and ended.
  it("keeps the logo's moving lines on their own layer before and after they move", () => {
    expect(game).toMatch(/\.lyrix-logo-row\s*\{[^}]*will-change:\s*transform/);
    expect(game).toMatch(/\.lyrix-logo\.is-leveling \.lyrix-logo-row\s*\{[^}]*animation:\s*lyrix-logo-level/);
  });

  // Both are as specific: the exit must come later to win over the hover.
  it("lets the logo's exit win over its hover animation", () => {
    const hover = game.lastIndexOf(".lyrix-logo.is-leveling .lyrix-logo-row");
    expect(hover).toBeGreaterThan(-1);
    expect(game.indexOf(".lyrix-logo.is-leaving .lyrix-logo-row")).toBeGreaterThan(hover);
  });

  // AppHeader remounts the logo LOGO_EXIT_MS after a click: sooner, its exit
  // is cut short; later, the logo sits invisible before coming back in.
  it("brings the logo back in as soon as its exit ends", () => {
    const ends = new Map<string, { duration: number; delay: number }>();
    for (const [, selector, body] of game.matchAll(/([^{}]*\.is-leaving[^{}]*)\{([^}]*)\}/g)) {
      const target = selector
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim()
        .replace(/:nth-child\(\d+\)/, "");
      const end = ends.get(target) ?? { duration: 0, delay: 0 };
      const shorthand = /animation:\s*\S+\s+(\d+)ms\s+cubic-bezier\([^)]*\)(?:\s+(\d+)ms)?/.exec(body);
      if (shorthand) {
        end.duration = Number(shorthand[1]);
        end.delay = Math.max(end.delay, Number(shorthand[2] ?? 0));
      }
      const delay = /animation-delay:\s*(\d+)ms/.exec(body);
      if (delay) end.delay = Math.max(end.delay, Number(delay[1]));
      ends.set(target, end);
    }
    expect([...ends.keys()].sort()).toEqual(
      [".lyrix-logo-mark", ".lyrix-logo-row", ".lyrix-wordmark-dot", ".lyrix-wordmark-letter"].map(
        (part) => `.lyrix-logo.is-leaving ${part}`,
      ),
    );
    expect(Math.max(...[...ends.values()].map(({ duration, delay }) => duration + delay))).toBe(LOGO_EXIT_MS);
  });
});
