import { LEXICON } from "../../../worker/src/lexiconWords";

/**
 * Words the game knows that no test song holds, the dev stand-in song
 * included: a guess that is no word at all is refused rather than counted
 * (worker/src/lexicon.ts), so a test or an e2e spec that needs many misses
 * takes them from here. 228 of them, all starting "zo".
 */
export const KNOWN_MISSES: readonly string[] = LEXICON.split("\n").filter((word) => word.startsWith("zo"));
