import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalize } from "../../../src/game/normalize";
import { NEAR_SCORE, numberProximityScore } from "../../../src/game/similarity";
import { tokenize } from "../../../src/game/tokenize";
import type { DisplayToken, GuessResult, RoundView, Song } from "../../../src/game/types";
import { ARCHIVE_DAYS, archiveDays } from "../../../src/game/daily";
import { pickDailyEntry } from "../../../worker/src/catalog";
import { resetFreshRoundMemo } from "../../../worker/src/freshRound";
import app from "../../../worker/src/index";
import { resetSimilarityMemo, SIMILARITY_TABLE_VERSION, type SimilarityKv } from "../../../worker/src/similarity";
import { getSongById, resetSongMemo } from "../../../worker/src/songs";
import { openState, sealState } from "../../../worker/src/state";
import { encodeNear, type ReadableNear } from "./similarityTableFixture";
import { titleLeaks } from "./titleLeak";

const env = { STATE_SECRET: "test-secret" };

interface KvTable {
  scores?: Record<string, number>;
  near?: ReadableNear;
  /** When set, only this song has a table, which proves the right one is read. */
  songId?: string;
}

/** Stands in for the Workers KV namespace holding the precomputed tables. */
function similarityKv({ scores = {}, near = {}, songId }: KvTable): SimilarityKv {
  return {
    get: async (key: string) =>
      songId && key !== songId
        ? null
        : JSON.stringify({
            version: SIMILARITY_TABLE_VERSION,
            songId: key,
            model: "test-model",
            scores,
            ...encodeNear(near),
          }),
  };
}

// Long enough to clear resolveSong.ts's MIN_LYRIC_WORDS floor, which a real
// song always does and an LRCLIB stub never does.
const FIXTURE_LYRICS = [
  "Premiere ligne du couplet",
  "Deuxieme ligne du couplet",
  "Troisieme ligne pour finir le couplet",
  "",
  "Refrain une ligne",
  "Refrain deux lignes",
  "Encore un refrain avant la fin",
].join("\n");

