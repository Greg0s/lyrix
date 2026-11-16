import { normalize } from "../../src/game/normalize";

/** A name's words, case, accents and punctuation aside: "Stromae, Pharrell Williams" -> stromae, pharrell, williams. */
function nameWords(name: string): string[] {
  return normalize(name).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
}

/** Whether `inner`'s words run, in order and whole, somewhere in `outer`'s. */
function containsWords(outer: readonly string[], inner: readonly string[]): boolean {
  if (inner.length === 0 || inner.length > outer.length) return false;
  for (let start = 0; start + inner.length <= outer.length; start++) {
    if (inner.every((word, index) => outer[start + index] === word)) return true;
  }
  return false;
}

/**
 * The same artist, or a credit naming them among others (a featuring), by
 * whole words: a substring used to match "IAM" with "William Sheller" and
 * "Cali" with "Calimero". Deezer's covers and LRCLIB's lyrics are both
 * matched with it: either one, once kept, is kept for good.
 */
export function sameArtist(found: string, wanted: string): boolean {
  const a = nameWords(found);
  const b = nameWords(wanted);
  return containsWords(a, b) || containsWords(b, a);
}
