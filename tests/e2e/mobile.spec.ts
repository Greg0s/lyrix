import { expect, test, type Page } from "@playwright/test";
import type { RoundView } from "../../src/game/types";
import { lyricsOnlyWord, titleWords } from "./titleWords";

/**
 * A phone's layout, below 880px (game.css): laid out like an installed app.
 * The song comes first, the round's progress is in the header, the words
 * tried and the hints open as sheets from the dock, and the header's buttons
 * are a bar of tabs along the bottom edge, which steps aside for the keyboard.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const tabBar = (page: Page) => page.getByRole("navigation", { name: "Navigation" });
const progress = (page: Page) => page.getByRole("banner").getByRole("group", { name: "Progression" });
const input = (page: Page) => page.getByPlaceholder("Propose un mot…");

/** Today's round, as the Worker sent it: the word to find is read off its dev hints. */
async function openRound(page: Page): Promise<RoundView> {
  const response = page.waitForResponse((res) => res.url().includes("/api/round") && res.request().method() === "GET");
  await page.goto("/");
  const round = (await (await response).json()) as RoundView;
  await expect(input(page)).toBeVisible();
  return round;
}

/** The header's progress keeps clear of the logo: a pill at its right end (proposition "H4"). */
async function expectProgressClearOfLogo(page: Page): Promise<void> {
  const logo = (await page.locator(".lyrix-logo-link").boundingBox())!;
  const pill = (await progress(page).boundingBox())!;
  expect(pill.x).toBeGreaterThanOrEqual(logo.x + logo.width + 12);
  expect(pill.x + pill.width).toBeLessThanOrEqual(page.viewportSize()!.width);
}

/** Once the cards have risen in: their entrance moves them. */
async function settle(page: Page): Promise<void> {
  // A screen that slid out is cancelled once gone: its promise rejects, and it is just as done.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
  );
}

test("puts the song on the first screen, the side column out of the page", async ({ page }) => {
  await openRound(page);
  await settle(page);
  const title = await page.locator(".lyrix-title-block").boundingBox();
  expect(title).not.toBeNull();
  expect(title!.y + title!.height).toBeLessThan(844);
  await expect(page.locator(".lyrix-aside")).toBeHidden();
  await expectProgressClearOfLogo(page);
  await expect(progress(page)).toContainText("0 %");
  await expect(tabBar(page)).toBeVisible();
  // The tab bar carries the header's buttons (a role query leaves hidden ones out).
  await expect(page.getByRole("banner").getByRole("button")).toHaveCount(0);
});

test("counts a guess in the header's progress", async ({ page }) => {
  const round = await openRound(page);
  await input(page).fill(lyricsOnlyWord(round));
  await input(page).press("Enter");
  await expect(progress(page)).toContainText("1 trouvé · 1 essai");
});

test("opens the words tried and the hints as sheets from the dock", async ({ page }) => {
  const round = await openRound(page);
  const word = lyricsOnlyWord(round);
  await input(page).fill(word);
  await input(page).press("Enter");
  await expect(input(page)).toHaveValue("");

  await page.getByRole("button", { name: "Tes mots : 1 mot" }).click();
  const words = page.getByRole("dialog", { name: "Tes mots" });
  await expect(words.locator(".lyrix-chip")).toHaveCount(1);
  await words.getByRole("button", { name: "Fermer" }).click();
  await expect(words).toHaveCount(0);

  if (round.hints) {
    await page.getByRole("button", { name: /^Indices :/ }).click();
    await expect(page.getByRole("dialog", { name: "Indices" }).locator(".lyrix-hint")).toHaveCount(3);
  }
});