function requestUrl(input: string | URL | Request): URL {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

/** Stubs the LRCLIB search call the Worker makes, so route tests never hit the real network. Echoes the requested artist back so `bestMatch` finds an exact hit for whichever song is active today. */
function mockLrclibFetch(plainLyrics: string = FIXTURE_LYRICS): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const artistName = requestUrl(input).searchParams.get("artist_name") ?? "Unknown";
      return new Response(JSON.stringify([{ artistName, instrumental: false, plainLyrics, syncedLyrics: null }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
}

beforeEach(() => {
  mockLrclibFetch();
  // Each test starts from a cold isolate: getSongById memoizes a resolved song
  // for the isolate's lifetime (see worker/src/songs.ts), so without this a
  // test that counts LRCLIB calls would be answered from the previous test's
  // song and count none.
  resetSongMemo();
  resetSimilarityMemo();
  resetFreshRoundMemo();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function getRound(): Promise<RoundView> {
  const res = await app.request("/api/round", {}, env);
  expect(res.status).toBe(200);
  return (await res.json()) as RoundView;
}

/** The song a round is played on, as only the Worker can read it: from its sealed state. */
async function songIdOf(round: RoundView): Promise<string> {
  const payload = await openState(round.state, env.STATE_SECRET);
  if (!payload) throw new Error("round state does not open");
  return payload.songId;
}

async function playedSong(round: RoundView): Promise<Song> {
  const song = await getSongById(await songIdOf(round));
  if (!song) throw new Error("round song not found");
  return song;
}

async function guess(
  state: string,
  word: string,
  bindings: Record<string, unknown> = env
): Promise<{ status: number; body: GuessResult }> {
  const res = await app.request(
    "/api/guess",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, word }) },
    bindings
  );
  const body = (await res.json()) as GuessResult;
  return { status: res.status, body };
}

function allTokens(round: RoundView): DisplayToken[] {
  return [...round.title.tokens, ...round.sections.flatMap((s) => s.lines.flatMap((l) => l.tokens))];
}

/**
 * Every word of the song in the order positions count them: the title's, then
 * the lyrics'. Written out here rather than taken from src/game/slots.ts, so
 * the route is checked against the contract instead of against itself.
 */
function wordsInOrder(song: Song): string[] {
  return [song.title, ...song.sections.flatMap((section) => section.lines)]
    .flatMap((text) => tokenize(text))
    .filter((token) => token.isWord)
    .map((token) => normalize(token.text));
}

describe("GET /api/round", () => {
  it("never reveals word text before any guess", async () => {
    const round = await getRound();
    const words = allTokens(round).filter((t) => t.isWord);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((t) => !t.revealed && /^_+$/.test(t.text))).toBe(true);
  });

  it("omits the artist before victory", async () => {
    expect((await getRound()).artist).toBeUndefined();
  });

  it("returns the same song for repeated calls the same day", async () => {
    const first = await getRound();
    const second = await getRound();
    expect(await songIdOf(second)).toBe(await songIdOf(first));
  });

  // Every first visit of the day used to mask the whole song and seal a state
  // again, for a round that is the same for every player.
  it("builds the day's fresh round once, then serves it as is", async () => {
    const first = await getRound();
    const sealed = vi.spyOn(crypto.subtle, "encrypt");

    const again = await getRound();

    expect(sealed).not.toHaveBeenCalled();
    expect(again).toEqual(first);
    // Still a state the Worker opens, for a round with nothing found.
    expect((await openState(again.state, env.STATE_SECRET))?.foundKeys).toEqual([]);
    sealed.mockRestore();
  });

  it("keeps the fresh round of each configuration apart", async () => {
    const withHints = await app.request("/api/round", {}, { ...env, DEV_REVEAL_LYRICS: "1" });
    const plain = await getRound();
    const otherSecret = await app.request("/api/round", {}, { STATE_SECRET: "another-secret" });

    expect(JSON.stringify(await withHints.json())).toContain("devHint");
    expect(JSON.stringify(plain)).not.toContain("devHint");
    const { state } = (await otherSecret.json()) as RoundView;
    expect(await openState(state, "another-secret")).not.toBeNull();
    expect(await openState(state, env.STATE_SECRET)).toBeNull();
  });

  // At UTC midnight every player asks for the new song at once, and a cold
  // isolate used to search LRCLIB once per request rather than once in all.
  it("searches LRCLIB once for requests that arrive together on a cold isolate", async () => {
    const rounds = await Promise.all(Array.from({ length: 5 }, () => app.request("/api/round", {}, env)));

    for (const res of rounds) expect(res.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("searches LRCLIB again after a resolution that found nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const emergency = await songIdOf(await getRound());
    mockLrclibFetch();

    // The emergency song stood in, but the day's pick isn't given up on for the isolate's lifetime.
    const round = await getRound();
    expect(vi.mocked(fetch)).toHaveBeenCalled();
    expect(await songIdOf(round)).not.toBe(emergency);
  });

  it("falls back to the next catalog entry when LRCLIB fails for the daily pick", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        callCount += 1;
        if (callCount === 1) return new Response("", { status: 500 });
        const artistName = requestUrl(input).searchParams.get("artist_name") ?? "Unknown";
        return new Response(
          JSON.stringify([{ artistName, instrumental: false, plainLyrics: FIXTURE_LYRICS, syncedLyrics: null }]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );

    const round = await getRound();
    expect(await songIdOf(round)).toBeTruthy();
    expect(callCount).toBeGreaterThan(1);
  });
});

// Regression tests for #40: catalog ids are slugs of the title, and the round
// used to send the id as \`songId\` and inside a signed-but-readable \`state\`, so
// DevTools named the day's song before a single guess.
describe("the song's identity", () => {
  it("is in no response before victory, state included", async () => {
    const round = await getRound();
    const song = await playedSong(round);
    const miss = await guess(round.state, "xylophoneinexistant");
    const hit = await guess(miss.body.state, "ligne");
    expect(hit.body.found).toBe(true);
    expect(hit.body.victory).toBe(false);

    const sent = [round, miss.body, hit.body].map((body) => JSON.stringify(body)).join("\n");
    expect(titleLeaks(sent, song)).toEqual([]);
  });

  it("is in no response for the emergency song either", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const round = await getRound();
    const song = await playedSong(round);
    expect(song.id).toBe("le-refuge-de-novembre");

    const miss = await guess(round.state, "xylophoneinexistant");
    const sent = [round, miss.body].map((body) => JSON.stringify(body)).join("\n");
    expect(titleLeaks(sent, song)).toEqual([]);
  });
});

// The archives (last 30 days) replay any day that had a song, under the
// same rules as today's round; tomorrow's song stays secret.
describe("GET /api/round?day=", () => {
  function at(now: string): void {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(now) });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  async function roundOf(day: string): Promise<Response> {
    return app.request(`/api/round?day=${encodeURIComponent(day)}`, {}, env);
  }

  it("names the day of today's round when none is asked for", async () => {
    at("2026-10-20T10:00:00Z");
    const round = await getRound();
    expect(round.day).toBe("2026-10-20");
    expect(await songIdOf(round)).toBe(pickDailyEntry(new Date("2026-10-20T00:00:00Z")).id);
  });

  it("serves a day the archives hold, on the song it had", async () => {
    at("2026-10-01T10:00:00Z");
    const res = await roundOf("2026-09-26");
    expect(res.status).toBe(200);
    const round = (await res.json()) as RoundView;
    expect(round.day).toBe("2026-09-26");
    expect(await songIdOf(round)).toBe("avenir");
    expect(allTokens(round).filter((t) => t.isWord).every((t) => !t.revealed)).toBe(true);
  });

  it("keeps the round on its day through a guess", async () => {
    at("2026-10-01T10:00:00Z");
    const round = (await (await roundOf("2026-09-26")).json()) as RoundView;
    const { status, body } = await guess(round.state, "xylophoneinexistant");
    expect(status).toBe(200);
    expect(body.day).toBe("2026-09-26");
  });

  it("serves the oldest day of the window and nothing before it", async () => {
    at("2026-11-15T10:00:00Z");
    expect((await roundOf("2026-10-17")).status).toBe(200);
    expect((await roundOf("2026-10-16")).status).toBe(404);
  });

  it("never serves a day to come", async () => {
    at("2026-10-01T23:59:59Z");
    expect((await roundOf("2026-10-02")).status).toBe(404);
    expect((await roundOf("2027-10-01")).status).toBe(404);
  });

  it("has nothing for a day before the game had songs", async () => {
    at("2026-10-01T10:00:00Z");
    expect((await roundOf("2026-09-11")).status).toBe(404);
    expect((await roundOf("2026-09-12")).status).toBe(200);
  });

  it("refuses anything that isn't a calendar day", async () => {
    at("2026-10-01T10:00:00Z");
    for (const day of ["2026-02-30", "2026-9-26", "yesterday", "", "2026-09-26T00:00:00Z"]) {
      expect((await roundOf(day)).status, day).toBe(400);
    }
  });

  it("names nothing of the song before victory", async () => {
    at("2026-10-01T10:00:00Z");
    const round = (await (await roundOf("2026-09-26")).json()) as RoundView;
    const song = await playedSong(round);
    const miss = await guess(round.state, "xylophoneinexistant");
    const sent = [round, miss.body].map((body) => JSON.stringify(body)).join("\n");
    expect(titleLeaks(sent, song)).toEqual([]);
  });

  it("keeps the song of every day of the window resolved, once each", async () => {
    at("2026-10-11T10:00:00Z");
    const fetched = vi.mocked(fetch);
    const rounds: RoundView[] = [];
    for (const day of archiveDays()) {
      const res = await roundOf(day);
      expect(res.status, day).toBe(200);
      rounds.push((await res.json()) as RoundView);
    }
    const resolved = fetched.mock.calls.length;
    expect(resolved).toBe(ARCHIVE_DAYS);

    for (const round of rounds) expect((await guess(round.state, "xylophoneinexistant")).status).toBe(200);
    expect(fetched.mock.calls.length).toBe(resolved);
  });

  it("takes a state sealed before the archives as a round of today", async () => {
    at("2026-10-01T10:00:00Z");
    const song = await playedSong(await getRound());
    const legacy = await sealState({ songId: song.id, foundKeys: [] }, env.STATE_SECRET);
    const { status, body } = await guess(legacy, "xylophoneinexistant");
    expect(status).toBe(200);
    expect(body.day).toBe("2026-10-01");
  });
});

describe("POST /api/round/resume", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-01T10:00:00Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function dayRound(day: string): Promise<RoundView> {
    return (await (await app.request(`/api/round?day=${day}`, {}, env)).json()) as RoundView;
  }

  async function resume(body: unknown): Promise<{ status: number; body: RoundView }> {
    const res = await app.request(
      "/api/round/resume",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      env
    );
    return { status: res.status, body: (await res.json()) as RoundView };
  }

  function revealedKeys(round: RoundView): string[] {
    return [...new Set(allTokens(round).filter((t) => t.isWord && t.revealed).map((t) => normalize(t.text)))].sort();
  }

  it("rebuilds a saved day's view from its state alone", async () => {
    const played = (await guess((await dayRound("2026-09-26")).state, "ligne")).body;
    const { status, body } = await resume({ states: [played.state] });
    expect(status).toBe(200);
    expect(body.day).toBe("2026-09-26");
    expect(revealedKeys(body)).toEqual(["ligne"]);
  });

  it("puts together what several states of the same round found", async () => {
    const start = await dayRound("2026-09-26");
    const mine = (await guess(start.state, "ligne")).body;
    const theirs = (await guess(start.state, "refrain")).body;
    const { status, body } = await resume({ states: [mine.state, theirs.state] });
    expect(status).toBe(200);
    expect(revealedKeys(body)).toEqual(["ligne", "refrain"]);
  });

  it("wins the round when the states together hold the whole title", async () => {
    const start = await dayRound("2026-09-26");
    const song = await playedSong(start);
    const titleWords = tokenize(song.title).filter((t) => t.isWord);
    const states = await Promise.all(titleWords.map(async (word) => (await guess(start.state, word.text)).body.state));
    expect(states.length).toBeLessThanOrEqual(4);
    const { body } = await resume({ states });
    expect(body.victory).toBe(true);
    expect(body.artist).toBe(song.artist);
  });

  it("refuses states of two different rounds", async () => {
    const one = await dayRound("2026-09-26");
    const other = await dayRound("2026-09-27");
    expect((await resume({ states: [one.state, other.state] })).status).toBe(400);
  });

  it("refuses a state it didn't seal", async () => {
    const song = await playedSong(await dayRound("2026-09-26"));
    const forged = await sealState({ songId: song.id, foundKeys: ["ligne"], day: "2026-09-26" }, "not-the-secret");
    expect((await resume({ states: [forged] })).status).toBe(400);
  });

  it("files a state sealed before the archives under the day it is told", async () => {
    const song = await playedSong(await dayRound("2026-09-30"));
    const legacy = await sealState({ songId: song.id, foundKeys: ["ligne"] }, env.STATE_SECRET);
    const { status, body } = await resume({ states: [legacy], day: "2026-09-30" });
    expect(status).toBe(200);
    expect(body.day).toBe("2026-09-30");
    expect((await openState(body.state, env.STATE_SECRET))?.day).toBe("2026-09-30");
  });

  it("refuses a malformed request", async () => {
    const { state } = await dayRound("2026-09-26");
    for (const body of [{}, { states: [] }, { states: "x" }, { states: [1] }, { states: [state, state, state, state, state] }, { states: [state], day: "hier" }]) {
      expect((await resume(body)).status, JSON.stringify(body).slice(0, 40)).toBe(400);
    }
  });

  it("names nothing of the song before victory", async () => {
    const start = await dayRound("2026-09-26");
    const song = await playedSong(start);
    const { body } = await resume({ states: [start.state] });
    expect(titleLeaks(JSON.stringify(body), song)).toEqual([]);
  });
});

