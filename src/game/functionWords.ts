/**
 * French function words: articles, pronouns, prepositions, conjunctions, the
 * auxiliaries être and avoir, and the interjections lyrics are full of.
 *
 * They carry grammar, not meaning, and an embedding model shows it: "la", "de"
 * or "et" sit close to nearly every frequent word. Left in, they were the
 * nearest song words of most guesses, so "demain" was shown on "la" rather
 * than on "lendemains" (see docs/LEARNINGS.md, 2026-09-15). The similarity
 * tables therefore never point at them and never place them anywhere; guessing
 * one still reveals it, like any other word of the song.
 *
 * Normalized keys (see normalize.ts), elided forms included, since tokenize.ts
 * splits "j'ai" into "j" and "ai". Deliberately short of most adverbs, which
 * mean something in a song ("toujours", "jamais", "rien", "bien"), and of
 * homographs whose other reading is a real word ("ete", summer; "or", gold).
 * Only the offline build and the dev sample table read it: the frontend never
 * needs to know.
 */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  // Articles, determiners, possessives
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux",
  "ce", "cet", "cette", "ces",
  "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre", "vos", "leur", "leurs",
  "quel", "quelle", "quels", "quelles", "chaque", "quelque", "quelques", "quelqu", "aucun", "aucune",
  "tout", "toute", "tous", "toutes", "plusieurs",
  // Pronouns
  "je", "j", "tu", "t", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "me", "m", "te", "se", "s", "lui", "y", "en", "moi", "toi", "soi", "eux",
  "c", "ca", "cela", "ceci", "celui", "celle", "ceux", "celles",
  "qui", "que", "qu", "quoi", "dont", "ou", "lequel", "laquelle", "lesquels", "lesquelles",
  // Prepositions
  "a", "dans", "par", "pour", "sur", "sous", "avec", "sans", "chez", "vers", "entre", "contre",
  "pendant", "depuis", "avant", "apres", "devant", "derriere", "selon", "malgre", "parmi", "envers",
  "hors", "jusqu", "jusque", "durant", "via", "voici", "voila",
  // Conjunctions
  "et", "mais", "donc", "ni", "car", "quand", "lorsque", "lorsqu", "puisque", "puisqu", "quoique", "quoiqu",
  "comme", "si", "parce", "tandis",
  // Negation and grammatical adverbs
  "ne", "n", "pas", "plus", "moins", "tres", "trop", "peu", "aussi", "encore", "deja", "ici", "alors",
  "ainsi", "puis", "ensuite", "oui", "non", "meme", "tant", "tellement", "assez", "beaucoup", "seulement",
  "vraiment", "comment", "pourquoi", "combien",
  // Être and avoir
  "etre", "suis", "es", "est", "sommes", "etes", "sont", "etais", "etait", "etions", "etiez", "etaient",
  "sera", "seras", "serai", "serons", "serez", "seront", "serais", "serait", "serions", "seriez", "seraient",
  "soit", "sois", "soient", "soyons", "soyez", "fut", "fus", "furent", "etant",
  "avoir", "ai", "as", "avons", "avez", "ont", "avais", "avait", "avions", "aviez", "avaient",
  "eu", "eue", "eus", "eut", "aura", "aurai", "auras", "aurons", "aurez", "auront",
  "aurais", "aurait", "aurions", "auriez", "auraient", "ait", "aie", "aies", "aient", "ayant",
  // Interjections
  "oh", "ah", "eh", "hey", "ho", "ouh", "ouais", "yeah", "hein", "bah", "ben",
]);

export function isFunctionWord(key: string): boolean {
  return FUNCTION_WORDS.has(key);
}
