import { expect, test, type Locator, type Page } from "@playwright/test";
import type { GuessResult, RoundView } from "../../src/game/types";
import { titleWords } from "./titleWords";

/**
 * Proximity scoring, end to end through the real Worker.
 *
 * `npm run dev:worker` (which Playwright starts) passes
 * `--var SIMILARITY_SAMPLE:1`, so the Worker serves the placeholder table in
 * worker/src/sampleSimilarity.ts instead of needing a populated KV namespace
 * and a 200-dimension French embedding model. The words below are picked to
 * be in that table and to stand no realistic chance of appearing in a song's
 * lyrics, so the assertions hold whichever song the day's rotation lands on.
 * Which hidden words a close word lands on is arbitrary in that table, so the
 * placement tests assert on how a close word shows up, not on where.
 */
const CLOSE_WORD = "clavecin"; // sample score 71 -> "hot"
const LONG_CLOSE_WORD = "violoncelle"; // sample score 64, and longer than most words it lands on
const DISTANT_WORD = "chlorophylle"; // sample score 4 -> "cold"
const UNKNOWN_WORD = "zzzinconnu"; // absent from the table -> no score at all

/**
 * The tried-word chip of exactly this word: its text, then its score if it has
 * one. Not a plain `hasText`, which is a case-insensitive substring match — a
 * title word like "La" would also match an earlier "clavecin 71" chip.
 */
function chipOf(page: Page, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.locator(".lyrix-tried-list .lyrix-chip", {
    hasText: new RegExp(`^${escaped}\\s*\\d*$`),
  });
}

/** The shade a scored word carries, as set inline for game.css's cold-to-hot ramp. */
async function heatOf(locator: Locator): Promise<number> {
  const style = (await locator.getAttribute("style")) ?? "";
  const match = /--heat:\s*([\d.]+)/.exec(style);
  if (!match) throw new Error(`no --heat in style="${style}"`);
  return Number(match[1]);
}

/** Submits a word and waits for it to join the tried-word list. */
async function guess(page: Page, word: string): Promise<void> {
  const input = page.getByPlaceholder("Propose un mot…");
  await input.fill(word);
  await input.press("Enter");
  await expect(chipOf(page, word)).toBeVisible();
}

test("colours and ranks tried words by how close they are to the song", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  for (const word of [DISTANT_WORD, UNKNOWN_WORD, CLOSE_WORD]) {
    await input.fill(word);
    await input.press("Enter");
    await expect(page.locator(".lyrix-chip", { hasText: word })).toBeVisible();
  }

  const chips = page.locator(".lyrix-tried-list .lyrix-chip");
  await expect(chips).toHaveCount(3);

  // None of the three is in the lyrics: what separates them is only the score.
  for (const word of [CLOSE_WORD, DISTANT_WORD, UNKNOWN_WORD]) {
    await expect(page.locator(".lyrix-chip", { hasText: word })).toHaveClass(
      /is-missed/,
    );
  }

  const close = page.locator(".lyrix-chip", { hasText: CLOSE_WORD });
  const distant = page.locator(".lyrix-chip", { hasText: DISTANT_WORD });
  await expect(close).toHaveClass(/tier-hot/);
  await expect(distant).toHaveClass(/tier-cold/);
  await expect(close).toContainText("71");
  await expect(distant).toContainText("4");

  // A word the model doesn't know shows no score rather than a misleading zero.
  await expect(
    page.locator(".lyrix-chip", { hasText: UNKNOWN_WORD }),
  ).toHaveClass(/tier-unknown/);

  // Highest score first, unscored last - not the order they were typed in.
  await expect(chips.nth(0)).toContainText(CLOSE_WORD);
  await expect(chips.nth(1)).toContainText(DISTANT_WORD);
  await expect(chips.nth(2)).toContainText(UNKNOWN_WORD);

  await expect(
    page.getByText("Plus le score est élevé", { exact: false }),
  ).toBeVisible();
  // CC BY 3.0: the model is credited wherever its numbers show.
  await expect(page.getByRole("link", { name: "frWac2Vec" })).toBeVisible();
});

