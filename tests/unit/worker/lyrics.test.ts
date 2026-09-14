import { describe, expect, it } from "vitest";
import type { LrclibTrack } from "../../../worker/src/lrclib";
import { cleanLyrics, parseSections, plainLyricsFrom } from "../../../worker/src/lyrics";

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

describe("cleanLyrics", () => {
  it("drops LRC id tags, which would otherwise hand the player the artist and title", () => {
    const lrc = "[ti:Papaoutai]\n[ar:Stromae]\n[length:03:52]\nDites-moi d'ou il vient";
    expect(cleanLyrics(lrc)).toBe("Dites-moi d'ou il vient");
  });

  it("drops bracketed section headers rather than turning them into guessable words", () => {
    expect(cleanLyrics("[Couplet 1]\nUne ligne\n[Refrain]\nUne autre")).toBe("Une ligne\nUne autre");
  });

  it("strips leading timestamps, however many and whatever their shape", () => {
    expect(cleanLyrics("[00:12.34]Une ligne")).toBe("Une ligne");
    expect(cleanLyrics("[00:12][01:40.5] Une ligne")).toBe("Une ligne");
    expect(cleanLyrics("[0:12.34] Une ligne")).toBe("Une ligne");
    expect(cleanLyrics("[01:02:03.45] Une ligne")).toBe("Une ligne");
  });

  it("strips the word-level timestamps of enhanced LRC", () => {
    expect(cleanLyrics("[00:12.00] <00:12.00> Dites <00:12.50> moi")).toBe("Dites moi");
  });

  it("drops the filler that stands in for an instrumental break", () => {
    expect(cleanLyrics("Une ligne\n\n♪\n♪ ♪\n***\n\n[Instrumental]\n(Instrumental break)\n\nAutre ligne")).toBe(
      "Une ligne\n\n\n\nAutre ligne"
    );
  });

  it("keeps parenthesised backing vocals, which are sung", () => {
    expect(cleanLyrics("Papaoutai (ah ah ah)\n(Oh oh oh)")).toBe("Papaoutai (ah ah ah)\n(Oh oh oh)");
  });

  it("keeps blank lines exactly where they are, so sections survive the cleanup", () => {
    expect(cleanLyrics("Une ligne\n\nAutre ligne")).toBe("Une ligne\n\nAutre ligne");
  });

  it("evens out ragged spacing", () => {
    expect(cleanLyrics("  Une    ligne\t\tespacee  ")).toBe("Une ligne espacee");
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

  it("returns null when nothing sung survives the cleanup", () => {
    expect(plainLyricsFrom(track({ plainLyrics: "[ar:Stromae]\n♪\n[Instrumental]" }))).toBeNull();
  });

  it("makes an instrumental break vanish instead of masking it as a section", () => {
    const lyrics = plainLyricsFrom(track({ plainLyrics: "Une ligne\n\n♪\n♪\n\nAutre ligne" }));
    expect(lyrics).not.toBeNull();
    expect(parseSections(lyrics ?? "")).toEqual([
      { label: "Couplet 1", lines: ["Une ligne"] },
      { label: "Couplet 2", lines: ["Autre ligne"] },
    ]);
  });
});
