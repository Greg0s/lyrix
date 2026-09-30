import { expect, test, type Page } from "@playwright/test";
import type { RoundView } from "../../src/game/types";
import { titleWords as titleWordsOf } from "./titleWords";

test("reveals guesses live and lets the player win the round", async ({ page }) => {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;

  const input = page.getByPlaceholder("Propose un mot…");
  const titleWords = titleWordsOf(round);
  const [firstWord] = titleWords;
  if (!firstWord) throw new Error("song title has no word tokens");

  await input.fill(firstWord);
  await input.press("Enter");

  await expect(page.getByText(`« ${firstWord} » trouvé`, { exact: false })).toBeVisible();
  await expect(page.locator(".token-word-found", { hasText: firstWord }).first()).toBeVisible();

  for (const word of titleWords) {
    await input.fill(word);
    await input.press("Enter");
    // The input empties once the guess has landed. Pressing Enter again before
    // that is ignored by design (a guess is in flight), which dropped a title
    // word now and then and left the round unwon.
    await expect(input).toHaveValue("");
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

  const input = page.getByPlaceholder("Propose un mot…");
  const [firstWord] = titleWordsOf(round);
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

  const input = page.getByPlaceholder("Propose un mot…");
  const titleWords = titleWordsOf(round);
  for (const word of titleWords) {
    await input.fill(word);
    await input.press("Enter");
    // The input empties once the guess has landed. Pressing Enter again before
    // that is ignored by design (a guess is in flight), which dropped a title
    // word now and then and left the round unwon.
    await expect(input).toHaveValue("");
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

test("agrees in number between found and tried counts in the progress card", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  await input.fill("xylophoneinexistant");
  await input.press("Enter");

  // Regression test: the stats text used to always say "trouvés"/"essayés"
  // (plural), even when the count was 1. French takes the singular for 0 too.
  await expect(page.locator('[data-stat="found"]')).toHaveText("0 mot trouvé");
  await expect(page.locator('[data-stat="tried"]')).toHaveText("1 essai");

  await input.fill("xylophoneautre");
  await input.press("Enter");
  await expect(page.locator('[data-stat="tried"]')).toHaveText("2 essais");
});

test("opens the rules from the header and closes them with Escape", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Comment jouer" }).click();
  await expect(page.getByRole("dialog", { name: "Comment on joue ?" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByPlaceholder("Propose un mot…")).toBeFocused();
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

test("makes Valider inert while a guess is in flight, so a fast double submit can't race", async ({ page }) => {
  let guessRequests = 0;
  await page.route("**/api/guess", async (route) => {
    guessRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });

  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");
  const button = page.getByRole("button", { name: "Valider" });

  await input.fill("premiere");
  await input.press("Enter");

  await expect(button).toBeDisabled();
  // The input itself stays enabled (see the focus tests below), so a second
  // Enter really reaches it, and must still not fire a 2nd request.
  await expect(input).toBeEnabled();
  await input.press("Enter");

  await expect(button).toBeEnabled({ timeout: 5000 });
  expect(guessRequests).toBe(1);
  await expect(input).toHaveValue("");
});

test("keeps the guess input focused after submitting, whether by Enter or by clicking Valider", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  await input.fill("xylophoneinexistant");
  await input.press("Enter");
  await expect(input).toBeFocused();

  // Regression test: clicking "Valider" moved focus to the button, leaving
  // the player to reclick the input before typing their next guess.
  await input.fill("xylophoneautre");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(input).toBeFocused();
});

/** Counts every time the guess input loses focus - on a phone, each one closes the keyboard. */
async function countInputBlurs(page: Page) {
  await page.getByPlaceholder("Propose un mot…").evaluate((input) => {
    (window as unknown as { inputBlurs: number }).inputBlurs = 0;
    input.addEventListener("blur", () => (window as unknown as { inputBlurs: number }).inputBlurs++);
  });
  return () => page.evaluate(() => (window as unknown as { inputBlurs: number }).inputBlurs);
}

async function slowGuesses(page: Page) {
  await page.route("**/api/guess", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
}

test("never blurs the guess input while a guess is submitted, by Enter or by clicking Valider", async ({ page }) => {
  // Regression test: the input used to be disabled while a guess was in
  // flight, which blurs it natively - on a phone, the keyboard closed on
  // every guess and reopened once focus was handed back.
  await slowGuesses(page);
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");
  await input.focus();
  const blurs = await countInputBlurs(page);

  await input.fill("xylophoneinexistant");
  await input.press("Enter");
  await expect(page.locator('[data-stat="tried"]')).toHaveText("1 essai");

  await input.fill("xylophoneautre");
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.locator('[data-stat="tried"]')).toHaveText("2 essais");

  expect(await blurs()).toBe(0);
  await expect(input).toBeFocused();
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test("tapping Valider submits without the input ever losing focus", async ({ page }) => {
    await slowGuesses(page);
    await page.goto("/");
    const input = page.getByPlaceholder("Propose un mot…");
    await input.tap();
    const blurs = await countInputBlurs(page);

    await input.fill("xylophoneinexistant");
    await page.getByRole("button", { name: "Valider" }).tap();
    await expect(page.locator('[data-stat="tried"]')).toHaveText("1 essai");

    expect(await blurs()).toBe(0);
    await expect(input).toBeFocused();
  });
});