test("shades each close word by how close it is", async ({ page }) => {
  await page.goto("/");
  await guess(page, CLOSE_WORD);

  // The placeholder table spreads a word over a few hidden words, a step
  // further off each time, and each of those steps gets its own shade.
  const placed = page.locator(".token-word-near", { hasText: CLOSE_WORD });
  await expect(placed.first()).toBeVisible();
  const shaded: { heat: number; opacity: number }[] = [];
  for (const slot of await placed.all()) {
    shaded.push({
      heat: await heatOf(slot),
      // The bar is the accent whatever the score: the guess written over it is
      // what gets more opaque the closer it is (game.css). Read once settled:
      // it fades in, and mid-way every slot shows about the same.
      opacity: await slot
        .locator(".token-near-guess")
        .evaluate(async (element) => {
          await Promise.all(
            element.getAnimations().map((animation) => animation.finished),
          );
          return Number(getComputedStyle(element).opacity);
        }),
    });
  }
  const heats = shaded.map((slot) => slot.heat);
  expect(new Set(heats).size).toBeGreaterThan(1);

  // Different shades, not just different numbers in an attribute.
  const hottest = shaded.find((slot) => slot.heat === Math.max(...heats));
  const coolest = shaded.find((slot) => slot.heat === Math.min(...heats));
  expect(hottest?.opacity).toBeGreaterThan(coolest?.opacity ?? 1);

  // The chip wears the shade of the guess's best placement.
  expect(await heatOf(chipOf(page, CLOSE_WORD))).toBe(Math.max(...heats));
});

test("writes a close word in full, widening its bar when it is longer than the word", async ({
  page,
}) => {
  await page.goto("/");
  await guess(page, LONG_CLOSE_WORD);

  const placed = page.locator(".token-word-near", { hasText: LONG_CLOSE_WORD });
  await expect(placed.first()).toBeVisible();
  let widened = 0;
  for (const slot of await placed.all()) {
    const fit = await slot.evaluate(async (bar) => {
      const guessed = bar.querySelector(".token-near-guess");
      const hidden = bar.querySelector(".token-near-blank");
      if (!guessed || !hidden)
        throw new Error("a close-word bar without its guess or its blank");
      await Promise.all(
        guessed.getAnimations().map((animation) => animation.finished),
      );
      // The letters actually drawn, wherever they overflow to.
      const range = document.createRange();
      range.selectNodeContents(guessed);
      const text = range.getBoundingClientRect();
      const box = bar.getBoundingClientRect();
      return {
        left: text.left - box.left,
        right: box.right - text.right,
        barFontSize: parseFloat(getComputedStyle(bar).fontSize),
        // Read off whatever element holds the letters, however deep.
        guessFontSize: parseFloat(
          getComputedStyle(
            document.createTreeWalker(guessed, NodeFilter.SHOW_TEXT).nextNode()
              ?.parentElement ?? guessed,
          ).fontSize,
        ),
        longerThanWord: text.width > hidden.getBoundingClientRect().width,
      };
    });
    // Never shrunk to fit...
    expect(fit.guessFontSize).toBe(fit.barFontSize);
    // ...nor cut: every letter sits inside the bar, a fifth of the text size off each end.
    expect(fit.left).toBeGreaterThanOrEqual(fit.barFontSize * 0.2);
    expect(fit.right).toBeGreaterThanOrEqual(fit.barFontSize * 0.2);
    if (fit.longerThanWord) widened += 1;
  }
  // An 11-letter guess outgrows at least one of the words it lands on: the case being pinned.
  expect(widened).toBeGreaterThan(0);
});

