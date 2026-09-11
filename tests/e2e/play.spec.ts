import { expect, test } from "@playwright/test";
import { catalog } from "../../worker/src/catalog";
import { tokenize } from "../../src/game/tokenize";
import type { RoundView } from "../../src/game/types";

function findCatalogEntry(songId: string) {
  const entry = catalog.find((candidate) => candidate.id === songId);
  if (!entry) throw new Error(`unknown song id from /api/round: ${songId}`);
  return entry;
}

test("reveals guesses live and lets the player win the round", async ({ page }) => {
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

  await input.fill(firstWord);
  await input.press("Enter");

  await expect(page.getByText(`« ${firstWord} » trouvé`, { exact: false })).toBeVisible();
  await expect(page.locator(".token-word-found", { hasText: firstWord }).first()).toBeVisible();

  for (const word of titleWords) {
    await input.fill(word);
    await input.press("Enter");
  }

  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();
  await expect(page.getByText("Reviens demain pour une nouvelle chanson")).toBeVisible();
});

test("keeps previously found words after reloading the page", async ({ page }) => {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;
  const song = findCatalogEntry(round.songId);

  const input = page.getByPlaceholder("Propose un mot…");
  const [firstWord] = [...new Set(tokenize(song.title).filter((t) => t.isWord).map((t) => t.text))];
  if (!firstWord) throw new Error("song title has no word tokens");

  await input.fill(firstWord);
  await input.press("Enter");
  await expect(page.locator(".token-word-found", { hasText: firstWord }).first()).toBeVisible();

  // Regression test: with one shared song per day, a page reload used to
  // start a brand new round (fresh masked lyrics), silently discarding
  // progress on the one puzzle available that day.
  await page.reload();

  await expect(page.locator(".token-word-found", { hasText: firstWord }).first()).toBeVisible();
});

test("still shows the victory screen after reloading once the song is solved", async ({ page }) => {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;
  const song = findCatalogEntry(round.songId);

  const input = page.getByPlaceholder("Propose un mot…");
  const titleWords = [...new Set(tokenize(song.title).filter((t) => t.isWord).map((t) => t.text))];
  for (const word of titleWords) {
    await input.fill(word);
    await input.press("Enter");
  }
  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();

  await page.reload();

  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();
});

test("shows feedback for a guess that is not in the lyrics", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  await input.fill("xylophoneinexistant");
  await input.press("Enter");

  await expect(page.getByText("n’y est pas")).toBeVisible();
});

test("agrees in number between found and tried counts in the stats text", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  await input.fill("xylophoneinexistant");
  await input.press("Enter");

  // Regression test: the stats text used to always say "trouvés"/"essayés"
  // (plural), even when the count was 1.
  await expect(page.getByText("0 trouvés sur 1 essayé", { exact: true })).toBeVisible();
});

test("shows an error message when a guess fails to submit, and recovers on the next one", async ({ page }) => {
  await page.route("**/api/guess", (route) => route.abort("failed"));

  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");
  await input.fill("test");
  await input.press("Enter");

  // Regression test: a failed guess submission used to be silently
  // swallowed, leaving the player with no feedback that anything went wrong.
  await expect(page.getByText("n'a pas pu être envoyé", { exact: false })).toBeVisible();
  await expect(input).toHaveValue("test");

  await page.unroute("**/api/guess");
  await input.press("Enter");
  await expect(page.getByText("n’y est pas", { exact: false })).toBeVisible();
});

test("offers a retry when the initial round fails to load, and recovers", async ({ page }) => {
  await page.route("**/api/round", (route) => route.abort("failed"));
  await page.goto("/");

  // Regression test: a failed initial load used to strand the player on a
  // dead-end error screen with no way to recover except reloading the page.
  await expect(page.getByRole("alert")).toHaveText("Impossible de charger la partie.");

  await page.unroute("**/api/round");
  await page.getByRole("button", { name: "Réessayer" }).click();

  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
});

test("disables the form while a guess is in flight, so a fast double submit can't race", async ({ page }) => {
  let guessRequests = 0;
  await page.route("**/api/guess", async (route) => {
    guessRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });

  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  await input.fill("premiere");
  await input.press("Enter");

  await expect(input).toBeDisabled();
  // A disabled input can't receive real keystrokes, but a stray Enter at
  // the page level (e.g. a queued keydown) must still not fire a 2nd request.
  await page.keyboard.press("Enter");

  await expect(input).toBeEnabled({ timeout: 5000 });
  expect(guessRequests).toBe(1);
  await expect(input).toHaveValue("");
});
