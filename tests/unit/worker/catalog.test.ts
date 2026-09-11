import { describe, expect, it } from "vitest";
import { catalog, catalogRotation, pickDailyEntry } from "../../../worker/src/catalog";

const DAY_MS = 86_400_000;

describe("catalog", () => {
  it("has no duplicate ids", () => {
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
  });
});

describe("pickDailyEntry / catalogRotation", () => {
  it("is deterministic for a given date", () => {
    const date = new Date("2026-01-15T12:00:00Z");
    expect(pickDailyEntry(date)).toEqual(pickDailyEntry(new Date(date)));
  });

  it("advances by exactly one position per day", () => {
    const day = new Date("2026-01-15T00:00:00Z");
    const nextDay = new Date(day.getTime() + DAY_MS);
    expect(catalogRotation(nextDay)[0]).toEqual(catalogRotation(day)[1]);
  });

  it("wraps around after a full catalog length in days", () => {
    const day = new Date("2026-01-15T00:00:00Z");
    const later = new Date(day.getTime() + catalog.length * DAY_MS);
    expect(pickDailyEntry(later)).toEqual(pickDailyEntry(day));
  });

  it("rotation contains every catalog entry exactly once, starting with today's pick", () => {
    const date = new Date("2026-01-15T00:00:00Z");
    const rotation = catalogRotation(date);
    expect(rotation).toHaveLength(catalog.length);
    expect(new Set(rotation.map((entry) => entry.id)).size).toBe(catalog.length);
    expect(rotation[0]).toEqual(pickDailyEntry(date));
  });
});
