import type { Token } from "./types";

/**
 * The letters words are made of: ASCII, Latin-1's accented letters, and the
 * three French letters Latin-1 lacks — œ and Œ ("cœur", "sœur", "œil") and Ÿ,
 * the capital of ÿ. Without œ, "cœur" used to split into "c" and "ur" and could
 * never be found. Shared with scripts/lib/vocabulary.ts, so the embedding model
 * is read with the same idea of a word as the lyrics.
 */
export const LETTER_CLASS = "A-Za-zÀ-ÖØ-öø-ÿŒœŸ";

// A word is a run of letters or a run of digits, never a mix of the two, so a
// number stays a number: "90s" -> "90", "s".
const WORD_RUN = `[${LETTER_CLASS}]+|[0-9]+`;
const SPLIT_ON_WORDS = new RegExp(`(${WORD_RUN})`);
const IS_WORD = new RegExp(`^(?:${WORD_RUN})$`);
const IS_NUMBER = /^[0-9]+$/;

// Splits into word/non-word runs, so "l'amour" -> ["l", "'", "amour"] and "amour" is guessable despite the elision.
export function tokenize(text: string): Token[] {
  return text
    .split(SPLIT_ON_WORDS)
    .filter((chunk) => chunk.length > 0)
    .map((chunk): Token => ({ text: chunk, isWord: IS_WORD.test(chunk) }));
}

/**
 * A word made of digits, like "2015": hidden and guessed like any other word,
 * but compared with other numbers by value rather than by meaning (see
 * numberProximityScore in similarity.ts).
 */
export function isNumberWord(text: string): boolean {
  return IS_NUMBER.test(text);
}
