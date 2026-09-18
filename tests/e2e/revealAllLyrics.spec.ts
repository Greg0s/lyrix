import { expect, test } from "@playwright/test";
import { normalize } from "../../src/game/normalize";
import { tokenize } from "../../src/game/tokenize";
import type { RoundView } from "../../src/game/types";
import { catalog } from "../../worker/src/catalog";

/**
 * The post-victory "show all lyrics" checkbox, end to end through the real
 * Worker.
 *
 * `npm run dev:worker` (which Playwright starts) also passes `--var
 * DEV_REVEAL_LYRICS:1` (see tests/e2e/devReveal.spec.ts), so every still-hidden
 * lyrics word already carries its real text as `devHint` before any guess is
 * made - used here only to know what real word to look for once the checkbox
 * reveals it, without a second network call for the actual lyrics.
 */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCatalogEntry(songId: string) {
  const entry = catalog.find((candidate) => candidate.id === songId);
  if (!entry) throw new Error(`unknown song id from /api/round: ${songId}`);
  return entry;
}

test("shows the checkbox only once the round is won", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("checkbox", { name: "Afficher tous les lyrics" })).toHaveCount(0);
});

test("reveals every still-hidden lyrics word once checked, and hides it again once unchecked", async ({ page }) => {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;
  const song = findCatalogEntry(round.songId);

  // Excludes a lyrics word that also happens to be a title word: guessing the
  // title to win reveals every occurrence of that key, lyrics included, which
  // would leave nothing for the checkbox to add - a correct outcome (a found
  // word always wins over the reveal-all display), but not what this test means
  // to check.
  const titleKeys = new Set(tokenize(song.title).filter((t) => t.isWord).map((t) => normalize(t.text)));
  const lyricsWord = round.sections
    .flatMap((section) => section.lines)
    .flatMap((line) => line.tokens)
    .find((token) => token.isWord && typeof token.devHint === "string" && !titleKeys.has(normalize(token.devHint)))
    ?.devHint;
  if (!lyricsWord) test.skip(true, "this song's lyrics have no hidden word outside the title to check against");

  const input = page.getByPlaceholder("Propose un mot…");
  const titleWords = [...new Set(tokenize(song.title).filter((t) => t.isWord).map((t) => t.text))];
  for (const word of titleWords) {
    await input.fill(word);
    await input.press("Enter");
  }
  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();

  const revealed = page.locator(".token-word-revealed", { hasText: new RegExp(`^${escapeRegExp(lyricsWord as string)}$`) });
  await expect(revealed).toHaveCount(0);

  const checkbox = page.getByRole("checkbox", { name: "Afficher tous les lyrics" });
  await checkbox.check();
  await expect(revealed.first()).toBeVisible();

  await checkbox.uncheck();
  await expect(revealed).toHaveCount(0);
});

test("does not affect an already-found title word", async ({ page }) => {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;
  const song = findCatalogEntry(round.songId);

  const input = page.getByPlaceholder("Propose un mot…");
  const titleWords = [...new Set(tokenize(song.title).filter((t) => t.isWord).map((t) => t.text))];
  const [firstWord] = titleWords;
  if (!firstWord) throw new Error("song title has no word tokens");
  for (const word of titleWords) {
    await input.fill(word);
    await input.press("Enter");
  }
  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();

  await page.getByRole("checkbox", { name: "Afficher tous les lyrics" }).check();

  await expect(page.locator(".token-word-found", { hasText: new RegExp(`^${escapeRegExp(firstWord)}$`) }).first()).toBeVisible();
});
