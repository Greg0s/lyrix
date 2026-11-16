import { describe, expect, it } from "vitest";
import { ARCHIVE_DAYS } from "../../../src/game/daily";
import {
  catalog,
  catalogRotation,
  FIRST_SONG_DAY,
  hasScheduledSong,
  monthKey,
  months,
  pickDailyEntry,
  SPARES,
} from "../../../worker/src/catalog";

const DAY_MS = 86_400_000;

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** The UTC month after the one `month` (YYYY-MM) names. */
function nextMonth(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return monthKey(new Date(Date.UTC(year, index, 1)));
}

function daysIn(month: string): number {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index, 0)).getUTCDate();
}

const listed = Object.keys(months);
const lastListedDay = (() => {
  const last = listed[listed.length - 1];
  return day(`${last}-${String(daysIn(last)).padStart(2, "0")}`);
})();

// The song each day actually served, as computed by the code that served it.
// The archives replay these days, so a catalog edit must never change one: if
// this fails, the edit rewrote a month already played - new songs go in a
// month not yet started instead. Only ever add rows.
const PLAYED: [string, string][] = [
  ["2026-10-01", "la-tribu-de-dana"],
  ["2026-10-02", "elle-a-les-yeux-revolver"],
  ["2026-10-03", "moi-lolita"],
  ["2026-10-04", "le-sud"],
  ["2026-10-05", "sauver-lamour"],
  ["2026-10-06", "cest-quand-le-bonheur"],
  ["2026-10-07", "il-est-cinq-heures-paris-seveille"],
  ["2026-10-08", "le-vent-nous-portera"],
  ["2026-10-09", "les-corons"],
  ["2026-10-10", "une-belle-histoire"],
  ["2026-10-11", "nuit-de-folie"],
  ["2026-10-12", "derniere-danse"],
  ["2026-10-13", "les-copains-dabord"],
  ["2026-10-14", "foule-sentimentale"],
  ["2026-10-15", "femme-liberee"],
  ["2026-10-16", "respire"],
  ["2026-10-17", "lete-indien"],
  ["2026-10-18", "la-terre-est-ronde"],
  ["2026-10-19", "les-demons-de-minuit"],
];

describe("catalog", () => {
  it("never plays a song twice", () => {
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
  });
});

describe("months", () => {
  it("starts on the first day the game had a song", () => {
    expect(FIRST_SONG_DAY).toBe("2026-10-01");
    expect(`${listed[0]}-01`).toBe(FIRST_SONG_DAY);
  });

  it("lists every month in order, none missing", () => {
    for (const key of listed) expect(key).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    for (let index = 1; index < listed.length; index++) expect(listed[index]).toBe(nextMonth(listed[index - 1]));
  });

  it.each(listed)("gives %s one song per day", (month) => {
    expect(months[month]).toHaveLength(daysIn(month));
  });

  // Always a month ahead: from the 1st of a month, the next one must be written.
  it("lists the month after the current one", () => {
    const ahead = nextMonth(monthKey(new Date()));
    expect(months[ahead], `no song list for ${ahead} in worker/src/catalog.ts`).toBeDefined();
  });

  it.each(PLAYED)("keeps %s on the song it served (%s)", (iso, id) => {
    expect(pickDailyEntry(day(iso)).id).toBe(id);
    // Any time of that UTC day.
    expect(pickDailyEntry(new Date(`${iso}T23:59:59Z`)).id).toBe(id);
  });

  it("plays the month's day N on its Nth song", () => {
    for (const month of listed) {
      months[month].forEach((entry, index) => {
        expect(pickDailyEntry(day(`${month}-${String(index + 1).padStart(2, "0")}`))).toEqual(entry);
      });
    }
  });

  it("had no song before its first day", () => {
    expect(hasScheduledSong(day("2026-09-30"))).toBe(false);
    expect(hasScheduledSong(new Date("2026-09-30T23:59:59Z"))).toBe(false);
    expect(hasScheduledSong(day(FIRST_SONG_DAY))).toBe(true);
    expect(hasScheduledSong(day("2027-01-01"))).toBe(true);
  });

  it("replays the last month listed rather than serving nothing past it", () => {
    const after = addDays(lastListedDay, 1);
    const last = months[listed[listed.length - 1]];
    expect(pickDailyEntry(after)).toEqual(last[0]);
    // Two months on, each day still plays its day of the month's song in the last list.
    for (let offset = 1; offset <= 62; offset++) {
      const date = addDays(lastListedDay, offset);
      expect(pickDailyEntry(date)).toEqual(last[(date.getUTCDate() - 1) % last.length]);
    }
  });

  // The archives offer the last ARCHIVE_DAYS days: none of them may be the
  // song coming tomorrow, or replaying it there would give tomorrow away.
  it("never schedules tomorrow's song among the days the archives hold", () => {
    for (let today = day(FIRST_SONG_DAY); today < lastListedDay; today = addDays(today, 1)) {
      const tomorrow = pickDailyEntry(addDays(today, 1)).id;
      for (let back = 0; back < ARCHIVE_DAYS; back++) {
        const archived = addDays(today, -back);
        if (!hasScheduledSong(archived)) break;
        expect(pickDailyEntry(archived).id, `${today.toISOString().slice(0, 10)} minus ${back} days`).not.toBe(
          tomorrow
        );
      }
    }
  });
});

describe("pickDailyEntry / catalogRotation", () => {
  it("is deterministic for a given date", () => {
    const date = new Date("2026-11-15T12:00:00Z");
    expect(pickDailyEntry(date)).toEqual(pickDailyEntry(new Date(date)));
  });

  it("advances by exactly one position per day within a month", () => {
    for (const iso of ["2026-10-20", "2026-11-15"]) {
      const today = day(iso);
      const list = months[iso.slice(0, 7)];
      const index = list.findIndex((entry) => entry.id === pickDailyEntry(today).id);
      expect(pickDailyEntry(addDays(today, 1))).toEqual(list[index + 1]);
    }
  });

  // Regression test: the fallback used to be the month's next days, so a day
  // whose song had no lyrics on LRCLIB played tomorrow's, and tomorrow played it again.
  it("falls back on the spares alone, never on a song of another day", () => {
    const scheduled = new Set(Object.values(months).flat().map((entry) => entry.id));
    for (const month of listed) {
      const date = day(`${month}-04`);
      const [pick, ...fallbacks] = catalogRotation(date);
      expect(pick).toEqual(pickDailyEntry(date));
      expect(new Set(fallbacks.map((entry) => entry.id))).toEqual(new Set(SPARES.map((entry) => entry.id)));
      expect(fallbacks.some((entry) => scheduled.has(entry.id))).toBe(false);
    }
  });

  it("starts the spares at a different one from one day to the next", () => {
    const today = day("2026-11-15");
    expect(catalogRotation(addDays(today, 1))[1]).not.toEqual(catalogRotation(today)[1]);
  });
});
