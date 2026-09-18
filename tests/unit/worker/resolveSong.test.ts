import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry } from "../../../worker/src/catalog";
import { MIN_LYRIC_WORDS, resolveFromLrclib } from "../../../worker/src/resolveSong";

const entry: CatalogEntry = { id: "papaoutai", artist: "Stromae", title: "Papaoutai" };

function track(overrides: Record<string, unknown>): Record<string, unknown> {
  return { artistName: "Stromae", instrumental: false, plainLyrics: null, syncedLyrics: null, ...overrides };
}

/** Stubs the one LRCLIB search call resolveFromLrclib makes, so this never goes out to the network. */
function mockSearch(tracks: Record<string, unknown>[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(tracks), { status: 200, headers: { "content-type": "application/json" } })
    )
  );
}

/** A lyrics blob holding exactly `count` word tokens, laid out four to a line. */
function lyricsOf(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i += 4) lines.push(Array.from({ length: Math.min(4, count - i) }, () => "mot").join(" "));
  return lines.join("\n");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveFromLrclib", () => {
  it("turns a usable LRCLIB result into a playable song", async () => {
    mockSearch([track({ plainLyrics: "Dites-moi d'ou il vient\nEnfin je saurais ou je vais\n\n" + lyricsOf(20) })]);

    const song = await resolveFromLrclib(entry);

    expect(song?.id).toBe(entry.id);
    // The title and artist always come from our own catalog, never from
    // LRCLIB's own metadata fields (see docs/LEARNINGS.md).
    expect(song?.title).toBe(entry.title);
    expect(song?.artist).toBe(entry.artist);
    expect(song?.sections).toHaveLength(2);
  });

  it("returns null when LRCLIB has no usable result at all", async () => {
    mockSearch([track({ instrumental: true, plainLyrics: lyricsOf(200) })]);
    expect(await resolveFromLrclib(entry)).toBeNull();
  });

  // Regression guard for the stub entries LRCLIB serves in place of real
  // lyrics: without a floor they become a round that is over in three
  // guesses, instead of falling through to the next catalog candidate.
  it("accepts a song sitting exactly on the word floor", async () => {
    mockSearch([track({ plainLyrics: lyricsOf(MIN_LYRIC_WORDS) })]);
    expect(await resolveFromLrclib(entry)).not.toBeNull();
  });

  it("rejects a stub one word short of the floor", async () => {
    mockSearch([track({ plainLyrics: lyricsOf(MIN_LYRIC_WORDS - 1) })]);
    expect(await resolveFromLrclib(entry)).toBeNull();
  });

  it("counts only words that survive the cleanup, not the annotations around them", async () => {
    const padding = Array.from({ length: MIN_LYRIC_WORDS }, (_, index) => `[Couplet numero ${index}]`).join("\n");
    mockSearch([track({ plainLyrics: `${padding}\n${lyricsOf(MIN_LYRIC_WORDS - 1)}` })]);
    expect(await resolveFromLrclib(entry)).toBeNull();
  });

  it("falls back to synced lyrics when the plain ones are missing", async () => {
    const synced = lyricsOf(24)
      .split("\n")
      .map((line, index) => `[00:${String(index).padStart(2, "0")}.00] ${line}`)
      .join("\n");
    mockSearch([track({ syncedLyrics: synced })]);

    const song = await resolveFromLrclib(entry);
    expect(song?.sections[0].lines[0]).toBe("mot mot mot mot");
  });
});
