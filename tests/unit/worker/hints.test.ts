import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utcDay } from "../../../src/game/daily";
import { normalize } from "../../../src/game/normalize";
import { tokenize } from "../../../src/game/tokenize";
import type { GuessDelta, GuessResult, HintAnswer, HintId, RoundView, Song } from "../../../src/game/types";
import { resetFreshRoundMemo } from "../../../worker/src/freshRound";
import app from "../../../worker/src/index";
import { resetSimilarityMemo } from "../../../worker/src/similarity";
import { hintValues } from "../../../worker/src/songFacts";
import { getSongById, resetSongMemo } from "../../../worker/src/songs";
import { openState, sealState } from "../../../worker/src/state";

const env = { STATE_SECRET: "test-secret" };

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

function requestUrl(input: string | URL | Request): URL {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

beforeEach(() => {
  // LRCLIB stubbed: the requested artist is echoed back, so today's catalog song resolves to the fixture.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const artistName = requestUrl(input).searchParams.get("artist_name") ?? "Unknown";
      const results = [{ artistName, instrumental: false, plainLyrics: FIXTURE_LYRICS, syncedLyrics: null }];
      return new Response(JSON.stringify(results), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
  resetSongMemo();
  resetSimilarityMemo();
  resetFreshRoundMemo();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function post<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await app.request(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    env
  );
  return { status: res.status, body: (await res.json()) as T };
}

async function todaysRound(): Promise<{ round: RoundView; song: Song }> {
  const res = await app.request("/api/round", {}, env);
  expect(res.status).toBe(200);
  const round = (await res.json()) as RoundView;
  const payload = await openState(round.state, env.STATE_SECRET);
  const song = payload ? await getSongById(payload.songId) : null;
  if (!song) throw new Error("today's song didn't resolve");
  return { round, song };
}

/** A state the Worker itself would have sealed after `tried` guesses, with `hints` revealed. */
function stateAfter(song: Song, tried: number, hints: HintId[] = [], foundKeys: string[] = []): Promise<string> {
  return sealState({ songId: song.id, foundKeys, day: utcDay(), tried, ...(hints.length ? { hints } : {}) }, env.STATE_SECRET);
}

function reveal(state: string, hint: unknown) {
  return post<HintAnswer & { error?: string }>("/api/round/hint", { state, hint });
}

function titleKeys(song: Song): string[] {
  return tokenize(song.title)
    .filter((token) => token.isWord)
    .map((token) => normalize(token.text));
}

describe("hints in a round", () => {
  it("come with a fresh round as a guess count, with no text", async () => {
    const { round, song } = await todaysRound();
    expect(round.hints).toEqual({ tried: 0, used: [], values: {} });
    const values = hintValues(song.id);
    expect(values).not.toBeNull();
    for (const text of Object.values(values ?? {})) expect(JSON.stringify(round)).not.toContain(text);
  });

  it("count every guess the Worker answers, found or not, in a delta as in a full view", async () => {
    const { round } = await todaysRound();
    const missed = await post<GuessDelta>("/api/guess", { state: round.state, word: "xylophone", delta: true });
    expect(missed.body.hints?.tried).toBe(1);
    const found = await post<GuessResult>("/api/guess", { state: missed.body.state, word: "ligne" });
    expect(found.body.found).toBe(true);
    expect(found.body.hints?.tried).toBe(2);
    expect((await openState(found.body.state, env.STATE_SECRET))?.tried).toBe(2);
  });

  it("reads a state sealed before hints as having counted its found words", async () => {
    const { song } = await todaysRound();
    const legacy = await sealState({ songId: song.id, foundKeys: ["ligne", "couplet"], day: utcDay() }, env.STATE_SECRET);
    const { body } = await post<RoundView>("/api/round/resume", { states: [legacy] });
    expect(body.hints).toEqual({ tried: 2, used: [], values: {} });
  });

  it("merges states on resume: the furthest guess count, every hint revealed", async () => {
    const { song } = await todaysRound();
    const values = hintValues(song.id);
    const mine = await stateAfter(song, 22, ["era"]);
    const room = await stateAfter(song, 41, ["style", "era"]);
    const { body } = await post<RoundView>("/api/round/resume", { states: [mine, room] });
    expect(body.hints).toEqual({ tried: 41, used: ["era", "style"], values: { era: values?.era, style: values?.style } });
  });
});

describe("POST /api/round/hint", () => {
  it("refuses a hint before the first threshold", async () => {
    const { song } = await todaysRound();
    const { status } = await reveal(await stateAfter(song, 19), "era");
    expect(status).toBe(409);
  });

  it("reveals the hint picked at a threshold, and seals it", async () => {
    const { song } = await todaysRound();
    const { status, body } = await reveal(await stateAfter(song, 20), "artistType");
    expect(status).toBe(200);
    expect(body.hints).toEqual({ tried: 20, used: ["artistType"], values: { artistType: hintValues(song.id)?.artistType } });
    expect(await openState(body.state, env.STATE_SECRET)).toMatchObject({ tried: 20, hints: ["artistType"] });
  });

  it("allows one hint per threshold reached, whichever the player picks", async () => {
    const { song } = await todaysRound();
    expect((await reveal(await stateAfter(song, 34, ["style"]), "era")).status).toBe(409);
    const second = await reveal(await stateAfter(song, 35, ["style"]), "era");
    expect(second.body.hints.used).toEqual(["style", "era"]);
    // Two thresholds passed with none taken: two may be revealed, one after the other.
    const first = await reveal(await stateAfter(song, 40), "style");
    expect((await reveal(first.body.state, "era")).body.hints.used).toEqual(["style", "era"]);
  });

  it("answers a hint already revealed with the round as it stands", async () => {
    const { song } = await todaysRound();
    const state = await stateAfter(song, 20, ["era"]);
    const { status, body } = await reveal(state, "era");
    expect(status).toBe(200);
    expect(body.state).toBe(state);
    expect(body.hints.used).toEqual(["era"]);
  });

  it("refuses a forged state, a state that isn't one, and a hint that doesn't exist", async () => {
    const { song } = await todaysRound();
    const forged = await sealState({ songId: song.id, foundKeys: [], day: utcDay(), tried: 50 }, "not-the-secret");
    expect((await reveal(forged, "era")).status).toBe(400);
    expect((await reveal("not-a-state", "era")).status).toBe(400);
    expect((await reveal(await stateAfter(song, 50), "artist")).status).toBe(400);
  });

  it("refuses a hint once the round is won, whose view shows every hint", async () => {
    const { song } = await todaysRound();
    const won = await stateAfter(song, 30, ["era"], titleKeys(song));
    expect((await reveal(won, "style")).status).toBe(409);
    const { body } = await post<RoundView>("/api/round/resume", { states: [won] });
    expect(body.victory).toBe(true);
    expect(body.hints).toEqual({ tried: 30, used: ["era"], values: hintValues(song.id) });
  });
});
