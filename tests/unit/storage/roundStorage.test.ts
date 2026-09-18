import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoundView } from "../../../src/game/types";
import type { TriedWord } from "../../../src/hooks/useGame";
import { flushSavedRound, loadSavedRound, saveRound, saveRoundSoon, todayKey } from "../../../src/roundStorage";

// The module's own storage key isn't exported (it's a private implementation
// detail), so tests that need to write a raw entry directly duplicate it here.
const STORAGE_KEY = "lyrix:round";

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

const round: RoundView = {
  songId: "papaoutai",
  state: "signed-state",
  title: { tokens: [{ text: "____", isWord: true, revealed: false }] },
  sections: [],
  victory: false,
};

const triedWords: TriedWord[] = [
  { key: "le", display: "Le", found: true, score: 100, near: [] },
  { key: "orage", display: "orage", found: false, score: 41, near: [{ position: 3, score: 41 }] },
  { key: "zzzz", display: "zzzz", found: false, score: null, near: [] },
];

function savedToday(words: unknown[]): Storage {
  return fakeStorage({ [STORAGE_KEY]: JSON.stringify({ date: todayKey(), round, triedWords: words }) });
}

describe("roundStorage", () => {
  it("round-trips a saved round for today", () => {
    const storage = fakeStorage();
    saveRound(round, triedWords, storage);
    expect(loadSavedRound(storage)).toEqual({ round, triedWords });
  });

  it("returns null when nothing is saved", () => {
    expect(loadSavedRound(fakeStorage())).toBeNull();
  });

  it("ignores a saved round from a previous day", () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ date: "2000-01-01", round, triedWords }) });
    expect(loadSavedRound(storage)).toBeNull();
  });

  it("ignores corrupted JSON instead of throwing", () => {
    const storage = fakeStorage({ [STORAGE_KEY]: "not json" });
    expect(loadSavedRound(storage)).toBeNull();
  });

  it("ignores a malformed saved shape", () => {
    const malformed = JSON.stringify({ date: todayKey(), round: { not: "a round" }, triedWords: [] });
    const storage = fakeStorage({ [STORAGE_KEY]: malformed });
    expect(loadSavedRound(storage)).toBeNull();
  });

  it("treats storage that throws as unavailable, without throwing itself", () => {
    const throwing: Storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    expect(loadSavedRound(throwing)).toBeNull();
    expect(() => saveRound(round, triedWords, throwing)).not.toThrow();
  });

  it("returns null when no storage is available at all", () => {
    expect(loadSavedRound(undefined)).toBeNull();
  });

  // Regression test: proximity scores were added after the first release, so
  // rounds saved by the previous version have no `score` field. Rejecting
  // those would silently wipe the player's progress on the one song of the day.
  it("loads a round saved before proximity scores existed", () => {
    expect(loadSavedRound(savedToday([{ key: "le", display: "Le", found: true }]))).toEqual({
      round,
      triedWords: [{ key: "le", display: "Le", found: true, score: null, near: [] }],
    });
  });

  // Close words shown in the lyrics came later still: a round saved in
  // between has scores but no placements, and must keep its progress too.
  it("loads a round saved before close words were shown in the lyrics", () => {
    const saved = savedToday([{ key: "orage", display: "orage", found: false, score: 41 }]);
    expect(loadSavedRound(saved)?.triedWords).toEqual([
      { key: "orage", display: "orage", found: false, score: 41, near: [] },
    ]);
  });

  it("drops a malformed placement rather than the whole round", () => {
    const saved = savedToday([
      {
        key: "orage",
        display: "orage",
        found: false,
        score: 41,
        near: [{ position: -1, score: 41 }, { position: 2, score: 41 }, "junk"],
      },
    ]);
    expect(loadSavedRound(saved)?.triedWords[0].near).toEqual([{ position: 2, score: 41 }]);
  });

  it("ignores a saved round holding a malformed tried word", () => {
    expect(loadSavedRound(savedToday([{ key: "le", display: "Le" }]))).toBeNull();
  });
});

describe("saveRoundSoon", () => {
  afterEach(() => {
    flushSavedRound();
    vi.useRealTimers();
  });

  it("writes nothing straight away", () => {
    vi.useFakeTimers();
    const storage = fakeStorage();

    saveRoundSoon(round, triedWords, storage);

    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("writes once the player has stopped, and loads back identically", () => {
    vi.useFakeTimers();
    const storage = fakeStorage();

    saveRoundSoon(round, triedWords, storage);
    vi.runAllTimers();

    expect(loadSavedRound(storage)).toEqual({ round, triedWords });
  });

  it("collapses a burst of guesses into a single write", () => {
    vi.useFakeTimers();
    const storage = fakeStorage();
    const setItem = vi.spyOn(storage, "setItem");

    saveRoundSoon(round, [], storage);
    saveRoundSoon(round, triedWords.slice(0, 1), storage);
    saveRoundSoon(round, triedWords, storage);
    vi.runAllTimers();

    expect(setItem).toHaveBeenCalledTimes(1);
    // The newest state wins - a collapsed write must never lose a guess.
    expect(loadSavedRound(storage)?.triedWords).toEqual(triedWords);
  });

  it("can be forced out early, for a tab about to go away", () => {
    vi.useFakeTimers();
    const storage = fakeStorage();

    saveRoundSoon(round, triedWords, storage);
    flushSavedRound();

    expect(loadSavedRound(storage)).toEqual({ round, triedWords });
    // Nothing is left pending afterwards, so the timer can't write a second time.
    const setItem = vi.spyOn(storage, "setItem");
    vi.runAllTimers();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("schedules again after a flush", () => {
    vi.useFakeTimers();
    const storage = fakeStorage();

    saveRoundSoon(round, [], storage);
    flushSavedRound();
    saveRoundSoon(round, triedWords, storage);
    vi.runAllTimers();

    expect(loadSavedRound(storage)?.triedWords).toEqual(triedWords);
  });

  it("does nothing at all without a storage", () => {
    expect(() => saveRoundSoon(round, triedWords, undefined)).not.toThrow();
  });
});
