import { expect, test, type Page } from "@playwright/test";
import type { RoundView } from "../../src/game/types";
import { lyricsOnlyWord } from "./titleWords";

/**
 * A phone's layout, below 880px (game.css): laid out like an installed app.
 * The song comes first, the round's progress is in the header, the words
 * tried and the hints open as sheets from the dock, and the header's buttons
 * are a bar of tabs along the bottom edge, which steps aside for the keyboard.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const tabBar = (page: Page) => page.getByRole("navigation", { name: "Navigation" });
const progress = (page: Page) => page.getByRole("banner").getByRole("group", { name: "Progression" });
const input = (page: Page) => page.getByPlaceholder("Propose un mot…");

/** Today's round, as the Worker sent it: the word to find is read off its dev hints. */
async function openRound(page: Page): Promise<RoundView> {
  const response = page.waitForResponse((res) => res.url().includes("/api/round") && res.request().method() === "GET");
  await page.goto("/");
  const round = (await (await response).json()) as RoundView;
  await expect(input(page)).toBeVisible();
  return round;
}

/** Once the cards have risen in: their entrance moves them. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
}

test("puts the song on the first screen, the side column out of the page", async ({ page }) => {
  await openRound(page);
  await settle(page);
  const title = await page.locator(".lyrix-title-block").boundingBox();
  expect(title).not.toBeNull();
  expect(title!.y + title!.height).toBeLessThan(844);
  await expect(page.locator(".lyrix-aside")).toBeHidden();
  await expect(progress(page)).toContainText("0 %");
  await expect(tabBar(page)).toBeVisible();
  // The tab bar carries the header's buttons (a role query leaves hidden ones out).
  await expect(page.getByRole("banner").getByRole("button")).toHaveCount(0);
});

test("counts a guess in the header's progress", async ({ page }) => {
  const round = await openRound(page);
  await input(page).fill(lyricsOnlyWord(round));
  await input(page).press("Enter");
  await expect(progress(page)).toContainText("1 trouvé · 1 essai");
});

test("opens the words tried and the hints as sheets from the dock", async ({ page }) => {
  const round = await openRound(page);
  const word = lyricsOnlyWord(round);
  await input(page).fill(word);
  await input(page).press("Enter");
  await expect(input(page)).toHaveValue("");

  await page.getByRole("button", { name: "Tes mots : 1 mot" }).click();
  const words = page.getByRole("dialog", { name: "Tes mots" });
  await expect(words.locator(".lyrix-chip")).toHaveCount(1);
  await words.getByRole("button", { name: "Fermer" }).click();
  await expect(words).toHaveCount(0);

  if (round.hints) {
    await page.getByRole("button", { name: /^Indices :/ }).click();
    await expect(page.getByRole("dialog", { name: "Indices" }).locator(".lyrix-hint")).toHaveCount(3);
  }
});

test("moves between the screens with the tab bar", async ({ page }) => {
  await openRound(page);
  await expect(tabBar(page).getByRole("link", { name: "Jouer" })).toHaveAttribute("aria-current", "page");

  await tabBar(page).getByRole("link", { name: "Archives" }).click();
  await expect(page).toHaveURL(/\/archives$/);
  await expect(tabBar(page).getByRole("link", { name: "Archives" })).toHaveAttribute("aria-current", "page");
  // A page has no progress to show, and the theme has its own card on the rules' page.
  await expect(progress(page)).toHaveCount(0);
  await expect(page.getByRole("banner").locator(".lyrix-theme-toggle")).toBeHidden();

  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  await expect(page).toHaveURL(/\/comment-jouer$/);

  await tabBar(page).getByRole("link", { name: "Jouer" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(input(page)).toBeVisible();
});

test("picks the theme on the rules' page: light, dark, or the phone's own", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openRound(page);
  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  const picker = page.getByRole("group", { name: "Apparence" });
  await expect(picker.getByRole("radio", { name: "Auto" })).toBeChecked();

  await picker.getByText("Sombre").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("group", { name: "Apparence" }).getByText("Auto").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("keeps the dock over the tab bar, and steps the tab bar aside for the keyboard", async ({ page }) => {
  await openRound(page);
  await settle(page);
  const dock = page.locator(".lyrix-dock");
  const bar = (await tabBar(page).boundingBox())!;
  const above = (await dock.boundingBox())!;
  expect(above.y + above.height).toBeLessThanOrEqual(bar.y);

  await input(page).tap();
  await expect(tabBar(page)).toBeHidden();
  const docked = (await dock.boundingBox())!;
  expect(844 - (docked.y + docked.height)).toBeLessThan(40);

  await input(page).blur();
  await expect(tabBar(page)).toBeVisible();
});

test("keeps the logo's mark alone on the narrowest phones, nothing wider than the screen", async ({ page }) => {
  await page.setViewportSize({ width: 340, height: 700 });
  await openRound(page);
  await expect(page.locator(".lyrix-wordmark")).toBeHidden();
  await expect(page.locator(".lyrix-logo-mark")).toBeVisible();
  await expect(progress(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(340);
});

test.describe("from 880px", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test("has none of it: the side column, the header's buttons", async ({ page }) => {
    await openRound(page);
    await expect(tabBar(page)).toBeHidden();
    await expect(progress(page)).toBeHidden();
    await expect(page.locator(".lyrix-dock-shortcuts")).toBeHidden();
    await expect(page.locator(".lyrix-aside")).toBeVisible();
    await expect(page.getByRole("button", { name: "Archives" })).toBeVisible();
  });
});
