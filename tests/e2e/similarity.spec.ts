import { expect, test } from "@playwright/test";

/**
 * Proximity scoring, end to end through the real Worker.
 *
 * `npm run dev:worker` (which Playwright starts) passes
 * `--var SIMILARITY_SAMPLE:1`, so the Worker serves the placeholder table in
 * worker/src/sampleSimilarity.ts instead of needing a populated KV namespace
 * and a 200-dimension French embedding model. The words below are picked to
 * be in that table and to stand no realistic chance of appearing in a song's
 * lyrics, so the assertions hold whichever song the day's rotation lands on.
 */
const CLOSE_WORD = "clavecin"; // sample score 71 -> "hot"
const DISTANT_WORD = "chlorophylle"; // sample score 4 -> "cold"
const UNKNOWN_WORD = "zzzinconnu"; // absent from the table -> no score at all

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