test("keeps proximity scores after reloading the page", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder("Propose un mot…");

  await input.fill(CLOSE_WORD);
  await input.press("Enter");
  await expect(
    page.locator(".lyrix-chip", { hasText: CLOSE_WORD }),
  ).toHaveClass(/tier-hot/);

  await page.reload();

  await expect(
    page.locator(".lyrix-chip", { hasText: CLOSE_WORD }),
  ).toHaveClass(/tier-hot/);
  await expect(
    page.locator(".lyrix-chip", { hasText: CLOSE_WORD }),
  ).toContainText("71");
});

test("shows a close word in place of the hidden words it is close to", async ({
  page,
}) => {
  await page.goto("/");
  await guess(page, CLOSE_WORD);

  const placed = page.locator(".token-word-near", { hasText: CLOSE_WORD });
  await expect(placed.first()).toBeVisible();
  // At its own score on its closest word, so in the same colour as its chip...
  await expect(
    page.locator(".token-word-near.tier-hot", { hasText: CLOSE_WORD }).first(),
  ).toBeVisible();
  // ...and on top of that word's blank, which stays a blank: nothing is revealed.
  await expect(placed.first().locator(".token-near-blank")).toHaveText(/^_+$/);
  await expect(
    page.getByText(`« ${CLOSE_WORD} » n’y est pas, mais il est proche`, {
      exact: false,
    }),
  ).toBeVisible();

  // Too far from everything, or unknown to the model: nothing to show in the lyrics.
  await guess(page, DISTANT_WORD);
  await expect(
    page.getByText(`« ${DISTANT_WORD} » n’y est pas.`, { exact: true }),
  ).toBeVisible();
  await guess(page, UNKNOWN_WORD);
  await expect(
    page.locator(".token-word-near", { hasText: DISTANT_WORD }),
  ).toHaveCount(0);
  await expect(
    page.locator(".token-word-near", { hasText: UNKNOWN_WORD }),
  ).toHaveCount(0);
  await expect(placed.first()).toBeVisible();
});

test("keeps close words in place after reloading the page", async ({
  page,
}) => {
  await page.goto("/");
  await guess(page, CLOSE_WORD);

  const placed = page.locator(".token-word-near", { hasText: CLOSE_WORD });
  await expect(placed.first()).toBeVisible();
  const count = await placed.count();

  await page.reload();

  await expect(placed).toHaveCount(count);
});

test("hands a hidden word back to the real one once it is found", async ({
  page,
}) => {
  const roundResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/round") && res.request().method() === "GET",
  );
  await page.goto("/");
  const round = (await (await roundResponse).json()) as RoundView;
  const [firstWord] = titleWords(round);

  // The placeholder table lands close words arbitrarily, so aim this one at
  // position 0 - the title's first word - which the test can then find for real.
  await page.route(
    "**/api/guess",
    async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as GuessResult;
      await route.fulfill({
        response,
        json: { ...body, near: [{ position: 0, score: 71 }] },
      });
    },
    { times: 1 },
  );

  const title = page.locator(".lyrix-title-line");
  await guess(page, CLOSE_WORD);
  await expect(title.locator(".token-word-near").first()).toContainText(
    CLOSE_WORD,
  );

  await guess(page, firstWord);
  await expect(title.locator(".token-word-found").first()).toHaveText(
    firstWord,
  );
  await expect(
    title.locator(".token-word-near", { hasText: CLOSE_WORD }),
  ).toHaveCount(0);
});

// Regression test: guess() used to find a word's chip with a plain `hasText`,
// a case-insensitive substring match. On a day whose title starts with "La",
// that also matched the earlier "clavecin 71" chip and strict mode failed the
// test above - but only on such days, since the song changes every day.
test("keeps a guess apart from an earlier one that contains it", async ({
  page,
}) => {
  await page.goto("/");
  await guess(page, CLOSE_WORD);
  await guess(page, "clave");
  await expect(page.locator(".lyrix-tried-list .lyrix-chip")).toHaveCount(2);
});
