// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const { PEEK_FADE_MS, PEEK_SHOW_MS } = await import("../../../src/components/WordToken");

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
  // Inside act, so the mocked round has landed and every effect it triggers —
  // StrictMode's cleanup-and-rerun included — has run before the test goes on.
  // Rendered outside it, those effects could still be pending once the input
  // showed up, and run after a test had switched to fake timers: the countdown's
  // interval started too late to tick, and a bar's re-run cleanup cleared the
  // tip timers a focus had just set.
  await act(async () => {
    render(<GameScreen />);
  });
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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

describe("a guess in flight", () => {
  // Regression: the input used to be `disabled` until the answer came back,
  // which blurs it natively. On a phone that closed the keyboard on every
  // guess, and handing focus back reopened it.
  function pendingGuess() {
    let answer: (result: GuessResult) => void = () => {};
    submitGuess.mockReturnValue(new Promise<GuessResult>((resolve) => (answer = resolve)));
    return (result: GuessResult) => act(() => answer(result));
  }
  const missed: GuessResult = { ...round("state-1"), found: false, key: "vent", score: 12, near: [] };

  it("leaves the input enabled and focused, with only Valider inert", async () => {
    const answer = pendingGuess();
    const input = await mountGame();
    input.focus();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);

    const button = screen.getByRole("button", { name: "Valider" }) as HTMLButtonElement;
    await waitFor(() => expect(button.getAttribute("aria-disabled")).toBe("true"));
    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(input);

    await answer(missed);
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("");
  });

  it("does not send a second guess until the first one lands", async () => {
    const answer = pendingGuess();
    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    await waitFor(() => expect(submitGuess).toHaveBeenCalledTimes(1));

    fireEvent.submit(input);
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    await answer(missed);
    expect(submitGuess).toHaveBeenCalledTimes(1);
  });

  it("keeps what the player typed meanwhile instead of clearing it", async () => {
    const answer = pendingGuess();
    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    await waitFor(() => expect(submitGuess).toHaveBeenCalledTimes(1));

    fireEvent.change(input, { target: { value: "port" } });
    await answer(missed);

    expect(input.value).toBe("port");
    expect(screen.getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy();
  });
});

describe("the Valider button", () => {
  it("cancels the mousedown a tap starts, so the input keeps focus (and a phone its keyboard)", async () => {
    await mountGame();
    const button = screen.getByRole("button", { name: "Valider" });
    // fireEvent returns false when a handler called preventDefault().
    expect(fireEvent.mouseDown(button)).toBe(false);
  });
});

