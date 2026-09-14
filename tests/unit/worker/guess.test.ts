import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalize } from "../../../src/game/normalize";
import { NEAR_SCORE } from "../../../src/game/similarity";
import { tokenize } from "../../../src/game/tokenize";
import type { DisplayToken, GuessResult, RoundView, Song } from "../../../src/game/types";
import app from "../../../worker/src/index";
import { SIMILARITY_TABLE_VERSION, type SimilarityKv } from "../../../worker/src/similarity";
import { getSongById } from "../../../worker/src/songs";

const env = { STATE_SECRET: "test-secret" };

interface KvTable {
  scores?: Record<string, number>;
  near?: Record<string, Record<string, number>>;
  /** When set, only this song has a table, which proves the right one is read. */
  songId?: string;
}

/** Stands in for the Workers KV namespace holding the precomputed tables. */
function similarityKv({ scores = {}, near = {}, songId }: KvTable): SimilarityKv {
  return {
    get: async (key: string) =>
      songId && key !== songId
        ? null
        : JSON.stringify({ version: SIMILARITY_TABLE_VERSION, songId: key, model: "test-model", scores, near }),
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
function mockLrclibFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const artistName = requestUrl(input).searchParams.get("artist_name") ?? "Unknown";
      return new Response(
        JSON.stringify([{ artistName, instrumental: false, plainLyrics: FIXTURE_LYRICS, syncedLyrics: null }]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    })
  );
}

beforeEach(() => {
  mockLrclibFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function getRound(): Promise<RoundView> {
  const res = await app.request("/api/round", {}, env);
  expect(res.status).toBe(200);
  return (await res.json()) as RoundView;
}

async function playedSong(round: RoundView): Promise<Song> {
  const song = await getSongById(round.songId);
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
    expect(second.songId).toBe(first.songId);
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
    expect(round.songId).toBeTruthy();
    expect(callCount).toBeGreaterThan(1);
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
    const lastChar = round.state.at(-1);
    const tampered = round.state.slice(0, -1) + (lastChar === "a" ? "b" : "a");
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

  it("reads the table of the song actually being played", async () => {
    const round = await getRound();
    const scoring = {
      ...env,
      SIMILARITY: similarityKv({ scores: { xylophoneinexistant: 12 }, songId: round.songId }),
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
      "found",
      "key",
      "near",
      "score",
      "sections",
      "songId",
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
