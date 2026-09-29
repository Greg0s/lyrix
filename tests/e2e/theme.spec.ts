import { expect, test, type Page } from "@playwright/test";

/**
 * Whether the page background is a dark colour. Painted onto a canvas to read
 * it back as sRGB: computed styles keep oklch() as written.
 */
async function paintsDark(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) throw new Error("no 2D canvas");
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  });
}

test.describe("on a system set to dark", () => {
  test.use({ colorScheme: "dark" });

  test("opens dark, and a light choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await paintsDark(page)).toBe(true);

    await page.getByRole("button", { name: "Passer en mode clair" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(page.getByRole("button", { name: "Passer en mode sombre" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await paintsDark(page)).toBe(false);
  });
});

test.describe("on a system set to light", () => {
  test.use({ colorScheme: "light" });

  test("opens light, and switches to dark from the header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await paintsDark(page)).toBe(false);

    await page.getByRole("button", { name: "Passer en mode sombre" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => paintsDark(page)).toBe(true);
  });
});
