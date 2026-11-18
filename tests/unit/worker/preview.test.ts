import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalog } from "../../../worker/src/catalog";
import { coverToken, resetCoverMemo } from "../../../worker/src/covers";
import { MAX_PREVIEW_BYTES } from "../../../worker/src/deezer";
import app from "../../../worker/src/index";
import { parseRange } from "../../../worker/src/preview";

const SECRET = "test-secret";
const ENTRY = catalog[0];
const PREVIEW_URL = "https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/0/abc.mp3?hdnea=exp=1~acl=*~hmac=x";
const AUDIO = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 9]);

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

interface DeezerOptions {
  /** Deezer answers nothing at all. */
  down?: boolean;
  /** The search finds no track by the entry's artist. */
  noTrack?: boolean;
  /** The track's `preview` field. */
  preview?: unknown;
  /** The extract's answer. */
  audio?: Response;
}

function deezer({ down = false, noTrack = false, preview = PREVIEW_URL, audio }: DeezerOptions = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(url);
      if (down) return new Response("", { status: 503 });
      if (url.startsWith("https://api.deezer.com/search")) {
        const artist = noTrack ? "Quelqu'un d'autre" : ENTRY.artist;
        const data = [{ id: 42, title: ENTRY.title, artist: { name: artist }, album: { id: 7, cover_medium: null } }];
        return Response.json({ data, total: data.length });
      }
      if (url === "https://api.deezer.com/track/42") return Response.json({ id: 42, preview });
      if (url === PREVIEW_URL) return audio ?? new Response(AUDIO, { headers: { "content-type": "audio/mpeg" } });
      return new Response("", { status: 404 });
    })
  );
}

const env = () => ({ STATE_SECRET: SECRET, SONGS });

async function getPreview(token: string, init: RequestInit = {}): Promise<Response> {
  return app.request(`/api/preview/${token}`, init, env());
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

describe("GET /api/preview/:token", () => {
  it("serves the song's extract, fetched by the Worker from a freshly signed address", async () => {
    deezer();
    const response = await getPreview(await coverToken(ENTRY.id, SECRET));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(AUDIO);
    expect(calls).toContain("https://api.deezer.com/track/42");
    expect(calls).toContain(PREVIEW_URL);
  });

  it("asks Deezer for the track once, ever, then only for the extract's address", async () => {
    deezer();
    const token = await coverToken(ENTRY.id, SECRET);
    await getPreview(token);
    resetCoverMemo();
    calls = [];
    expect((await getPreview(token)).status).toBe(200);
    expect(calls.some((url) => url.startsWith("https://api.deezer.com/search"))).toBe(false);
  });

  it("answers a byte range with 206, as Safari needs to play it", async () => {
    deezer();
    const response = await getPreview(await coverToken(ENTRY.id, SECRET), { headers: { Range: "bytes=2-5" } });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes 2-5/${AUDIO.length}`);
    expect(response.headers.get("content-length")).toBe("4");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(AUDIO.slice(2, 6));
  });

  it("answers 404 for an unknown token, without asking Deezer", async () => {
    deezer();
    const response = await getPreview("not-a-token");
    expect(response.status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("answers the same 404 for a song Deezer has no track or no extract for", async () => {
    deezer({ noTrack: true });
    expect((await getPreview(await coverToken(ENTRY.id, SECRET))).status).toBe(404);

    resetCoverMemo();
    SONGS = new FakeKv();
    deezer({ preview: "" });
    expect((await getPreview(await coverToken(ENTRY.id, SECRET))).status).toBe(404);
  });

  it("never fetches an extract's address off Deezer's own hosts", async () => {
    deezer({ preview: "https://example.com/extract.mp3" });
    expect((await getPreview(await coverToken(ENTRY.id, SECRET))).status).toBe(404);
    expect(calls).not.toContain("https://example.com/extract.mp3");
  });

  it("answers 503 when Deezer doesn't answer, and keeps nothing (an outage is never 'no extract')", async () => {
    deezer({ down: true });
    const token = await coverToken(ENTRY.id, SECRET);
    const response = await getPreview(token);
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).not.toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(SONGS.store.size).toBe(0);

    deezer();
    expect((await getPreview(token)).status).toBe(200);
  });

  it("refuses an extract that isn't audio, or is far too big to be one", async () => {
    deezer({ audio: new Response("<html>", { headers: { "content-type": "text/html" } }) });
    const token = await coverToken(ENTRY.id, SECRET);
    expect((await getPreview(token)).status).toBe(503);

    deezer({
      audio: new Response(new Uint8Array(MAX_PREVIEW_BYTES + 1), { headers: { "content-type": "audio/mpeg" } }),
    });
    expect((await getPreview(token)).status).toBe(503);
  });
});

describe("parseRange", () => {
  it("reads a range, an open-ended one and a suffix", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });

  it("answers the whole body for what it can't read, and refuses a range past the end", () => {
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseRange("items=0-1", 100)).toBeNull();
    expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=20-10", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 100)).toBe("unsatisfiable");
  });
});
