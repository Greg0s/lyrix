// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "../../../src/components/AppHeader";
import { LOGO_EXIT_MS } from "../../../src/components/Logo";
import { TODAY } from "../../../src/routes";

/**
 * The header's logo comes in as the page loads (mockup 1b). A click leaves it
 * first (exit C), then plays the entrance again: CSS animations play once per
 * element, so the logo is remounted once its exit is over. jsdom runs no
 * animation, so what we pin is the class and the remount (the stylesheet,
 * and LOGO_EXIT_MS against it, in tests/unit/ci/logoLink.test.ts).
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
const clickLogo = () => fireEvent.click(screen.getByRole("link", { name: "Lyrix, chanson du jour" }));
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("header logo", () => {
  it("leaves on a click, while the click goes straight to today's song", () => {
    const onNavigate = vi.fn();
    header(onNavigate);
    const before = logo();
    clickLogo();
    expect(onNavigate).toHaveBeenCalledWith(TODAY);
    expect(logo()).toBe(before);
    expect(logo()?.classList.contains("is-leaving")).toBe(true);
  });

  it("comes back in, remounted, once its exit is over", () => {
    header();
    const before = logo();
    clickLogo();
    wait(LOGO_EXIT_MS - 1);
    expect(logo()).toBe(before);
    wait(1);
    expect(logo()).not.toBeNull();
    expect(logo()).not.toBe(before);
    expect(logo()?.classList.contains("is-leaving")).toBe(false);
  });

  it("doesn't restart its exit on a click while it leaves", () => {
    const onNavigate = vi.fn();
    header(onNavigate);
    const before = logo();
    clickLogo();
    wait(LOGO_EXIT_MS - 100);
    clickLogo();
    expect(onNavigate).toHaveBeenCalledTimes(2);
    wait(100);
    expect(logo()).not.toBe(before);
    expect(logo()?.classList.contains("is-leaving")).toBe(false);
  });

  it("neither leaves nor comes back in under reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const onNavigate = vi.fn();
    header(onNavigate);
    const before = logo();
    clickLogo();
    expect(onNavigate).toHaveBeenCalledWith(TODAY);
    expect(logo()?.classList.contains("is-leaving")).toBe(false);
    wait(LOGO_EXIT_MS);
    expect(logo()).toBe(before);
  });

  it("doesn't leave when the header re-renders for anything else", () => {
    const { rerender, props } = header();
    const before = logo();
    rerender(<AppHeader {...props} archivesOpen />);
    expect(logo()).toBe(before);
    expect(logo()?.classList.contains("is-leaving")).toBe(false);
  });

  it("keeps the wordmark read as one word", () => {
    header();
    expect(screen.getByLabelText("Lyrix").textContent).toBe("Lyrıx");
  });
});
