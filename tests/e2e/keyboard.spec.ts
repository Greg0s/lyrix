import { expect, test } from "@playwright/test";

/**
 * GitHub issue #33: a hidden word's letter count, without a mouse or touch,
 * in a real browser's tab order. The lyrics are one tab stop, not one per bar,
 * and the arrow keys move between bars from there.
 */
test("reaches the lyrics' bars in one tab stop and walks them with the arrow keys", async ({ page }) => {
  await page.goto("/");
  const lyrics = page.getByRole("group", { name: "Paroles" });
  const bars = lyrics.locator(".token-blank");
  await expect(bars.first()).toBeVisible();

  // Tab from the title's own tab stop lands on the first lyrics bar, which shows its tip.
  await page.locator(".lyrix-title-line .token-blank").first().focus();
  await page.keyboard.press("Tab");
  await expect(bars.first()).toBeFocused();
  await expect(bars.first().locator(".token-peek")).toHaveText(/^\d+ lettres?$/);

  await page.keyboard.press("ArrowRight");
  await expect(bars.nth(1)).toBeFocused();
  await expect(bars.nth(1).locator(".token-peek")).toHaveText(/^\d+ lettres?$/);

  // One more Tab leaves the lyrics altogether, however many bars are left.
  await page.keyboard.press("Tab");
  await expect(page.locator(".lyrix-lyrics .token-blank:focus")).toHaveCount(0);
});

test("names every bar by its letter count for screen readers", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("group", { name: "Paroles" }).locator(".token-blank").first();
  await expect(bar).toBeVisible();
  await expect(bar.locator(".sr-only")).toHaveText(/^mot caché, \d+ lettres?/);
});
