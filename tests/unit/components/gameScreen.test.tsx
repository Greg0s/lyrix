// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuessResult, RoundView } from "../../../src/game/types";

/**
 * What the player feels between keystrokes.
 *
 * The lyrics are the biggest thing on the page - hundreds of tokens for a real
 * song - and they have nothing to do with the word being typed. These tests
 * count how many of them React re-renders, so a regression shows up here
 * rather than as a laggy input on someone's phone.
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
vi.mock("../../../src/api/client", () => ({ fetchRound, submitGuess }));

const { GameScreen } = await import("../../../src/components/GameScreen");

function tokens(text: string, revealed = false) {
  return text.split(" ").flatMap((word, index) => {
    const token = { text: revealed ? word : "_".repeat(word.length), isWord: true, revealed };
    return index === 0 ? [token] : [{ text: " ", isWord: false, revealed: true }, token];
  });
}

function round(state = "state-0"): RoundView {
  return {
    songId: "fixture",
    state,
    title: { tokens: tokens("Le refuge de novembre") },
    sections: [
      {
        label: "Couplet 1",
        lines: [
          { tokens: tokens("Le vent referme la porte du jardin") },
          { tokens: tokens("Les feuilles tombent doucement sans bruit") },
        ],
      },
      { label: "Refrain", lines: [{ tokens: tokens("On est bien on est la") }] },
    ],
    victory: false,
  };
}

async function mountGame(): Promise<HTMLInputElement> {
  render(<GameScreen />);
  await waitFor(() => expect(screen.getByPlaceholderText("Propose un mot…")).toBeTruthy());
  // Let the mount settle (StrictMode double-invokes) before counting anything.
  wordTokenRenders.count = 0;
  return screen.getByPlaceholderText("Propose un mot…") as HTMLInputElement;
}

beforeEach(() => {
  wordTokenRenders.count = 0;
  window.localStorage.clear();
  fetchRound.mockReset().mockResolvedValue(round());
  submitGuess.mockReset();
  // jsdom has no matchMedia; useIsMobile asks for one.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("typing a guess", () => {
  it("does not re-render a single lyrics token", async () => {
    const input = await mountGame();

    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "ch" } });
    fireEvent.change(input, { target: { value: "cha" } });

    expect(input.value).toBe("cha");
    expect(wordTokenRenders.count).toBe(0);
  });

  it("keeps the lyrics on screen while it does so", async () => {
    const input = await mountGame();
    fireEvent.change(input, { target: { value: "refuge" } });

    expect(screen.getByText("Couplet 1")).toBeTruthy();
    expect(screen.getAllByText("_______").length).toBeGreaterThan(0);
  });
});

describe("a round in progress", () => {
  // The round is persisted off the critical path now (see saveRoundSoon), so
  // this checks the thing that made it worth deferring at all: that a player
  // coming back still finds their guesses, without a second round trip.
  it("comes back from storage after a remount, guesses included", async () => {
    submitGuess.mockResolvedValue({ ...round("state-1"), found: false, key: "vent", score: 12, near: [] });

    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    await waitFor(() => expect(screen.getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy());
    await waitFor(() => expect(window.localStorage.getItem("lyrix:round")).toBeTruthy());

    cleanup();
    fetchRound.mockClear();
    render(<GameScreen />);

    await waitFor(() => expect(screen.getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy());
    expect(fetchRound).not.toHaveBeenCalled();
  });

  it("is saved before the tab goes away, even if the deferred write has not run", async () => {
    submitGuess.mockResolvedValue({ ...round("state-1"), found: false, key: "vent", score: 12, near: [] });
    // An idle callback that never runs: the only thing that can write the
    // round here is the flush the tab-hiding listener does.
    vi.stubGlobal("requestIdleCallback", () => 1);
    vi.stubGlobal("cancelIdleCallback", () => {});

    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    await waitFor(() => expect(screen.getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy());
    expect(window.localStorage.getItem("lyrix:round")).toBeNull();

    window.dispatchEvent(new Event("pagehide"));

    const saved = window.localStorage.getItem("lyrix:round");
    expect(saved).toBeTruthy();
    expect(saved).toContain("vent");
  });
});

describe("reveal all lyrics (post-victory checkbox)", () => {
  function wonRound(): RoundView {
    return {
      ...round("state-victory"),
      title: { tokens: tokens("Novembre", true) },
      sections: [
        {
          label: "Couplet 1",
          lines: [
            {
              tokens: [
                { text: "____", isWord: true, revealed: false, revealHint: "vent" },
                { text: " ", isWord: false, revealed: true },
                { text: "referme", isWord: true, revealed: true },
              ],
            },
          ],
        },
      ],
      victory: true,
      artist: "Fixture Artist",
    };
  }

  it("shows the checkbox only once the round is won", async () => {
    await mountGame();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("reveals every still-hidden word once checked, and hides it again once unchecked", async () => {
    fetchRound.mockResolvedValue(wonRound());
    await mountGame();

    const checkbox = screen.getByRole("checkbox", { name: "Afficher tous les lyrics" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(screen.queryByText("vent", { selector: ".token-word-revealed" })).toBeNull();

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText("vent", { selector: ".token-word-revealed" })).toBeTruthy();

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(screen.queryByText("vent", { selector: ".token-word-revealed" })).toBeNull();
  });

  it("does not affect an already-found word", async () => {
    fetchRound.mockResolvedValue(wonRound());
    await mountGame();

    fireEvent.click(screen.getByRole("checkbox", { name: "Afficher tous les lyrics" }));
    expect(screen.getByText("referme", { selector: ".token-word-found" })).toBeTruthy();
  });
});

describe("submitting a guess", () => {
  it("re-renders the lyrics, since that is what changed", async () => {
    const revealed: GuessResult = {
      ...round("state-1"),
      sections: [
        { label: "Couplet 1", lines: [{ tokens: tokens("vent", true) }] },
        { label: "Refrain", lines: [{ tokens: tokens("On est bien on est la") }] },
      ],
      found: true,
      key: "vent",
      score: 100,
      near: [],
    };
    submitGuess.mockResolvedValue(revealed);

    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);

    await waitFor(() => expect(screen.getByText("vent", { selector: ".token-word-found" })).toBeTruthy());
    expect(wordTokenRenders.count).toBeGreaterThan(0);
    expect(submitGuess).toHaveBeenCalledWith("state-0", "vent");
  });

  it("costs nothing on the wire when the word was already tried", async () => {
    submitGuess.mockResolvedValue({ ...round("state-1"), found: false, key: "vent", score: 12, near: [] });

    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    await waitFor(() => expect(screen.getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy());

    fireEvent.change(input, { target: { value: "VENT" } });
    fireEvent.submit(input);

    await waitFor(() => expect(input.value).toBe(""));
    expect(submitGuess).toHaveBeenCalledTimes(1);
  });
});
