import { expect, test } from "@playwright/test";
import type { RoundView } from "../../src/game/types";
import { lyricsOnlyWord } from "./titleWords";

// Below 880px the "Tes mots" card sits above the lyrics, collapsed.
test.use({ viewport: { width: 390, height: 800 } });

test("opens the tried words card downward on a scrolled phone page", async ({ page }) => {
  const roundResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponsePromise).json()) as RoundView;

  // A word found last, as after most of a player's finds: the case the browser anchored on the lyrics.
  const input = page.getByPlaceholder("Propose un mot…");
  for (const word of ["nuit", "ciel", lyricsOnlyWord(round)]) {
    await input.fill(word);
    await input.press("Enter");
    await expect(input).toHaveValue("");
  }

  const toggle = page.getByRole("button", { name: /Tes mots/ });
  // Scrolled so the card's header sits just under the top bar, the lyrics below it on screen:
  // the browser's scroll anchoring used to hold the lyrics still and grow the card upward,
  // pushing its header off screen.
  await page.evaluate(() => {
    const top = document.querySelector(".lyrix-words")!.getBoundingClientRect().top;
    window.scrollBy(0, top - 60);
  });
  // The cards rise in with a transform: measure once they have landed.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  const before = (await toggle.boundingBox())!.y;

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".lyrix-words-body")).toBeVisible();
  expect((await toggle.boundingBox())!.y).toBe(before);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect((await toggle.boundingBox())!.y).toBe(before);
});
