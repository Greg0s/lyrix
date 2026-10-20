import { expect, test, type Page } from "@playwright/test";
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

/** Hides the tab, as switching apps or closing it does: when a page sends its audience report (src/stats.ts). */
async function hideTab(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
}

/** Every report the page hands sendBeacon, recorded as it is handed. */
async function recordBeacons(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const sent: string[] = [];
    (window as unknown as { lyrixBeacons: string[] }).lyrixBeacons = sent;
    const send = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, body) => {
      sent.push(String(body));
      return send(url, body);
    };
  });
}

const beaconsSent = (page: Page) => page.evaluate(() => (window as unknown as { lyrixBeacons: string[] }).lyrixBeacons);

test("reports the visit to the site's own API on leaving: the screens seen and the link's campaign, no identifier", async ({ page }) => {
  await page.goto("/?utm_source=Mastodon&utm_campaign=lancement");
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
  await page.getByRole("button", { name: "Archives" }).click();
  await expect(page).toHaveURL(/\/archives$/);

  const [request] = await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).pathname === "/api/visit"),
    hideTab(page),
  ]);
  expect(new URL(request.url()).host).toBe(new URL(previewUrl).host);
  expect(request.method()).toBe("POST");
  // Counted by the Worker, its EVENTS dataset bound as in production.
  expect((await request.response())?.status()).toBe(204);
  expect(JSON.parse(request.postData() ?? "null")).toEqual({
    landed: true,
    entry: "today",
    referrer: "",
    source: "mastodon",
    medium: "",
    campaign: "lancement",
    display: "browser",
    views: { today: 1, day: 0, archives: 1, help: 0, legal: 0 },
  });
});

test("reports nothing once the player opts out from the legal page, even after a reload", async ({ page }) => {
  await recordBeacons(page);
  await page.goto("/mentions-legales");
  await page.getByRole("checkbox", { name: "Ne pas compter mes visites sur cet appareil" }).check();
  await hideTab(page);
  expect(await beaconsSent(page)).toEqual([]);

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Ne pas compter mes visites sur cet appareil" })).toBeChecked();
  await hideTab(page);

  expect(await beaconsSent(page)).toEqual([]);
});

test("reports nothing from a browser that asks not to be tracked", async ({ page }) => {
  await recordBeacons(page);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true });
  });
  await page.goto("/");
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
  await hideTab(page);

  expect(await beaconsSent(page)).toEqual([]);
});
