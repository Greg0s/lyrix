// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utcDay } from "../../../src/game/daily";
import type { GuessDelta, HintAnswer, RoundHints, RoundView } from "../../../src/game/types";
import { flushSavedRound } from "../../../src/roundStorage";

/**
 * The hints card as the player meets it: a guess that reaches a threshold,
 * the dock saying so, a hint picked from the card or from the dock's sheet.
 * Revealing one must not re-render the lyrics, which it changes nothing in.
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
const revealHint = vi.hoisted(() => vi.fn());
vi.mock("../../../src/api/client", () => ({ fetchRound, submitGuess, resumeRound, revealHint }));

const { GameScreen } = await import("../../../src/components/GameScreen");

function tokens(text: string) {
  return text.split(" ").flatMap((word, index) => {
    const token = { text: "_".repeat(word.length), isWord: true, revealed: false };
    return index === 0 ? [token] : [{ text: " ", isWord: false, revealed: true }, token];
  });
}

function round(hints: RoundHints, state = "state-0"): RoundView {
  return {
    state,
    day: utcDay(),
    title: { tokens: tokens("Le refuge de novembre") },
    sections: [{ label: "Couplet 1", lines: [{ tokens: tokens("Le vent referme la porte du jardin") }] }],
    victory: false,
    hints,
  };
}

function missed(hints: RoundHints, state = "state-1"): GuessDelta {
  return { kind: "delta", state, day: utcDay(), key: "orage", found: false, score: null, near: [], reveal: [], revealed: 0, hints };
}

async function mountGame(hints: RoundHints): Promise<HTMLInputElement> {
  fetchRound.mockResolvedValue(round(hints));
  await act(async () => {
    render(<GameScreen />);
  });
  await waitFor(() => expect(screen.getByPlaceholderText("Propose un mot…")).toBeTruthy());
  wordTokenRenders.count = 0;
  return screen.getByPlaceholderText("Propose un mot…") as HTMLInputElement;
}

async function guess(input: HTMLInputElement, word: string): Promise<void> {
  fireEvent.change(input, { target: { value: word } });
  await act(async () => {
    fireEvent.submit(input.closest("form") as HTMLFormElement);
  });
}

function card(): HTMLElement {
  return screen.getByRole("region", { name: "Indices" });
}

const reached = { tried: 20, used: [], values: {} } satisfies RoundHints;
const revealed: HintAnswer = { state: "state-2", hints: { tried: 20, used: ["era"], values: { era: "Années 90" } } };

beforeEach(() => {
  wordTokenRenders.count = 0;
  window.localStorage.clear();
  fetchRound.mockReset();
  submitGuess.mockReset();
  resumeRound.mockReset();
  revealHint.mockReset();
});

afterEach(() => {
  cleanup();
  flushSavedRound();
});

describe("the hints card", () => {
  it("shows every hint locked, and how far the first one is", async () => {
    await mountGame({ tried: 13, used: [], values: {} });
    expect(within(card()).getByText("Premier indice")).toBeTruthy();
    expect(within(card()).getByText("13 / 20 essais")).toBeTruthy();
    expect(within(card()).queryByRole("button", { name: /Révéler/ })).toBeNull();
  });

  it("offers a hint once a guess reaches a threshold, and the dock says so", async () => {
    const input = await mountGame({ tried: 19, used: [], values: {} });
    submitGuess.mockResolvedValue(missed(reached));
    await guess(input, "orage");

    expect(screen.getByText("Un indice est débloqué.")).toBeTruthy();
    expect(within(card()).getByText("1 à choisir")).toBeTruthy();
    expect(within(card()).getAllByRole("button", { name: /Révéler/ })).toHaveLength(3);
  });

  it("reveals the hint picked, without re-rendering the lyrics", async () => {
    await mountGame(reached);
    revealHint.mockResolvedValue(revealed);

    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: /Époque/ }));
    });

    expect(revealHint).toHaveBeenCalledWith("state-0", "era");
    expect(within(card()).getByText("Années 90")).toBeTruthy();
    expect(screen.getByText("Époque : Années 90.")).toBeTruthy();
    expect(wordTokenRenders.count).toBe(0);
  });

  it("sends the hint's state with the next guess", async () => {
    const input = await mountGame(reached);
    revealHint.mockResolvedValue(revealed);
    await act(async () => {
      fireEvent.click(within(card()).getByRole("button", { name: /Style/ }));
    });
    submitGuess.mockResolvedValue(missed({ ...revealed.hints, tried: 21 }, "state-3"));
    await guess(input, "orage");

    expect(submitGuess).toHaveBeenCalledWith("state-2", "orage");
  });

  it("can be picked from the dock's sheet, which closes once it is", async () => {
    const input = await mountGame({ tried: 19, used: [], values: {} });
    submitGuess.mockResolvedValue(missed(reached));
    await guess(input, "orage");
    revealHint.mockResolvedValue({ state: "state-2", hints: { tried: 20, used: ["style"], values: { style: "Rock" } } });
    wordTokenRenders.count = 0;

    fireEvent.click(screen.getByRole("button", { name: "Choisir" }));
    const sheet = screen.getByRole("dialog", { name: "Choisis un indice" });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: /Style/ }));
    });

    expect(revealHint).toHaveBeenCalledWith("state-1", "style");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(card()).getByText("Rock")).toBeTruthy();
    expect(wordTokenRenders.count).toBe(0);
  });

  it("is not shown for a round without hints", async () => {
    fetchRound.mockResolvedValue({ ...round(reached), hints: undefined });
    await act(async () => {
      render(<GameScreen />);
    });
    await waitFor(() => expect(screen.getByPlaceholderText("Propose un mot…")).toBeTruthy());
    expect(screen.queryByRole("region", { name: "Indices" })).toBeNull();
  });
});
