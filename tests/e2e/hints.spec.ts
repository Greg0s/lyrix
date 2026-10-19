import { expect, test, type Page } from "@playwright/test";

/**
 * Hints (src/game/hints.ts), on whatever song the day plays: unlocked at 20
 * guesses, revealed only when picked, kept across a reload. The words guessed
 * are nobody's lyrics, so the round is never won on the way.
 */

const NONSENSE = Array.from("abcdefghijklmnopqrst", (letter) => `zq${letter}xw`);

async function guessNonsense(page: Page, count: number): Promise<void> {
  const input = page.getByPlaceholder("Propose un mot…");
  for (const word of NONSENSE.slice(0, count)) {
    await input.fill(word);
    await input.press("Enter");
    await expect(input).toHaveValue("");
  }
}

test("unlocks a hint at 20 guesses, reveals the one picked, and keeps it on reload", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("region", { name: "Indices" });
  await expect(card.getByText("0 / 20 essais")).toBeVisible();
  await expect(card.getByRole("button", { name: /Révéler/ })).toHaveCount(0);

  await guessNonsense(page, 20);
  await expect(page.getByText("Un indice est débloqué.")).toBeVisible();
  await expect(card.getByText("1 à choisir")).toBeVisible();

  await card.getByRole("button", { name: /Époque/ }).click();
  const value = card.locator(".lyrix-hint.is-revealed .lyrix-hint-value");
  await expect(value).toHaveText(/^Années \d+$/);
  await expect(card.getByText("1 / 3")).toBeVisible();
  const era = await value.textContent();

  await page.reload();
  await expect(page.getByRole("region", { name: "Indices" }).locator(".lyrix-hint.is-revealed .lyrix-hint-value")).toHaveText(
    era ?? ""
  );
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("offers the hint from the dock, in a sheet that closes once one is picked", async ({ page }) => {
    await page.goto("/");
    await guessNonsense(page, 20);

    await page.getByRole("button", { name: "Choisir", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Choisis un indice" });
    await sheet.getByRole("button", { name: /Style/ }).click();

    await expect(sheet).toHaveCount(0);
    await expect(page.locator(".lyrix-feedback")).toHaveText(/^Style : .+\.$/);
  });
});
