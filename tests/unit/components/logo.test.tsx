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
