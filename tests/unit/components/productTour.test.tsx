// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utcDay } from "../../../src/game/daily";
import type { RoundHints, RoundView } from "../../../src/game/types";
import { flushSavedRound, saveRound } from "../../../src/roundStorage";
import { readFileSync } from "node:fs";
import { INVITE_LEAVE_MS, TOUR_STEPS } from "../../../src/tour";
import { TOUR_STORAGE_KEY, isTourSeen } from "../../../src/tourStorage";

/**
 * The guided tour a first visit gets: first offered in the guess dock's place
 * (TourInvite.tsx), then, if taken, over today's round (ProductTour.tsx), one
 * step per key part of the screen, "Passer" on every one, and never twice.
 */

const wordTokenRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../../src/components/WordToken", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/components/WordToken")>();
  const Counted: typeof actual.WordToken = (props) => {
    wordTokenRenders.count += 1;
    return actual.WordToken(props);
  };
  return { ...actual, WordToken: Counted };
});

const fetchRound = vi.hoisted(() => vi.fn());
const submitGuess = vi.hoisted(() => vi.fn());
const resumeRound = vi.hoisted(() => vi.fn());
vi.mock("../../../src/api/client", () => ({ fetchRound, submitGuess, resumeRound }));

const { GameScreen } = await import("../../../src/components/GameScreen");

function tokens(text: string, revealed = false) {
  return text.split(" ").flatMap((word, index) => {
    const token = { text: revealed ? word : "_".repeat(word.length), isWord: true, revealed };
    return index === 0 ? [token] : [{ text: " ", isWord: false, revealed: true }, token];
  });
}

const hints: RoundHints = { tried: 0, used: [], values: {} };

function round({ victory = false, withHints = true } = {}): RoundView {
  return {
    state: "state-0",
    day: utcDay(),
    title: { tokens: tokens("Le refuge de novembre", victory) },
    sections: [{ label: "Couplet 1", lines: [{ tokens: tokens("Le vent referme la porte du jardin") }] }],
    victory,
    ...(withHints ? { hints } : {}),
  };
}

async function mountGame(view: RoundView = round()): Promise<void> {
  fetchRound.mockResolvedValue(view);
  await act(async () => {
    render(<GameScreen />);
  });
  await waitFor(() => expect(screen.getByText("Couplet 1")).toBeTruthy());
}

const input = () => screen.queryByPlaceholderText("Propose un mot…");
const invite = () => screen.queryByRole("region", { name: /Première fois sur Lyrix/ });
const invitePanel = () => screen.getByRole("region", { name: /Première fois/ }).firstElementChild as HTMLElement;
/** Pressed, under reduced motion (see beforeEach): the answer takes effect at once. */
const answer = (name: string) =>
  fireEvent.click(within(screen.getByRole("region", { name: /Première fois/ })).getByRole("button", { name }));

/** A system that asks for reduced motion, or not. */
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

/** Mounted, then "Faire la visite": the tour itself. */
async function mountTour(view: RoundView = round()): Promise<void> {
  await mountGame(view);
  answer("Faire la visite");
}

const tour = () => screen.queryByRole("dialog");
const step = () => within(screen.getByRole("dialog")).getByRole("heading").textContent;
const press = (name: string | RegExp) => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name }));

beforeEach(() => {
  // The invitation's exit is timed; the tests that are about it ask for motion.
  stubReducedMotion(true);
  wordTokenRenders.count = 0;
  window.localStorage.clear();
  fetchRound.mockReset();
  submitGuess.mockReset();
  resumeRound.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  flushSavedRound();
});

