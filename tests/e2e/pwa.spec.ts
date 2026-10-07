import { expect, test, type Page } from "@playwright/test";
import { previewUrl } from "../../playwright.config";
import { OFFLINE_MESSAGE } from "../../src/pwa";

/**
 * An installable Lyrix (#79), on the production build: the dev server
 * registers no service worker (src/pwa.ts).
 */
test.use({ baseURL: previewUrl });

/** Resolves once the service worker has installed and took the page over. */
async function controlledByServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/** Every URL the page's origin keeps in Cache Storage. */
function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
}

const isRound = (url: string) => new URL(url).pathname === "/api/round";

test("links the manifest and registers the service worker", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  const manifest = (await (await page.request.get("/manifest.webmanifest")).json()) as { name: string; display: string };
  expect(manifest).toMatchObject({ name: "Lyrix", display: "standalone" });
  const worker = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
  expect(worker).toBe(`${previewUrl}/sw.js`);
  await controlledByServiceWorker(page);
});

test("never answers the day's round from its cache, nor keeps it", async ({ page }) => {
  // Nothing saved between loads: each one asks the Worker for the round.
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await controlledByServiceWorker(page);

  const [round] = await Promise.all([page.waitForResponse((response) => isRound(response.url())), page.reload()]);
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();

  expect(round.ok()).toBe(true);
  expect(round.fromServiceWorker()).toBe(false);
  const cached = await cachedUrls(page);
  // It does keep the app shell.
  expect(cached).toContain(`${previewUrl}/`);
  expect(cached.filter((url) => new URL(url).pathname.startsWith("/api"))).toEqual([]);
});

test("leaves invite links to the page Pages serves for them, and answers the app's own addresses", async ({ page }) => {
  await page.goto("/");
  await controlledByServiceWorker(page);

  const invite = await page.goto("/salon/ABCDEF");
  expect(invite?.fromServiceWorker()).toBe(false);
  const archives = await page.goto("/archives");
  expect(archives?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("reopens offline on the app shell it kept, today's round readable and the dock saying why", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
  await controlledByServiceWorker(page);

  await context.setOffline(true);
  // The worker's own request for the page fails: the page that opens is the one it kept.
  const pageRequestFailed = context.waitForEvent(
    "requestfailed",
    (request) => request.serviceWorker() !== null && request.url() === `${previewUrl}/`
  );
  const reopened = await page.reload();
  await pageRequestFailed;

  expect(reopened?.fromServiceWorker()).toBe(true);
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
  await expect(page.locator(".lyrix-song .lyrix-section").first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(OFFLINE_MESSAGE);

  await context.setOffline(false);
  await expect(page.getByText(OFFLINE_MESSAGE)).toHaveCount(0);
});

test("says it is offline in place of a round it couldn't load, and loads it once back online", async ({ page, context }) => {
  // Nothing saved: offline, the round can't be loaded at all.
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
  await controlledByServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("alert")).toHaveText(OFFLINE_MESSAGE);
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();

  const [round] = await Promise.all([
    page.waitForResponse((response) => isRound(response.url())),
    context.setOffline(false),
  ]);
  expect(round.fromServiceWorker()).toBe(false);
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
});
