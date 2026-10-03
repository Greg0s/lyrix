// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuessResult, RoundView } from "../../../src/game/types";
import { flushSavedRound, loadArchive, loadSavedDay, saveRound } from "../../../src/roundStorage";

/**
 * The archives (the last 30 days), as the player goes through them: the
 * header's button, the collection, a day played, won, and the way on. Mounted
 * under StrictMode, as in development: its double mount once left the game
 * stuck on "Chargement de la partie…".
 */

const fetchRound = vi.hoisted(() => vi.fn());
const resumeRound = vi.hoisted(() => vi.fn());
const submitGuess = vi.hoisted(() => vi.fn());
vi.mock("../../../src/api/client", () => ({ fetchRound, resumeRound, submitGuess }));

const { GameScreen } = await import("../../../src/components/GameScreen");

const NOW = new Date("2026-10-01T10:00:00Z");
const TODAY = "2026-10-01";
const DAY = "2026-09-26";

function tokens(text: string, revealed = false) {
  return text.split(" ").flatMap((word, index) => {
    const token = { text: revealed ? word : "_".repeat(word.length), isWord: true, revealed };
    return index === 0 ? [token] : [{ text: " ", isWord: false, revealed: true }, token];
  });
}

function round(day: string, state = `state-${day}`): RoundView {
  return {
    state,
    day,
    title: { tokens: tokens("Le refuge de novembre") },
    sections: [{ label: "Couplet 1", lines: [{ tokens: tokens("Le vent referme la porte du jardin") }] }],
    victory: false,
  };
}

function answer(day: string, key: string, found: boolean, state = `${day}-${key}`): GuessResult {
  return { ...round(day, state), found, key, score: found ? 100 : 12, near: [] };
}

function won(day: string, key: string): GuessResult {
  return {
    ...answer(day, key, true, `${day}-won`),
    title: { tokens: tokens("Le refuge de novembre", true) },
    victory: true,
    artist: "Anaïs Verger",
  };
}

async function mount(path = "/"): Promise<void> {
  window.history.replaceState(null, "", path);
  await act(async () => {
    render(
      <StrictMode>
        <GameScreen />
      </StrictMode>
    );
  });
}

async function propose(word: string): Promise<void> {
  const input = await screen.findByPlaceholderText("Propose un mot…");
  fireEvent.change(input, { target: { value: word } });
  await act(async () => {
    fireEvent.submit(input);
  });
}

async function openArchives(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Archives" }));
  });
  await screen.findByRole("heading", { name: "Les 30 derniers jours" });
}

function cover(name: RegExp): HTMLElement {
  return screen.getByRole("link", { name });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  window.localStorage.clear();
  // Like fetch: a request aborted before its answer arrives rejects.
  fetchRound.mockReset().mockImplementation(async (signal?: AbortSignal, day?: string) => {
    await Promise.resolve();
    if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    return round(day ?? TODAY);
  });
  resumeRound.mockReset();
  submitGuess.mockReset();
});

afterEach(() => {
  flushSavedRound();
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("today's song, under StrictMode", () => {
  it("loads instead of staying on the loading screen", async () => {
    await mount();
    expect(await screen.findByPlaceholderText("Propose un mot…")).toBeTruthy();
    expect(fetchRound).toHaveBeenCalled();
    expect(screen.queryByText("Chargement de la partie…")).toBeNull();
  });
});

describe("the archives screen", () => {
  it("opens from the header, at its own address, and goes back to today's song", async () => {
    await mount();
    await screen.findByPlaceholderText("Propose un mot…");
    await openArchives();
    expect(window.location.pathname).toBe("/archives");
    expect(screen.getByRole("button", { name: "Archives" }).getAttribute("aria-current")).toBe("page");

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Chanson du jour" }));
    });
    expect(window.location.pathname).toBe("/");
    expect(await screen.findByPlaceholderText("Propose un mot…")).toBeTruthy();
  });

  it("holds the last 30 days, the ones before the first song unavailable", async () => {
    await mount("/archives");
    const list = await screen.findByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(30);
    // 2026-09-12 to 2026-10-01: the game's first 20 days.
    expect(screen.getByText("0 chanson trouvée sur 20")).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Vendredi 11 septembre : pas de chanson/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Vendredi 11 septembre/ })).toBeNull();
    expect(cover(/^Samedi 12 septembre : à découvrir/)).toBeTruthy();
  });

  it("shows nothing of a song the player hasn't played", async () => {
    await mount("/archives");
    await screen.findByRole("list");
    expect(cover(/^Samedi 26 septembre : à découvrir$/).textContent).not.toMatch(/refuge|xxx/);
    expect(fetchRound).not.toHaveBeenCalledWith(expect.anything(), DAY);
  });

  it("follows Back to the screen before", async () => {
    await mount();
    await screen.findByPlaceholderText("Propose un mot…");
    await openArchives();
    await act(async () => {
      fireEvent.click(cover(/^Samedi 26 septembre/));
    });
    await screen.findByText("Samedi 26 septembre");

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
    });
    expect(await screen.findByRole("heading", { name: "Les 30 derniers jours" })).toBeTruthy();
  });

  it("turns an address it doesn't serve into the archives", async () => {
    await mount("/archives/2026-09-11");
    expect(await screen.findByRole("heading", { name: "Les 30 derniers jours" })).toBeTruthy();
    expect(window.location.pathname).toBe("/archives");
  });
});

