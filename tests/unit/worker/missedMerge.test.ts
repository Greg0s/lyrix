import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utcDay } from "../../../src/game/daily";
import type { GuessDelta, RoundView } from "../../../src/game/types";
import { resetFreshRoundMemo } from "../../../worker/src/freshRound";
import app from "../../../worker/src/index";
import { resetSimilarityMemo } from "../../../worker/src/similarity";
import { resetSongMemo } from "../../../worker/src/songs";
import { LAST_HINT_THRESHOLD, missedMark, openState, sealState } from "../../../worker/src/state";

/**
 * Two states of one round, each under the last hint, can hold more distinct
 * misses together than a state may: merged as they were, the resumed state
 * no longer opened, and the round it carried was refused.
 */

const env = { STATE_SECRET: "test-secret" };
const LYRICS = Array.from({ length: 8 }, (_, index) => `ligne numero ${index} du vrai couplet`).join("\n");

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const artistName = url.searchParams.get("artist_name") ?? "Unknown";
      return new Response(JSON.stringify([{ artistName, instrumental: false, plainLyrics: LYRICS, syncedLyrics: null }]));
    })
  );
  resetSongMemo();
  resetSimilarityMemo();
  resetFreshRoundMemo();
});

afterEach(() => vi.unstubAllGlobals());

async function post<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await app.request(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    env
  );
  return { status: res.status, body: (await res.json()) as T };
}

describe("merging two states' misses", () => {
  it("keeps a state that still opens, however many misses the two hold together", async () => {
    const res = await app.request("/api/round", {}, env);
    const round = (await res.json()) as RoundView;
    const opened = await openState(round.state, env.STATE_SECRET);
    if (!opened) throw new Error("today's state doesn't open");

    const tried = LAST_HINT_THRESHOLD - 10;
    const marks = (prefix: string) => Array.from({ length: tried }, (_, i) => missedMark(`${prefix}${i}`));
    const day = utcDay();
    const mine = await sealState({ songId: opened.songId, foundKeys: [], day, tried, missed: marks("a") }, env.STATE_SECRET);
    const theirs = await sealState({ songId: opened.songId, foundKeys: [], day, tried, missed: marks("b") }, env.STATE_SECRET);

    const merged = await post<RoundView>("/api/round/resume", { states: [mine, theirs] });
    expect(merged.status).toBe(200);
    expect(await openState(merged.body.state, env.STATE_SECRET)).not.toBeNull();
    const next = await post<GuessDelta>("/api/guess", { state: merged.body.state, word: "xylophone", delta: true });
    expect(next.status).toBe(200);
    // And a new miss on top of a state holding as many marks as it may.
    expect(await openState(next.body.state, env.STATE_SECRET)).not.toBeNull();
  });
});
