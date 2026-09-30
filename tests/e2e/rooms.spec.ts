import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { RoundView } from "../../src/game/types";
import { lyricsOnlyWord, titleWords as titleWordsOf } from "./titleWords";

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

/**
 * The title's words of the day's song, read off the solo round's dev hints:
 * the e2e Worker runs with DEV_REVEAL_LYRICS (see CLAUDE.md), and this works
 * whichever song the day falls on, the emergency one included.
 */
let titleWords: string[] = [];
/** A lyrics word outside the title, same source: a find that never wins the round. */
let lyricsWord = "";

async function openGame(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  contexts.push(context);
  const page = await context.newPage();
  const roundResponse = page.waitForResponse((res) => res.url().includes("/api/round"));
  await page.goto("/");
  const round = (await (await roundResponse).json()) as RoundView;
  titleWords = titleWordsOf(round);
  lyricsWord = lyricsOnlyWord(round);
  await expect(page.getByPlaceholder("Propose un mot…")).toBeVisible();
  return page;
}

async function guess(page: Page, word: string): Promise<void> {
  const input = page.getByPlaceholder("Propose un mot au groupe…");
  await input.fill(word);
  await input.press("Enter");
  // Empty once the guess has landed; Enter meanwhile is ignored by design.
  await expect(input).toHaveValue("");
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

/** The dialog's box once every animation in it has settled. */
async function settledBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  await dialog(page).evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  const box = await dialog(page).boundingBox();
  if (box === null) throw new Error("The dialog isn't laid out.");
  return box;
}

test("switching between the create and join tabs doesn't move the dialog", async ({ browser }) => {
  const page = await openGame(browser);
  await page.getByRole("button", { name: "Jouer à plusieurs" }).click();
  const onCreate = await settledBox(page);

  await dialog(page).getByRole("tab", { name: "Rejoindre" }).click();
  await expect(dialog(page).getByLabel("Code du salon")).toBeVisible();
  expect(await settledBox(page)).toEqual(onCreate);

  await dialog(page).getByRole("tab", { name: "Créer un salon" }).click();
  await expect(dialog(page).getByRole("button", { name: "Créer le salon" })).toBeVisible();
  expect(await settledBox(page)).toEqual(onCreate);
});

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

