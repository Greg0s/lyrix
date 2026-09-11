import { describe, expect, it } from "vitest";
import type { LrclibTrack } from "../../../worker/src/lrclib";
import { parseSections, plainLyricsFrom } from "../../../worker/src/lyrics";

function track(overrides: Partial<LrclibTrack>): LrclibTrack {
  return { artistName: "Test Artist", instrumental: false, plainLyrics: null, syncedLyrics: null, ...overrides };
}

describe("parseSections", () => {
  it("splits blank-line-separated paragraphs into generically labeled sections", () => {
    expect(parseSections("Premiere ligne\nDeuxieme ligne\n\nTroisieme ligne")).toEqual([
      { label: "Couplet 1", lines: ["Premiere ligne", "Deuxieme ligne"] },
      { label: "Couplet 2", lines: ["Troisieme ligne"] },
    ]);
  });

  it("drops stray blank lines instead of producing empty sections", () => {
    expect(parseSections("\n\nUne ligne\n\n\n\nAutre ligne\n\n")).toEqual([
      { label: "Couplet 1", lines: ["Une ligne"] },
      { label: "Couplet 2", lines: ["Autre ligne"] },
    ]);
  });

  it("returns no sections for lyrics that are empty once trimmed", () => {
    expect(parseSections("   \n\n  ")).toEqual([]);
  });
});

describe("plainLyricsFrom", () => {
  it("prefers plainLyrics when present", () => {
    const result = plainLyricsFrom(track({ plainLyrics: "Des paroles\n", syncedLyrics: "[00:01.00] Autre chose" }));
    expect(result).toBe("Des paroles");
  });

  it("falls back to syncedLyrics with timestamps stripped when plainLyrics is missing", () => {
    const result = plainLyricsFrom(track({ syncedLyrics: "[00:01.00] Premiere ligne\n[00:05.20] Deuxieme ligne" }));
    expect(result).toBe("Premiere ligne\nDeuxieme ligne");
  });

  it("returns null when neither field is usable", () => {
    expect(plainLyricsFrom(track({ plainLyrics: "   ", syncedLyrics: null }))).toBeNull();
  });

  it("normalizes CRLF and lone CR line endings", () => {
    const result = plainLyricsFrom(track({ plainLyrics: "Une ligne\r\nAutre ligne\rTroisieme" }));
    expect(result).toBe("Une ligne\nAutre ligne\nTroisieme");
  });

  it("strips stray control characters, as observed live in an LRCLIB response", () => {
    const dirty = "Premiere ligne" + String.fromCharCode(31) + "propre";
    expect(plainLyricsFrom(track({ plainLyrics: dirty }))).toBe("Premiere lignepropre");
  });
});
