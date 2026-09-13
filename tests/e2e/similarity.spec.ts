import { expect, test, type Page } from "@playwright/test";
import { tokenize } from "../../src/game/tokenize";
import type { GuessResult, RoundView } from "../../src/game/types";
import { catalog } from "../../worker/src/catalog";

/**
 * Proximity scoring, end to end through the real Worker.
 *
 * `npm run dev:worker` (which Playwright starts) passes
 * `--var SIMILARITY_SAMPLE:1`, so the Worker serves the placeholder table in
 * worker/src/sampleSimilarity.ts instead of needing a populated KV namespace
 * and a 200-dimension French embedding model. The words below are picked to
 * be in that table and to stand no realistic chance of appearing in a song's
 * lyrics, so the assertions hold whichever song the day's rotation lands on.
 * Which hidden words a close word lands on is arbitrary in that table, so the
 * placement tests assert on how a close word shows up, not on where.
 */
const CLOSE_WORD = "clavecin"; // sample score 71 -> "hot"
const DISTANT_WORD = "chlorophylle"; // sample score 4 -> "cold"
const UNKNOWN_WORD = "zzzinconnu"; // absent from the table -> no score at all

/**
 * The tried-word chip of exactly this word: its text, then its score if it has
 * one. Not a plain `hasText`, which is a case-insensitive substring match — a
 * title word like "La" would also match an earlier "clavecin 71" chip.
 */
function chipOf(page: Page, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.locator(".lyrix-tried-list .lyrix-chip", { hasText: new RegExp(`^${escaped}\\s*\\d*$`) });
}

/** Submits a word and waits for it to join the tried-word list. */
async function guess(page: Page, word: string): Promise<void> {
  const input = page.getByPlaceholder("Propose un mot…");
  await input.fill(word);
  await input.press("Enter");
  await expect(chipOf(page, word)).toBeVisible();
}

test("colours and ranks tried words by how close they are to the song", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  for (const word of [DISTANT_WORD, UNKNOWN_WORD, CLOSE_WORD]) {
    await input.fill(word);
    await input.press("Enter");
    await expect(page.locator(".lyrix-chip", { hasText: word })).toBeVisible();
  }

  const chips = page.locator(".lyrix-tried-list .lyrix-chip");
  await expect(chips).toHaveCount(3);

  // None of the three is in the lyrics: what separates them is only the score.
  for (const word of [CLOSE_WORD, DISTANT_WORD, UNKNOWN_WORD]) {
    await expect(page.locator(".lyrix-chip", { hasText: word })).toHaveClass(/is-missed/);
  }

  const close = page.locator(".lyrix-chip", { hasText: CLOSE_WORD });
  const distant = page.locator(".lyrix-chip", { hasText: DISTANT_WORD });
  await expect(close).toHaveClass(/tier-hot/);
  await expect(distant).toHaveClass(/tier-cold/);
  await expect(close).toContainText("71");
  await expect(distant).toContainText("4");

  // A word the model doesn't know shows no score rather than a misleading zero.
  await expect(page.locator(".lyrix-chip", { hasText: UNKNOWN_WORD })).toHaveClass(/tier-unknown/);

  // Highest score first, unscored last - not the order they were typed in.
  await expect(chips.nth(0)).toContainText(CLOSE_WORD);
  await expect(chips.nth(1)).toContainText(DISTANT_WORD);
  await expect(chips.nth(2)).toContainText(UNKNOWN_WORD);

  await expect(page.getByText("Plus le score est élevé", { exact: false })).toBeVisible();
});

test("keeps proximity scores after reloading the page", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  await input.fill(CLOSE_WORD);
  await input.press("Enter");
  await expect(page.locator(".lyrix-chip", { hasText: CLOSE_WORD })).toHaveClass(/tier-hot/);

  await page.reload();

  await expect(page.locator(".lyrix-chip", { hasText: CLOSE_WORD })).toHaveClass(/tier-hot/);
  await expect(page.locator(".lyrix-chip", { hasText: CLOSE_WORD })).toContainText("71");
});

test("shows a close word in place of the hidden words it is close to", async ({ page }) => {
  await page.goto("/");
  await guess(page, CLOSE_WORD);

  const placed = page.locator(".token-word-near", { hasText: CLOSE_WORD });
  await expect(placed.first()).toBeVisible();
  // At its own score on its closest word, so in the same colour as its chip...
  await expect(page.locator(".token-word-near.tier-hot", { hasText: CLOSE_WORD }).first()).toBeVisible();
  // ...and on top of that word's blank, which stays a blank: nothing is revealed.
  await expect(placed.first().locator(".token-near-blank")).toHaveText(/^_+$/);
  await expect(page.getByText(`« ${CLOSE_WORD} » n’y est pas, mais il est proche`, { exact: false })).toBeVisible();

  // Too far from everything, or unknown to the model: nothing to show in the lyrics.
  await guess(page, DISTANT_WORD);
  await expect(page.getByText(`« ${DISTANT_WORD} » n’y est pas.`, { exact: true })).toBeVisible();
  await guess(page, UNKNOWN_WORD);
  await expect(page.locator(".token-word-near", { hasText: DISTANT_WORD })).toHaveCount(0);
  await expect(page.locator(".token-word-near", { hasText: UNKNOWN_WORD })).toHaveCount(0);
  await expect(placed.first()).toBeVisible();
});

test("keeps close words in place after reloading the page", async ({ page }) => {
  await page.goto("/");
  await guess(page, CLOSE_WORD);

  const placed = page.locator(".token-word-near", { hasText: CLOSE_WORD });
  await expect(placed.first()).toBeVisible();
  const count = await placed.count();

  await page.reload();

  await expect(placed).toHaveCount(count);
});

test("hands a hidden word back to the real one once it is found", async ({ page }) => {
  const roundResponse = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponse).json()) as RoundView;
  const entry = catalog.find((candidate) => candidate.id === round.songId);
  if (!entry) throw new Error(`unknown song id from /api/round: ${round.songId}`);
  const firstWord = tokenize(entry.title).find((token) => token.isWord)?.text;
  if (!firstWord) throw new Error("song title has no word tokens");

  // The placeholder table lands close words arbitrarily, so aim this one at
  // position 0 - the title's first word - which the test can then find for real.
  await page.route(
    "**/api/guess",
    async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as GuessResult;
      await route.fulfill({ response, json: { ...body, near: [{ position: 0, score: 71 }] } });
    },
    { times: 1 }
  );

  const title = page.locator(".lyrix-title-line");
  await guess(page, CLOSE_WORD);
  await expect(title.locator(".token-word-near").first()).toContainText(CLOSE_WORD);

  await guess(page, firstWord);
  await expect(title.locator(".token-word-found").first()).toHaveText(firstWord);
  await expect(title.locator(".token-word-near", { hasText: CLOSE_WORD })).toHaveCount(0);
});

// Regression test: guess() used to find a word's chip with a plain `hasText`,
// a case-insensitive substring match. On a day whose title starts with "La",
// that also matched the earlier "clavecin 71" chip and strict mode failed the
// test above - but only on such days, since the song changes every day.
test("keeps a guess apart from an earlier one that contains it", async ({ page }) => {
  await page.goto("/");
  await guess(page, CLOSE_WORD);
  await guess(page, "clave");
  await expect(page.locator(".lyrix-tried-list .lyrix-chip")).toHaveCount(2);
});
