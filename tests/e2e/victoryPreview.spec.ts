import { expect, test, type Page } from "@playwright/test";
import type { GuessAnswer, RoundView } from "../../src/game/types";
import { titleWords } from "./titleWords";

/**
 * Once won, the song's 30-second extract plays from a record out of its
 * sleeve (VictoryPreview), served by the Worker. Dev's stand-in song has no
 * Deezer track, so the round's cover token and the Worker's two answers for
 * it are stood in for here; the Worker's own route is worker/src/preview.ts's
 * unit tests'.
 */

const TOKEN = "e2e-token";

/** A short silent WAV: enough for a browser to load and play. */
function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const samples = rate * seconds;
  const wav = Buffer.alloc(44 + samples);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples, 40);
  wav.fill(128, 44);
  return wav;
}

/** A 1x1 PNG, standing in for a cover. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

async function winWithCover(page: Page, extract: boolean): Promise<void> {
  await page.route("**/api/guess", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as GuessAnswer;
    if (!("kind" in body) && body.victory) body.cover = TOKEN;
    await route.fulfill({ response, json: body });
  });
  await page.route(`**/api/cover/${TOKEN}`, (route) => route.fulfill({ body: PIXEL, contentType: "image/png" }));
  await page.route(`**/api/preview/${TOKEN}`, (route) =>
    extract
      ? route.fulfill({ body: silentWav(30), contentType: "audio/wav" })
      : route.fulfill({ status: 404, json: { error: "no extract" } })
  );

  const roundResponse = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponse).json()) as RoundView;
  const input = page.getByPlaceholder("Propose un mot…");
  for (const word of titleWords(round)) {
    const answer = page.waitForResponse((res) => res.url().includes("/api/guess"));
    await input.fill(word);
    await input.press("Enter");
    await answer;
    await expect(input).toHaveValue("");
  }
  await expect(page.locator(".lyrix-victory")).toBeVisible();
}

test("plays the extract from a tap on the sleeve itself, and pauses it from the record", async ({ page }) => {
  await winWithCover(page, true);
  const record = page.getByRole("button", { name: "Écouter un extrait de 30 secondes" });
  await expect(record).toBeVisible();
  const audio = page.locator(".lyrix-preview audio");
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);

  // The sleeve lets the tap through to the record under it: the whole of both is one target.
  const sleeve = page.locator(".lyrix-victory-cover");
  await expect(sleeve).toHaveClass(/has-image/);
  // Clicked where the sleeve is, not on it: Playwright refuses an element that lets clicks through.
  const box = await sleeve.boundingBox();
  if (!box) throw new Error("the sleeve isn't on screen");
  await page.mouse.click(box.x + 20, box.y + 20);
  await expect(page.locator(".lyrix-preview")).toHaveClass(/is-playing/);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);

  await page.getByRole("button", { name: "Mettre l'extrait en pause" }).click();
  await expect(page.locator(".lyrix-preview")).not.toHaveClass(/is-playing/);
});

/** The label's angle, as the browser computes it. */
function labelAngle(page: Page): Promise<string> {
  return page.locator(".lyrix-vinyl-label").evaluate((label) => getComputedStyle(label).rotate);
}

test("turns the record's label while it plays, and stops it where it is on pause", async ({ page }) => {
  await winWithCover(page, true);
  await page.getByRole("button", { name: "Écouter un extrait de 30 secondes" }).click();
  await expect(page.locator(".lyrix-preview")).toHaveClass(/is-playing/);
  const playing = await labelAngle(page);
  await expect.poll(() => labelAngle(page)).not.toBe(playing);

  await page.getByRole("button", { name: "Mettre l'extrait en pause" }).click();
  // Slowed to a stop: the angle settles, and isn't the first one again.
  let settled = "";
  await expect
    .poll(async () => {
      const before = await labelAngle(page);
      await page.waitForTimeout(200);
      settled = await labelAngle(page);
      return settled === before;
    })
    .toBe(true);
  expect(["none", "0deg", "0turn"]).not.toContain(settled);
});

test("doesn't turn the record under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await winWithCover(page, true);
  await page.getByRole("button", { name: "Écouter un extrait de 30 secondes" }).click();
  await expect(page.locator(".lyrix-preview")).toHaveClass(/is-playing/);
  expect(await page.locator(".lyrix-vinyl-label").evaluate((label) => label.getAnimations().length)).toBe(0);
});

test("shows no record for a song without an extract", async ({ page }) => {
  await winWithCover(page, false);
  await expect(page.locator(".lyrix-victory-cover")).toHaveClass(/has-image/);
  await expect(page.locator(".lyrix-preview")).toHaveCount(0);
});
