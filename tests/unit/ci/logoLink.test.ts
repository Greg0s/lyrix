import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    for (const name of ["lyrix-logo-mark-in", "lyrix-logo-grow", "lyrix-logo-mask", "lyrix-logo-letter", "lyrix-logo-dot-drop"]) {
      expect(global).toContain(`@keyframes ${name} `);
      expect(motion?.[1]).toContain(name);
      expect(outside).not.toContain(name);
    }
  });
});
