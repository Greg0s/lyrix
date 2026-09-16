import { normalize } from "../../src/game/normalize";
import { LETTER_CLASS } from "../../src/game/tokenize";

/**
 * Picking the reference vocabulary a similarity table covers.
 *
 * Two vocabularies meet here and they don't use the same spelling rules:
 *  - the embedding model's, which may keep case and accents ("Été", "été", "ETE");
 *  - the game's, whose lookup key is `normalize()`d (lowercase, accent-free).
 * Everything below is keyed the game's way, and one key can therefore map to
 * several model rows — they're all kept, and the best of them wins when the
 * table is scored (see similarityTable.ts).
 */

// The same letters as src/game/tokenize.ts's word runs: anything a player can't
// type as a single guessed word is useless in the table. Digits are left out on
// purpose, although tokenize() makes a word of a number: numbers are compared by
// value (see numberProximityScore), never through a vector.
const LETTERS_ONLY = new RegExp(`^[${LETTER_CLASS}]+$`);

export interface KeyIndex {
  /** Normalized key -> every model row holding a form of that key. */
  rowsByKey: Map<string, number[]>;
  /** Keys in model order (i.e. by descending frequency), first occurrence wins. */
  keysByFrequency: string[];
}

/**
 * A model entry a player could type as one guess. Proper nouns are welcome:
 * "france" is as good a hint for "allemagne" as one common noun is for
 * another, and a lowercased model like frWac2Vec can't tell them apart anyway.
 */
export function isReferenceCandidate(word: string): boolean {
  return LETTERS_ONLY.test(word);
}

export function indexByKey(words: readonly string[]): KeyIndex {
  const rowsByKey = new Map<string, number[]>();
  const keysByFrequency: string[] = [];

  words.forEach((word, row) => {
    if (!isReferenceCandidate(word)) return;
    const key = normalize(word);
    if (key.length === 0) return;

    const existing = rowsByKey.get(key);
    if (existing) {
      existing.push(row);
    } else {
      rowsByKey.set(key, [row]);
      keysByFrequency.push(key);
    }
  });

  return { rowsByKey, keysByFrequency };
}

export interface ReferenceOptions {
  /** Reference word list (e.g. Lexique383, one word per line), most frequent first. Falls back to the model's own frequency order. */
  words?: readonly string[];
  maxWords: number;
  /** Always included however rare — in practice the song's own words, so a target is never missing from its table. */
  required?: Iterable<string>;
}

/**
 * The keys a table will cover, most frequent first: the model's vocabulary
 * intersected with a common-word list, plus the song's own words. The order
 * matters, since ranks are counted among the first of them (see
 * RANK_VOCABULARY_SIZE in similarityTable.ts).
 */
export function selectReferenceKeys(index: KeyIndex, options: ReferenceOptions): string[] {
  const selected = new Set<string>();

  const candidates = options.words
    ? options.words.map(normalize).filter((key) => key.length > 0)
    : index.keysByFrequency;

  for (const key of candidates) {
    if (selected.size >= options.maxWords) break;
    if (!index.rowsByKey.has(key)) continue;
    selected.add(key);
  }

  for (const word of options.required ?? []) {
    const key = normalize(word);
    if (key.length > 0) selected.add(key);
  }

  return [...selected];
}
