import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utcDay } from "../../../src/game/daily";
import { catalogRotation } from "../../../worker/src/catalog";
import type { EventsDataset } from "../../../worker/src/events";
import worker from "../../../worker/src/index";
import { PREPARED_DAYS, prepareSongs } from "../../../worker/src/prepare";
import { getSongOfDay, resetSongMemo } from "../../../worker/src/songs";

// Long enough to clear resolveSong.ts's MIN_LYRIC_WORDS floor.
const FIXTURE_LYRICS = [
  "Premiere ligne du couplet",
  "Deuxieme ligne du couplet",
  "Troisieme ligne pour finir le couplet",
  "",
  "Refrain une ligne",
  "Refrain deux lignes",
  "Encore un refrain avant la fin",
].join("\n");

const NOW = new Date(Date.UTC(2026, 9, 20, 18, 17));
const DAY_MS = 24 * 60 * 60 * 1000;
const dayAfter = (ahead: number) => new Date(NOW.getTime() + ahead * DAY_MS);

/** Stands in for the SONGS namespace: songs once resolved, and each day's song id. */
class FakeSongsKv {
  readonly store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

let SONGS: FakeSongsKv;
let points: Parameters<EventsDataset["writeDataPoint"]>[0][];
let lrclibCalls: string[];

/** LRCLIB answering every search with the fixture, but none for the artists in `without`, or down altogether. */
function lrclib({ without = [] as string[], down = false } = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      const artistName = url.searchParams.get("artist_name") ?? "Unknown";
      lrclibCalls.push(artistName);
      if (down) return new Response("", { status: 503 });
      if (without.includes(artistName)) return new Response("[]", { status: 200 });
      const results = [{ artistName, instrumental: false, plainLyrics: FIXTURE_LYRICS, syncedLyrics: null }];
      return new Response(JSON.stringify(results), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
}

const env = () => ({ SONGS, EVENTS: { writeDataPoint: (point: (typeof points)[number]) => points.push(point) } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetSongMemo();
  SONGS = new FakeSongsKv();
  points = [];
  lrclibCalls = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("preparing the songs of the days to come", () => {
  it("keeps today's song and the week's after it in SONGS, pinning today alone", async () => {
    lrclib();
    const prepared = await prepareSongs(env(), NOW);

    expect(prepared).toHaveLength(PREPARED_DAYS);
    for (let ahead = 0; ahead < PREPARED_DAYS; ahead += 1) {
      const pick = catalogRotation(dayAfter(ahead))[0];
      expect(prepared[ahead]).toEqual({ day: utcDay(dayAfter(ahead)), outcome: "ready", song: pick.id });
      expect(SONGS.store.has(`song:${pick.id}`)).toBe(true);
    }
    expect([...SONGS.store.keys()].filter((key) => key.startsWith("day:"))).toEqual([`day:${utcDay(NOW)}`]);
  });

  it("leaves midnight nothing to ask LRCLIB: tomorrow's first round is played off the copy kept", async () => {
    lrclib();
    await prepareSongs(env(), NOW);

    // Midnight, a new isolate, LRCLIB down.
    resetSongMemo();
    lrclib({ down: true });
    lrclibCalls = [];
    const song = await getSongOfDay(dayAfter(1), { SONGS });
    expect(song.id).toBe(catalogRotation(dayAfter(1))[0].id);
    expect(lrclibCalls).toEqual([]);
  });

  it("asks LRCLIB nothing about a song already kept", async () => {
    lrclib();
    await prepareSongs(env(), NOW);
    resetSongMemo();
    lrclibCalls = [];
    await prepareSongs(env(), NOW);
    expect(lrclibCalls).toEqual([]);
  });

  it("finds a day whose pick has no usable lyrics days ahead, and says which song will play instead", async () => {
    const [pick, next] = catalogRotation(dayAfter(3));
    lrclib({ without: [pick.artist] });
    const prepared = await prepareSongs(env(), NOW);

    expect(prepared[3]).toEqual({ day: utcDay(dayAfter(3)), outcome: "fallback", song: next.id });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`"${pick.id}"`));
    // Not pinned: a fix to the catalog before the day still counts.
    expect(SONGS.store.has(`day:${utcDay(dayAfter(3))}`)).toBe(false);
  });

  it("stops at the first day LRCLIB can't be asked about, for the next run to try again", async () => {
    lrclib({ down: true });
    const prepared = await prepareSongs(env(), NOW);
    expect(prepared).toEqual([{ day: utcDay(NOW), outcome: "unavailable" }]);
  });

  it("counts each day's outcome, how many days ahead", async () => {
    lrclib();
    await prepareSongs(env(), NOW);
    const prepare = points.filter((point) => point.blobs?.[0] === "prepare");
    expect(prepare).toHaveLength(PREPARED_DAYS);
    expect(prepare[1]).toEqual({
      indexes: ["prepare"],
      blobs: ["prepare", utcDay(dayAfter(1)), "ready", catalogRotation(dayAfter(1))[0].id],
      doubles: [1],
    });
  });
});

describe("the Worker's scheduled run", () => {
  it("prepares the songs, and the Worker still answers requests", async () => {
    lrclib();
    const waited: Promise<unknown>[] = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => waited.push(promise), passThroughOnException: () => {} };
    worker.scheduled({} as ScheduledController, env(), ctx as unknown as ExecutionContext);
    await Promise.all(waited);
    expect(SONGS.store.has(`song:${catalogRotation(dayAfter(7))[0].id}`)).toBe(true);

    const res = await worker.request("/api/round", {}, { STATE_SECRET: "test-secret", SONGS });
    expect(res.status).toBe(200);
  });
});
