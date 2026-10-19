import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { invitePageHtml } from "../../../scripts/lib/invitePage";

/**
 * A phone's on-screen keyboard must shrink the page itself, so the sticky
 * guess dock sits right above it whatever the player scrolls. Under Chrome's
 * default (`resizes-visual`), Brave and Chrome on Android placed the dock by
 * their own reckoning of the keyboard: up to 60px above it, or under it, as
 * the page scrolled (docs/LEARNINGS.md, 2026-10-19). Neither jsdom nor
 * Playwright has an on-screen keyboard, so the viewport meta is what we pin;
 * the behaviour itself was checked on a Pixel 9.
 */

const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");

function viewport(page: string): string | undefined {
  return /<meta name="viewport" content="([^"]*)"/.exec(page)?.[1];
}

describe("the on-screen keyboard", () => {
  it("resizes the page, not just the part of it on screen", () => {
    expect(viewport(html)).toMatch(/(^|,\s*)interactive-widget=resizes-content(\s*,|$)/);
  });

  it("does the same on the page invite links open", () => {
    expect(viewport(invitePageHtml(html))).toBe(viewport(html));
  });
});
