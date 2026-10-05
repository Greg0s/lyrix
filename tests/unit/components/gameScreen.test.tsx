// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CELEBRATION_MS } from "../../../src/components/confetti";
import { utcDay } from "../../../src/game/daily";
import type { GuessResult, RoundView } from "../../../src/game/types";
import { saveRound } from "../../../src/roundStorage";

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
const { prefetchTodayRound, takePrefetchedRound } = await import("../../../src/roundPrefetch");
const { PEEK_FADE_MS, PEEK_SHOW_MS } = await import("../../../src/components/WordToken");

function tokens(text: string, revealed = false) {
  return text.split(" ").flatMap((word, index) => {
    const token = { text: revealed ? word : "_".repeat(word.length), isWord: true, revealed };
    return index === 0 ? [token] : [{ text: " ", isWord: false, revealed: true }, token];
  });
}

function round(state = "state-0"): RoundView {
  return {
    state,
    day: utcDay(),
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
  takePrefetchedRound();
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

// On a first visit, today's round used to be asked for only once the whole
// app had rendered and useGame's effect had run: main.tsx now asks first.
describe("today's round, asked for before the app rendered", () => {
  it("is the one the game shows, without asking a second time", async () => {
    fetchRound.mockResolvedValue(round("prefetched"));
    prefetchTodayRound("/");
    expect(fetchRound).toHaveBeenCalledTimes(1);

    await mountGame();
    expect(fetchRound).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Couplet 1")).toBeTruthy();
  });

  it("is not asked for when today's round is saved, nor for a day of the archives", () => {
    saveRound(round(), []);
    prefetchTodayRound("/");
    window.localStorage.clear();
    // Yesterday: always a day of the archives, whenever the suite runs.
    prefetchTodayRound(`/archives/${utcDay(new Date(Date.now() - 86_400_000))}`);

    expect(fetchRound).not.toHaveBeenCalled();
    expect(takePrefetchedRound()).toBeNull();
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
    await waitFor(() => expect(window.localStorage.getItem(`lyrix:day:${utcDay()}`)).toBeTruthy());

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
    expect(window.localStorage.getItem(`lyrix:day:${utcDay()}`)).toBeNull();

    window.dispatchEvent(new Event("pagehide"));

    const saved = window.localStorage.getItem(`lyrix:day:${utcDay()}`);
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
  // A network that never answers is given up on (GUESS_TIMEOUT_MS,
  // tests/unit/api/timeout.test.ts): what the player gets is the dock back,
  // told the word didn't go, with the word still there to send again.
  it("gives the dock back once the guess has timed out", async () => {
    submitGuess.mockRejectedValueOnce(new DOMException("request timed out", "TimeoutError"));
    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);

    await waitFor(() => expect(screen.getByText("Le mot n'a pas pu être envoyé, réessaie.")).toBeTruthy());
    const button = screen.getByRole("button", { name: "Valider" });
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(input.value).toBe("vent");

    submitGuess.mockResolvedValueOnce(missed);
    fireEvent.submit(input);
    await waitFor(() => expect(screen.getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy());
    expect(submitGuess).toHaveBeenCalledTimes(2);
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

describe("the rules' page", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  async function toggleRules(): Promise<void> {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Comment jouer" }));
    });
  }

  async function back(): Promise<void> {
    await act(async () => {
      const popped = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
      window.history.back();
      await popped;
    });
  }

  it("opens at its own address from the header, which says so, and closes from the same button", async () => {
    await mountGame();

    await toggleRules();
    expect(window.location.pathname).toBe("/comment-jouer");
    expect(screen.getByRole("heading", { name: /^Comment on joue/ })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Comment jouer" }).getAttribute("aria-current")).toBe("page");

    await toggleRules();
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(await screen.findByPlaceholderText("Propose un mot…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Comment jouer" }).getAttribute("aria-current")).toBeNull();
  });

  it("closes from its own button too", async () => {
    await mountGame();
    await toggleRules();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "C'est parti" }));
    });
    expect(await screen.findByPlaceholderText("Propose un mot…")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });

  it("follows the browser's Back to the round", async () => {
    await mountGame();
    await toggleRules();
    await back();
    expect(await screen.findByPlaceholderText("Propose un mot…")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });

  it("closes to today's round when the player landed on it from a link, Back reopening it", async () => {
    window.history.replaceState(null, "", "/comment-jouer");
    await act(async () => {
      render(<GameScreen />);
    });
    expect(screen.getByRole("heading", { name: /^Comment on joue/ })).toBeTruthy();

    await toggleRules();
    expect(await screen.findByPlaceholderText("Propose un mot…")).toBeTruthy();
    expect(window.location.pathname).toBe("/");

    await back();
    expect(window.location.pathname).toBe("/comment-jouer");
    expect(screen.getByRole("heading", { name: /^Comment on joue/ })).toBeTruthy();
  });

  it("keeps the round as it was, with no second round trip", async () => {
    submitGuess.mockResolvedValue({ ...round("state-1"), found: false, key: "vent", score: 12, near: [] });
    const input = await mountGame();
    fireEvent.change(input, { target: { value: "vent" } });
    fireEvent.submit(input);
    await waitFor(() => expect(screen.getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy());

    await toggleRules();
    await toggleRules();

    expect(await screen.findByText("vent", { selector: ".lyrix-chip" })).toBeTruthy();
    expect(fetchRound).toHaveBeenCalledTimes(1);
  });
});

describe("the dialogs (v3 header)", () => {
  it("gives the input back on Escape", async () => {
    const input = await mountGame();
    fireEvent.click(screen.getByRole("button", { name: "Jouer à plusieurs" }));
    expect(screen.getByRole("dialog", { name: "Jouer à plusieurs" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(input);
  });

  // Regression: closing a dialog always focused the guess input, which on a
  // phone opened the on-screen keyboard every time a dialog was dismissed.
  describe("on a touch screen", () => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(pointer: coarse)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it("gives focus back to the multiplayer button, not to the input (which would open the keyboard)", async () => {
      const input = await mountGame();
      const opener = screen.getByRole("button", { name: "Jouer à plusieurs" });

      opener.focus();
      fireEvent.click(opener);
      expect(screen.getByRole("dialog", { name: "Jouer à plusieurs" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(document.activeElement).not.toBe(input);
      expect(document.activeElement).toBe(opener);
    });
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

  it("closes the side card for good from its cross, without opening the dialog or re-rendering the lyrics", async () => {
    await mountGame();

    fireEvent.click(screen.getByRole("button", { name: "Masquer cette suggestion" }));
    expect(screen.queryByRole("button", { name: /Chercher à plusieurs/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(wordTokenRenders.count).toBe(0);
    // The header's button still leads to rooms.
    expect(screen.getByRole("button", { name: "Jouer à plusieurs" })).toBeTruthy();

    cleanup();
    await mountGame();
    expect(screen.queryByRole("button", { name: /Chercher à plusieurs/ })).toBeNull();
  });
});

describe("the theme toggle", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("switches the palette and remembers the choice, without re-rendering a single lyrics token", async () => {
    document.documentElement.dataset.theme = "light";
    await mountGame();

    fireEvent.click(screen.getByRole("button", { name: "Passer en mode sombre" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("lyrix:theme")).toBe("dark");
    expect(wordTokenRenders.count).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Passer en mode clair" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("lyrix:theme")).toBe("light");
    expect(wordTokenRenders.count).toBe(0);
  });

  it("starts from the theme index.html already put on the page", async () => {
    document.documentElement.dataset.theme = "dark";
    await mountGame();

    expect(screen.getByRole("button", { name: "Passer en mode clair" })).toBeTruthy();
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

// GitHub issue #42: confetti, the title's words popping in turn, the panel bouncing in.
describe("celebrating the win", () => {
  /** The Worker's answer to a guess once the title is complete: every title word out, the lyrics as they were. */
  function won(state: string, key: string): GuessResult {
    return {
      ...round(state),
      title: { tokens: tokens("Le refuge de novembre", true) },
      victory: true,
      artist: "Anaïs Verger",
      found: true,
      key,
      score: 100,
      near: [],
    };
  }

  /** Every word on the page, the title's and the lyrics'. */
  const WORDS = 4 + 7 + 6 + 6;

  function confetti(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".lyrix-confetti");
  }

  function titleBlock(): HTMLElement {
    return document.querySelector<HTMLElement>(".lyrix-title-block") as HTMLElement;
  }

  /** Proposes `word` and lets the answer land. Not through waitFor, which polls with the setTimeout these tests fake. */
  async function propose(input: HTMLInputElement, word: string): Promise<void> {
    fireEvent.change(input, { target: { value: word } });
    await act(async () => {
      fireEvent.submit(input);
    });
  }

  it("bursts once, the moment the guess completing the title lands, and is gone once it has fallen", async () => {
    submitGuess.mockResolvedValueOnce(won("state-won", "novembre"));
    const input = await mountGame();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await propose(input, "novembre");

    expect(screen.getByText("Bravo, tu l'as trouvée !")).toBeTruthy();
    const layer = confetti();
    expect(layer?.querySelectorAll(".lyrix-confetti-piece").length).toBeGreaterThan(0);
    // Left alone by screen readers, which read the victory text instead.
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    // Straight under <body>: in the song card, which its entrance animation
    // leaves transformed, `position: fixed` would be fixed to the card.
    expect(layer?.parentElement).toBe(document.body);
    expect(titleBlock().className).toContain("is-celebrating");

    // A lyrics word found while it falls: the same burst goes on, it doesn't start over.
    submitGuess.mockResolvedValueOnce(won("state-won-2", "vent"));
    await propose(input, "vent");
    expect(confetti()).toBe(layer);

    act(() => vi.advanceTimersByTime(CELEBRATION_MS));
    expect(confetti()).toBeNull();

    submitGuess.mockResolvedValueOnce(won("state-won-3", "porte"));
    await propose(input, "porte");
    expect(confetti()).toBeNull();
  });

  it("re-renders no word beyond what the win itself does, from the burst to its end", async () => {
    submitGuess.mockResolvedValueOnce(won("state-won", "novembre"));
    const input = await mountGame();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await propose(input, "novembre");
    // Each word once, for the round that changed, and nothing more for the celebration.
    expect(wordTokenRenders.count).toBe(WORDS);

    wordTokenRenders.count = 0;
    act(() => vi.advanceTimersByTime(CELEBRATION_MS));
    expect(confetti()).toBeNull();
    expect(wordTokenRenders.count).toBe(0);
  });

  it.each([
    [
      "restored from storage",
      () => saveRound(won("state-won", "novembre"), [{ key: "novembre", display: "novembre", found: true, score: 100, near: [] }]),
    ],
    ["loaded from the Worker", () => void fetchRound.mockResolvedValue(won("state-won", "novembre"))],
  ])("never plays for a round that comes back already won: %s", async (_, setUp) => {
    setUp();
    await mountGame();

    expect(screen.getByText("Bravo, tu l'as trouvée !")).toBeTruthy();
    expect(confetti()).toBeNull();
    expect(titleBlock().className).not.toContain("is-celebrating");
  });

  it("plays no confetti at all under reduced motion, and still shows the victory", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    submitGuess.mockResolvedValueOnce(won("state-won", "novembre"));
    const input = await mountGame();

    await propose(input, "novembre");

    expect(screen.getByText("Bravo, tu l'as trouvée !")).toBeTruthy();
    expect(confetti()).toBeNull();
  });
});
