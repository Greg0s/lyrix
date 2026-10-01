import { describe, expect, it } from "vitest";
import { ARCHIVE_DAYS } from "../../../src/game/daily";
import {
  catalog,
  catalogRotation,
  FIRST_SONG_DAY,
  hasScheduledSong,
  pickDailyEntry,
  schedule,
} from "../../../worker/src/catalog";

const DAY_MS = 86_400_000;

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// The song each day actually served, as computed by the code that served it.
// The archives replay these days, so a catalog edit must never change one: if
// this fails, the edit rewrote history - put the new songs in a new schedule
// segment starting on a day not yet played instead. Only ever add rows.
const PLAYED: [string, string][] = [
  ["2026-09-12", "mistral-gagnant"],
  ["2026-09-13", "la-corrida"],
  ["2026-09-14", "envole-moi"],
  ["2026-09-15", "desenchantee"],
  ["2026-09-16", "casser-la-voix"],
  ["2026-09-17", "nes-sous-la-meme-etoile"],
  ["2026-09-18", "caroline"],
  ["2026-09-19", "en-apesanteur"],
  ["2026-09-20", "alors-on-danse"],
  ["2026-09-21", "papaoutai"],
  ["2026-09-22", "je-veux"],
  ["2026-09-23", "on-sattache"],
  ["2026-09-24", "pas-la"],
  ["2026-09-25", "balance-ton-quoi"],
  ["2026-09-26", "avenir"],
  ["2026-09-27", "la-grenade"],
  ["2026-09-28", "paris-seychelles"],
  ["2026-09-29", "romeo-kiffe-juliette"],
  ["2026-09-30", "dommage"],
  ["2026-10-01", "on-brulera"],
  ["2026-10-02", "mon-amour"],
  ["2026-10-03", "jai-cherche"],
  ["2026-10-04", "non-je-ne-regrette-rien"],
  ["2026-10-05", "la-vie-en-rose"],
  ["2026-10-06", "ne-me-quitte-pas"],
  ["2026-10-07", "la-boheme"],
  ["2026-10-08", "le-poinconneur-des-lilas"],
  ["2026-10-09", "ella-elle-la"],
  ["2026-10-10", "un-autre-monde"],
  ["2026-10-11", "laventurier"],
];

describe("catalog", () => {
  it("has no duplicate ids", () => {
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
  });
});

describe("schedule", () => {
  it("starts on the first day the game had a song", () => {
    expect(FIRST_SONG_DAY).toBe("2026-09-12");
    expect(schedule[0].from).toBe(FIRST_SONG_DAY);
  });

  it("lists its segments in order, each a real day", () => {
    const starts = schedule.map((segment) => Date.parse(`${segment.from}T00:00:00Z`));
    for (const start of starts) expect(Number.isNaN(start)).toBe(false);
    for (let index = 1; index < starts.length; index++) expect(starts[index]).toBeGreaterThan(starts[index - 1]);
  });

  it("plays only catalog songs, each at most once per segment, and every catalog song somewhere", () => {
    const ids = new Set(catalog.map((entry) => entry.id));
    const scheduled = new Set<string>();
    for (const segment of schedule) {
      const segmentIds = segment.entries.map((entry) => entry.id);
      expect(new Set(segmentIds).size).toBe(segmentIds.length);
      for (const id of segmentIds) {
        expect(ids.has(id)).toBe(true);
        scheduled.add(id);
      }
    }
    expect(scheduled.size).toBe(ids.size);
  });

  it.each(PLAYED)("keeps %s on the song it served (%s)", (iso, id) => {
    expect(pickDailyEntry(day(iso)).id).toBe(id);
    // Any time of that UTC day.
    expect(pickDailyEntry(new Date(`${iso}T23:59:59Z`)).id).toBe(id);
  });

  it("had no song before its first day", () => {
    expect(hasScheduledSong(day("2026-09-11"))).toBe(false);
    expect(hasScheduledSong(new Date("2026-09-11T23:59:59Z"))).toBe(false);
    expect(hasScheduledSong(day(FIRST_SONG_DAY))).toBe(true);
    expect(hasScheduledSong(day("2027-01-01"))).toBe(true);
  });

  // The archives offer the last ARCHIVE_DAYS days: none of them may be the
  // song coming tomorrow, or replaying it there would give tomorrow away.
  it("never schedules tomorrow's song among the days the archives hold", () => {
    const first = day(FIRST_SONG_DAY);
    for (let offset = 0; offset < 3 * 365; offset++) {
      const today = addDays(first, offset);
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

  it("advances by exactly one position per day within a segment", () => {
    for (const iso of ["2026-09-20", "2026-11-15"]) {
      const today = day(iso);
      expect(catalogRotation(addDays(today, 1))[0]).toEqual(catalogRotation(today)[1]);
    }
  });

  it("wraps around after a segment's length in days", () => {
    const last = schedule[schedule.length - 1];
    const start = day(last.from);
    expect(pickDailyEntry(addDays(start, last.entries.length))).toEqual(pickDailyEntry(start));
  });

  it("rotation holds the day's segment once each, starting with the day's pick", () => {
    for (const segment of schedule) {
      const date = addDays(day(segment.from), 3);
      const rotation = catalogRotation(date);
      expect(rotation).toHaveLength(segment.entries.length);
      expect(new Set(rotation.map((entry) => entry.id))).toEqual(new Set(segment.entries.map((entry) => entry.id)));
      expect(rotation[0]).toEqual(pickDailyEntry(date));
    }
  });
});
