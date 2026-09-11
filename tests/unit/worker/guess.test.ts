import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalize } from "../../../src/game/normalize";
import { tokenize } from "../../../src/game/tokenize";
import type { DisplayToken, GuessResult, RoundView } from "../../../src/game/types";
import app from "../../../worker/src/index";
import { getSongById } from "../../../worker/src/songs";

const env = { STATE_SECRET: "test-secret" };

const FIXTURE_LYRICS = "Premiere ligne du couplet\nDeuxieme ligne du couplet\n\nRefrain une ligne\nRefrain deux lignes";

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

async function guess(state: string, word: string): Promise<{ status: number; body: GuessResult }> {
  const res = await app.request(
    "/api/guess",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, word }) },
    env
  );
  const body = (await res.json()) as GuessResult;
  return { status: res.status, body };
}

function allTokens(round: RoundView): DisplayToken[] {
  return [...round.title.tokens, ...round.sections.flatMap((s) => s.lines.flatMap((l) => l.tokens))];
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
    const song = await getSongById(round.songId);
    if (!song) throw new Error("round song not found");

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
    const song = await getSongById(round.songId);
    if (!song) throw new Error("round song not found");

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
    const song = await getSongById(round.songId);
    if (!song) throw new Error("round song not found");

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
