import { expect, test, type Page } from "@playwright/test";
import { utcDay } from "../../src/game/daily";
import { capitalize, longDayLabel } from "../../src/game/frenchDates";
import type { RoundView } from "../../src/game/types";
import { lyricsOnlyWord, titleWords } from "./titleWords";

const DAY_MS = 24 * 60 * 60 * 1000;
const yesterday = utcDay(new Date(Date.now() - DAY_MS));
const tomorrow = utcDay(new Date(Date.now() + DAY_MS));

/** Waits for the round of `day` the page asks the Worker for, fresh or resumed. */
function roundOf(page: Page, day: string): Promise<RoundView> {
  return page
    .waitForResponse(
      (res) =>
        (res.url().includes(`/api/round?day=${day}`) || res.url().includes("/api/round/resume")) && res.ok()
    )
    .then((res) => res.json() as Promise<RoundView>);
}

async function propose(page: Page, word: string): Promise<void> {
  const input = page.getByPlaceholder("Propose un mot…");
  await input.fill(word);
  await input.press("Enter");
  // Landed once the input empties: Enter during a guess in flight is ignored.
  await expect(input).toHaveValue("");
}

test("plays a day of the archives from the collection, and adds it to it once won", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();

  await page.getByRole("button", { name: "Archives" }).click();
  await expect(page).toHaveURL(/\/archives$/);
  await expect(page.getByRole("heading", { name: "Les 30 derniers jours" })).toBeVisible();

  const date = capitalize(longDayLabel(yesterday));
  const roundPromise = roundOf(page, yesterday);
  await page.getByRole("link", { name: `${date} : à découvrir` }).click();
  const round = await roundPromise;
  expect(round.day).toBe(yesterday);
  await expect(page).toHaveURL(new RegExp(`/archives/${yesterday}$`));
  await expect(page.getByRole("navigation", { name: "Jours des archives" })).toContainText(date);

  for (const word of titleWords(round)) await propose(page, word);
  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();
  await expect(page.getByText(new RegExp(`^Chanson du ${longDayLabel(yesterday)}, trouvée en \\d+ essais?\\.$`))).toBeVisible();
  await expect(page.getByText("Prochaine chanson dans")).toHaveCount(0);

  await page.getByRole("button", { name: "Toutes les archives" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`^${date} : .+, trouvée en \\d+ essais?$`) })).toBeVisible();
});

test("resumes a day of the archives after a reload, through its saved state", async ({ page }) => {
  const roundPromise = roundOf(page, yesterday);
  await page.goto(`/archives/${yesterday}`);
  const round = await roundPromise;
  const word = lyricsOnlyWord(round);
  await propose(page, word);
  await expect(page.locator(".token-word-found", { hasText: word }).first()).toBeVisible();

  const resumed = page.waitForResponse((res) => res.url().includes("/api/round/resume") && res.ok());
  await page.reload();
  await resumed;
  await expect(page.locator(".token-word-found", { hasText: word }).first()).toBeVisible();
  await expect(page.locator(".lyrix-chip", { hasText: word })).toBeVisible();
});

test("never opens a day to come", async ({ page }) => {
  await page.goto(`/archives/${tomorrow}`);
  await expect(page.getByRole("heading", { name: "Les 30 derniers jours" })).toBeVisible();
  await expect(page).toHaveURL(/\/archives$/);
  const answer = await page.request.get(`/api/round?day=${tomorrow}`);
  expect(answer.status()).toBe(404);
});
