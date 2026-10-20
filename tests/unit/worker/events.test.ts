import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utcDay } from "../../../src/game/daily";
import { tokenize } from "../../../src/game/tokenize";
import type { GuessResult, RoundView, Song } from "../../../src/game/types";
import { columnOf, deviceOf, EVENT_FIELDS, recordEvent, type EventsDataset } from "../../../worker/src/events";
import { resetFreshRoundMemo } from "../../../worker/src/freshRound";
import app from "../../../worker/src/index";
import { resetSimilarityMemo } from "../../../worker/src/similarity";
import { getSongById, resetSongMemo } from "../../../worker/src/songs";
import { openState, sealState } from "../../../worker/src/state";

type Point = Parameters<EventsDataset["writeDataPoint"]>[0];

class FakeDataset implements EventsDataset {
  readonly points: Point[] = [];
  writeDataPoint(point: Point): void {
    this.points.push(point);
  }
  /** The points of one event, as name -> value, the way the stats script reads them back. */
  of(event: keyof typeof EVENT_FIELDS): Record<string, string | number>[] {
    const { blobs, doubles } = EVENT_FIELDS[event];
    return this.points
      .filter((point) => point.blobs?.[0] === event)
      .map((point) => ({
        ...Object.fromEntries(blobs.map((field, i) => [field, point.blobs?.[i + 1] ?? ""])),
        ...Object.fromEntries(doubles.map((field, i) => [field, point.doubles?.[i] ?? 0])),
      }));
  }
}

