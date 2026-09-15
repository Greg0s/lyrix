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
