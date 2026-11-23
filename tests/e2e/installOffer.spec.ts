import { expect, test, type Page } from "@playwright/test";
import { utcDay } from "../../src/game/daily";
import type { RoundView } from "../../src/game/types";
import { titleWords } from "./titleWords";

/**
 * The offer to install Lyrix (InstallOffer.tsx): made in the victory panel
 * to a player who found a second song, in a browser that can install it.
 * Chromium fires `beforeinstallprompt` only on a served, installable origin
 * after its own engagement checks, so the page is handed a stand-in event.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const yesterday = utcDay(new Date(Date.now() - DAY_MS));

declare global {
  interface Window {
    lyrixPrompted?: number;
  }
}

/** A stand-in for Chromium's event, fired once the page has loaded; counts the prompts it opens. */
async function offerInstallPrompt(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.addEventListener("load", () => {
      const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: () => {
          window.lyrixPrompted = (window.lyrixPrompted ?? 0) + 1;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      });
      window.dispatchEvent(event);
    });
  });
}

async function win(page: Page, url: string, roundUrl: string): Promise<void> {
  const roundPromise = page.waitForResponse((res) => res.url().includes(roundUrl) && res.ok());
  await page.goto(url);
  const round = (await (await roundPromise).json()) as RoundView;
  const input = page.getByPlaceholder("Propose un mot…");
  for (const word of titleWords(round)) {
    await input.fill(word);
    await input.press("Enter");
    await expect(input).toHaveValue("");
  }
  await expect(page.getByText("Bravo, tu l'as trouvée")).toBeVisible();
}

const offer = (page: Page) => page.getByRole("region", { name: "Lyrix sur ton écran d'accueil" });

test("offers nothing on a first song found", async ({ page }) => {
  await offerInstallPrompt(page);
  await win(page, "/", "/api/round");
  await expect(offer(page)).toHaveCount(0);
});

test("offers to install Lyrix once a second song is found, through the browser's own dialog", async ({ page }) => {
  await offerInstallPrompt(page);
  await win(page, `/archives/${yesterday}`, `/api/round?day=${yesterday}`);
  await win(page, "/", "/api/round");

  await expect(offer(page)).toContainText("Tu as trouvé 2 chansons");
  await offer(page).getByRole("button", { name: "Installer Lyrix" }).click();
  await expect.poll(() => page.evaluate(() => window.lyrixPrompted ?? 0)).toBe(1);
  await expect(offer(page)).toHaveCount(0);
});
