import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { similarityWorkerUrl, workerUrl } from "../../playwright.config";
import type { GuessResult, RoundView } from "../../src/game/types";
import { SAMPLE_SIMILARITY_SCORES } from "../../worker/src/sampleSimilarity";
import { parseSimilarityTable } from "../../worker/src/similarity";

/**
 * Playing against a real table out of a local KV namespace, the way
 * `npm run dev:debug` sets it up.
 *
 * Playwright starts that very command for this (see playwright.config.ts),
 * pointed at tests/e2e/fixtures/similarity-table.json, since no CI machine has
 * the 126 MB embedding model a real table is built from. What that proves is
 * the half of the wiring no configuration test can see: `wrangler kv bulk put
 * --local` and `wrangler dev` are two separate processes, and a table written
 * where the Worker doesn't look produces no error at all — just guesses with no
 * score, exactly like a Worker with no table.
 *
 * The scores below are the fixture's, chosen to differ from the placeholder's
 * for the same words, so a guess says which table answered it.
 */
const WORD = "clavecin"; // placeholder: 71. Fixture: 13.

function fixtureScore(word: string): number {
  const path = new URL("./fixtures/similarity-table.json", import.meta.url);
  const table = parseSimilarityTable(JSON.parse(readFileSync(path, "utf8")) as unknown);
  if (!table) throw new Error(`${path.pathname} is not a table this Worker would read — rebuild it, then re-run`);
  const score = table.scores[word];
  if (score === undefined) throw new Error(`the fixture table has no score for "${word}"`);
  return score;
}

/** Plays one guess through a Worker's own API, round state included. */
async function guessScore(request: APIRequestContext, baseUrl: string, word: string): Promise<number | null> {
  const round = (await (await request.get(`${baseUrl}/api/round`)).json()) as RoundView;
  const response = await request.post(`${baseUrl}/api/guess`, { data: { state: round.state, word } });
  const result = (await response.json()) as GuessResult;
  expect(result.found, `"${word}" turned up in today's song, so it was revealed instead of scored`).toBe(false);
  return result.score;
}

test("serves the table loaded into the local KV namespace", async ({ request }) => {
  expect(await guessScore(request, similarityWorkerUrl, WORD)).toBe(fixtureScore(WORD));
});

// The rest of the suite asserts on the placeholder's scores. This is the test
// that says a table loaded for local play can never turn up underneath them:
// the two Workers keep separate local state, and only one has a namespace bound.
test("leaves the Worker the rest of the suite plays against on the placeholder table", async ({ request }) => {
  expect(await guessScore(request, workerUrl, WORD)).toBe(SAMPLE_SIMILARITY_SCORES[WORD]);
});
