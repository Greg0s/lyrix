import { isNumberWord } from "../../src/game/tokenize";
import { LEXICON } from "./lexiconWords";

/**
 * Whether the game knows a word, as Pedantix does: a guess that is no word at
 * all ("azertyuiop", a typo) is refused, never counted as a try, kept, or
 * shown in the words tried. Known: a number, a word of the song (checked
 * before this, by the caller), a word the song's similarity table scores (the
 * embedding model's vocabulary: proper nouns, English, slang), and every word
 * of the lexicon - the French word list and its hand-curated additions
 * (scripts/build-lexicon.ts, generated into lexiconWords.ts).
 *
 * The lexicon is one string of ~325,000 sorted words, one per line, searched
 * in place: nothing is built from it, so a cold isolate pays nothing, and a
 * lookup is ~19 comparisons, whatever the song.
 */

/** A guess's key as the lexicon holds it: plain apostrophes (keys are already normalized). */
function lexiconKey(key: string): string {
  return key.replace(/[’ʼ]/gu, "'");
}

/** Binary search over LEXICON, whose every word sits between two newlines. */
export function inLexicon(key: string, lexicon: string = LEXICON): boolean {
  const word = lexiconKey(key);
  if (word.length === 0 || word.includes("\n")) return false;
  // [lo, hi) always starts a line and ends where one starts.
  let lo = 1;
  let hi = lexicon.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const start = lexicon.lastIndexOf("\n", mid - 1) + 1;
    const end = lexicon.indexOf("\n", start);
    const candidate = lexicon.slice(start, end);
    if (candidate === word) return true;
    if (candidate < word) lo = end + 1;
    else hi = start;
  }
  return false;
}

/** What tells the Worker a word is one: the song's similarity table's scores, when there is one. */
export interface KnownScores {
  scores: Record<string, number>;
}

/**
 * Whether a guess that isn't in the song is a word the game knows. `key` is
 * the guess's base key (src/game/normalize.ts: no elision in front). `table`
 * is undefined when the song's table couldn't be read just now: KV not
 * answering is no reason to refuse a word (CLAUDE.md, "A dependency that
 * didn't answer is never a refusal"), so every guess counts then, as before.
 */
export function isKnownWord(key: string, table: KnownScores | null | undefined): boolean {
  if (table === undefined) return true;
  if (isNumberWord(key)) return true;
  if (table !== null && Object.prototype.hasOwnProperty.call(table.scores, key)) return true;
  return inLexicon(key);
}
