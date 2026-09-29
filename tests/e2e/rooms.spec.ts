import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

/**
 * Rooms ("salons", issue #29), for real: a Durable Object per room in the
 * e2e Worker, and each player in a browser context of their own, so nothing
 * but the Worker is shared between them.
 */

const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

// Contexts opened by hand aren't closed by Playwright's fixtures: close them
// at the end of each test, so their rooms' sockets close with them.
const contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()));
});

async function openGame(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
  return page;
}

function dialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Jouer à plusieurs" });
}

function roomCard(page: Page): Locator {
  return page.getByRole("region", { name: "Salon" });
}

function feedback(page: Page): Locator {
  return page.locator(".lyrix-feedback");
}

/** Creates a room from the header, closes the dialog, and returns its code. */
async function createRoom(page: Page, pseudo: string): Promise<string> {
  await page.getByRole("button", { name: "Jouer à plusieurs" }).click();
  await dialog(page).getByLabel("Ton pseudo").fill(pseudo);
  await dialog(page).getByRole("button", { name: "Créer le salon" }).click();
  const code = dialog(page).locator(".lyrix-room-code");
  await expect(code).toHaveText(CODE_PATTERN);
  const text = (await code.textContent()) ?? "";
  await dialog(page).getByRole("button", { name: "Chercher ensemble" }).click();
  await expect(dialog(page)).toBeHidden();
  return text;
}

async function joinRoom(page: Page, code: string, pseudo: string): Promise<void> {
  await page.getByRole("button", { name: "Jouer à plusieurs" }).click();
  await dialog(page).getByRole("tab", { name: "Rejoindre" }).click();
  await dialog(page).getByLabel("Ton pseudo").fill(pseudo);
  await dialog(page).getByLabel("Code du salon").fill(code);
  await dialog(page).getByRole("button", { name: "Rejoindre le salon" }).click();
}

test("creates a room: its code, its host, and the room everywhere on the page", async ({ browser }) => {
  const page = await openGame(browser);
  await page.getByRole("button", { name: "Jouer à plusieurs" }).click();
  await dialog(page).getByLabel("Ton pseudo").fill("Camille");
  await dialog(page).getByRole("button", { name: "Créer le salon" }).click();

  const codeInDialog = dialog(page).locator(".lyrix-room-code");
  await expect(codeInDialog).toHaveText(CODE_PATTERN);
  const code = (await codeInDialog.textContent()) ?? "";
  await expect(dialog(page).getByRole("heading", { name: "Joueurs · 1" })).toBeVisible();
  const me = dialog(page).locator(".lyrix-member", { hasText: "Camille" });
  await expect(me.locator(".lyrix-tag")).toHaveText(["toi", "hôte"]);
  await expect(dialog(page).locator(".lyrix-member.is-waiting")).toHaveText("En attente…");

  await dialog(page).getByRole("button", { name: "Chercher ensemble" }).click();
  await expect(dialog(page)).toBeHidden();

  await expect(roomCard(page).locator(".lyrix-room-code")).toHaveText(code);
  await expect(roomCard(page)).toContainText("Camille");
  await expect(page.getByRole("button", { name: "Salon · 1 joueur" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Chercher à plusieurs/ })).toHaveCount(0);
});

test("lets a second player join by code, and both see each other live", async ({ browser }) => {
  const host = await openGame(browser);
  const guest = await openGame(browser);
  const code = await createRoom(host, "Camille");

  await guest.getByRole("button", { name: "Jouer à plusieurs" }).click();
  await dialog(guest).getByRole("tab", { name: "Rejoindre" }).click();
  await dialog(guest).getByLabel("Ton pseudo").fill("Léo");
  // Typed lowercase with spaces: uppercased as typed, whitespace ignored.
  await dialog(guest).getByLabel("Code du salon").pressSequentially(code.toLowerCase().split("").join(" "));
  await expect(dialog(guest).getByLabel("Code du salon")).toHaveValue(code);
  await dialog(guest).getByRole("button", { name: "Rejoindre le salon" }).click();

  await expect(dialog(guest)).toBeHidden();
  await expect(feedback(guest)).toHaveText("Tu as rejoint le salon de Camille.");
  await expect(feedback(host)).toHaveText("Léo a rejoint le salon.");
  for (const page of [host, guest]) {
    await expect(page.getByRole("button", { name: "Salon · 2 joueurs" })).toBeVisible();
    await expect(roomCard(page).locator(".lyrix-member-name")).toHaveText(["Camille", "Léo"]);
  }
  await expect(roomCard(guest).locator(".lyrix-member", { hasText: "Camille" }).locator(".lyrix-tag")).toHaveText(
    "hôte"
  );
});

