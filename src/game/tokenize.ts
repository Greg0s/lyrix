import type { Token } from "./types";

const WORD_RUN = "[A-Za-zÀ-ÖØ-öø-ÿ]+";
const SPLIT_ON_WORDS = new RegExp(`(${WORD_RUN})`);
const IS_WORD = new RegExp(`^${WORD_RUN}$`);

// Splits into word/non-word runs, so "l'amour" -> ["l", "'", "amour"] and "amour" is guessable despite the elision.
export function tokenize(text: string): Token[] {
  return text
    .split(SPLIT_ON_WORDS)
    .filter((chunk) => chunk.length > 0)
    .map((chunk): Token => ({ text: chunk, isWord: IS_WORD.test(chunk) }));
}
