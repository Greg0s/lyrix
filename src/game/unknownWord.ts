/**
 * A guess that is no word the game knows (worker/src/lexicon.ts), as Pedantix
 * refuses one: never counted as a try, kept, or added to the words tried, solo
 * or in a room. The Worker answers it with a 422 carrying this body, whose
 * `error` is the player's message, so a tab running an older build, which
 * shows a refused guess's `error` as it is, still says why.
 */

export const UNKNOWN_WORD = "unknown-word";

export interface UnknownWordAnswer {
  /** What the player is told. */
  error: string;
  code: typeof UNKNOWN_WORD;
  /** The guess's key, normalized like any guess's. */
  key: string;
}

/** What the player is told about a word the game doesn't know, as they typed it. */
export function unknownWordMessage(word: string): string {
  return `Je ne connais pas le mot « ${word} ».`;
}

export function isUnknownWordAnswer(value: unknown): value is UnknownWordAnswer {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return body.code === UNKNOWN_WORD && typeof body.error === "string" && typeof body.key === "string";
}
