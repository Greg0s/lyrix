// Case- and accent-insensitive form, so e.g. "Étoile" matches "etoile".
export function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
