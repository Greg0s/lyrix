import { afterEach, describe, expect, it, vi } from "vitest";
import type { DisplayToken, RoundView } from "../../../src/game/types";
import type { TriedWord } from "../../../src/hooks/useGame";
import {
  flushSavedRound,
  loadArchive,
  loadSavedDay,
  loadSavedRound,
  saveRound,
  saveRoundSoon,
} from "../../../src/roundStorage";

// The module's storage keys aren't exported (they're a private implementation
// detail), so tests that need to write or check a raw entry duplicate them here.
const dayKey = (day: string) => `lyrix:day:${day}`;
const viewKey = (day: string) => `lyrix:view:${day}`;
const ARCHIVE_KEY = "lyrix:archive";
const LEGACY_KEY = "lyrix:round";

const NOW = new Date("2026-10-01T10:00:00Z");
const TODAY = "2026-10-01";
const YESTERDAY = "2026-09-30";

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

function roundOf(day: string, state = `state-${day}`, extra: Partial<RoundView> = {}): RoundView {
  return {
    state,
    day,
    title: { tokens: [{ text: "____", isWord: true, revealed: false }] },
    sections: [],
    victory: false,
    ...extra,
  };
}

const round = roundOf(TODAY);

const triedWords: TriedWord[] = [
  { key: "le", display: "Le", found: true, score: 100, near: [] },
  { key: "orage", display: "orage", found: false, score: 41, near: [{ position: 3, score: 41 }] },
  { key: "zzzz", display: "zzzz", found: false, score: null, near: [] },
];

/** Today's round as saved by hand, its tried words written raw. */
function savedToday(words: unknown[]): Storage {
  return fakeStorage({
    [dayKey(TODAY)]: JSON.stringify({ state: round.state, triedWords: words }),
    [viewKey(TODAY)]: JSON.stringify(round),
  });
}

function undated(view: RoundView): Omit<RoundView, "day"> {
  const copy: Partial<RoundView> = { ...view };
  delete copy.day;
  return copy as Omit<RoundView, "day">;
}