describe("POST /api/guess", () => {
  it("reveals every occurrence of a correctly guessed word", async () => {
    const round = await getRound();
    const song = await playedSong(round);

    const titleWord = tokenize(song.title).find((t) => t.isWord);
    if (!titleWord) throw new Error("song title has no word tokens");

    const { status, body } = await guess(round.state, titleWord.text);
    expect(status).toBe(200);
    expect(body.found).toBe(true);
    expect(body.key).toBe(normalize(titleWord.text));
    expect(allTokens(body).some((t) => t.isWord && t.revealed && normalize(t.text) === body.key)).toBe(true);
  });

  it("matches guesses regardless of case or accents", async () => {
    const round = await getRound();
    const song = await playedSong(round);

    const titleWord = tokenize(song.title).find((t) => t.isWord);
    if (!titleWord) throw new Error("song title has no word tokens");

    const { body } = await guess(round.state, titleWord.text.toUpperCase());
    expect(body.found).toBe(true);
  });

  it("does not reveal anything for a word that is not in the song", async () => {
    const round = await getRound();
    const { body } = await guess(round.state, "xylophoneinexistant");
    expect(body.found).toBe(false);
    expect(allTokens(body).filter((t) => t.isWord).every((t) => !t.revealed)).toBe(true);
  });

  it("declares victory and reveals the artist once every title word is found", async () => {
    const round = await getRound();
    const song = await playedSong(round);

    const titleWords = tokenize(song.title).filter((t) => t.isWord);
    let state = round.state;
    let last: GuessResult | undefined;
    for (const word of titleWords) {
      const result = await guess(state, word.text);
      state = result.body.state;
      last = result.body;
    }

    expect(last?.victory).toBe(true);
    expect(last?.artist).toBe(song.artist);
  });

  it("rejects a tampered state token", async () => {
    const round = await getRound();
    // Flip the token's first character (its IV), not its last: the last
    // character of a base64url token can carry padding bits decoding ignores,
    // so swapping it could leave the token's bytes intact on some days.
    const first = round.state[0];
    const tampered = (first === "a" ? "b" : "a") + round.state.slice(1);
    const { status } = await guess(tampered, "le");
    expect(status).toBe(400);
  });

  it("does not let a client forge already-found words via a tampered state", async () => {
    // An attacker can't construct a validly-signed state without the server
    // secret, so a forged/foreign token must be rejected outright rather
    // than accepted with attacker-supplied foundKeys.
    const round = await getRound();
    const { status } = await guess(`${round.state}tampered`, "le");
    expect(status).toBe(400);
  });
});