describe("a first visit's invitation to the tour", () => {
  it("takes the dock's place, dims nothing, and is marked seen as soon as it shows", async () => {
    await mountGame();
    expect(invite()).toBeTruthy();
    expect(input()).toBeNull();
    expect(tour()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Faire la visite" }));
    expect(isTourSeen()).toBe(true);
  });

  it("slides out once answered, and only then gives way", async () => {
    stubReducedMotion(false);
    await mountGame();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Non merci, je joue" }));
    expect(invitePanel().classList.contains("is-answered")).toBe(true);
    // Another answer meanwhile changes nothing.
    fireEvent.click(screen.getByRole("button", { name: "Faire la visite" }));
    act(() => vi.advanceTimersByTime(INVITE_LEAVE_MS - 1));
    expect(invite()).toBeTruthy();
    expect(input()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(invite()).toBeNull();
    expect(tour()).toBeNull();
    expect(input()).toBeTruthy();
  });

  // Read from the repository root, where Vitest runs: jsdom gives import.meta.url no file scheme.
  it("waits exactly as long as its exit animation lasts", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    const rule = /\.lyrix-invite-panel\.is-answered\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(/animation:\s*lyrix-invite-out\s+(\d+)ms/.exec(rule)?.[1]).toBe(String(INVITE_LEAVE_MS));
  });

  it("gives way at once under reduced motion", async () => {
    await mountGame();
    answer("Faire la visite");
    expect(invite()).toBeNull();
    expect(tour()).toBeTruthy();
  });

  it("declined, gives the dock back, focused, and the tour never shows", async () => {
    await mountGame();
    answer("Non merci, je joue");
    expect(invite()).toBeNull();
    expect(tour()).toBeNull();
    expect(document.activeElement).toBe(input());
    cleanup();
    await mountGame();
    expect(invite()).toBeNull();
    expect(input()).toBeTruthy();
  });

  it("never comes back once shown, even left unanswered", async () => {
    await mountGame();
    cleanup();
    await mountGame();
    expect(invite()).toBeNull();
    expect(input()).toBeTruthy();
  });

  it("re-renders none of the lyrics, answered either way", async () => {
    await mountGame();
    wordTokenRenders.count = 0;
    answer("Faire la visite");
    press("Passer");
    expect(wordTokenRenders.count).toBe(0);
    cleanup();
    window.localStorage.clear();
    await mountGame();
    wordTokenRenders.count = 0;
    answer("Non merci, je joue");
    expect(wordTokenRenders.count).toBe(0);
  });
});

describe("a first visit's guided tour", () => {
  it("opens over today's round once accepted, in the dock's place given back", async () => {
    await mountTour();
    expect(invite()).toBeNull();
    expect(input()).toBeTruthy();
    expect(tour()).toBeTruthy();
    expect(step()).toBe(TOUR_STEPS[0]?.title);
    expect(screen.getByText(`Étape 1 sur ${TOUR_STEPS.length}`)).toBeTruthy();
    expect(isTourSeen()).toBe(true);
  });

  it("walks through every step, back and forth, then hands the player the input", async () => {
    await mountTour();
    expect(screen.queryByRole("button", { name: "Précédent" })).toBeNull();
    press("Suivant");
    expect(step()).toBe(TOUR_STEPS[1]?.title);
    press("Précédent");
    expect(step()).toBe(TOUR_STEPS[0]?.title);
    for (let index = 1; index < TOUR_STEPS.length; index += 1) {
      press("Suivant");
      expect(step()).toBe(TOUR_STEPS[index]?.title);
    }
    expect(screen.queryByRole("button", { name: "Suivant" })).toBeNull();
    press(/C'est parti/);
    expect(tour()).toBeNull();
    expect(document.activeElement).toBe(input());
  });

  it("offers \"Passer\" on every step, which ends it there", async () => {
    await mountTour();
    for (let index = 0; index < TOUR_STEPS.length; index += 1) {
      expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Passer" })).toBeTruthy();
      if (index < TOUR_STEPS.length - 1) press("Suivant");
    }
    press("Passer");
    expect(tour()).toBeNull();
  });

  it("is skipped with Escape too", async () => {
    await mountTour();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(tour()).toBeNull();
  });

  it("points every step at its element, highlighted on the page", async () => {
    await mountTour();
    for (const { target } of TOUR_STEPS) expect(document.querySelector(`[data-tour="${target}"]`)).not.toBeNull();
  });

  it("leaves out a step whose element isn't there: no hints for this song", async () => {
    await mountTour(round({ withHints: false }));
    expect(screen.getByText(`Étape 1 sur ${TOUR_STEPS.length - 1}`)).toBeTruthy();
    const titles: (string | null)[] = [];
    for (let index = 0; index < TOUR_STEPS.length - 1; index += 1) {
      titles.push(step());
      if (index < TOUR_STEPS.length - 2) press("Suivant");
    }
    expect(titles).not.toContain(TOUR_STEPS.find((each) => each.target === "hints")?.title);
  });

  it("never comes back once shown, even left halfway", async () => {
    await mountTour();
    press("Suivant");
    cleanup();
    await mountGame();
    expect(tour()).toBeNull();
  });

  it("is never shown to a player who played before it existed", async () => {
    saveRound(round(), [{ key: "orage", display: "orage", found: false, score: null, near: [] }]);
    flushSavedRound();
    await mountGame();
    expect(invite()).toBeNull();
    expect(tour()).toBeNull();
  });

  it("waits for a round still to find", async () => {
    await mountGame(round({ victory: true }));
    expect(invite()).toBeNull();
    expect(tour()).toBeNull();
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBeNull();
  });

  it("re-renders none of the lyrics while it moves on", async () => {
    await mountTour();
    wordTokenRenders.count = 0;
    press("Suivant");
    press("Suivant");
    press("Passer");
    expect(wordTokenRenders.count).toBe(0);
  });
});
