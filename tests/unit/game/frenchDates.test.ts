import { describe, expect, it } from "vitest";
import {
  capitalize,
  dayOfMonthLabel,
  longDayLabel,
  monthAbbreviation,
  relativeDayLabel,
  shortDayLabel,
  weekdayAbbreviation,
} from "../../../src/game/frenchDates";

describe("frenchDates", () => {
  it("writes a day out in French", () => {
    expect(longDayLabel("2026-09-26")).toBe("samedi 26 septembre");
    expect(capitalize(longDayLabel("2026-10-01"))).toBe("Jeudi 1er octobre");
  });

  it("abbreviates the way French does", () => {
    expect(shortDayLabel("2026-09-26")).toBe("26 sept.");
    expect(shortDayLabel("2026-10-01")).toBe("1er oct.");
    expect(weekdayAbbreviation("2026-09-26")).toBe("sam.");
    expect(monthAbbreviation("2026-09-26")).toBe("sept.");
    expect(dayOfMonthLabel("2026-09-01")).toBe("1er");
  });

  it("counts back from today, by UTC day", () => {
    const now = new Date("2026-10-01T00:30:00Z");
    expect(relativeDayLabel("2026-10-01", now)).toBe("aujourd'hui");
    expect(relativeDayLabel("2026-09-30", now)).toBe("hier");
    expect(relativeDayLabel("2026-09-26", now)).toBe("il y a 5 jours");
  });
});