describe("POST /api/guess — proximity score", () => {
  it("scores a missed word from the song's precomputed table", async () => {
    const round = await getRound();
    const scoring = { ...env, SIMILARITY: similarityKv({ scores: { xylophoneinexistant: 37 } }) };
    const { body } = await guess(round.state, "xylophoneinexistant", scoring);
    expect(body.found).toBe(false);
    expect(body.score).toBe(37);
  });

  it("gives a found word the top score without touching the table", async () => {
    const round = await getRound();
    const song = await playedSong(round);
    const titleWord = tokenize(song.title).find((t) => t.isWord);
    if (!titleWord) throw new Error("song title has no word tokens");

    const get = vi.fn(async () => null);
    const { body } = await guess(round.state, titleWord.text, { ...env, SIMILARITY: { get } });
    expect(body.found).toBe(true);
    expect(body.score).toBe(100);
    expect(body.near).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it("reads the table once for a whole round, not once per guess", async () => {
    const round = await getRound();
    const get = vi.fn(async (key: string) =>
      JSON.stringify({
        version: SIMILARITY_TABLE_VERSION,
        songId: key,
        model: "test-model",
        scores: {},
        targets: [],
        near: {},
      })
    );
    const scoring = { ...env, SIMILARITY: { get } };

    const first = await guess(round.state, "xylophoneinexistant", scoring);
    await guess(first.body.state, "betteraveimaginaire", scoring);

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("reads the table of the song actually being played", async () => {
    const round = await getRound();
    const scoring = {
      ...env,
      SIMILARITY: similarityKv({ scores: { xylophoneinexistant: 12 }, songId: await songIdOf(round) }),
    };
    expect((await guess(round.state, "xylophoneinexistant", scoring)).body.score).toBe(12);
  });

  it("returns a null score for a word outside the reference vocabulary", async () => {
    const round = await getRound();
    const scoring = { ...env, SIMILARITY: similarityKv({ scores: { autrechose: 80 } }) };
    expect((await guess(round.state, "xylophoneinexistant", scoring)).body.score).toBeNull();
  });

  it("keeps working with no similarity namespace bound at all", async () => {
    const round = await getRound();
    const { status, body } = await guess(round.state, "xylophoneinexistant");
    expect(status).toBe(200);
    expect(body.found).toBe(false);
    expect(body.score).toBeNull();
    expect(body.near).toEqual([]);
  });

  it("never leaks a hidden word or a vector alongside the hint", async () => {
    const round = await getRound();
    const song = await playedSong(round);

    const scoring = {
      ...env,
      SIMILARITY: similarityKv({
        scores: { xylophoneinexistant: 64 },
        near: { xylophoneinexistant: { couplet: 64, ligne: 52 } },
      }),
    };
    const { body } = await guess(round.state, "xylophoneinexistant", scoring);

    // The response may only ever grow by numbers: a score, and positions with
    // a score each. No neighbour word, no vector, no table excerpt.
    expect(Object.keys(body).sort()).toEqual([
      "day",
      "found",
      "key",
      "near",
      "score",
      "sections",
      "state",
      "title",
      "victory",
    ]);
    expect(body.near.length).toBeGreaterThan(0);
    for (const slot of body.near) {
      expect(Object.keys(slot).sort()).toEqual(["position", "score"]);
      expect(Number.isInteger(slot.position)).toBe(true);
    }

    // Still-masked lyrics must stay masked, the very words the guess is close
    // to included: the table is read server side and answered with numbers.
    const serialized = JSON.stringify(body);
    const hiddenWords = song.sections
      .flatMap((section) => section.lines)
      .flatMap((line) => tokenize(line))
      .filter((token) => token.isWord)
      .map((token) => normalize(token.text))
      .filter((key) => key.length > 3);
    expect(hiddenWords).toContain("couplet");
    expect(hiddenWords.some((key) => serialized.includes(key))).toBe(false);
  });
});

describe("POST /api/guess — close words", () => {
  it("points a missed guess at every hidden occurrence of the words it is close to", async () => {
    const round = await getRound();
    const words = wordsInOrder(await playedSong(round));
    const scoring = {
      ...env,
      SIMILARITY: similarityKv({
        scores: { xylophoneinexistant: 64 },
        near: { xylophoneinexistant: { couplet: 64, refrain: 41 } },
      }),
    };

    const { body } = await guess(round.state, "xylophoneinexistant", scoring);

    const expected = words.flatMap((word, position) =>
      word === "couplet" ? [{ position, score: 64 }] : word === "refrain" ? [{ position, score: 41 }] : []
    );
    expect(expected.length).toBeGreaterThanOrEqual(2);
    expect(body.found).toBe(false);
    expect(body.near).toEqual(expected);
  });

  it("leaves out a word the player has already found", async () => {
    const round = await getRound();
    const scoring = {
      ...env,
      SIMILARITY: similarityKv({ scores: { xylophoneinexistant: 64 }, near: { xylophoneinexistant: { couplet: 64 } } }),
    };

    const first = await guess(round.state, "couplet", scoring);
    expect(first.body.found).toBe(true);

    const { body } = await guess(first.body.state, "xylophoneinexistant", scoring);
    expect(body.score).toBe(64);
    expect(body.near).toEqual([]);
  });

  it("never places a word that is itself in the lyrics", async () => {
    const round = await getRound();
    const scoring = { ...env, SIMILARITY: similarityKv({ near: { couplet: { refrain: 90 } } }) };
    const { body } = await guess(round.state, "couplet", scoring);
    expect(body.found).toBe(true);
    expect(body.near).toEqual([]);
  });

  it("places nothing for a word that isn't close enough to any hidden word", async () => {
    const round = await getRound();
    const scoring = {
      ...env,
      SIMILARITY: similarityKv({
        scores: { xylophoneinexistant: 20 },
        near: { xylophoneinexistant: { couplet: NEAR_SCORE - 1 } },
      }),
    };
    const { body } = await guess(round.state, "xylophoneinexistant", scoring);
    expect(body.score).toBe(20);
    expect(body.near).toEqual([]);
  });
});

// The shared fixture plus the two dated lines these tests need: a blob of its
// own would have to clear the MIN_LYRIC_WORDS floor all over again.
const NUMBER_LYRICS = `${FIXTURE_LYRICS}\n\nNee en 1975\nRevenue en 2015`;

describe("POST /api/guess — numbers", () => {
  beforeEach(() => {
    mockLrclibFetch(NUMBER_LYRICS);
  });

  it("hides a number in the lyrics until it is guessed", async () => {
    const round = await getRound();
    expect(wordsInOrder(await playedSong(round))).toContain("2015");
    expect(allTokens(round).some((t) => t.text.includes("2015"))).toBe(false);

    const { body } = await guess(round.state, "2015");
    expect(body.found).toBe(true);
    expect(allTokens(body).some((t) => t.revealed && t.text === "2015")).toBe(true);
  });

  it("shows a close number in place of the hidden ones, once similarity is on", async () => {
    const round = await getRound();
    const words = wordsInOrder(await playedSong(round));

    const { body } = await guess(round.state, "2010", { ...env, SIMILARITY: similarityKv({}) });
    expect(body.found).toBe(false);
    expect(body.score).toBe(numberProximityScore("2010", "2015"));
    expect(body.near).toContainEqual({ position: words.indexOf("2015"), score: numberProximityScore("2010", "2015") });
  });

  it("gives a number nothing when similarity is off", async () => {
    const round = await getRound();
    const { body } = await guess(round.state, "2010");
    expect(body.score).toBeNull();
    expect(body.near).toEqual([]);
  });
});

describe("DEV_REVEAL_LYRICS", () => {
  it("never attaches devHint by default", async () => {
    const round = await getRound();
    expect(allTokens(round).every((t) => t.devHint === undefined)).toBe(true);

    const { body } = await guess(round.state, "xylophoneinexistant");
    expect(allTokens(body).every((t) => t.devHint === undefined)).toBe(true);
  });

  it("attaches every still-hidden word's real text when on, matching the actual song", async () => {
    const devEnv = { ...env, DEV_REVEAL_LYRICS: "1" };
    const res = await app.request("/api/round", {}, devEnv);
    const round = (await res.json()) as RoundView;
    const song = await getSongById(await songIdOf(round));
    if (!song) throw new Error("round song not found");

    const words = allTokens(round).filter((t) => t.isWord);
    expect(words.length).toBeGreaterThan(0);
    const realKeys = new Set(wordsInOrder(song));
    // Nothing is found yet, so every word is still masked, and every one now
    // carries its real text - checked against the song itself, not echoed back.
    for (const token of words) {
      expect(token.revealed).toBe(false);
      expect(typeof token.devHint).toBe("string");
      expect(realKeys.has(normalize(token.devHint as string))).toBe(true);
    }
  });

  it("never sends devHint for a word that is already found", async () => {
    const devEnv = { ...env, DEV_REVEAL_LYRICS: "1" };
    const round = (await (await app.request("/api/round", {}, devEnv)).json()) as RoundView;
    const song = await getSongById(await songIdOf(round));
    if (!song) throw new Error("round song not found");
    const titleWord = tokenize(song.title).find((t) => t.isWord);
    if (!titleWord) throw new Error("song title has no word tokens");

    const { body } = await guess(round.state, titleWord.text, devEnv);
    const found = allTokens(body).find((t) => t.isWord && t.revealed && normalize(t.text) === normalize(titleWord.text));
    expect(found).toBeDefined();
    expect(found?.devHint).toBeUndefined();

    const stillHidden = allTokens(body).filter((t) => t.isWord && !t.revealed);
    expect(stillHidden.every((t) => typeof t.devHint === "string")).toBe(true);
  });

  it("treats any value other than the literal string \"1\" as off", async () => {
    const round = (await (await app.request("/api/round", {}, { ...env, DEV_REVEAL_LYRICS: "true" })).json()) as RoundView;
    expect(allTokens(round).every((t) => t.devHint === undefined)).toBe(true);
  });
});

describe("reveal all lyrics (post-victory checkbox)", () => {
  it("never attaches revealHint before the round is won", async () => {
    const round = await getRound();
    expect(allTokens(round).every((t) => t.revealHint === undefined)).toBe(true);

    const { body } = await guess(round.state, "xylophoneinexistant");
    expect(body.victory).toBe(false);
    expect(allTokens(body).every((t) => t.revealHint === undefined)).toBe(true);
  });

  it("attaches every still-hidden word's real text once every title word is found, matching the actual song", async () => {
    const round = await getRound();
    const song = await playedSong(round);

    const titleWords = tokenize(song.title).filter((t) => t.isWord);
    let state = round.state;
    let last: GuessResult | undefined;
    for (const word of titleWords) {
      const result = await guess(state, word.text);
      state = result.body.state;
      last = result.body;
    }
    if (!last) throw new Error("no guess was made");

    expect(last.victory).toBe(true);
    const realKeys = new Set(wordsInOrder(song));
    const stillHidden = allTokens(last).filter((t) => t.isWord && !t.revealed);
    expect(stillHidden.length).toBeGreaterThan(0);
    for (const token of stillHidden) {
      expect(typeof token.revealHint).toBe("string");
      expect(realKeys.has(normalize(token.revealHint as string))).toBe(true);
    }
  });

  it("never sends revealHint for a word that is already found", async () => {
    const round = await getRound();
    const song = await playedSong(round);
    const titleWords = tokenize(song.title).filter((t) => t.isWord);

    let state = round.state;
    let last: GuessResult | undefined;
    for (const word of titleWords) {
      const result = await guess(state, word.text);
      state = result.body.state;
      last = result.body;
    }
    if (!last) throw new Error("no guess was made");

    const found = allTokens(last).filter((t) => t.isWord && t.revealed);
    expect(found.every((t) => t.revealHint === undefined)).toBe(true);
  });
});

describe("a missing STATE_SECRET", () => {
  // Regression test: with no worker/.dev.vars on disk, env.STATE_SECRET is
  // undefined and every request used to blow up inside Web Crypto with
  // "Imported HMAC key length (0) must be a non-zero value...", five frames
  // deep, naming neither the variable nor the file that was never created.
  it("names itself in the log instead of failing inside Web Crypto", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await app.request("/api/round", {}, {});

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server is misconfigured" });
    expect(logged).toHaveBeenCalledTimes(1);
    const message = String(logged.mock.calls[0][0]);
    expect(message).toContain("STATE_SECRET");
    expect(message).toContain("worker/.dev.vars");
    logged.mockRestore();
  });

  it("rejects a guess the same way rather than half-processing it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await app.request(
      "/api/guess",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: "x", word: "le" }) },
      {}
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server is misconfigured" });
    logged.mockRestore();
  });

  it("treats an empty secret as missing, not as a usable key", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await app.request("/api/round", {}, { STATE_SECRET: "" })).status).toBe(500);
    logged.mockRestore();
  });
});

