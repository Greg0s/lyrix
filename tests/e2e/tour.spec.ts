import { expect, test, type Page } from "@playwright/test";
import { TOUR_STEPS } from "../../src/tour";

/**
 * A first visit's guided tour (ProductTour.tsx), in a real browser: every
 * other spec starts from a browser that has seen it (TOUR_SEEN,
 * playwright.config.ts), this one from an empty one.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const tour = (page: Page) => page.getByRole("dialog");

/** Inside the viewport, and next to the element its step points at. */
async function expectTipBy(page: Page, target: string): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const tip = await tour(page).boundingBox();
  const element = await page.locator(`[data-tour="${target}"]`).boundingBox();
  if (!tip || !element) throw new Error(`no box for the tip or [data-tour="${target}"]`);
  expect(tip.x).toBeGreaterThanOrEqual(0);
  expect(tip.y).toBeGreaterThanOrEqual(0);
  expect(tip.x + tip.width).toBeLessThanOrEqual(viewport.width);
  expect(tip.y + tip.height).toBeLessThanOrEqual(viewport.height);
  // Just under or just over the element (TIP_GAP, and the highlight's padding).
  const gap = Math.min(Math.abs(tip.y - (element.y + element.height)), Math.abs(element.y - (tip.y + tip.height)));
  expect(gap).toBeLessThan(40);
}

for (const viewport of [
  { name: "desktop", size: { width: 1280, height: 800 } },
  { name: "phone", size: { width: 390, height: 760 } },
]) {
  test(`walks a first visit through the screen, next to each element (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize(viewport.size);
    await page.goto("/");
    await expect(tour(page)).toBeVisible();
    // A step whose element isn't there (a song without hints) is left out.
    const steps = [];
    for (const step of TOUR_STEPS) if ((await page.locator(`[data-tour="${step.target}"]`).count()) > 0) steps.push(step);
    await expect(tour(page)).toContainText(`Étape 1 sur ${steps.length}`);
    for (const [index, step] of steps.entries()) {
      await expect(tour(page).getByRole("heading")).toHaveText(step.title);
      await expect(tour(page).getByRole("button", { name: "Passer" })).toBeVisible();
      // Its position follows a smooth scroll: wait for it to settle.
      await expect(async () => expectTipBy(page, step.target)).toPass({ timeout: 3000 });
      if (index < steps.length - 1) await tour(page).getByRole("button", { name: "Suivant" }).click();
    }
    await tour(page).getByRole("button", { name: /C'est parti/ }).click();
    await expect(tour(page)).toHaveCount(0);
    await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
  });
}

test("is shown once: skipped, it never comes back, and the game is playable at once", async ({ page }) => {
  await page.goto("/");
  await expect(tour(page)).toBeVisible();
  // The page behind is out of reach while it shows.
  await page.getByPlaceholder("Propose un mot…").click({ trial: true, timeout: 1000 }).then(
    () => {
      throw new Error("the input could be clicked through the tour");
    },
    () => undefined
  );
  await tour(page).getByRole("button", { name: "Passer" }).click();
  await expect(tour(page)).toHaveCount(0);
  await expect(page.getByPlaceholder("Propose un mot…")).toBeFocused();

  await page.reload();
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
  await expect(tour(page)).toHaveCount(0);
});