describe("roundStorage", () => {
  it("round-trips today's round", () => {
    const storage = fakeStorage();
    saveRound(round, triedWords, storage, NOW);
    expect(loadSavedRound(storage, NOW)).toEqual({ round, triedWords });
  });

  it("returns null when nothing is saved", () => {
    expect(loadSavedRound(fakeStorage(), NOW)).toBeNull();
    expect(loadSavedDay(YESTERDAY, fakeStorage(), NOW)).toBeNull();
  });

  it("keeps a past day's state and tried words, but no longer its view", () => {
    const storage = fakeStorage();
    saveRound(roundOf(YESTERDAY), triedWords, storage, new Date("2026-09-30T22:00:00Z"));
    expect(storage.getItem(viewKey(YESTERDAY))).not.toBeNull();

    expect(loadSavedRound(storage, NOW)).toBeNull();
    expect(loadSavedDay(YESTERDAY, storage, NOW)).toEqual({ state: `state-${YESTERDAY}`, triedWords });
    expect(storage.getItem(viewKey(YESTERDAY))).toBeNull();
  });

  it("saves a round of an archived day without its view", () => {
    const storage = fakeStorage();
    saveRound(roundOf("2026-09-20"), triedWords, storage, NOW);
    expect(storage.getItem(viewKey("2026-09-20"))).toBeNull();
    expect(loadSavedDay("2026-09-20", storage, NOW)).toEqual({ state: "state-2026-09-20", triedWords });
  });

  it("keeps every day apart", () => {
    const storage = fakeStorage();
    saveRound(roundOf("2026-09-20"), triedWords.slice(0, 1), storage, NOW);
    saveRound(round, triedWords, storage, NOW);
    expect(loadSavedDay("2026-09-20", storage, NOW)?.triedWords).toEqual(triedWords.slice(0, 1));
    expect(loadSavedRound(storage, NOW)?.triedWords).toEqual(triedWords);
    expect(Object.keys(loadArchive(storage, NOW)).sort()).toEqual(["2026-09-20", TODAY]);
  });

  it("forgets a day once it has left the archives", () => {
    const storage = fakeStorage();
    saveRound(roundOf("2026-09-02"), triedWords, storage, NOW);
    saveRound(roundOf("2026-09-03"), triedWords, storage, NOW);

    const nextDay = new Date("2026-10-02T08:00:00Z");
    expect(loadSavedDay("2026-09-02", storage, nextDay)).toBeNull();
    expect(storage.getItem(dayKey("2026-09-02"))).toBeNull();
    expect(Object.keys(loadArchive(storage, nextDay))).toEqual(["2026-09-03"]);
  });

  it("files a view without a day under today", () => {
    const storage = fakeStorage();
    saveRound(undated(round) as RoundView, triedWords, storage, NOW);
    expect(loadSavedRound(storage, NOW)?.round.day).toBe(TODAY);
  });

  it("doesn't resume a view saved for another state than the round's", () => {
    const storage = fakeStorage({
      [dayKey(TODAY)]: JSON.stringify({ state: "newer-state", triedWords }),
      [viewKey(TODAY)]: JSON.stringify(round),
    });
    expect(loadSavedRound(storage, NOW)).toBeNull();
    expect(loadSavedDay(TODAY, storage, NOW)).toEqual({ state: "newer-state", triedWords });
  });

  it("ignores corrupted JSON instead of throwing", () => {
    const storage = fakeStorage({ [dayKey(TODAY)]: "not json", [ARCHIVE_KEY]: "not json either" });
    expect(loadSavedRound(storage, NOW)).toBeNull();
    expect(loadArchive(storage, NOW)).toEqual({});
  });

  it("ignores a malformed saved shape", () => {
    const storage = fakeStorage({ [dayKey(TODAY)]: JSON.stringify({ not: "a round" }) });
    expect(loadSavedDay(TODAY, storage, NOW)).toBeNull();
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
    expect(loadSavedRound(throwing, NOW)).toBeNull();
    expect(loadArchive(throwing, NOW)).toEqual({});
    expect(() => saveRound(round, triedWords, throwing, NOW)).not.toThrow();
  });

  it("keeps a day's progress when only the view is refused, for lack of room", () => {
    const store = fakeStorage();
    const full: Storage = {
      getItem: (key) => store.getItem(key),
      setItem: (key, value) => {
        if (key.startsWith("lyrix:view:")) throw new DOMException("full", "QuotaExceededError");
        store.setItem(key, value);
      },
      removeItem: (key) => store.removeItem(key),
      clear: () => store.clear(),
      key: (index) => store.key(index),
      get length() {
        return store.length;
      },
    };
    saveRound(round, triedWords, full, NOW);
    expect(loadSavedDay(TODAY, full, NOW)).toEqual({ state: round.state, triedWords });
    expect(loadArchive(full, NOW)[TODAY]).toBeDefined();
  });

  it("returns nothing when no storage is available at all", () => {
    expect(loadSavedRound(undefined, NOW)).toBeNull();
    expect(loadArchive(undefined, NOW)).toEqual({});
  });

  // Regression test: proximity scores were added after the first release, so
  // rounds saved by the previous version have no `score` field. Rejecting
  // those would silently wipe the player's progress on the song.
  it("loads a round saved before proximity scores existed", () => {
    expect(loadSavedRound(savedToday([{ key: "le", display: "Le", found: true }]), NOW)).toEqual({
      round,
      triedWords: [{ key: "le", display: "Le", found: true, score: null, near: [] }],
    });
  });

  // Close words shown in the lyrics came later still: a round saved in
  // between has scores but no placements, and must keep its progress too.
  it("loads a round saved before close words were shown in the lyrics", () => {
    const saved = savedToday([{ key: "orage", display: "orage", found: false, score: 41 }]);
    expect(loadSavedRound(saved, NOW)?.triedWords).toEqual([
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
    expect(loadSavedRound(saved, NOW)?.triedWords[0].near).toEqual([{ position: 2, score: 41 }]);
  });

  it("ignores a saved round holding a malformed tried word", () => {
    expect(loadSavedRound(savedToday([{ key: "le", display: "Le" }]), NOW)).toBeNull();
  });
});

describe("the archive summary", () => {
  const hidden: DisplayToken = { text: "______", isWord: true, revealed: false, devHint: "refuge", revealHint: "refuge" };
  const found: DisplayToken = { text: "Le", isWord: true, revealed: true };
  const space: DisplayToken = { text: " ", isWord: false, revealed: true };

  it("keeps the title as left, the share revealed and the tries", () => {
    const storage = fakeStorage();
    const played = roundOf("2026-09-26", "s", {
      title: { tokens: [found, space, hidden] },
      sections: [{ label: "Refrain", lines: [{ tokens: [found, space, hidden, space, hidden] }] }],
    });
    saveRound(played, triedWords, storage, NOW);
    expect(loadArchive(storage, NOW)["2026-09-26"]).toEqual({
      title: [found, space, { text: "______", isWord: true, revealed: false }],
      percent: 40,
      victory: false,
      tries: 3,
    });
  });

  it("never keeps a hidden word's text, dev or post-victory hint included", () => {
    const storage = fakeStorage();
    saveRound(roundOf("2026-09-26", "s", { title: { tokens: [hidden] } }), [], storage, NOW);
    expect(storage.getItem(ARCHIVE_KEY)).not.toContain("refuge");
  });

  it("names the artist once the song is found, and only then", () => {
    const storage = fakeStorage();
    saveRound(roundOf("2026-09-26", "s", { title: { tokens: [found] }, victory: true, artist: "Louane" }), [], storage, NOW);
    saveRound(roundOf("2026-09-27", "t", { artist: "Leaked" }), [], storage, NOW);
    const archive = loadArchive(storage, NOW);
    expect(archive["2026-09-26"]).toMatchObject({ victory: true, artist: "Louane", percent: 100 });
    expect(archive["2026-09-27"].artist).toBeUndefined();
  });

  it("drops a malformed entry rather than the whole archive", () => {
    const storage = fakeStorage();
    saveRound(roundOf("2026-09-26"), [], storage, NOW);
    const raw = JSON.parse(storage.getItem(ARCHIVE_KEY) ?? "{}") as Record<string, unknown>;
    storage.setItem(
      ARCHIVE_KEY,
      JSON.stringify({ ...raw, "2026-09-27": { title: "nope" }, "not-a-day": raw["2026-09-26"] })
    );
    expect(Object.keys(loadArchive(storage, NOW))).toEqual(["2026-09-26"]);
  });
});

// Before the archives, one round was kept, under one key, and forgotten at
// UTC midnight: a round started yesterday was lost. It now joins the archives.
describe("the round saved before the archives", () => {
  function legacy(date: string): Storage {
    return fakeStorage({
      [LEGACY_KEY]: JSON.stringify({ date, round: { ...undated(round), state: "legacy" }, triedWords }),
    });
  }

  it("resumes as today's round", () => {
    const storage = legacy(TODAY);
    expect(loadSavedRound(storage, NOW)).toEqual({ round: { ...round, state: "legacy" }, triedWords });
    expect(storage.getItem(LEGACY_KEY)).toBeNull();
  });

  it("joins the archives when it was yesterday's, instead of being lost", () => {
    const storage = legacy(YESTERDAY);
    expect(loadSavedRound(storage, NOW)).toBeNull();
    expect(loadSavedDay(YESTERDAY, storage, NOW)).toEqual({ state: "legacy", triedWords });
    expect(loadArchive(storage, NOW)[YESTERDAY]).toMatchObject({ tries: 3, victory: false });
  });

  it("is dropped when older than the archives, or unreadable", () => {
    const old = legacy("2026-08-01");
    expect(loadArchive(old, NOW)).toEqual({});
    expect(old.length).toBe(0);

    const broken = fakeStorage({ [LEGACY_KEY]: JSON.stringify({ date: TODAY, round: { not: "a round" }, triedWords }) });
    expect(loadSavedRound(broken, NOW)).toBeNull();
    expect(broken.getItem(LEGACY_KEY)).toBeNull();
  });
});

describe("saveRoundSoon", () => {
  afterEach(() => {
    flushSavedRound();
    vi.useRealTimers();
  });

  function writesOf(setItem: { mock: { calls: unknown[][] } }, key: string): number {
    return setItem.mock.calls.filter(([written]) => written === key).length;
  }

  it("writes nothing straight away", () => {
    vi.useFakeTimers({ now: NOW });
    const storage = fakeStorage();

    saveRoundSoon(round, triedWords, storage);

    expect(storage.length).toBe(0);
  });

  it("writes once the player has stopped, and loads back identically", () => {
    vi.useFakeTimers({ now: NOW });
    const storage = fakeStorage();

    saveRoundSoon(round, triedWords, storage);
    vi.runAllTimers();

    expect(loadSavedRound(storage, NOW)).toEqual({ round, triedWords });
  });

  it("collapses a burst of guesses into a single write", () => {
    vi.useFakeTimers({ now: NOW });
    const storage = fakeStorage();
    const setItem = vi.spyOn(storage, "setItem");

    saveRoundSoon(round, [], storage);
    saveRoundSoon(round, triedWords.slice(0, 1), storage);
    saveRoundSoon(round, triedWords, storage);
    vi.runAllTimers();

    expect(writesOf(setItem, dayKey(TODAY))).toBe(1);
    expect(writesOf(setItem, viewKey(TODAY))).toBe(1);
    // The newest state wins - a collapsed write must never lose a guess.
    expect(loadSavedRound(storage, NOW)?.triedWords).toEqual(triedWords);
  });

  it("keeps the latest write of each day, never one day's for another's", () => {
    vi.useFakeTimers({ now: NOW });
    const storage = fakeStorage();

    saveRoundSoon(roundOf("2026-09-20"), triedWords.slice(0, 1), storage);
    saveRoundSoon(round, triedWords, storage);
    vi.runAllTimers();

    expect(loadSavedDay("2026-09-20", storage, NOW)?.triedWords).toEqual(triedWords.slice(0, 1));
    expect(loadSavedRound(storage, NOW)?.triedWords).toEqual(triedWords);
  });

  it("can be forced out early, for a tab about to go away", () => {
    vi.useFakeTimers({ now: NOW });
    const storage = fakeStorage();

    saveRoundSoon(round, triedWords, storage);
    flushSavedRound();

    expect(loadSavedRound(storage, NOW)).toEqual({ round, triedWords });
    // Nothing is left pending afterwards, so the timer can't write a second time.
    const setItem = vi.spyOn(storage, "setItem");
    vi.runAllTimers();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("schedules again after a flush", () => {
    vi.useFakeTimers({ now: NOW });
    const storage = fakeStorage();

    saveRoundSoon(round, [], storage);
    flushSavedRound();
    saveRoundSoon(round, triedWords, storage);
    vi.runAllTimers();

    expect(loadSavedRound(storage, NOW)?.triedWords).toEqual(triedWords);
  });

  it("does nothing at all without a storage", () => {
    expect(() => saveRoundSoon(round, triedWords, undefined)).not.toThrow();
  });
});
