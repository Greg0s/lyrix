import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../../worker/src/catalog";
import { bestMatch, parseLrclibTrack, type LrclibTrack } from "../../../worker/src/lrclib";

const entry: CatalogEntry = { id: "papaoutai", artist: "Stromae", title: "Papaoutai" };

describe("parseLrclibTrack", () => {
  it("parses a well-formed track", () => {
    const raw = { artistName: "Stromae", instrumental: false, plainLyrics: "Des paroles", syncedLyrics: null };
    expect(parseLrclibTrack(raw)).toEqual(raw);
  });

  it("rejects values with no usable artistName", () => {
    expect(parseLrclibTrack({ instrumental: false })).toBeNull();
    expect(parseLrclibTrack(null)).toBeNull();
    expect(parseLrclibTrack("not an object")).toBeNull();
  });

  it("defaults missing or malformed optional fields instead of throwing", () => {
    expect(parseLrclibTrack({ artistName: "Stromae", instrumental: "yes", plainLyrics: 42 })).toEqual({
      artistName: "Stromae",
      instrumental: false,
      plainLyrics: null,
      syncedLyrics: null,
    });
  });
});

describe("bestMatch", () => {
  function track(overrides: Partial<LrclibTrack>): LrclibTrack {
    return {
      artistName: "Someone Else",
      instrumental: false,
      plainLyrics: "lyrics",
      syncedLyrics: null,
      ...overrides,
    };
  }

  it("prefers a result whose artist matches the catalog entry", () => {
    const tracks = [track({ artistName: "Cover Band" }), track({ artistName: "stromae" })];
    expect(bestMatch(tracks, entry)?.artistName).toBe("stromae");
  });

  it("matches the artist regardless of case or accents", () => {
    const tracks = [track({ artistName: "STROMÄE" })];
    expect(bestMatch(tracks, entry)).not.toBeNull();
  });

  it("skips instrumental tracks and ones without usable lyrics", () => {
    const tracks = [track({ instrumental: true, artistName: "Stromae" }), track({ plainLyrics: null, syncedLyrics: null })];
    expect(bestMatch(tracks, entry)).toBeNull();
  });

  // Regression test: the first usable result used to be taken when no artist
  // matched, so another artist's song of the same title could be played.
  it("takes nothing when no result is the entry's artist", () => {
    expect(bestMatch([track({ artistName: "Nobody Related" })], entry)).toBeNull();
    expect(bestMatch([track({ artistName: "Stromaenia" })], entry)).toBeNull();
  });

  it("takes a credit naming the artist among others, the exact one first", () => {
    const featuring = track({ artistName: "Stromae feat. Orelsan" });
    expect(bestMatch([featuring], entry)).toEqual(featuring);
    const exact = track({ artistName: "Stromae" });
    expect(bestMatch([featuring, exact], entry)).toEqual(exact);
  });

  it("returns null for an empty list", () => {
    expect(bestMatch([], entry)).toBeNull();
  });
});
