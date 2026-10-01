import { describe, expect, it } from "vitest";
import {
  ARCHIVE_DAYS,
  archiveDays,
  FIRST_SONG_DAY,
  formatCountdown,
  isDayKey,
  isPlayableDay,
  msUntilNextSong,
  utcDay,
} from "../../../src/game/daily";

describe("utcDay", () => {
  it("is the UTC day, whatever the local time zone", () => {
    expect(utcDay(new Date("2026-10-01T23:59:59Z"))).toBe("2026-10-01");
    expect(utcDay(new Date("2026-10-01T23:30:00-02:00"))).toBe("2026-10-02");
  });
});

describe("isDayKey", () => {
  it("takes a real calendar day written YYYY-MM-DD", () => {
    expect(isDayKey("2026-09-26")).toBe(true);
    expect(isDayKey("2028-02-29")).toBe(true);
  });

  it("refuses anything else", () => {
    for (const value of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-9-26", "26/09/2026", "", null, 20260926]) {
      expect(isDayKey(value), String(value)).toBe(false);
    }
  });
});

describe("archiveDays", () => {
  it("is today and the days before it, newest first, across a month boundary", () => {
    const days = archiveDays(new Date("2026-10-01T08:00:00Z"));
    expect(days).toHaveLength(ARCHIVE_DAYS);
    expect(days[0]).toBe("2026-10-01");
    expect(days[1]).toBe("2026-09-30");
    expect(days[ARCHIVE_DAYS - 1]).toBe("2026-09-02");
  });
});

describe("isPlayableDay", () => {
  const now = new Date("2026-10-01T08:00:00Z");

  it("is any day of the window that had a song", () => {
    expect(isPlayableDay("2026-10-01", now)).toBe(true);
    expect(isPlayableDay(FIRST_SONG_DAY, now)).toBe(true);
  });

  it("is never a day to come, one too old, or one before the first song", () => {
    expect(isPlayableDay("2026-10-02", now)).toBe(false);
    expect(isPlayableDay("2026-09-11", now)).toBe(false);
    expect(isPlayableDay("2026-12-01", new Date("2027-01-15T00:00:00Z"))).toBe(false);
  });
});

describe("msUntilNextSong", () => {
  it("counts down to the next UTC midnight, whatever the local time zone", () => {
    expect(msUntilNextSong(Date.UTC(2026, 8, 29, 22, 30, 0))).toBe(90 * 60 * 1000);
  });

  it("is a full day right at midnight, never zero", () => {
    expect(msUntilNextSong(Date.UTC(2026, 8, 29))).toBe(24 * 60 * 60 * 1000);
  });

  it("is one millisecond just before midnight", () => {
    expect(msUntilNextSong(Date.UTC(2026, 8, 30) - 1)).toBe(1);
  });
});

describe("formatCountdown", () => {
  it("pads hours, minutes and seconds", () => {
    expect(formatCountdown((5 * 3600 + 4 * 60 + 3) * 1000)).toBe("05:04:03");
  });

  it("rounds up to the second", () => {
    expect(formatCountdown(1)).toBe("00:00:01");
    expect(formatCountdown(59_001)).toBe("00:01:00");
  });

  it("stops at zero", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-500)).toBe("00:00:00");
  });
});
