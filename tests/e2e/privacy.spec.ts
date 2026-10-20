import { expect, test } from "@playwright/test";
import { previewUrl } from "../../playwright.config";

/**
 * Playing asks no one but the site for anything: a request to another host
 * (Google Fonts, once) hands it the player's IP address, which the GDPR
 * doesn't allow without consent, and the game shows no consent banner. Run
 * on the production build, whose HTML and stylesheets are the deployed ones.
 * In production the API is on an origin of its own; here, as in dev, it is
 * proxied by the site's server.
 */
test.use({ baseURL: previewUrl });

test("loads and plays without a request to any other host, its own fonts in use", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") hosts.add(url.host);
  });

  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");
  await input.fill("amour");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await page.evaluate(() => document.fonts.ready);

  expect([...hosts]).toEqual([new URL(previewUrl).host]);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family.replace(/"/g, ""))
  );
  expect(new Set(loaded)).toEqual(new Set(["Figtree", "Bricolage Grotesque"]));
});
