// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { memo, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markTourSeen } from "../../../src/tourStorage";
import { utcDay } from "../../../src/game/daily";
import type { RoundHints, RoundView } from "../../../src/game/types";
import { flushSavedRound } from "../../../src/roundStorage";

/**
 * A phone's layout (below 880px, game.css): the round's progress in the
 * header, the words tried and the hints behind two buttons on the dock, the
 * header's buttons in a bar of tabs. jsdom applies no media query, so both
 * layouts are in the page here: these tests check what each part does, and
 * that typing a guess re-renders none of them. tests/e2e/mobile.spec.ts
 * checks which one shows at which width.
 */

const renders = vi.hoisted(() => ({ tabBar: 0, shortcuts: 0, progress: 0 }));
vi.mock("../../../src/components/TabBar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/components/TabBar")>();
  const inner = (actual.TabBar as unknown as { type: (props: object) => ReactElement }).type;
  return { TabBar: memo((props: object) => (renders.tabBar++, inner(props))) };
});
vi.mock("../../../src/components/DockShortcuts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/components/DockShortcuts")>();
  const inner = (actual.DockShortcuts as unknown as { type: (props: object) => ReactElement }).type;
  return { DockShortcuts: memo((props: object) => (renders.shortcuts++, inner(props))) };
});
vi.mock("../../../src/components/HeaderProgress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/components/HeaderProgress")>();
  const inner = (actual.HeaderProgress as unknown as { type: (props: object) => ReactElement }).type;
  return { HeaderProgress: memo((props: object) => (renders.progress++, inner(props))) };
});

const fetchRound = vi.hoisted(() => vi.fn());
const submitGuess = vi.hoisted(() => vi.fn());
const resumeRound = vi.hoisted(() => vi.fn());
vi.mock("../../../src/api/client", () => ({ fetchRound, submitGuess, resumeRound, revealHint: vi.fn() }));

const { GameScreen } = await import("../../../src/components/GameScreen");

function tokens(text: string) {
  return text.split(" ").flatMap((word, index) => {
    const token = { text: "_".repeat(word.length), isWord: true, revealed: false };
    return index === 0 ? [token] : [{ text: " ", isWord: false, revealed: true }, token];
  });
}

const HINTS: RoundHints = { tried: 0, used: [], values: {} };

function round(state = "state-0", hints: RoundHints | undefined = HINTS): RoundView {
  return {
    state,
    day: utcDay(),
    title: { tokens: tokens("Le refuge de novembre") },
    sections: [{ label: "Couplet 1", lines: [{ tokens: tokens("Le vent referme la porte du jardin") }] }],
    victory: false,
    hints,
  };
}

async function mountGame(): Promise<HTMLInputElement> {
  await act(async () => {
    render(<GameScreen />);
  });
  await waitFor(() => expect(screen.getByPlaceholderText("Propose un mot…")).toBeTruthy());
  renders.tabBar = renders.shortcuts = renders.progress = 0;
  return screen.getByPlaceholderText("Propose un mot…") as HTMLInputElement;
}

function header() {
  return within(screen.getByRole("banner"));
}

function tabBar() {
  return within(screen.getByRole("navigation", { name: "Navigation" }));
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  markTourSeen();
  fetchRound.mockReset().mockResolvedValue(round());
  submitGuess.mockReset();
  resumeRound.mockReset();
});

afterEach(() => {
  cleanup();
  flushSavedRound();
});

describe("the header's progress", () => {
  it("says the share revealed, the words found and the tries, in French plurals", async () => {
    await mountGame();
    const progress = header().getByRole("group", { name: "Progression" });
    expect(progress.textContent).toContain("0 %");
    expect(progress.textContent).toContain("0 trouvé · 0 essai");
  });

  it("counts a missed guess as a try", async () => {
    submitGuess.mockResolvedValue({ ...round("state-1"), found: false, key: "vent", score: 12, near: [] });
    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    await waitFor(() =>
      expect(header().getByRole("group", { name: "Progression" }).textContent).toContain("0 trouvé · 1 essai"),
    );
  });

  it("is not in the header of a page", async () => {
    window.history.replaceState(null, "", "/comment-jouer");
    await act(async () => {
      render(<GameScreen />);
    });
    expect(header().queryByRole("group", { name: "Progression" })).toBeNull();
    expect(screen.getByRole("banner").classList.contains("has-progress")).toBe(false);
  });
});

describe("the tab bar", () => {
  it("marks the round's tab as the screen shown, and links every page", async () => {
    await mountGame();
    expect(tabBar().getByRole("link", { name: "Jouer" }).getAttribute("aria-current")).toBe("page");
    expect(tabBar().getByRole("link", { name: "Archives" }).getAttribute("href")).toBe("/archives");
    expect(tabBar().getByRole("link", { name: "Plus" }).getAttribute("href")).toBe("/comment-jouer");
  });

  it("changes screen in place, and marks the page shown", async () => {
    await mountGame();
    fireEvent.click(tabBar().getByRole("link", { name: "Archives" }));
    await waitFor(() => expect(window.location.pathname).toBe("/archives"));
    expect(tabBar().getByRole("link", { name: "Archives" }).getAttribute("aria-current")).toBe("page");
    expect(tabBar().getByRole("link", { name: "Jouer" }).getAttribute("aria-current")).toBeNull();

    fireEvent.click(tabBar().getByRole("link", { name: "Jouer" }));
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  it("opens the multiplayer dialog from its room tab", async () => {
    await mountGame();
    fireEvent.click(tabBar().getByRole("button", { name: "Salon" }));
    expect(screen.getByRole("dialog", { name: "Jouer à plusieurs" })).toBeTruthy();
  });
});

describe("the dock's shortcuts", () => {
  it("open the words tried as a sheet", async () => {
    submitGuess.mockResolvedValue({ ...round("state-1"), found: false, key: "vent", score: 12, near: [] });
    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    const button = await screen.findByRole("button", { name: "Tes mots : 1 mot" });

    fireEvent.click(button);
    const sheet = screen.getByRole("dialog", { name: "Tes mots" });
    expect(within(sheet).getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy();
    // The list alone: the sheet's title is its heading, there is nothing to unfold.
    expect(within(sheet).queryByRole("button", { expanded: false })).toBeNull();
  });

  it("open the hints as a sheet, with every hint's row", async () => {
    await mountGame();
    fireEvent.click(screen.getByRole("button", { name: "Indices : 0 sur 3" }));
    const sheet = screen.getByRole("dialog", { name: "Indices" });
    expect(within(sheet).getAllByText(/verrouillé/).length).toBe(3);
  });

  it("say when a hint is waiting to be picked", async () => {
    fetchRound.mockResolvedValue(round("state-0", { tried: 50, used: [], values: {} }));
    await mountGame();
    const button = screen.getByRole("button", { name: /^Indices : \d à choisir$/ });
    expect(button.classList.contains("is-waiting")).toBe(true);
  });

  it("leave the hints out for a round without any", async () => {
    const withoutHints: RoundView = round();
    delete withoutHints.hints;
    fetchRound.mockResolvedValue(withoutHints);
    await mountGame();
    expect(screen.queryByRole("button", { name: /^Indices :/ })).toBeNull();
  });
});

describe("typing a guess", () => {
  it("re-renders neither the tab bar, the dock's shortcuts nor the header's progress", async () => {
    const input = await mountGame();
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "ch" } });
    fireEvent.change(input, { target: { value: "cha" } });
    expect(input.value).toBe("cha");
    expect(renders).toEqual({ tabBar: 0, shortcuts: 0, progress: 0 });
  });
});
