import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry } from "../../../worker/src/catalog";
import {
  bestDeezerMatch,
  DeezerUnavailableError,
  fetchDeezerImage,
  parseDeezerTrack,
  searchDeezer,
  type DeezerTrack,
} from "../../../worker/src/deezer";

const ENTRY: CatalogEntry = { id: "papaoutai", artist: "Stromae", title: "Papaoutai" };

/** A search result as Deezer's API writes one, trimmed to the fields that matter. */
function deezerResult(overrides: { id?: number; title?: string; artist?: string; cover?: unknown } = {}) {
  return {
    id: overrides.id ?? 70322130,
    title: overrides.title ?? "Papaoutai",
    title_short: overrides.title ?? "Papaoutai",
    preview: "https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/0/abc.mp3?hdnea=exp=1",
    artist: { id: 1, name: overrides.artist ?? "Stromae" },
    album: {
      id: 7090505,
      title: "Racine carrée",
      cover_medium:
        "cover" in overrides ? overrides.cover : "https://cdn-images.dzcdn.net/images/cover/abc/250x250-000000-80-0-0.jpg",
    },
  };
}

function track(overrides: Partial<DeezerTrack>): DeezerTrack {
  return { id: 1, title: "Papaoutai", artist: "Stromae", albumId: 2, cover: null, ...overrides };
}

function answer(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseDeezerTrack", () => {
  it("keeps the track, its artist, album and cover", () => {
    expect(parseDeezerTrack(deezerResult())).toEqual({
      id: 70322130,
      title: "Papaoutai",
      artist: "Stromae",
      albumId: 7090505,
      cover: "https://cdn-images.dzcdn.net/images/cover/abc/250x250-000000-80-0-0.jpg",
    });
  });

  it("never keeps a cover the Worker would fetch from anywhere but Deezer's image hosts", () => {
    expect(parseDeezerTrack(deezerResult({ cover: "https://evil.example/cover.jpg" }))?.cover).toBeNull();
    expect(parseDeezerTrack(deezerResult({ cover: "http://cdn-images.dzcdn.net/x.jpg" }))?.cover).toBeNull();
    expect(parseDeezerTrack(deezerResult({ cover: null }))?.cover).toBeNull();
  });

  it("refuses what isn't a track", () => {
    expect(parseDeezerTrack(null)).toBeNull();
    expect(parseDeezerTrack({ id: "1", title: "x", artist: { name: "a" }, album: { id: 1 } })).toBeNull();
    expect(parseDeezerTrack({ id: 1, title: "x", album: { id: 1 } })).toBeNull();
  });
});

describe("bestDeezerMatch", () => {
  it("prefers the entry's artist with the same title", () => {
    const tracks = [
      track({ id: 1, artist: "Someone Else", title: "Papaoutai" }),
      track({ id: 2, title: "Papaoutai (Live)" }),
      track({ id: 3, title: "Papaoutai" }),
    ];
    expect(bestDeezerMatch(tracks, ENTRY)?.id).toBe(3);
  });

  it("takes another version by the same artist over nothing", () => {
    expect(bestDeezerMatch([track({ id: 2, title: "Papaoutai (Live)" })], ENTRY)?.id).toBe(2);
  });

  it("matches artists case- and accent-insensitively, and a featuring", () => {
    expect(bestDeezerMatch([track({ artist: "STROMAÉ" })], ENTRY)).not.toBeNull();
    expect(bestDeezerMatch([track({ artist: "Stromae, Pharrell Williams" })], ENTRY)).not.toBeNull();
  });

  it("never falls back to another artist's track: a wrong cover is worse than none", () => {
    expect(bestDeezerMatch([track({ artist: "Someone Else" })], ENTRY)).toBeNull();
  });
});

describe("searchDeezer", () => {
  it("asks for the artist and the title together", async () => {
    answer({ data: [deezerResult()] });
    const tracks = await searchDeezer(ENTRY);
    expect(tracks.map((found) => found.id)).toEqual([70322130]);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe("https://api.deezer.com/search");
    expect(url.searchParams.get("q")).toBe('artist:"Stromae" track:"Papaoutai"');
  });

  it("answers an empty list when Deezer has nothing", async () => {
    answer({ data: [], total: 0 });
    expect(await searchDeezer(ENTRY)).toEqual([]);
  });

  it.each([
    ["an HTTP error", () => answer({}, 500)],
    ["its quota error, sent with a 200", () => answer({ error: { type: "Exception", message: "Quota limit exceeded", code: 4 } })],
    ["a body that isn't a search", () => answer(["not", "a", "search"])],
    [
      "the network failing",
      () =>
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => {
            throw new TypeError("fetch failed");
          })
        ),
    ],
  ])("throws DeezerUnavailableError on %s, never an empty result", async (_name, stub) => {
    stub();
    await expect(searchDeezer(ENTRY)).rejects.toBeInstanceOf(DeezerUnavailableError);
  });
});

describe("fetchDeezerImage", () => {
  it("returns the image and its type", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } })));
    const image = await fetchDeezerImage("papaoutai", "https://cdn-images.dzcdn.net/x.jpg");
    expect(image.contentType).toBe("image/jpeg");
    expect([...new Uint8Array(image.bytes)]).toEqual([1, 2, 3]);
  });

  it("throws DeezerUnavailableError on an error or something that isn't an image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 502 })));
    await expect(fetchDeezerImage("papaoutai", "https://cdn-images.dzcdn.net/x.jpg")).rejects.toBeInstanceOf(DeezerUnavailableError);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { headers: { "content-type": "text/html" } })));
    await expect(fetchDeezerImage("papaoutai", "https://cdn-images.dzcdn.net/x.jpg")).rejects.toBeInstanceOf(DeezerUnavailableError);
  });
});