describe("malformed input", () => {
  it("rejects a missing word field", async () => {
    const round = await getRound();
    const res = await app.request(
      "/api/guess",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: round.state }) },
      env
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-JSON bodies", async () => {
    const res = await app.request(
      "/api/guess",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" },
      env
    );
    expect(res.status).toBe(400);
  });

  it("rejects an empty or whitespace-only word", async () => {
    const round = await getRound();
    expect((await guess(round.state, "   ")).status).toBe(400);
  });

  it("rejects an oversized word", async () => {
    const round = await getRound();
    expect((await guess(round.state, "a".repeat(65))).status).toBe(400);
  });

  it("rejects a missing state field", async () => {
    const res = await app.request(
      "/api/guess",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: "le" }) },
      env
    );
    expect(res.status).toBe(400);
  });
});

describe("CORS preflight", () => {
  // Pages and the Worker are on different origins in production, so a guess is
  // preflighted. Without an explicit max-age the browser caches that preflight
  // for its own default of a few seconds, and the player pays an extra round
  // trip on most guesses.
  it("tells the browser it can keep the preflight", async () => {
    const res = await app.request(
      "/api/guess",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://lyrix-eyg.pages.dev",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      },
      env
    );

    expect(res.status).toBe(204);
    expect(Number(res.headers.get("access-control-max-age"))).toBeGreaterThanOrEqual(3600);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("answers a preflight without needing the signing secret", async () => {
    const res = await app.request(
      "/api/guess",
      { method: "OPTIONS", headers: { Origin: "https://lyrix-eyg.pages.dev", "Access-Control-Request-Method": "POST" } },
      {}
    );
    expect(res.status).toBe(204);
  });
});