describe("the header's logo", () => {
  async function clickLogo(): Promise<void> {
    const logo = screen.getByRole("link", { name: "Lyrix, chanson du jour" });
    expect(logo.getAttribute("href")).toBe("/");
    await act(async () => {
      fireEvent.click(logo);
    });
  }

  it("goes from the archives screen to today's song", async () => {
    await mount("/archives");
    await screen.findByRole("heading", { name: "Les 30 derniers jours" });
    await clickLogo();
    expect(window.location.pathname).toBe("/");
    expect(await screen.findByPlaceholderText("Propose un mot…")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Les 30 derniers jours" })).toBeNull();
  });

  it("goes from a day of the archives to today's song", async () => {
    await mount(`/archives/${DAY}`);
    await screen.findByText("Samedi 26 septembre");
    await clickLogo();
    expect(window.location.pathname).toBe("/");
    await screen.findByPlaceholderText("Propose un mot…");
    expect(screen.queryByText("Samedi 26 septembre")).toBeNull();
    expect(fetchRound).toHaveBeenLastCalledWith(expect.anything(), undefined);
  });
});

describe("a day of the archives", () => {
  it("is played on its own round, alone, under a bar naming the day", async () => {
    await mount(`/archives/${DAY}`);
    await screen.findByPlaceholderText("Propose un mot…");
    expect(fetchRound).toHaveBeenCalledWith(expect.anything(), DAY);
    expect(screen.getByText("Samedi 26 septembre")).toBeTruthy();
    expect(screen.getByText("Archives · il y a 5 jours")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Jour suivant : Dimanche 27 septembre" })).toBeTruthy();
    expect(screen.queryByText("Chercher à plusieurs")).toBeNull();
  });

  it("joins the archives once a word is tried on it, and not before", async () => {
    await mount(`/archives/${DAY}`);
    await screen.findByPlaceholderText("Propose un mot…");
    flushSavedRound();
    expect(loadArchive()[DAY]).toBeUndefined();

    submitGuess.mockResolvedValueOnce(answer(DAY, "vent", true));
    await propose("vent");
    flushSavedRound();
    expect(loadSavedDay(DAY)?.state).toBe(`${DAY}-vent`);
    expect(loadArchive()[DAY]).toMatchObject({ tries: 1, victory: false });

    await openArchives();
    expect(cover(/^Samedi 26 septembre : en cours/)).toBeTruthy();
  });

  it("resumes from its saved state, without starting it afresh", async () => {
    saveRound(answer(DAY, "vent", true, "saved-state"), [{ key: "vent", display: "vent", found: true, score: 100, near: [] }]);
    resumeRound.mockResolvedValue(round(DAY, "resumed-state"));
    await mount(`/archives/${DAY}`);
    await screen.findByPlaceholderText("Propose un mot…");
    expect(resumeRound).toHaveBeenCalledWith(["saved-state"], DAY, expect.anything());
    expect(fetchRound).not.toHaveBeenCalledWith(expect.anything(), DAY);
    expect(screen.getByText("vent", { selector: ".lyrix-chip" })).toBeTruthy();
  });

  it("starts afresh when its saved state no longer opens", async () => {
    saveRound(answer(DAY, "vent", true, "stale-state"), []);
    resumeRound.mockRejectedValue(new Error("invalid or expired round state"));
    await mount(`/archives/${DAY}`);
    await screen.findByPlaceholderText("Propose un mot…");
    expect(fetchRound).toHaveBeenCalledWith(expect.anything(), DAY);
  });

  it("once won, says when it was and offers the next day still to find", async () => {
    await mount(`/archives/${DAY}`);
    submitGuess.mockResolvedValueOnce(won(DAY, "novembre"));
    await propose("novembre");

    expect(screen.getByText("Chanson du samedi 26 septembre, trouvée en 1 essai.")).toBeTruthy();
    expect(screen.queryByText(/Prochaine chanson dans/)).toBeNull();
    expect(screen.getByText("Mercredi 30 septembre")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Jouer la chanson du mercredi 30 septembre" }));
    });
    expect(window.location.pathname).toBe("/archives/2026-09-30");
    await screen.findByText("Mercredi 30 septembre");
    expect(fetchRound).toHaveBeenCalledWith(expect.anything(), "2026-09-30");
  });

  it("is a cover with its title once won", async () => {
    await mount(`/archives/${DAY}`);
    submitGuess.mockResolvedValueOnce(won(DAY, "novembre"));
    await propose("novembre");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Toutes les archives" }));
    });
    expect(cover(/^Samedi 26 septembre : Le refuge de novembre, Anaïs Verger, trouvée en 1 essai$/)).toBeTruthy();
    expect(screen.getByText("Le refuge de novembre")).toBeTruthy();
  });
});

describe("today's victory", () => {
  it("points to the days of the archives still to find", async () => {
    await mount();
    submitGuess.mockResolvedValueOnce(won(TODAY, "novembre"));
    await propose("novembre");
    // Every past day of the window that had a song: 2026-09-12 to 2026-09-30.
    expect(screen.getByText("En attendant, 19 chansons des 30 derniers jours t'attendent.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Voir les archives" }));
    });
    expect(window.location.pathname).toBe("/archives");
    expect(cover(/^Chanson du jour, trouvée : Le refuge de novembre/)).toBeTruthy();
  });
});
