import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalog, DEV_STANDIN_SONG_ID } from "../../../worker/src/catalog";
import { COVER_OVERRIDES } from "../../../worker/src/coverOverrides";
import {
  coverOverride,
  coverToken,
  getSongMedia,
  hasCoverLookup,
  prepareCovers,
  resetCoverMemo,
  songOfCoverToken,
} from "../../../worker/src/covers";
import app from "../../../worker/src/index";

const SECRET = "test-secret";
const ENTRY = catalog[0];
const COVER_URL = "https://cdn-images.dzcdn.net/images/cover/abc/250x250-000000-80-0-0.jpg";
const IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

/** Stands in for the SONGS namespace. */
class FakeKv {
  readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

let SONGS: FakeKv;
let calls: string[];

/** Deezer: its search answers with `artist`'s track (the catalog entry's own by default), its CDN with the image. */
function deezer({ down = false, artist = ENTRY.artist, cover = COVER_URL as string | null } = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(url);
      if (down) return new Response("", { status: 503 });
      if (url.startsWith("https://api.deezer.com/search")) {
        const data = [
          { id: 42, title: ENTRY.title, artist: { name: artist }, album: { id: 7, cover_medium: cover } },
        ];
        return Response.json({ data, total: data.length });
      }
      return new Response(IMAGE, { headers: { "content-type": "image/jpeg" } });
    })
  );
}

const env = () => ({ STATE_SECRET: SECRET, SONGS });

async function getCover(token: string): Promise<Response> {
  return app.request(`/api/cover/${token}`, {}, env());
}

beforeEach(() => {
  resetCoverMemo();
  SONGS = new FakeKv();
  calls = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cover tokens", () => {
  it("are the same for every player and lead back to their song", async () => {
    const token = await coverToken(ENTRY.id, SECRET);
    resetCoverMemo();
    expect(await coverToken(ENTRY.id, SECRET)).toBe(token);
    expect(await songOfCoverToken(token, SECRET)).toBe(ENTRY.id);
  });

  it("never name the song, and can't be made without the secret", async () => {
    const token = await coverToken(ENTRY.id, SECRET);
    expect(token).not.toContain(ENTRY.id);
    expect(await coverToken(ENTRY.id, "another-secret")).not.toBe(token);
    expect(await songOfCoverToken(token, "another-secret")).toBeNull();
    expect(await songOfCoverToken("made-up", SECRET)).toBeNull();
  });

  it("differ from song to song", async () => {
    const all = await Promise.all(catalog.map((entry) => coverToken(entry.id, SECRET)));
    expect(new Set(all).size).toBe(catalog.length);
  });

  it("are only given for a catalog song, never dev's stand-in", () => {
    expect(hasCoverLookup(ENTRY.id)).toBe(true);
    expect(hasCoverLookup(DEV_STANDIN_SONG_ID)).toBe(false);
  });
});

describe("GET /api/cover/:token", () => {
  it("serves the song's cover from Deezer, kept for good by the browser", async () => {
    deezer();
    const res = await getCover(await coverToken(ENTRY.id, SECRET));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(IMAGE);
  });

  it("asks Deezer once, ever: the cover and the track are kept in SONGS", async () => {
    deezer();
    const token = await coverToken(ENTRY.id, SECRET);
    await getCover(token);
    expect(JSON.parse(SONGS.store.get(`media:${ENTRY.id}`) ?? "null")).toMatchObject({
      deezer: { trackId: 42, albumId: 7 },
      cover: { contentType: "image/jpeg" },
    });

    // A new isolate.
    resetCoverMemo();
    calls = [];
    const res = await getCover(token);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(IMAGE);
    expect(calls).toEqual([]);
  });

  it("answers 404 for a song Deezer doesn't have, and keeps that answer", async () => {
    deezer({ artist: "Someone Else" });
    const token = await coverToken(ENTRY.id, SECRET);
    expect((await getCover(token)).status).toBe(404);
    expect(JSON.parse(SONGS.store.get(`media:${ENTRY.id}`) ?? "null")).toEqual({ deezer: null });
    calls = [];
    expect((await getCover(token)).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("answers 404 for a track without a cover, keeping the track for its extract", async () => {
    deezer({ cover: null });
    expect((await getCover(await coverToken(ENTRY.id, SECRET))).status).toBe(404);
    expect(JSON.parse(SONGS.store.get(`media:${ENTRY.id}`) ?? "null")).toEqual({ deezer: { trackId: 42, albumId: 7 } });
  });

  it("answers 404 for a token it never gave, without asking Deezer", async () => {
    deezer();
    expect((await getCover("made-up")).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("answers 503 when Deezer can't be asked, and keeps nothing: a later request tries again", async () => {
    deezer({ down: true });
    const token = await coverToken(ENTRY.id, SECRET);
    const res = await getCover(token);
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).not.toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(SONGS.store.size).toBe(0);

    deezer();
    expect((await getCover(token)).status).toBe(200);
  });

  it("serves a cover without the SONGS namespace, from Deezer and the isolate", async () => {
    deezer();
    const token = await coverToken(ENTRY.id, SECRET);
    const res = await app.request(`/api/cover/${token}`, {}, { STATE_SECRET: SECRET });
    expect(res.status).toBe(200);
  });
});

describe("prepareCovers", () => {
  it("finds the covers of the songs prepared, ahead of their day", async () => {
    deezer();
    await prepareCovers([catalog[0].id, catalog[1].id], { SONGS });
    expect(SONGS.store.has(`media:${catalog[0].id}`)).toBe(true);
    expect(SONGS.store.has(`media:${catalog[1].id}`)).toBe(true);
  });

  it("stops at the first song Deezer can't be asked about, and never throws", async () => {
    deezer({ down: true });
    await expect(prepareCovers([catalog[0].id, catalog[1].id], { SONGS })).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(SONGS.store.size).toBe(0);
  });

  it("shares one Deezer lookup between requests for the same song", async () => {
    deezer();
    await Promise.all([getSongMedia(ENTRY.id, { SONGS }), getSongMedia(ENTRY.id, { SONGS })]);
    expect(calls.filter((url) => url.startsWith("https://api.deezer.com/search"))).toHaveLength(1);
  });
});

describe("covers supplied by hand", () => {
  it("are only for catalog songs", () => {
    for (const id of Object.keys(COVER_OVERRIDES)) expect(hasCoverLookup(id)).toBe(true);
  });

  it("are served before Deezer is asked anything, even when it is down", async () => {
    const [id] = Object.keys(COVER_OVERRIDES);
    deezer({ down: true });
    const res = await getCover(await coverToken(id, SECRET));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const bytes = Uint8Array.from(atob(COVER_OVERRIDES[id] as string), (char) => char.charCodeAt(0));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(calls).toEqual([]);
  });

  it("leave the scheduled run nothing to look up", async () => {
    const [id] = Object.keys(COVER_OVERRIDES);
    deezer();
    await prepareCovers([id], { SONGS });
    expect(calls).toEqual([]);
    expect(coverOverride(id)).not.toBeNull();
  });
});
