import { expect, test } from "@playwright/test";
import { previewUrl } from "../../playwright.config";

/**
 * Errors met in a player's browser reach the Worker (src/errorReport.ts),
 * on the production build, where the game's scripts are the deployed ones.
 */
test.use({ baseURL: previewUrl });

const isReport = (url: string) => new URL(url).pathname === "/api/client-error";

test("reports an error the game didn't catch to the site's own API, with the screen it happened on", async ({ page }) => {
  await page.goto("/archives");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const [request] = await Promise.all([
    page.waitForRequest((request) => isReport(request.url())),
    page.evaluate(() => {
      setTimeout(() => {
        throw new Error("thrown on purpose by the e2e suite");
      });
    }),
  ]);
  expect((await request.response())?.status()).toBe(204);
  expect(JSON.parse(request.postData() ?? "null")).toMatchObject({
    kind: "error",
    message: "Uncaught Error: thrown on purpose by the e2e suite",
    page: "archives",
  });
});

test("reports nothing while a round is played and its pages visited", async ({ page }) => {
  const reports: string[] = [];
  page.on("request", (request) => {
    if (isReport(request.url())) reports.push(request.postData() ?? "");
  });

  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");
  for (const word of ["amour", "xylophone", "le"]) {
    await input.fill(word);
    await input.press("Enter");
    await expect(input).toHaveValue("");
  }
  await page.getByRole("button", { name: "Archives" }).click();
  await page.getByRole("button", { name: "Comment jouer" }).click();
  await page.getByRole("link", { name: "Mentions légales et confidentialité" }).click();
  await expect(page).toHaveURL(/\/mentions-legales$/);
  await page.getByRole("button", { name: "Retour au jeu" }).click();
  await expect(input).toBeVisible();
  // A request that comes after any report the page could have sent meanwhile.
  await page.evaluate(() => fetch("/manifest.webmanifest"));

  expect(reports).toEqual([]);
});
