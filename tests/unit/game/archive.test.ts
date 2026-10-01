import { describe, expect, it } from "vitest";
import {
  archiveOverview,
  coverTitleSize,
  daysToFind,
  groupEntry,
  nextDayToFind,
  triesLabel,
  withGroupDays,
  type ArchiveEntry,
} from "../../../src/game/archive";
import type { RoomDaySummary } from "../../../src/game/room";

const NOW = new Date("2026-10-01T10:00:00Z");

function entry(extra: Partial<ArchiveEntry> = {}): ArchiveEntry {
  return { title: [{ text: "____", isWord: true, revealed: false }], percent: 12, victory: false, tries: 3, ...extra };
}

describe("archiveOverview", () => {
  const entries = {
    "2026-10-01": entry(),
    "2026-09-30": entry({ victory: true, percent: 40, artist: "Bigflo & Oli" }),
    "2026-09-29": entry(),
    "2026-09-28": entry({ tries: 0, percent: 0 }),
    // Before the first song: never shown, whatever storage says.
    "2026-09-05": entry({ victory: true }),
  };
  const overview = archiveOverview(entries, NOW);
  const status = (day: string) => overview.days.find((archived) => archived.day === day)?.status;

  it("spans the last 30 days, newest first", () => {
    expect(overview.days).toHaveLength(30);
    expect(overview.days[0].day).toBe("2026-10-01");
    expect(overview.days[29].day).toBe("2026-09-02");
  });

  it("tells each day's state", () => {
    expect(status("2026-10-01")).toBe("today");
    expect(status("2026-09-30")).toBe("solved");
    expect(status("2026-09-29")).toBe("progress");
    expect(status("2026-09-27")).toBe("new");
    expect(status("2026-09-11")).toBe("unavailable");
    expect(status("2026-09-05")).toBe("unavailable");
  });

  it("keeps a day opened without a guess still to discover, its title unseen", () => {
    const opened = overview.days.find((archived) => archived.day === "2026-09-28");
    expect(opened).toMatchObject({ status: "new", entry: null });
  });

  it("counts the songs found against the days that had one", () => {
    expect(overview.solved).toBe(1);
    expect(overview.playable).toBe(20);
  });

  it("marks the oldest day as leaving tomorrow, unless found or unplayable", () => {
    const later = new Date("2026-10-20T10:00:00Z");
    expect(archiveOverview({}, later).days.at(-1)).toMatchObject({ day: "2026-09-21", leaving: true });
    expect(archiveOverview({ "2026-09-21": entry({ victory: true }) }, later).days.at(-1)?.leaving).toBe(false);
    expect(overview.days.at(-1)?.leaving).toBe(false);
  });
});

describe("the days still to find", () => {
  const entries = { "2026-09-30": entry({ victory: true }), "2026-09-29": entry() };

  it("are the past days that had a song and aren't found, newest first", () => {
    const days = daysToFind(entries, NOW);
    expect(days[0]).toBe("2026-09-29");
    expect(days).not.toContain("2026-10-01");
    expect(days).not.toContain("2026-09-30");
    expect(days.at(-1)).toBe("2026-09-12");
    expect(days).toHaveLength(18);
  });

  it("suggest the most recent one but the day just played", () => {
    expect(nextDayToFind(entries, "2026-09-29", NOW)).toBe("2026-09-28");
    expect(nextDayToFind(entries, "2026-09-26", NOW)).toBe("2026-09-29");
  });

  it("run out once every day is found", () => {
    const all = Object.fromEntries(daysToFind({}, NOW).map((day) => [day, entry({ victory: true })]));
    expect(nextDayToFind(all, "2026-09-26", NOW)).toBeNull();
  });
});

describe("coverTitleSize", () => {
  it("sets a short title large", () => {
    expect(coverTitleSize("Le Sud")).toBe(30);
    expect(coverTitleSize("Caroline")).toBeGreaterThanOrEqual(28);
  });

  it("shrinks a long title to fit, never breaking a word", () => {
    const long = coverTitleSize("Il est cinq heures, Paris s'éveille");
    expect(long).toBeLessThan(coverTitleSize("Le Sud"));
    expect(long).toBeGreaterThanOrEqual(14);
    // The longest word fits on one line, a hyphenated one wrapping at its hyphen.
    expect("Désenchantée".length * coverTitleSize("Désenchantée") * 0.6).toBeLessThanOrEqual(140);
    expect("Seychelles".length * coverTitleSize("Paris-Seychelles") * 0.6).toBeLessThanOrEqual(140);
  });
});

describe("triesLabel", () => {
  it("agrees with its number", () => {
    expect(triesLabel(1)).toBe("1 essai");
    expect(triesLabel(41)).toBe("41 essais");
  });
});

// A room's days, in its members' archives (#B).
describe("the group's collection", () => {
  const word = (text: string, revealed: boolean) => ({ text: revealed ? text : "_".repeat(text.length), isWord: true, revealed });
  const space = { text: " ", isWord: false, revealed: true };
  const leo = { id: "m2", name: "Léo", number: 2 };
  const won: RoomDaySummary = {
    day: "2026-09-20",
    title: [word("Le", true), space, word("Sud", true)],
    percent: 40,
    victory: true,
    guesses: 9,
    artist: "Nino Ferrer",
    winner: leo,
    titleBeforeWin: [word("Le", true), space, word("Sud", false)],
  };

  it("shows a day the group won to the member who completed it, as found", () => {
    expect(groupEntry(won, "m2", false)).toMatchObject({ victory: true, artist: "Nino Ferrer", tries: 9, byGroup: true });
  });

  it("never shows its title to a member still looking on their own", () => {
    const entry = groupEntry(won, "m1", false);
    expect(entry).toMatchObject({ victory: false, groupFound: true, percent: 40 });
    expect(entry.artist).toBeUndefined();
    expect(entry.title.map((token) => token.text).join("")).toBe("Le ___");
    const without: RoomDaySummary = { ...won };
    delete without.titleBeforeWin;
    expect(groupEntry(without, "m1", false).title.every((token) => !token.isWord || /^_+$/.test(token.text))).toBe(true);
  });

  it("shows it once the member asked for the answer", () => {
    expect(groupEntry(won, "m1", true).victory).toBe(true);
  });

  it("keeps a day the player found, and the group's progress where it is further along", () => {
    const own = { "2026-09-20": entry({ victory: true }), "2026-09-21": entry({ percent: 50 }), "2026-09-22": entry({ percent: 5 }) };
    const group = {
      "2026-09-20": entry({ percent: 90, byGroup: true }),
      "2026-09-21": entry({ percent: 20, byGroup: true }),
      "2026-09-22": entry({ percent: 30, byGroup: true }),
      "2026-09-23": entry({ percent: 10, byGroup: true }),
    };
    const merged = withGroupDays(own, group);
    expect(merged["2026-09-20"].byGroup).toBeUndefined();
    expect(merged["2026-09-21"].percent).toBe(50);
    expect(merged["2026-09-22"].percent).toBe(30);
    expect(merged["2026-09-23"].byGroup).toBe(true);
  });
});
