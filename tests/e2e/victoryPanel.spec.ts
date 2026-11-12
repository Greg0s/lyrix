import { expect, test } from "@playwright/test";
import type { GuessAnswer, RoundView } from "../../src/game/types";
import { titleWords as titleWordsOf } from "./titleWords";

/**
 * The victory panel names the song's artist and year, the year on the
 * song's sleeve until its album cover (if the Worker has one) loads over it.
 * Neither is known before the win: the round's view carries no artist, year
 * or cover until then.
 */

test("names the artist and the year once the round is won, on the song's sleeve", async ({ page }) => {
  const roundResponse = page.waitForResponse(
    (res) => res.url().includes("/api/round") && res.request().method() === "GET"
  );
  await page.goto("/");
  const round = (await (await roundResponse).json()) as RoundView;
  expect(round.artist).toBeUndefined();
  expect(round.year).toBeUndefined();
  expect(round.cover).toBeUndefined();
  await expect(page.locator(".lyrix-victory-cover")).toHaveCount(0);

  const input = page.getByPlaceholder("Propose un mot…");
  let won: GuessAnswer | undefined;
  for (const word of titleWordsOf(round)) {
    const answer = page.waitForResponse((res) => res.url().includes("/api/guess"));
    await input.fill(word);
    await input.press("Enter");
    won = (await (await answer).json()) as GuessAnswer;
    await expect(input).toHaveValue("");
  }
  // A win is always a full view, never a delta.
  if (!won || "kind" in won || !won.victory) throw new Error("the title's words didn't win the round");
  const { artist, year } = won;
  if (!artist || year === undefined) throw new Error("the winning view names no artist or year");

  const panel = page.locator(".lyrix-victory");
  const facts = panel.locator(".lyrix-victory-facts");
  await expect(facts.locator("dt")).toHaveText(["Artiste", "Année"]);
  await expect(facts.locator("dd")).toHaveText([artist, String(year)]);
  const sleeve = panel.locator(".lyrix-victory-cover");
  await expect(sleeve).toHaveAttribute("aria-hidden", "true");
  await expect(sleeve.locator(".lyrix-victory-cover-year")).toHaveText(String(year));
});
