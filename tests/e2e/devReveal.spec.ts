import { expect, test } from "@playwright/test";
import { tokenize } from "../../src/game/tokenize";
import type { RoundView } from "../../src/game/types";
import { catalog } from "../../worker/src/catalog";

/**
 * DEV_REVEAL_LYRICS, end to end through the real Worker.
 *
 * `npm run dev:worker` (which Playwright starts) passes `--var
 * DEV_REVEAL_LYRICS:1` alongside `--var SIMILARITY_SAMPLE:1`, so every
 * still-hidden word carries its real text as a low-opacity `.token-word-devhint`
 * span - a local debugging aid, never on in production (see CLAUDE.md's
 * anti-cheat section). Title words are real, day-of-rotation-dependent text,
 * so - as in tests/e2e/play.spec.ts and similarity.spec.ts - assertions match
 * the actual word exactly rather than assuming a fixed fixture.
 */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A dev-hint span whose text is exactly `word` - not a substring match, which could also hit an unrelated longer word. */
function devHintFor(page: import("@playwright/test").Page, word: string) {
  return page.locator(".token-word-devhint", { hasText: new RegExp(`^${escapeRegExp(word)}$`) });
}

async function firstTitleWord(page: import("@playwright/test").Page): Promise<string> {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;
  const entry = catalog.find((candidate) => candidate.id === round.songId);
  if (!entry) throw new Error(`unknown song id from /api/round: ${round.songId}`);
  const word = tokenize(entry.title).find((token) => token.isWord)?.text;
  if (!word) throw new Error("song title has no word tokens");
  return word;
}

test("shows every hidden word's real text at low opacity before any guess", async ({ page }) => {
  const firstWord = await firstTitleWord(page);

  await expect(devHintFor(page, firstWord).first()).toBeVisible();
  // Nothing has been guessed yet, so the normal blank rendering never applies to this word.
  await expect(page.locator(".token-word-hidden", { hasText: new RegExp(`^${escapeRegExp(firstWord)}$`) })).toHaveCount(0);
});

test("replaces the dev hint with the normal found rendering once the word is guessed", async ({ page }) => {
  const firstWord = await firstTitleWord(page);
  await expect(devHintFor(page, firstWord).first()).toBeVisible();

  const input = page.getByPlaceholder("Propose un mot…");
  await input.fill(firstWord);
  await input.press("Enter");

  await expect(page.locator(".token-word-found", { hasText: firstWord }).first()).toBeVisible();
  await expect(devHintFor(page, firstWord)).toHaveCount(0);
});

test("keeps the dev hint for every other still-hidden word after one is guessed", async ({ page }) => {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;
  const entry = catalog.find((candidate) => candidate.id === round.songId);
  if (!entry) throw new Error(`unknown song id from /api/round: ${round.songId}`);
  const titleWords = [...new Set(tokenize(entry.title).filter((t) => t.isWord).map((t) => t.text))];
  const [firstWord, secondWord] = titleWords;
  if (!firstWord || !secondWord) test.skip(true, "this song's title has fewer than two distinct words");

  await expect(devHintFor(page, secondWord).first()).toBeVisible();

  const input = page.getByPlaceholder("Propose un mot…");
  await input.fill(firstWord);
  await input.press("Enter");

  await expect(page.locator(".token-word-found", { hasText: firstWord }).first()).toBeVisible();
  // Guessing one title word is normal, isolated progress - it doesn't touch any other word's dev hint.
  await expect(devHintFor(page, secondWord).first()).toBeVisible();
});