test("closes a sheet on Back, as an app does, and leaves the screen under it", async ({ page }) => {
  // A screen before the round, to go Back to: the rules, left with « C'est parti ».
  await page.goto("/comment-jouer");
  await page.getByRole("button", { name: "C'est parti" }).click();
  await expect(input(page)).toBeVisible();

  // Android's Back button: it used to go to the rules behind the sheet, the sheet still open.
  await page.getByRole("button", { name: /^Tes mots/ }).click();
  await expect(page.getByRole("dialog", { name: "Tes mots" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(input(page)).toBeVisible();

  // Closed with its ✕, the sheet leaves nothing behind: Back goes where it would have.
  await page.getByRole("button", { name: /^Indices :/ }).click();
  await page.getByRole("dialog", { name: "Indices" }).getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/comment-jouer$/);
});

test("offers an invite link's room on the « Salon » tab, not in a dialog", async ({ page }) => {
  await page.goto("/salon/ABCDEF");
  await expect(page).toHaveURL(/\/jouer-a-plusieurs$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(tabBar(page).getByRole("link", { name: "Salon" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").getByLabel("Code du salon")).toHaveValue("ABCDEF");

  // Offered once: the tab opened again later is the plain forms.
  await tabBar(page).getByRole("link", { name: "Jouer" }).click();
  await tabBar(page).getByRole("link", { name: "Salon" }).click();
  await expect(page.getByRole("main").getByLabel("Code du salon")).toHaveValue("");
});

test("puts the keyboard down on a win, so the victory panel and the tab bar show", async ({ page }) => {
  const round = await openRound(page);
  await input(page).tap();
  await expect(tabBar(page)).toBeHidden();
  for (const word of titleWords(round)) {
    await input(page).fill(word);
    await input(page).press("Enter");
    await expect(input(page)).toHaveValue("");
  }
  await expect(page.getByText(/Bravo, tu l'as trouvée/)).toBeVisible();
  await expect(input(page)).not.toBeFocused();
  await expect(tabBar(page)).toBeVisible();
});

test("goes Back from any tab to « Jouer », then out of the app, as Android apps do", async ({ page }) => {
  await openRound(page);
  const start = await page.evaluate(() => window.history.length);
  await tabBar(page).getByRole("link", { name: "Archives" }).click();
  await tabBar(page).getByRole("link", { name: "Salon" }).click();
  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  await expect(page).toHaveURL(/\/comment-jouer$/);
  // One entry over « Jouer », whatever the tabs on the way.
  expect(await page.evaluate(() => window.history.length)).toBe(start + 1);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(input(page)).toBeVisible();

  // Back to « Jouer » with its tab, then Back: the round's entry is the one below, not a copy of it.
  await tabBar(page).getByRole("link", { name: "Archives" }).click();
  await tabBar(page).getByRole("link", { name: "Jouer" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => window.history.length)).toBe(start + 1);
  expect(await page.evaluate(() => (window.history.state as { lyrixIndex: number }).lyrixIndex)).toBe(0);
});

test("finds each tab where it was left, and scrolls the one shown to its top when tapped again", async ({ page }) => {
  await openRound(page);
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);
  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  await expect(page).toHaveURL(/\/comment-jouer$/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);

  await tabBar(page).getByRole("link", { name: "Jouer" }).click();
  await expect(input(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600);
  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);

  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  await expect(page).toHaveURL(/\/comment-jouer$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("moves between the screens with the tab bar", async ({ page }) => {
  await openRound(page);
  await expect(tabBar(page).getByRole("link", { name: "Jouer" })).toHaveAttribute("aria-current", "page");

  await tabBar(page).getByRole("link", { name: "Archives" }).click();
  await expect(page).toHaveURL(/\/archives$/);
  await expect(tabBar(page).getByRole("link", { name: "Archives" })).toHaveAttribute("aria-current", "page");
  // A page has no progress to show, and the theme has its own card on the rules' page.
  await expect(progress(page)).toHaveCount(0);
  await expect(page.getByRole("banner").locator(".lyrix-theme-toggle")).toBeHidden();

  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  await expect(page).toHaveURL(/\/comment-jouer$/);

  await tabBar(page).getByRole("link", { name: "Jouer" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(input(page)).toBeVisible();
});

/** A finger moving across the screen, as Chrome gets it from a touchscreen. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const steps = 8;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  for (let step = 1; step <= steps; step++) {
    const point = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  // The screen slides out and the next one in, or springs back: a swipe starts once it is done.
  await settle(page);
}

const swipeLeft = (page: Page) => swipe(page, { x: 320, y: 420 }, { x: 80, y: 430 });
const swipeRight = (page: Page) => swipe(page, { x: 80, y: 420 }, { x: 320, y: 430 });

test("moves between the tabs with a sideways swipe, in place", async ({ page }) => {
  await openRound(page);
  // Set on the page itself: a page load would lose it.
  await page.evaluate(() => ((window as Window & { stayed?: boolean }).stayed = true));
  const current = tabBar(page).locator('[aria-current="page"]');

  // The first tab: nothing before it, and the browser doesn't go Back for it either.
  await swipeRight(page);
  await expect(current).toHaveText("Jouer");

  await swipeLeft(page);
  await expect(page).toHaveURL(/\/archives$/);
  await expect(current).toHaveText("Archives");
  await swipeLeft(page);
  await expect(page).toHaveURL(/\/jouer-a-plusieurs$/);
  await swipeLeft(page);
  await expect(page).toHaveURL(/\/comment-jouer$/);
  // The last tab: nothing beyond it.
  await swipeLeft(page);
  await expect(page).toHaveURL(/\/comment-jouer$/);

  await swipeRight(page);
  await swipeRight(page);
  await swipeRight(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(input(page)).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { stayed?: boolean }).stayed)).toBe(true);

  // As after taps: back to « Jouer », its own entry, never one more on top of it.
  await swipeLeft(page);
  await expect(page).toHaveURL(/\/archives$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(input(page)).toBeVisible();
});

test("moves the screen with the finger, and slides the next one in", async ({ page }) => {
  await openRound(page);
  await settle(page);
  const screen = page.locator(".lyrix-app > main");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 320, y: 420 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 300, y: 421 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 220, y: 422 }] });
  // Chrome hands touch moves to the page frame by frame.
  await expect
    .poll(() => screen.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41))
    .toBe(-100);
  // Nothing wider than the screen while it moves.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // The header and the tab bar stay put.
  await expect(tabBar(page)).toHaveCSS("transform", "none");

  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 120, y: 422 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await expect(page).toHaveURL(/\/archives$/);
  const entering = await page
    .locator(".lyrix-app > main.lyrix-archives")
    .evaluate((element) => element.getAnimations().length);
  expect(entering).toBeGreaterThan(0);
  await settle(page);
  await expect(page.locator(".lyrix-app > main")).toHaveCSS("transform", "none");
});

test("springs the screen back from a swipe too short, and only follows a little past the first tab", async ({
  page,
}) => {
  await openRound(page);
  await settle(page);
  await swipe(page, { x: 200, y: 420 }, { x: 160, y: 420 });
  await swipe(page, { x: 80, y: 420 }, { x: 320, y: 420 });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".lyrix-app > main")).toHaveCSS("transform", "none");
  await expect(page.locator(".lyrix-app > main")).toHaveCSS("opacity", "1");
});

test.describe("under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("changes tab on a swipe without moving the screen", async ({ page }) => {
    await openRound(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 320, y: 420 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y: 421 }] });
    await expect(page.locator(".lyrix-app > main")).toHaveCSS("transform", "none");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 100, y: 421 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await expect(page).toHaveURL(/\/archives$/);
  });
});

test("leaves a scroll, a swipe from the screen's edge and the keyboard alone", async ({ page }) => {
  await openRound(page);
  await swipe(page, { x: 200, y: 700 }, { x: 180, y: 250 });
  // Android's back gesture starts at the edge.
  await swipe(page, { x: 4, y: 420 }, { x: 300, y: 420 });
  await swipe(page, { x: 386, y: 420 }, { x: 90, y: 420 });
  await input(page).tap();
  await swipeLeft(page);
  await expect(input(page)).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
});

test("opens the room as a tab of its own, not a dialog, and plays its round from there", async ({ page }) => {
  await openRound(page);
  await tabBar(page).getByRole("link", { name: "Salon" }).click();
  await expect(page).toHaveURL(/\/jouer-a-plusieurs$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Jouer à plusieurs" })).toBeVisible();
  await expect(tabBar(page).getByRole("link", { name: "Salon" })).toHaveAttribute("aria-current", "page");
  await expect(progress(page)).toHaveCount(0);

  // The keyboard up for the pseudo, the tab bar steps aside, as for a guess.
  const main = page.getByRole("main");
  await main.getByRole("tab", { name: "Créer un salon" }).click();
  await main.getByLabel("Ton pseudo").tap();
  await expect(tabBar(page)).toBeHidden();
  await main.getByLabel("Ton pseudo").fill("Camille");
  await main.getByRole("button", { name: "Créer le salon" }).click();

  // Created, the page stays on the room, to share it.
  await expect(main.getByRole("heading", { name: "Joueurs · 1" })).toBeVisible();
  await expect(page).toHaveURL(/\/jouer-a-plusieurs$/);
  await expect(tabBar(page).getByRole("link", { name: "Salon, 1 joueur" })).toBeVisible();

  await main.getByRole("button", { name: "Chercher ensemble" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByPlaceholder("Propose un mot au groupe…")).toBeVisible();

  // Reloaded, the address is the page's own.
  await page.goto("/jouer-a-plusieurs");
  await expect(page.getByRole("main").getByRole("button", { name: "Quitter le salon" })).toBeVisible();
});

test("links the legal notice from the « Plus » tab alone", async ({ page }) => {
  const legal = page.getByRole("link", { name: "Mentions légales et confidentialité" });
  await openRound(page);
  await expect(legal).toBeHidden();
  await tabBar(page).getByRole("link", { name: "Archives" }).click();
  await expect(legal).toBeHidden();
  await tabBar(page).getByRole("link", { name: "Salon" }).click();
  await expect(legal).toBeHidden();

  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  await legal.click();
  await expect(page).toHaveURL(/\/mentions-legales$/);
  // Under "Plus", where it was opened from.
  await expect(tabBar(page).getByRole("link", { name: "Plus" })).toBeVisible();
});

test("picks the theme on the rules' page: light, dark, or the phone's own", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openRound(page);
  await tabBar(page).getByRole("link", { name: "Plus" }).click();
  const picker = page.getByRole("group", { name: "Apparence" });
  await expect(picker.getByRole("radio", { name: "Auto" })).toBeChecked();

  await picker.getByText("Sombre").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("group", { name: "Apparence" }).getByText("Auto").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("keeps the dock over the tab bar, and steps the tab bar aside for the keyboard", async ({ page }) => {
  await openRound(page);
  await settle(page);
  const dock = page.locator(".lyrix-dock");
  const bar = (await tabBar(page).boundingBox())!;
  const above = (await dock.boundingBox())!;
  expect(above.y + above.height).toBeLessThanOrEqual(bar.y);

  await input(page).tap();
  await expect(tabBar(page)).toBeHidden();
  const docked = (await dock.boundingBox())!;
  expect(844 - (docked.y + docked.height)).toBeLessThan(40);

  await input(page).blur();
  await expect(tabBar(page)).toBeVisible();
});

test("keeps the logo's mark alone on the narrowest phones, nothing wider than the screen", async ({ page }) => {
  await page.setViewportSize({ width: 340, height: 700 });
  await openRound(page);
  await expect(page.locator(".lyrix-wordmark")).toBeHidden();
  await expect(page.locator(".lyrix-logo-mark")).toBeVisible();
  await expect(progress(page)).toBeVisible();
  await settle(page);
  await expectProgressClearOfLogo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(340);
});

test.describe("a phone turned sideways", () => {
  // Wider than 880px, but a touch screen: the app's layout still, not the computer's.
  test.use({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });

  test("keeps the tab bar and the header's progress", async ({ page }) => {
    await openRound(page);
    await expect(tabBar(page)).toBeVisible();
    await expect(progress(page)).toBeVisible();
    await expect(page.locator(".lyrix-aside")).toBeHidden();
    await expect(page.getByRole("banner").getByRole("button")).toHaveCount(0);
  });
});

test.describe("from 880px", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test("has none of it: the side column, the header's buttons", async ({ page }) => {
    await openRound(page);
    await expect(tabBar(page)).toBeHidden();
    await expect(progress(page)).toBeHidden();
    await expect(page.locator(".lyrix-dock-shortcuts")).toBeHidden();
    await expect(page.locator(".lyrix-aside")).toBeVisible();
    await expect(page.getByRole("button", { name: "Archives" })).toBeVisible();
    // The legal notice is linked from every screen there.
    await expect(page.getByRole("link", { name: "Mentions légales et confidentialité" })).toBeVisible();
  });
});
