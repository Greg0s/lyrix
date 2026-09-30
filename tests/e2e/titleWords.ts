import { normalize } from "../../src/game/normalize";
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

/**
 * A word of the lyrics that isn't in the title, read off the same dev hints:
 * finding it never completes the title, whatever the day's song. A title word
 * can't stand in for it - on a one-word title ("Dommage"), finding it wins.
 */
export function lyricsOnlyWord(round: RoundView): string {
  const titleKeys = new Set(titleWords(round).map((word) => normalize(word)));
  const word = round.sections
    .flatMap((section) => section.lines)
    .flatMap((line) => line.tokens)
    .map((token) => token.devHint)
    .find((hint): hint is string => typeof hint === "string" && hint.length >= 3 && !titleKeys.has(normalize(hint)));
  if (!word) throw new Error("the day's lyrics have no word of three letters or more outside the title");
  return word;
}
