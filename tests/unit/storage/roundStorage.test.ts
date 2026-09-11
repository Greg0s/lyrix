import { describe, expect, it } from "vitest";
import type { RoundView } from "../../../src/game/types";
import type { TriedWord } from "../../../src/hooks/useGame";
import { loadSavedRound, saveRound, todayKey } from "../../../src/roundStorage";

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

const triedWords: TriedWord[] = [{ key: "le", display: "Le", found: true }];

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
});
