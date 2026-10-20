import { describe, expect, it, vi } from "vitest";
import { canaryConfig, formatResults, runCanary, runChecks } from "../../../scripts/lib/canary";

const config = { siteUrl: "https://lyrix.test", apiUrl: "https://api.lyrix.test" };
const NOW = new Date(Date.UTC(2026, 9, 21, 0, 17));
const SITE_HTML = '<!doctype html><title>Lyrix — chanson du jour</title><script type="module" crossorigin src="/assets/index-abc.js"></script>';
const ROUND = {
  state: "sealed",
  day: "2026-10-21",
  title: { tokens: [{ text: "", isWord: true, revealed: false, length: 5 }] },
  sections: [{ label: "Couplet", lines: [] }],
  victory: false,
};

/** A fake network: the site's page and the Worker's round, or what `overrides` answers instead. */
function network(overrides: Record<string, () => Response> = {}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (overrides[url]) return overrides[url]();
    if (url === "https://lyrix.test/") return new Response(SITE_HTML);
    if (url === "https://api.lyrix.test/api/round") return new Response(JSON.stringify(ROUND));
    return new Response("not found", { status: 404 });
  });
}

describe("the production canary", () => {
  it("passes when the site is the game and the Worker hands out today's round", async () => {
    const results = await runChecks(config, NOW, network());
    expect(results.map((result) => result.ok)).toEqual([true, true]);
    expect(formatResults(results)).toBe(
      "ok    the site answers with the game (HTTP 200)\nok    the Worker hands out 2026-10-21's round (HTTP 200)"
    );
  });

  it("fails on a round the Worker couldn't give, with what it answered", async () => {
    const down = network({
      "https://api.lyrix.test/api/round": () => new Response('{"error":"the song is unavailable, try again"}', { status: 503 }),
    });
    const [, round] = await runChecks(config, NOW, down);
    expect(round).toMatchObject({ ok: false, detail: expect.stringMatching(/^HTTP 503: .*unavailable/) });
  });

  it("fails on a round that isn't today's, or that nobody could play", async () => {
    for (const [body, problem] of [
      [{ ...ROUND, day: "2026-10-20" }, "the round is 2026-10-20's, not 2026-10-21's"],
      [{ ...ROUND, sections: [] }, "the round has no lyrics"],
      [{ ...ROUND, title: { tokens: [] } }, "the round has no title to find"],
      [{ ...ROUND, state: "" }, "the round has no sealed state"],
      [{ ...ROUND, victory: true }, "the round comes back won"],
    ] as const) {
      const odd = network({ "https://api.lyrix.test/api/round": () => new Response(JSON.stringify(body)) });
      const [, round] = await runChecks(config, NOW, odd);
      expect(round).toMatchObject({ ok: false, detail: problem });
    }
  });

  it("fails on a site that answers something else than the game, or nothing", async () => {
    const parked = network({ "https://lyrix.test/": () => new Response("<title>Domain parked</title>") });
    expect((await runChecks(config, NOW, parked))[0]).toMatchObject({ ok: false, detail: expect.stringContaining("isn't the game") });
    const unreachable = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect((await runChecks(config, NOW, unreachable))[0]).toMatchObject({ ok: false, detail: "no answer: fetch failed" });
  });

  it("tries a failed check again once before failing, and passes on a blip", async () => {
    let calls = 0;
    const blip = network({
      "https://api.lyrix.test/api/round": () => (calls++ === 0 ? new Response("", { status: 502 }) : new Response(JSON.stringify(ROUND))),
    });
    const wait = vi.fn(async () => {});
    const results = await runCanary(config, { now: NOW, fetchImpl: blip, wait });
    expect(wait).toHaveBeenCalledOnce();
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it("names the variable it is missing", () => {
    expect(() => canaryConfig({ CANARY_SITE_URL: "https://lyrix.test" })).toThrow(/^canary: CANARY_API_URL is not set/);
    expect(canaryConfig({ CANARY_SITE_URL: "a", CANARY_API_URL: "b" })).toEqual({ siteUrl: "a", apiUrl: "b" });
  });
});
