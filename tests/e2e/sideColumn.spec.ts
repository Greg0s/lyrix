import { expect, test, type Page } from "@playwright/test";

// The side column (progress, "Tes mots", hints, the multiplayer card) beside the song, from 880px.
async function sideColumn(page: Page) {
  await page.goto("/");
  await expect(page.locator(".lyrix-hints")).toBeVisible();
  // The cards rise in with a transform: measure once they have landed.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  return {
    box: () =>
      page.evaluate(() => {
        const aside = document.querySelector(".lyrix-aside") as HTMLElement;
        const { top, bottom } = aside.getBoundingClientRect();
        return { top, bottom, scrollHeight: aside.scrollHeight, clientHeight: aside.clientHeight };
      }),
    scrollTo: (y: number) =>
      page.evaluate((top) => {
        window.scrollTo(0, top);
        return new Promise(requestAnimationFrame);
      }, y),
  };
}

test.describe("on a laptop screen, shorter than the side column", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("scrolls it with the page, then sticks it by its bottom, never cutting a card off", async ({ page }) => {
    const aside = await sideColumn(page);
    const start = await aside.box();
    // Taller than the screen: the case it used to be capped and scroll on its own.
    expect(start.bottom).toBeGreaterThan(720);
    expect(start.scrollHeight).toBe(start.clientHeight);

    // Scrolled past its bottom: it stays on screen, its last card whole.
    await aside.scrollTo(10_000);
    const end = await aside.box();
    expect(end.bottom).toBeLessThanOrEqual(720);
    await expect(page.locator(".lyrix-promo")).toBeInViewport({ ratio: 1 });
  });
});

test.describe("on a screen tall enough for the side column", () => {
  // Still shorter than the song, so the page scrolls.
  test.use({ viewport: { width: 1920, height: 1000 } });

  test("keeps it stuck under the header", async ({ page }) => {
    const aside = await sideColumn(page);
    expect((await aside.box()).bottom).toBeLessThanOrEqual(1000);

    await aside.scrollTo(60);
    expect((await aside.box()).top).toBe(96);
  });
});
