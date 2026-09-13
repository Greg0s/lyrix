import { normalize } from "../../src/game/normalize";

/**
 * Picking the reference vocabulary a similarity table covers.
 *
 * Two vocabularies meet here and they don't use the same spelling rules:
 *  - the embedding model's, which keeps case and accents ("Été", "été", "ETE");
 *  - the game's, whose lookup key is `normalize()`d (lowercase, accent-free).
 * Everything below is keyed the game's way, and one key can therefore map to
 * several model rows — they're all kept, and the best of them wins when the
 * table is scored (see similarityTable.ts).
 */

// Same letter class as src/game/tokenize.ts's word runs: anything a player
// can't type as a single guessed word is useless in the table.
const LETTERS_ONLY = /^[A-Za-zÀ-ÖØ-öø-ÿ]+$/;
const STARTS_UPPERCASE = /^[A-ZÀ-ÖØ-Þ]/;

export interface KeyIndex {
  /** Normalized key -> every model row holding a form of that key. */
  rowsByKey: Map<string, number[]>;
  /** Keys in model order (i.e. by descending frequency), first occurrence wins. */
  keysByFrequency: string[];
}

/** Proper nouns are excluded: frWac2Vec keeps "Paris" and "Renaud" as ordinary vocabulary entries, and they make poor hints. */
export function isReferenceCandidate(word: string): boolean {
  return LETTERS_ONLY.test(word) && !STARTS_UPPERCASE.test(word);
}

export function indexByKey(words: readonly string[]): KeyIndex {
  const rowsByKey = new Map<string, number[]>();
  const listed = new Set<string>();
  const keysByFrequency: string[] = [];

  words.forEach((word, row) => {
    if (!LETTERS_ONLY.test(word)) return;
    const key = normalize(word);
    if (key.length === 0) return;

    const existing = rowsByKey.get(key);
    if (existing) existing.push(row);
    else rowsByKey.set(key, [row]);

    // A key whose first form is capitalized ("Été" before "été") must still
    // become a reference word once a lowercase form shows up further down.
    if (isReferenceCandidate(word) && !listed.has(key)) {
      listed.add(key);
      keysByFrequency.push(key);
    }
  });

  return { rowsByKey, keysByFrequency };
}

export interface ReferenceOptions {
  /** Reference word list (e.g. Lexique383, one word per line). Falls back to the model's own frequency order. */
  words?: readonly string[];
  maxWords: number;
  /** Always included however rare — in practice the song's own words, so a target is never missing from its table. */
  required?: Iterable<string>;
}

/** The keys a table will cover: the model's vocabulary intersected with a common-word list, plus the song's own words. */
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
