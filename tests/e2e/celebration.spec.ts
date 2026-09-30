import { expect, test, type Page } from "@playwright/test";
import type { RoundView } from "../../src/game/types";
import { titleWords as titleWordsOf } from "./titleWords";

/**
 * Celebrating the win (#42), end to end: confetti the moment the guess
 * completing the title lands, never in the way of a click, gone once it has
 * fallen, and never again for a round that comes back won.
 *
 * "No confetti" is read once, right after the victory panel shows: a burst
 * would have come with it. `toHaveCount(0)` would retry, and pass on a burst
 * that had cleared by then.
 */

async function winTheRound(page: Page): Promise<void> {
  const roundResponse = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponse).json()) as RoundView;

  const input = page.getByPlaceholder("Propose un mot…");
  for (const word of titleWordsOf(round)) {
    await input.fill(word);
    await input.press("Enter");
    // Empty once the guess has landed; Enter meanwhile is ignored by design.
    await expect(input).toHaveValue("");
  }
  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();
}

test("bursts confetti the moment the title is completed, lets every click through, and clears it once fallen", async ({
  page,
}) => {
  await winTheRound(page);

  const confetti = page.locator(".lyrix-confetti");
  await expect(confetti).toHaveCount(1);
  await expect(confetti).toHaveAttribute("aria-hidden", "true");
  await expect(confetti).toHaveCSS("position", "fixed");

  // Asked of the page in one go, so the confetti is known to be up while what
  // lies under it is hit-tested: the guess dock, the checkbox, the header.
  const underneath = await page.evaluate(() => {
    const reached = (element: Element | null) => {
      if (!element) return false;
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit !== null && element.contains(hit);
    };
    return {
      confetti: document.querySelector(".lyrix-confetti") !== null,
      dock: reached(document.querySelector(".lyrix-input")),
      checkbox: reached(document.querySelector(".lyrix-reveal-all input")),
      header: reached(document.querySelector('button[aria-label="Comment jouer"]')),
    };
  });
  expect(underneath).toEqual({ confetti: true, dock: true, checkbox: true, header: true });

  // Out of the DOM once every piece has fallen.
  await expect(confetti).toHaveCount(0);
});

test("does not celebrate again when the won round is reloaded", async ({ page }) => {
  await winTheRound(page);
  await page.reload();

  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();
  expect(await page.locator(".lyrix-confetti").count()).toBe(0);
  await expect(page.locator(".lyrix-title-block")).not.toHaveClass(/is-celebrating/);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the victory without any confetti", async ({ page }) => {
    await winTheRound(page);

    expect(await page.locator(".lyrix-confetti").count()).toBe(0);
  });
});
