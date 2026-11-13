// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utcDay } from "../../../src/game/daily";
import type { RoundHints, RoundView } from "../../../src/game/types";
import { flushSavedRound, saveRound } from "../../../src/roundStorage";
import { TOUR_STEPS } from "../../../src/tour";
import { TOUR_STORAGE_KEY, isTourSeen } from "../../../src/tourStorage";

/**
 * The guided tour a first visit gets (ProductTour.tsx): over today's round,
 * one step per key part of the screen, "Passer" on every one, and never twice.
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

async function mountGame(view: RoundView = round()): Promise<HTMLInputElement> {
  fetchRound.mockResolvedValue(view);
  await act(async () => {
    render(<GameScreen />);
  });
  await waitFor(() => expect(screen.getByPlaceholderText("Propose un mot…")).toBeTruthy());
  return screen.getByPlaceholderText("Propose un mot…") as HTMLInputElement;
}

const tour = () => screen.queryByRole("dialog");
const step = () => within(screen.getByRole("dialog")).getByRole("heading").textContent;
const press = (name: string | RegExp) => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name }));

beforeEach(() => {
  wordTokenRenders.count = 0;
  window.localStorage.clear();
  fetchRound.mockReset();
  submitGuess.mockReset();
  resumeRound.mockReset();
});

afterEach(() => {
  cleanup();
  flushSavedRound();
});

describe("a first visit's guided tour", () => {
  it("opens over today's round, and is marked seen as soon as it shows", async () => {
    await mountGame();
    expect(tour()).toBeTruthy();
    expect(step()).toBe(TOUR_STEPS[0]?.title);
    expect(screen.getByText(`Étape 1 sur ${TOUR_STEPS.length}`)).toBeTruthy();
    expect(isTourSeen()).toBe(true);
  });

  it("walks through every step, back and forth, then hands the player the input", async () => {
    const input = await mountGame();
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
    expect(document.activeElement).toBe(input);
  });

  it("offers \"Passer\" on every step, which ends it there", async () => {
    await mountGame();
    for (let index = 0; index < TOUR_STEPS.length; index += 1) {
      expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Passer" })).toBeTruthy();
      if (index < TOUR_STEPS.length - 1) press("Suivant");
    }
    press("Passer");
    expect(tour()).toBeNull();
  });

  it("is skipped with Escape too", async () => {
    await mountGame();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(tour()).toBeNull();
  });

  it("points every step at its element, highlighted on the page", async () => {
    await mountGame();
    for (const { target } of TOUR_STEPS) expect(document.querySelector(`[data-tour="${target}"]`)).not.toBeNull();
  });

  it("leaves out a step whose element isn't there: no hints for this song", async () => {
    await mountGame(round({ withHints: false }));
    expect(screen.getByText(`Étape 1 sur ${TOUR_STEPS.length - 1}`)).toBeTruthy();
    const titles: (string | null)[] = [];
    for (let index = 0; index < TOUR_STEPS.length - 1; index += 1) {
      titles.push(step());
      if (index < TOUR_STEPS.length - 2) press("Suivant");
    }
    expect(titles).not.toContain(TOUR_STEPS.find((each) => each.target === "hints")?.title);
  });

  it("never comes back once shown, even left halfway", async () => {
    await mountGame();
    press("Suivant");
    cleanup();
    await mountGame();
    expect(tour()).toBeNull();
  });

  it("is never shown to a player who played before it existed", async () => {
    saveRound(round(), [{ key: "orage", display: "orage", found: false, score: null, near: [] }]);
    flushSavedRound();
    await mountGame();
    expect(tour()).toBeNull();
  });

  it("waits for a round still to find", async () => {
    await mountGame(round({ victory: true }));
    expect(tour()).toBeNull();
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBeNull();
  });

  it("re-renders none of the lyrics while it moves on", async () => {
    await mountGame();
    wordTokenRenders.count = 0;
    press("Suivant");
    press("Suivant");
    press("Passer");
    expect(wordTokenRenders.count).toBe(0);
  });
});
