import { expect, test } from "@playwright/test";
import { tokenize } from "../../src/game/tokenize";
import type { RoundView } from "../../src/game/types";
import { songs } from "../../worker/src/songs";

test("reveals guesses live and lets the player win the round", async ({ page }) => {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;

  const song = songs.find((candidate) => candidate.id === round.songId);
  if (!song) throw new Error(`unknown song id from /api/round: ${round.songId}`);

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
  await expect(page.getByRole("button", { name: "Rejouer avec une autre chanson" })).toBeVisible();
});

test("shows feedback for a guess that is not in the lyrics", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  await input.fill("xylophoneinexistant");
  await input.press("Enter");

  await expect(page.getByText("n’y est pas")).toBeVisible();
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