test("invites a player with a link: an invitation's preview, then the room's code typed in for them", async ({
  browser,
}) => {
  const host = await openGame(browser);
  const code = await createRoom(host, "Camille");
  await roomCard(host).getByRole("button", { name: "Copier le lien d’invitation" }).click();
  await expect(roomCard(host).getByRole("button", { name: "Copié !" })).toBeVisible();
  const link = await host.evaluate(() => navigator.clipboard.readText());
  expect(new URL(link).pathname).toBe(`/salon/${code}`);

  // What a chat app's unfurler reads: the HTML, never the app.
  const response = await host.request.get(link);
  const html = await response.text();
  expect(html).toContain('<meta property="og:title" content="Rejoins mon salon Lyrix" />');
  expect(html).toContain("og-invite.png");
  expect(html).not.toContain(code);

  const guest = await (await browser.newContext()).newPage();
  contexts.push(guest.context());
  await guest.goto(link);
  await expect(dialog(guest).getByLabel("Code du salon")).toHaveValue(code);
  await expect(guest).toHaveURL(/\/$/);
  await dialog(guest).getByLabel("Ton pseudo").fill("Léo");
  await dialog(guest).getByRole("button", { name: "Rejoindre le salon" }).click();

  await expect(dialog(guest)).toBeHidden();
  await expect(feedback(guest)).toHaveText("Tu as rejoint le salon de Camille.");
  await expect(feedback(host)).toHaveText("Léo a rejoint le salon.");
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

test("plays the day's round together: every find and every miss reaches the whole room", async ({ browser }) => {
  const host = await openGame(browser);
  const guest = await openGame(browser);
  const code = await createRoom(host, "Camille");
  await joinRoom(guest, code, "Léo");
  await expect(feedback(host)).toHaveText("Léo a rejoint le salon.");

  // A lyrics word, not a title word: on a one-word title, that find would win the round.
  await guess(guest, lyricsWord);

  await expect(feedback(guest)).toHaveText(`« ${lyricsWord} » trouvé !`);
  await expect(feedback(host)).toHaveText(`Léo a trouvé « ${lyricsWord} » !`);
  await expect(host.locator(".token-word-found", { hasText: lyricsWord }).first()).toBeVisible();
  const hostWords = host.getByRole("region", { name: "Mots du groupe" });
  await expect(hostWords.locator(".lyrix-chip", { hasText: lyricsWord }).locator(".lyrix-player-dot")).toHaveCount(1);

  await guess(host, "zzqxw");
  await expect(feedback(guest)).toHaveText("Camille a proposé « zzqxw », sans succès.");
  await guess(guest, "ZZQXW");
  await expect(feedback(guest)).toHaveText("« ZZQXW » a déjà été proposé.");

  for (const word of titleWords) await guess(host, word);

  // Camille completed the title and sees the victory; Léo is offered the
  // answer, or to keep looking (see "when a teammate completes the title").
  await expect(host.getByText("Bravo, le groupe l'a trouvée")).toBeVisible();
  await expect(host.getByRole("region", { name: "Progression" }).locator('[data-stat="tried"]')).toContainText(
    `${titleWords.length + 2} essais`
  );
  await expect(guest.getByRole("button", { name: "Afficher la réponse" })).toBeVisible();
});

test("catches a player up on the room's round after a reload, and gives the solo round back on leaving", async ({
  browser,
}) => {
  const host = await openGame(browser);
  const guest = await openGame(browser);
  const code = await createRoom(host, "Camille");
  await joinRoom(guest, code, "Léo");
  // Not a title word: on a one-word title, finding it would end the round instead.
  await guess(host, lyricsWord);

  await guest.reload();
  const found = guest.locator(".token-word-found", { hasText: lyricsWord }).first();
  await expect(found).toBeVisible();

  await roomCard(guest).getByRole("button", { name: "Quitter le salon" }).click();

  await expect(guest.getByPlaceholder("Propose un mot…")).toBeVisible();
  await expect(guest.locator(".token-word-found")).toHaveCount(0);
  await expect(guest.getByRole("region", { name: "Tes mots" })).toContainText("Les mots que tu proposes");
});

test.describe("when a teammate completes the title", () => {
  async function wonByHost(browser: Browser): Promise<{ host: Page; guest: Page; winning: string }> {
    const host = await openGame(browser);
    const guest = await openGame(browser);
    const code = await createRoom(host, "Camille");
    await joinRoom(guest, code, "Léo");
    await expect(feedback(host)).toHaveText("Léo a rejoint le salon.");
    const winning = titleWords.at(-1);
    if (!winning) throw new Error("the day's song title has no word");
    for (const word of titleWords) await guess(host, word);
    await expect(host.getByText("Bravo, le groupe l'a trouvée")).toBeVisible();
    return { host, guest, winning };
  }

  test("the others keep looking alone, the winning word still hidden, and can win on their own", async ({
    browser,
  }) => {
    const { guest, winning } = await wonByHost(browser);

    await expect(feedback(guest)).toHaveText("Camille a trouvé la chanson !");
    await expect(guest.getByRole("region", { name: "Le groupe a trouvé" })).toBeVisible();
    await expect(guest.getByText(/Bravo/)).toHaveCount(0);
    await expect(guest.locator(".lyrix-title-line .token-word-found", { hasText: winning })).toHaveCount(0);

    const input = guest.getByPlaceholder("Propose un mot…");
    await input.fill(winning);
    await input.press("Enter");

    await expect(guest.getByText("Bravo, tu l'as trouvée")).toBeVisible();
    await expect(guest.getByRole("region", { name: "Le groupe a trouvé" })).toHaveCount(0);
  });

  test("the others can see the answer at once, and still do after a reload", async ({ browser }) => {
    const { guest, winning } = await wonByHost(browser);

    await guest.getByRole("button", { name: "Afficher la réponse" }).click();

    await expect(guest.getByText("Bravo, le groupe l'a trouvée")).toBeVisible();
    await expect(guest.locator(".lyrix-title-line .token-word-found", { hasText: winning }).first()).toBeVisible();
    await guest.reload();
    await expect(guest.getByText("Bravo, le groupe l'a trouvée")).toBeVisible();
  });
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
