import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A tap on a phone leaves :hover on the header's logo until the next tap
 * elsewhere, and global.css's a:hover (0,1,1) outranks a lone .lyrix-logo-link
 * (0,1,0): the wordmark stayed tinted in the link colour. jsdom has no :hover,
 * so the stylesheet itself is what we pin.
 */

const game = readFileSync(new URL("../../../src/styles/game.css", import.meta.url), "utf8");

describe("header logo link", () => {
  it("keeps the logo's own colour while hovered", () => {
    expect(game).toMatch(/\.lyrix-logo-link:hover\s*[,{][^}]*\{?[^}]*color:\s*inherit/);
  });
});
