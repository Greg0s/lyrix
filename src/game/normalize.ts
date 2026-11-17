// The two ligatures Unicode decomposition leaves whole, spelled out.
const LIGATURES: Readonly<Record<string, string>> = { œ: "oe", æ: "ae" };

// Case- and accent-insensitive form, so e.g. "Étoile" matches "etoile" and
// "Cœur" matches "coeur", the spelling most lyrics and the embedding model use.
export function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[œæ]/g, (ligature) => LIGATURES[ligature]);
}

// The elided words French glues to the next one ("l'amour", "qu'il",
// "jusqu'à"), with any of the apostrophes a keyboard types.
const ELISION = /^(?:c|d|j|l|m|n|s|t|qu|jusqu|lorsqu|puisqu|quoiqu|presqu)['’ʼ]/u;
// Punctuation typed around a word ("amour !", "« coeur »"): never part of a lyrics word.
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * A guess's matching key: its normalized form, without the punctuation around
 * it, and without an elided word in front, since the lyrics are tokenized with
 * the elision apart ("l'amour" -> "l", "'", "amour"): "j'aime" finds "aime".
 * Shared by the Worker, which checks the guess, and the client, which spots a
 * word already tried without asking.
 */
export function guessKey(word: string): string {
  const key = normalize(word).replace(EDGE_PUNCTUATION, "");
  const unelided = key.replace(ELISION, "");
  return unelided || key || normalize(word);
}

/** The elided words themselves, normalized: "j" in "j'aime", "qu" in "qu'il". */
const ELIDED_WORD = /^(?:c|d|j|l|m|n|s|t|qu|jusqu|lorsqu|puisqu|quoiqu|presqu)$/;
// An elision glued to its word in the lyrics: the apostrophe alone between them.
const APOSTROPHE = /^['’ʼ]$/u;

/** Whether a lyrics word is an elided one ("j", "l", "qu"…), by its normalized key. */
export function isElidedWord(key: string): boolean {
  return ELIDED_WORD.test(key);
}

/** Whether the text between two lyrics words is a lone apostrophe, gluing an elision to the next word. */
export function isElisionApostrophe(text: string): boolean {
  return APOSTROPHE.test(text);
}

/**
 * The key of an elided word and the word it is glued to, as one: "j'aime",
 * written with a plain apostrophe whichever one the lyrics or the player used.
 * A guess carrying it reveals the elision too, where the lyrics have it
 * before that word (see SongAnalysis.elidedPositions).
 */
export function elidedKey(elided: string, word: string): string {
  return `${elided}'${word}`;
}

/** A guess's elided key ("J’aime !" -> "j'aime"); null for a guess with no elision in front. */
export function elidedGuessKey(word: string): string | null {
  const key = normalize(word).replace(EDGE_PUNCTUATION, "");
  const match = ELISION.exec(key);
  if (!match) return null;
  const rest = key.slice(match[0].length);
  if (!rest) return null;
  return elidedKey(match[0].slice(0, -1), rest);
}

/** The word a found key reveals everywhere: "aime" for "j'aime", the key itself for a plain one. */
export function baseKey(key: string): string {
  const match = ELISION.exec(key);
  return match && key.length > match[0].length ? key.slice(match[0].length) : key;
}
