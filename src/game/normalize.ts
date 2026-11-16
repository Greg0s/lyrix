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
