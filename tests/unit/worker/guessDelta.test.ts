import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalize } from "../../../src/game/normalize";
import { tokenize } from "../../../src/game/tokenize";
import type { DisplayToken, GuessDelta, GuessResult, RoundView, Song } from "../../../src/game/types";
import { resetFreshRoundMemo } from "../../../worker/src/freshRound";
import { resetSimilarityMemo } from "../../../worker/src/similarity";
import { getSongById, resetSongMemo } from "../../../worker/src/songs";
import { openState } from "../../../worker/src/state";
import { titleLeaks } from "./titleLeak";

/**
 * POST /api/guess with `delta: true`: what a guess changed, instead of the
 * whole round. Counted rather than timed: the bytes a miss costs, and how many
 * full views the Worker builds for it.
 */

const buildRoundViewCalls = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../../worker/src/round", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../worker/src/round")>();
  return {
    ...actual,
    buildRoundView: (...args: Parameters<typeof actual.buildRoundView>) => {
      buildRoundViewCalls.count += 1;
      return actual.buildRoundView(...args);
    },
  };
});

const { default: app } = await import("../../../worker/src/index");

const env = { STATE_SECRET: "test-secret" };

const WORDS = ["amour", "toujours", "chemin", "lumière", "matin", "soleil", "rivière", "jardin"];

/**
 * `lines` lines of lyrics, each word coming back in several spellings: at the
 * start of a line it is capitalized ("Amour"), further on it isn't ("amour").
 */
function lyrics(lines: number): string {
  return Array.from({ length: lines }, (_, index) => {
    const word = (offset: number) => WORDS[(index + offset) % WORDS.length] as string;
    const first = word(0);
    return `${first[0]?.toUpperCase()}${first.slice(1)} et ${word(3)} encore ${word(5)} ici`;
  }).join("\n");
}

