// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "../../../src/components/AppHeader";

/**
 * The rules' button once wore a filled disc (--color-ink) with a "?" cut out of
 * it (--color-page-bg). Samsung Internet's dark mode recolours a page's text
 * but not every background: the "?" turned light on a light disc, and the
 * button showed a plain white circle. Every header icon is now a single-colour
 * line drawing in the text's own colour, which no recolouring can split apart.
 */

afterEach(cleanup);

function header() {
  render(
    <AppHeader
      roomPlayers={null}
      onOpenMultiplayer={vi.fn()}
      archivesOpen={false}
      onToggleArchives={vi.fn()}
      helpOpen={false}
      onToggleHelp={vi.fn()}
      onNavigate={vi.fn()}
    />,
  );
}

describe("header icons", () => {
  it("draws the rules' mark in the button's text colour, with no fill of its own", () => {
    header();
    const icon = screen.getByRole("button", { name: "Comment jouer" }).querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("stroke")).toBe("currentColor");
    expect(icon?.getAttribute("fill")).toBe("none");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("gives no header button's icon a surface of its own", () => {
    header();
    for (const button of screen.getAllByRole("button")) {
      for (const svg of button.querySelectorAll("svg")) {
        expect(svg.getAttribute("fill") ?? "none").toMatch(/^(none|currentColor)$/);
      }
    }
  });

  it("never fills a header element with a text token", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/game.css"), "utf8");
    const rules = css.match(/\.lyrix-(pill|help|theme)[^{]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule).not.toMatch(/background(-color)?:\s*var\(--color-ink/);
    }
  });
});