describe("recording an event", () => {
  it("writes its name as blob1 and its index, then its fields in the table's order", () => {
    const events = new FakeDataset();
    recordEvent({ EVENTS: events }, "win", { mode: "solo", kind: "today", day: "2026-10-20", song: "s", tries: 12, hints: 1 });
    expect(events.points).toEqual([
      { indexes: ["win"], blobs: ["win", "solo", "today", "2026-10-20", "s"], doubles: [12, 1] },
    ]);
  });

  it("names the column every field is read from as it was written", () => {
    expect(columnOf("win", "mode")).toBe("blob2");
    expect(columnOf("win", "song")).toBe("blob5");
    expect(columnOf("win", "tries")).toBe("double1");
    expect(columnOf("visit", "legal")).toBe("double6");
    expect(() => columnOf("win", "nothing" as "mode")).toThrow(/no field "nothing"/);
  });

  it("stays within what a data point holds, and no field is both a string and a number", () => {
    for (const { blobs, doubles } of Object.values(EVENT_FIELDS)) {
      expect(blobs.length + 1).toBeLessThanOrEqual(20);
      expect(doubles.length).toBeLessThanOrEqual(20);
      expect(blobs.filter((field) => (doubles as readonly string[]).includes(field))).toEqual([]);
    }
  });

  it("does nothing without the binding, and never throws when the dataset does", () => {
    expect(() => recordEvent({}, "room", { action: "create", members: 1 })).not.toThrow();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing: EventsDataset = {
      writeDataPoint() {
        throw new Error("quota");
      },
    };
    expect(() => recordEvent({ EVENTS: failing }, "room", { action: "create", members: 1 })).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("tells phones, tablets and computers apart, and keeps nothing else of the User-Agent", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
    const pixel = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
    const tab = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
    const ipad = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
    expect([iphone, pixel, tab, ipad, mac, undefined].map(deviceOf)).toEqual([
      "mobile",
      "mobile",
      "tablet",
      "tablet",
      "desktop",
      "desktop",
    ]);
  });
});

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

let events: FakeDataset;
let env: { STATE_SECRET: string; EVENTS: FakeDataset };

beforeEach(() => {
  // LRCLIB stubbed: the requested artist is echoed back, so today's catalog song resolves to the fixture.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      const artistName = url.searchParams.get("artist_name") ?? "Unknown";
      const results = [{ artistName, instrumental: false, plainLyrics: FIXTURE_LYRICS, syncedLyrics: null }];
      return new Response(JSON.stringify(results), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
  resetSongMemo();
  resetSimilarityMemo();
  resetFreshRoundMemo();
  events = new FakeDataset();
  env = { STATE_SECRET: "test-secret", EVENTS: events };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/visit", () => {
  function send(body: string, headers: Record<string, string> = {}) {
    return app.request("/api/visit", { method: "POST", headers: { "Content-Type": "text/plain", ...headers }, body }, env);
  }

  it("counts a report as one data point, with the kind of device and nothing else of the request", async () => {
    const report = {
      landed: true,
      entry: "invite",
      referrer: "t.co",
      source: "x",
      medium: "",
      campaign: "",
      display: "app",
      views: { today: 2, legal: 1 },
    };
    const res = await send(JSON.stringify(report), { "User-Agent": "Mozilla/5.0 (iPhone) Mobile/15E148" });
    expect(res.status).toBe(204);
    expect(events.of("visit")).toEqual([
      {
        entry: "invite",
        referrer: "t.co",
        source: "x",
        medium: "",
        campaign: "",
        device: "mobile",
        // Cloudflare's request.cf isn't there under plain Node.
        country: "",
        display: "app",
        landed: 1,
        today: 2,
        day: 0,
        archives: 0,
        help: 0,
        legal: 1,
      },
    ]);
    expect(JSON.stringify(events.points)).not.toContain("iPhone");
  });

  it("answers 204 to anything else too, and counts none of it", async () => {
    for (const body of ["", "not json", "{}", JSON.stringify({ landed: true, entry: "nowhere" })]) {
      expect((await send(body)).status).toBe(204);
    }
    expect(events.points).toEqual([]);
  });

  it("answers the same with no dataset bound", async () => {
    const res = await app.request("/api/visit", { method: "POST", body: "{}" }, { STATE_SECRET: "test-secret" });
    expect(res.status).toBe(204);
  });
});

describe("a solo round's statistics", () => {
  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await app.request(
      path,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      env
    );
    expect(res.status).toBe(200);
    return (await res.json()) as T;
  }

  async function todaysRound(): Promise<{ round: RoundView; song: Song }> {
    const round = (await (await app.request("/api/round", {}, env)).json()) as RoundView;
    const payload = await openState(round.state, env.STATE_SECRET);
    const song = payload ? await getSongById(payload.songId) : null;
    if (!song) throw new Error("today's song didn't resolve");
    return { round, song };
  }

  const titleWords = (song: Song) => tokenize(song.title).filter((token) => token.isWord).map((token) => token.text);

  it("count a round started on its first guess only, and nothing for loading it", async () => {
    const { round } = await todaysRound();
    expect(events.points).toEqual([]);
    const first = await post<RoundView>("/api/guess", { state: round.state, word: "xylophone", delta: true });
    await post<RoundView>("/api/guess", { state: first.state, word: "ligne", delta: true });
    expect(events.of("start")).toEqual([{ mode: "solo", kind: "today", day: utcDay() }]);
  });

  it("count a win once, on the guess that completes the title, with the guesses and hints it took", async () => {
    const { song } = await todaysRound();
    let state = await sealState({ songId: song.id, foundKeys: [], day: utcDay(), tried: 24, hints: ["era"] }, env.STATE_SECRET);
    const words = titleWords(song);
    for (const word of words) state = (await post<GuessResult>("/api/guess", { state, word, delta: true })).state;
    await post<GuessResult>("/api/guess", { state, word: "encore" });

    expect(events.of("win")).toEqual([
      { mode: "solo", kind: "today", day: utcDay(), song: song.id, tries: 24 + words.length, hints: 1 },
    ]);
  });

  it("count a hint revealed, and after how many guesses", async () => {
    const { song } = await todaysRound();
    const state = await sealState({ songId: song.id, foundKeys: [], day: utcDay(), tried: 21 }, env.STATE_SECRET);
    await post("/api/round/hint", { state, hint: "style" });
    expect(events.of("hint")).toEqual([{ mode: "solo", kind: "today", hint: "style", tries: 21 }]);
  });

  it("say a day of the archives is one", async () => {
    const { song } = await todaysRound();
    const state = await sealState({ songId: song.id, foundKeys: [], day: "2026-10-01", tried: 0 }, env.STATE_SECRET);
    await post("/api/guess", { state, word: "xylophone", delta: true });
    expect(events.of("start")).toEqual([{ mode: "solo", kind: "archive", day: "2026-10-01" }]);
  });
});