describe("the dialogs (v3 header)", () => {
  it("opens the rules without re-rendering a single lyrics token, and gives the input back on Escape", async () => {
    const input = await mountGame();

    fireEvent.click(screen.getByRole("button", { name: "Comment jouer" }));
    expect(screen.getByRole("dialog", { name: "Comment on joue ?" })).toBeTruthy();
    expect(wordTokenRenders.count).toBe(0);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(input);
    expect(wordTokenRenders.count).toBe(0);
  });

  it("closes the rules from their own button too", async () => {
    await mountGame();
    fireEvent.click(screen.getByRole("button", { name: "Comment jouer" }));
    fireEvent.click(screen.getByRole("button", { name: "C'est parti" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Rooms themselves are covered in rooms.test.tsx; this is about getting to them.
  it("opens the multiplayer dialog from the header and the side card, without re-rendering the lyrics", async () => {
    await mountGame();

    fireEvent.click(screen.getByRole("button", { name: "Jouer à plusieurs" }));
    expect(screen.getByRole("dialog", { name: "Jouer à plusieurs" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Créer un salon" }).getAttribute("aria-selected")).toBe("true");
    expect(wordTokenRenders.count).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /Chercher à plusieurs/ }));
    expect(screen.getByRole("dialog", { name: "Jouer à plusieurs" })).toBeTruthy();
  });
});

describe("the progress card", () => {
  it("counts revealed word occurrences, found words and guesses, in agreeing French", async () => {
    const title = tokens("Le refuge de novembre");
    title[0] = { text: "Le", isWord: true, revealed: true };
    submitGuess.mockResolvedValue({
      ...round("state-1"),
      title: { tokens: title },
      sections: [{ label: "Couplet 1", lines: [{ tokens: tokens("Le vent", true) }, { tokens: tokens("Les feuilles") }] }],
      found: true,
      key: "le",
      score: 100,
      near: [],
    });

    const input = await mountGame();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(document.querySelector('[data-stat="found"]')?.textContent).toBe("0 mot trouvé");
    expect(document.querySelector('[data-stat="tried"]')?.textContent).toBe("0 essai");

    fireEvent.change(input, { target: { value: "le" } });
    fireEvent.submit(input);

    // 3 of the 8 words (4 in the title, 4 in the lyrics) are out.
    await waitFor(() => expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("37"));
    expect(document.querySelector('[data-stat="found"]')?.textContent).toBe("1 mot trouvé");
    expect(document.querySelector('[data-stat="tried"]')?.textContent).toBe("1 essai");
  });
});

describe("feedback on a guess", () => {
  it("says so when the word was already tried, and shakes the input", async () => {
    submitGuess.mockResolvedValue({ ...round("state-1"), found: false, key: "vent", score: 12, near: [] });

    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    await waitFor(() => expect(screen.getByText("« vent » n’y est pas.")).toBeTruthy());
    const row = input.parentElement as HTMLElement;
    const firstShake = row.className;
    expect(firstShake).toMatch(/is-shake-/);

    fireEvent.change(input, { target: { value: "Vent" } });
    fireEvent.submit(input);

    await waitFor(() => expect(screen.getByText("« Vent » a déjà été proposé.")).toBeTruthy());
    // The other copy of the animation, so the second miss shakes too.
    expect(row.className).toMatch(/is-shake-/);
    expect(row.className).not.toBe(firstShake);
  });

  it("highlights every occurrence of the word just found, until the next guess", async () => {
    const found: GuessResult = {
      ...round("state-1"),
      sections: [
        { label: "Couplet 1", lines: [{ tokens: tokens("vent", true) }, { tokens: tokens("le vent", true) }] },
      ],
      found: true,
      key: "vent",
      score: 100,
      near: [],
    };
    submitGuess.mockResolvedValueOnce(found);

    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);

    await waitFor(() => expect(document.querySelectorAll(".token-word-found.is-last")).toHaveLength(2));
    expect(screen.getByText("le", { selector: ".token-word-found" }).className).not.toMatch(/is-last/);

    submitGuess.mockResolvedValueOnce({ ...found, state: "state-2", found: false, key: "pluie", score: 3 });
    fireEvent.change(input, { target: { value: "pluie" } });
    fireEvent.submit(input);

    await waitFor(() => expect(screen.getByText("« pluie » n’y est pas.")).toBeTruthy());
    expect(document.querySelectorAll(".token-word-found.is-last")).toHaveLength(0);
  });
});

describe("tapping a hidden word", () => {
  it("tells its letter count for a moment, re-rendering no lyrics token", async () => {
    await mountGame();
    vi.useFakeTimers();

    const blank = lyricsBlanks()[0] as HTMLElement;
    fireEvent.click(blank);

    expect(peekOf(blank)).toBe("2 lettres");
    expect(wordTokenRenders.count).toBe(0);

    act(() => vi.advanceTimersByTime(PEEK_SHOW_MS + PEEK_FADE_MS));
    expect(peekOf(blank)).toBeNull();
  });
});

/** The lyrics' bars, in reading order. */
function lyricsBlanks(): HTMLElement[] {
  const lyrics = screen.getByRole("group", { name: "Paroles" });
  return Array.from(lyrics.querySelectorAll<HTMLElement>(".token-blank"));
}

/** The "N lettres" tip currently shown on a bar, if any. */
function peekOf(blank: HTMLElement): string | null {
  return blank.querySelector(".token-peek")?.textContent ?? null;
}

// GitHub issue #33: the letter count, without a mouse or a touchscreen.
describe("a hidden word, without a mouse", () => {
  it("is announced by screen readers as its letter count, not as underscores", async () => {
    await mountGame();

    const blank = lyricsBlanks()[0] as HTMLElement;
    const face = blank.querySelector(".token-blank-face") as HTMLElement;
    expect(blank.querySelector(".sr-only")?.textContent).toBe("mot caché, 2 lettres");
    expect(face.getAttribute("aria-hidden")).toBe("true");
    expect(face.textContent).toBe("__");
    expect(screen.getAllByText("mot caché, 7 lettres").length).toBeGreaterThan(0);
  });

  it("gives the lyrics a single tab stop, and the title its own", async () => {
    await mountGame();

    const tabStops = Array.from(document.querySelectorAll<HTMLElement>(".token-blank")).filter(
      (blank) => blank.tabIndex === 0
    );
    expect(tabStops).toEqual([document.querySelector(".lyrix-title-line .token-blank"), lyricsBlanks()[0]]);
    expect(lyricsBlanks().slice(1).every((blank) => blank.tabIndex === -1)).toBe(true);
  });

  it("moves between bars with the arrow keys, showing each one's tip, re-rendering no lyrics token", async () => {
    await mountGame();
    vi.useFakeTimers();
    const [first, second] = lyricsBlanks() as [HTMLElement, HTMLElement];

    act(() => first.focus());
    expect(peekOf(first)).toBe("2 lettres");

    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(second);
    expect(peekOf(second)).toBe("4 lettres");
    // The tab stop follows, so leaving and coming back with Tab returns to this bar.
    expect(second.tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);

    fireEvent.keyDown(second, { key: "End" });
    const blanks = lyricsBlanks();
    expect(document.activeElement).toBe(blanks[blanks.length - 1]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(first);

    expect(wordTokenRenders.count).toBe(0);
  });

  it("keeps the tip's timing identical to a tap, and shows it again on Enter", async () => {
    await mountGame();
    vi.useFakeTimers();
    const blank = lyricsBlanks()[0] as HTMLElement;

    act(() => blank.focus());
    act(() => vi.advanceTimersByTime(PEEK_SHOW_MS));
    expect(blank.querySelector(".token-peek.is-out")).toBeTruthy();
    act(() => vi.advanceTimersByTime(PEEK_FADE_MS));
    expect(peekOf(blank)).toBeNull();

    fireEvent.keyDown(blank, { key: "Enter" });
    expect(peekOf(blank)).toBe("2 lettres");
    expect(wordTokenRenders.count).toBe(0);
  });

  it("keeps a single tab stop once the bar holding it is found", async () => {
    submitGuess.mockResolvedValue({
      ...round("state-1"),
      sections: [{ label: "Couplet 1", lines: [{ tokens: [...tokens("Le", true), ...tokens(" vent referme").slice(1)] }] }],
      found: true,
      key: "le",
      score: 100,
      near: [],
    });
    const input = await mountGame();

    fireEvent.change(input, { target: { value: "le" } });
    fireEvent.submit(input);
    await waitFor(() => expect(screen.getByText("Le", { selector: ".token-word-found" })).toBeTruthy());

    expect(lyricsBlanks().map((blank) => blank.tabIndex)).toEqual([0, -1]);
  });
});

describe("the countdown to tomorrow's song (won round)", () => {
  function wonRound(): RoundView {
    return { ...round("state-victory"), title: { tokens: tokens("Novembre", true) }, victory: true, artist: "Fixture" };
  }

  beforeEach(() => {
    // Only the clock and the interval: waitFor keeps its real setTimeout.
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(Date.UTC(2026, 8, 29, 22, 30, 0));
    fetchRound.mockResolvedValue(wonRound());
  });

  it("ticks every second to the next UTC midnight, re-rendering no lyrics token", async () => {
    await mountGame();
    expect(screen.getByText("01:30:00", { selector: ".lyrix-countdown" })).toBeTruthy();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("01:29:59", { selector: ".lyrix-countdown" })).toBeTruthy();
    expect(wordTokenRenders.count).toBe(0);
  });

  it("offers the new song once midnight has passed", async () => {
    await mountGame();
    act(() => vi.advanceTimersByTime(90 * 60 * 1000));
    expect(screen.getByText("La nouvelle chanson est prête", { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Jouer" })).toBeTruthy();
  });

  it("is not shown before the round is won", async () => {
    fetchRound.mockResolvedValue(round());
    await mountGame();
    expect(document.querySelector(".lyrix-countdown")).toBeNull();
  });
});

describe("the tried words card", () => {
  // Collapsed on mobile only: CSS hides the body, so the toggle's state is what can be checked here.
  it("toggles open and closed without re-rendering a single lyrics token", async () => {
    await mountGame();
    const toggle = screen.getByRole("button", { name: /Tes mots/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("0 mot");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.closest(".lyrix-words")?.className).toMatch(/is-open/);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(wordTokenRenders.count).toBe(0);
  });
});
