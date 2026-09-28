import type { DisplayToken, RoundView } from "./types";

/**
 * Share of the round's words revealed so far, 0-100: every word occurrence of
 * the title and the lyrics counts once, so a word found in a chorus weighs as
 * much as it fills the page. Rounded down, so 100 % only ever means every word
 * is out. Reads the masked view only - nothing the player can't already see.
 */
export function revealedPercent(round: Pick<RoundView, "title" | "sections">): number {
  let total = 0;
  let revealed = 0;
  const count = (token: DisplayToken) => {
    if (!token.isWord) return;
    total += 1;
    if (token.revealed) revealed += 1;
  };

  round.title.tokens.forEach(count);
  for (const section of round.sections) {
    for (const line of section.lines) line.tokens.forEach(count);
  }
  return total === 0 ? 0 : Math.floor((revealed / total) * 100);
}
