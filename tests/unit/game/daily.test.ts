import { describe, expect, it } from "vitest";
import { formatCountdown, msUntilNextSong } from "../../../src/game/daily";

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