function mockLrclib(plainLyrics: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const artistName = url.searchParams.get("artist_name") ?? "Unknown";
      return new Response(JSON.stringify([{ artistName, instrumental: false, plainLyrics, syncedLyrics: null }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
}

/** A cold isolate on a song of `lines` lines. */
function playSongOf(lines: number): void {
  resetSongMemo();
  resetSimilarityMemo();
  resetFreshRoundMemo();
  mockLrclib(lyrics(lines));
}

beforeEach(() => {
  playSongOf(8);
  buildRoundViewCalls.count = 0;
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
  const payload = await openState(round.state, env.STATE_SECRET);
  const song = payload ? await getSongById(payload.songId) : null;
  if (!song) throw new Error("round song not found");
  return song;
}

async function guess(state: string, word: string, delta: boolean): Promise<{ text: string; body: GuessResult | GuessDelta }> {
  const res = await app.request(
    "/api/guess",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(delta ? { state, word, delta: true } : { state, word }),
    },
    env
  );
  expect(res.status).toBe(200);
  const text = await res.text();
  return { text, body: JSON.parse(text) as GuessResult | GuessDelta };
}

function asDelta(body: GuessResult | GuessDelta): GuessDelta {
  if (!("kind" in body) || body.kind !== "delta") throw new Error("expected a delta");
  return body;
}

function asFull(body: GuessResult | GuessDelta): GuessResult {
  if ("kind" in body) throw new Error("expected a full view");
  return body;
}

/** A view's words, in the order positions count them. */
function words(view: Pick<RoundView, "title" | "sections">): DisplayToken[] {
  return [...view.title.tokens, ...view.sections.flatMap((s) => s.lines.flatMap((l) => l.tokens))].filter(
    (token) => token.isWord
  );
}

/** A word of the lyrics that isn't in the title: finding it never wins the round. */
function lyricsOnlyWord(song: Song): string {
  const titleKeys = new Set(tokenize(song.title).filter((t) => t.isWord).map((t) => normalize(t.text)));
  const found = WORDS.find((word) => !titleKeys.has(normalize(word)));
  if (!found) throw new Error("every lyrics word is in the title");
  return found;
}

describe("POST /api/guess with delta: true", () => {
  it("answers a miss with the same bytes, whatever the song's length", async () => {
    const short = await guess((await getRound()).state, "xylophone", true);
    playSongOf(200);
    const long = await guess((await getRound()).state, "xylophone", true);

    expect(asDelta(short.body).reveal).toEqual([]);
    expect(long.text.length).toBe(short.text.length);
    expect(long.text).not.toContain("sections");
  });

  it("builds no full view for a miss nor for a word found short of a win", async () => {
    playSongOf(200);
    const round = await getRound();
    const song = await playedSong(round);
    buildRoundViewCalls.count = 0;

    const miss = await guess(round.state, "xylophone", true);
    await guess(asDelta(miss.body).state, lyricsOnlyWord(song), true);

    expect(buildRoundViewCalls.count).toBe(0);
  });

  it("reveals exactly what the full view would, each occurrence as the song spells it", async () => {
    const round = await getRound();
    const word = lyricsOnlyWord(await playedSong(round));

    const delta = asDelta((await guess(round.state, word, true)).body);
    const full = asFull((await guess(round.state, word, false)).body);

    const before = words(round);
    const after = words(full);
    const uncovered = after.flatMap((token, position) =>
      token.revealed && !before[position]?.revealed ? [{ position, text: token.text }] : []
    );
    expect(delta.reveal).toEqual(uncovered);
    // Two spellings of the word at least: one capitalized at a line's start.
    expect(new Set(delta.reveal.map((slot) => slot.text)).size).toBeGreaterThan(1);
    expect(delta.revealed).toBe(after.filter((token) => token.revealed).length);
    expect(delta).toMatchObject({ found: true, key: full.key, score: full.score, near: full.near, day: full.day });
  });

  it("counts every word revealed so far, the earlier finds included, on a miss", async () => {
    const round = await getRound();
    const word = lyricsOnlyWord(await playedSong(round));
    const hit = asDelta((await guess(round.state, word, true)).body);
    const miss = asDelta((await guess(hit.state, "xylophone", true)).body);

    expect(miss.reveal).toEqual([]);
    expect(miss.revealed).toBe(hit.revealed);
    expect(miss.revealed).toBeGreaterThan(0);
  });

  it("answers the win with the full view, artist and hidden words included", async () => {
    const round = await getRound();
    const song = await playedSong(round);
    let state = round.state;
    let last: GuessResult | GuessDelta | undefined;
    for (const token of tokenize(song.title).filter((t) => t.isWord)) {
      last = (await guess(state, token.text, true)).body;
      state = last.state;
    }

    const won = asFull(last as GuessResult | GuessDelta);
    expect(won.victory).toBe(true);
    expect(won.artist).toBe(song.artist);
    expect(words(won).some((token) => !token.revealed && token.revealHint)).toBe(true);
  });

  it("names nothing of the song, and reveals nothing but the word found", async () => {
    const round = await getRound();
    const song = await playedSong(round);
    const miss = await guess(round.state, "xylophone", true);
    const hit = await guess(asDelta(miss.body).state, lyricsOnlyWord(song), true);

    expect(titleLeaks([miss.text, hit.text].join("\n"), song)).toEqual([]);
    const { key, reveal } = asDelta(hit.body);
    expect(reveal.length).toBeGreaterThan(0);
    expect(reveal.every((slot) => normalize(slot.text) === key)).toBe(true);
  });
});

describe("POST /api/guess without delta", () => {
  it("answers with the full view, as it always has", async () => {
    const round = await getRound();
    buildRoundViewCalls.count = 0;
    const miss = asFull((await guess(round.state, "xylophone", false)).body);

    expect(miss.sections.length).toBeGreaterThan(0);
    expect("reveal" in miss).toBe(false);
    expect(buildRoundViewCalls.count).toBe(1);
  });
});