test("says so when the code is too short, and when no room has it", async ({ browser }) => {
  const page = await openGame(browser);
  await joinRoom(page, "abc", "Léo");

  const field = dialog(page).getByLabel("Code du salon");
  await expect(dialog(page).getByRole("alert")).toHaveText("Le code doit contenir 6 caractères.");
  await expect(field).toHaveAttribute("aria-invalid", "true");

  await field.fill("ZZZZZZ");
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await dialog(page).getByRole("button", { name: "Rejoindre le salon" }).click();
  await expect(dialog(page).getByRole("alert")).toHaveText("Aucun salon ne porte ce code, ou il a expiré.");
  await expect(field).toHaveAttribute("aria-invalid", "true");
});

test("tells the others when a player leaves, and gives the leaver the promo card back", async ({ browser }) => {
  const host = await openGame(browser);
  const guest = await openGame(browser);
  const code = await createRoom(host, "Camille");
  await joinRoom(guest, code, "Léo");
  await expect(host.getByRole("button", { name: "Salon · 2 joueurs" })).toBeVisible();

  await roomCard(guest).getByRole("button", { name: "Quitter le salon" }).click();

  await expect(feedback(host)).toHaveText("Léo a quitté le salon.");
  await expect(host.getByRole("button", { name: "Salon · 1 joueur" })).toBeVisible();
  await expect(roomCard(guest)).toHaveCount(0);
  await expect(guest.getByRole("button", { name: /Chercher à plusieurs/ })).toBeVisible();
  await expect(guest.getByRole("button", { name: "Jouer à plusieurs" })).toBeVisible();
});

test("keeps a player in their room across a reload", async ({ browser }) => {
  const host = await openGame(browser);
  const guest = await openGame(browser);
  const code = await createRoom(host, "Camille");
  await joinRoom(guest, code, "Léo");
  await expect(feedback(host)).toHaveText("Léo a rejoint le salon.");

  await guest.reload();

  await expect(roomCard(guest).locator(".lyrix-room-code")).toHaveText(code);
  await expect(guest.getByRole("button", { name: "Salon · 2 joueurs" })).toBeVisible();
  await expect(roomCard(host).locator(".lyrix-member-name")).toHaveText(["Camille", "Léo"]);
  // Back, not new: nobody is told twice.
  await expect(feedback(host)).toHaveText("Léo a rejoint le salon.");
});

test("names a player who gave no pseudo « Toi » for themselves and « Joueur N » for the others", async ({ browser }) => {
  const host = await openGame(browser);
  const guest = await openGame(browser);
  const code = await createRoom(host, "");
  await expect(roomCard(host).locator(".lyrix-member-name")).toHaveText(["Toi"]);

  await joinRoom(guest, code, "");

  await expect(feedback(guest)).toHaveText("Tu as rejoint le salon de Joueur 1.");
  await expect(feedback(host)).toHaveText("Joueur 2 a rejoint le salon.");
  await expect(roomCard(guest).locator(".lyrix-member-name")).toHaveText(["Joueur 1", "Toi"]);
});

test("copies the room code, and says so for a moment", async ({ browser }) => {
  const page = await openGame(browser);
  const code = await createRoom(page, "Camille");
  const copy = roomCard(page).getByRole("button", { name: "Copier le code" });

  await copy.click();

  await expect(roomCard(page).getByRole("button", { name: "Copié !" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await expect(roomCard(page).getByRole("button", { name: "Copier le code" })).toBeVisible();
});

test.describe("on a narrow phone", () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test("the header button just counts the players", async ({ page }) => {
    await page.goto("/");
    await createRoom(page, "Camille");

    const button = page.getByRole("button", { name: "Salon · 1 joueur" });
    await expect(button.locator(".lyrix-pill-label.is-room-count")).toBeVisible();
    await expect(button.locator(".lyrix-pill-label.is-room")).toBeHidden();
    await expect(button.locator(".lyrix-presence-dot")).toBeVisible();
  });
});
