import { expect, test, type Page } from "@playwright/test";

/**
 * The header logo leaving on a click, then coming back in (Logo.tsx), in a
 * browser that runs its CSS: jsdom plays no animation, so the component test
 * can only see the class and the remount.
 */

/** The CSS animations currently in effect on the logo, by keyframes name. */
function logoAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation)
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && target.closest(".lyrix-logo") !== null;
      })
      .map((animation) => animation.animationName)
  );
}

const logoLink = (page: Page) => page.getByRole("link", { name: "Lyrix, chanson du jour" });

test("leaves on a click while today's song opens, then comes back in", async ({ page }) => {
  await page.goto("/archives");
  await expect(page.getByRole("heading", { name: "Les 30 derniers jours" })).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));

  await logoLink(page).click();
  // The click doesn't wait for the logo: today's song is already there.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".lyrix-logo.is-leaving")).toHaveCount(1);
  expect(await logoAnimations(page)).toEqual(
    expect.arrayContaining(["lyrix-logo-row-out", "lyrix-logo-mark-out", "lyrix-logo-letter-out", "lyrix-logo-dot-out"])
  );

  await expect(page.locator(".lyrix-logo.is-leaving")).toHaveCount(0);
  await expect(page.locator(".lyrix-logo")).toHaveCount(1);
  expect(await logoAnimations(page)).toEqual(
    expect.arrayContaining(["lyrix-logo-mark-in", "lyrix-logo-letter", "lyrix-logo-dot-drop"])
  );
  expect(await logoAnimations(page)).not.toContain("lyrix-logo-letter-out");
});

test("neither leaves nor comes back in under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/archives");
  await expect(page.getByRole("heading", { name: "Les 30 derniers jours" })).toBeVisible();

  await logoLink(page).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".lyrix-logo.is-leaving")).toHaveCount(0);
  expect(await logoAnimations(page)).toEqual([]);
});
