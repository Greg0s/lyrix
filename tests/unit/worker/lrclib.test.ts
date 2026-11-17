import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry } from "../../../worker/src/catalog";
import {
  BODY_TIMEOUT_MS,
  bestMatch,
  parseLrclibTrack,
  searchTrack,
  SEARCH_TIMEOUT_MS,
  type LrclibTrack,
} from "../../../worker/src/lrclib";

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

describe("searchTrack's timeouts", () => {
  const track = { artistName: "Stromae", instrumental: false, plainLyrics: "Des paroles", syncedLyrics: null };

  /** A fetch answering at once, its body arriving `bodyDelayMs` later, cut off like a real one when its signal aborts. */
  function slowBody(bodyDelayMs: number, text = JSON.stringify([track])) {
    return vi.fn(async (_url: unknown, init?: RequestInit) => {
      const signal = init?.signal;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const timer = setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(text));
            controller.close();
          }, bodyDelayMs);
          signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            controller.error(new DOMException("aborted", "AbortError"));
          });
        },
      });
      return new Response(stream, { status: 200 });
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    // Fake timers leave the platform's AbortSignal.timeout alone: run it on them too.
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ms);
      return controller.signal;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // A big answer used to be cut off SEARCH_TIMEOUT_MS after the request was
  // sent, mid-read, and reported as a malformed body.
  it("lets a large answer finish arriving after the search timeout", async () => {
    vi.stubGlobal("fetch", slowBody(SEARCH_TIMEOUT_MS + 2_000));
    const result = searchTrack(entry, []);
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS + 2_000);
    expect(await result).toEqual([track]);
  });

  it("says an answer that never finishes timed out, not that it is malformed", async () => {
    vi.stubGlobal("fetch", slowBody(BODY_TIMEOUT_MS * 10));
    const result = searchTrack(entry, []);
    const settled = expect(result).rejects.toThrow(/timed out reading the answer/);
    await vi.advanceTimersByTimeAsync(BODY_TIMEOUT_MS + 1);
    await settled;
  });

  it("still calls a body that isn't JSON malformed", async () => {
    vi.stubGlobal("fetch", slowBody(0, "<html>"));
    const result = searchTrack(entry, []);
    const settled = expect(result).rejects.toThrow(/malformed body/);
    await vi.advanceTimersByTimeAsync(1);
    await settled;
  });
});
