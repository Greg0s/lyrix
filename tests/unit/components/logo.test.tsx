// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "../../../src/components/AppHeader";
import { TODAY } from "../../../src/routes";

/**
 * The header's logo comes in as the page loads (mockup 1b), and again on each
 * click: CSS animations play once per element, so a click remounts the logo.
 * jsdom runs no animation, so what we pin is the remount (the stylesheet is
 * pinned in tests/unit/ci/logoLink.test.ts).
 */

function header(onNavigate = vi.fn()) {
  const props = {
    roomPlayers: null,
    onOpenMultiplayer: vi.fn(),
    archivesOpen: false,
    onToggleArchives: vi.fn(),
    helpOpen: false,
    onToggleHelp: vi.fn(),
    onNavigate,
  };
  const view = render(<AppHeader {...props} />);
  return { ...view, props };
}

const logo = () => document.querySelector(".lyrix-logo");

afterEach(cleanup);

describe("header logo entrance", () => {
  it("plays again on a click, which still goes to today's song", () => {
    const onNavigate = vi.fn();
    header(onNavigate);
    const before = logo();
    fireEvent.click(screen.getByRole("link", { name: "Lyrix, chanson du jour" }));
    expect(onNavigate).toHaveBeenCalledWith(TODAY);
    expect(logo()).not.toBeNull();
    expect(logo()).not.toBe(before);
  });

  it("doesn't play again when the header re-renders for anything else", () => {
    const { rerender, props } = header();
    const before = logo();
    rerender(<AppHeader {...props} archivesOpen />);
    expect(logo()).toBe(before);
  });

  it("keeps the wordmark read as one word", () => {
    header();
    expect(screen.getByLabelText("Lyrix").textContent).toBe("Lyrıx");
  });
});

/**
 * A mouse over the logo sets its lines going once through (game.css), even if
 * it leaves halfway: the class stays until the last line's animation ends.
 */
describe("header logo under a mouse", () => {
  const rows = () => [...document.querySelectorAll(".lyrix-logo-row")];
  const leveling = () => logo()?.classList.contains("is-leveling");
  // jsdom has no AnimationEvent: fireEvent.animationEnd would drop its name, and
  // React listens for the prefixed event instead (a browser's is animationend).
  const animationEnd = (target: Element, animationName: string) =>
    fireEvent(target, Object.assign(new Event("webkitAnimationEnd", { bubbles: true }), { animationName }));

  it("plays for a mouse, through to the last line, even once the mouse has left", () => {
    header();
    const mark = logo() as Element;
    fireEvent.pointerEnter(mark, { pointerType: "mouse" });
    expect(leveling()).toBe(true);
    fireEvent.pointerLeave(mark, { pointerType: "mouse" });
    animationEnd(rows()[0] as Element, "lyrix-logo-level");
    expect(leveling()).toBe(true);
    // The entrance's own animations ending don't stop it either.
    animationEnd(rows()[2]?.firstElementChild as Element, "lyrix-logo-grow");
    expect(leveling()).toBe(true);
    animationEnd(rows()[2] as Element, "lyrix-logo-level");
    expect(leveling()).toBe(false);
  });

  it("doesn't play for a tap", () => {
    header();
    fireEvent.pointerEnter(logo() as Element, { pointerType: "touch" });
    expect(leveling()).toBe(false);
  });
});
