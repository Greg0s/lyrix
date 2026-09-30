import type { RoundView } from "../../src/game/types";

/**
 * The distinct words of the round's title, in order. A round never names its
 * song, not even by id (#40), so they are read from the dev hints `npm run
 * dev:worker` attaches to every still-hidden word (DEV_REVEAL_LYRICS, which
 * Playwright's Worker always runs with) - the only way a client can know them.
 */
export function titleWords(round: RoundView): string[] {
  const words = round.title.tokens.filter((token) => token.isWord).map((token) => token.devHint);
  if (words.length === 0 || words.some((word) => word === undefined)) {
    throw new Error("the round's title carries no dev hints - is the Worker running with DEV_REVEAL_LYRICS:1?");
  }
  return [...new Set(words as string[])];
}
