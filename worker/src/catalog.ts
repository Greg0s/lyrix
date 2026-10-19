import { FIRST_SONG_DAY } from "../../src/game/daily";

export interface CatalogEntry {
  id: string;
  artist: string;
  title: string;
}

// Well-known French-language songs spanning several decades, chosen for being
// easy to find on a crowd-sourced lyrics database. LRCLIB has no "popular
// songs" endpoint, so these lists decide the song of each day: one list per
// calendar month (UTC), as many songs as the month has days, the month's day N
// playing its Nth song. A song is played once, ever.
//
// The month after the current one must always be listed in full (pinned in
// tests/unit/worker/catalog.test.ts, which fails from the 1st of a month until
// the next one is written). Run `npm run catalog:check` on a new list.
//
// An id is a slug of the title. Never change or remove one that has been
// played: a round in progress, or an archived one, names its song by id.
// Spares, should `npm run catalog:check` refuse a song before its day: "Quand
// la musique est bonne" (Jean-Jacques Goldman), "L'Hymne de nos campagnes"
// (Tryo), "Belle" (Garou, Daniel Lavoie, Patrick Fiori), "Andalouse" (Kendji
// Girac).

const OCTOBER_2026: readonly CatalogEntry[] = [
  { id: "la-tribu-de-dana", artist: "Manau", title: "La Tribu de Dana" },
  { id: "elle-a-les-yeux-revolver", artist: "Marc Lavoine", title: "Elle a les yeux revolver" },
  { id: "moi-lolita", artist: "Alizée", title: "Moi... Lolita" },
  { id: "le-sud", artist: "Nino Ferrer", title: "Le Sud" },
  { id: "sauver-lamour", artist: "Daniel Balavoine", title: "Sauver l'amour" },
  { id: "cest-quand-le-bonheur", artist: "Cali", title: "C'est quand le bonheur ?" },
  { id: "il-est-cinq-heures-paris-seveille", artist: "Jacques Dutronc", title: "Il est cinq heures, Paris s'éveille" },
  { id: "le-vent-nous-portera", artist: "Noir Désir", title: "Le vent nous portera" },
  { id: "les-corons", artist: "Pierre Bachelet", title: "Les Corons" },
  { id: "une-belle-histoire", artist: "Michel Fugain", title: "Une belle histoire" },
  { id: "nuit-de-folie", artist: "Début de Soirée", title: "Nuit de folie" },
  { id: "derniere-danse", artist: "Indila", title: "Dernière danse" },
  { id: "les-copains-dabord", artist: "Georges Brassens", title: "Les Copains d'abord" },
  { id: "foule-sentimentale", artist: "Alain Souchon", title: "Foule sentimentale" },
  { id: "femme-liberee", artist: "Cookie Dingler", title: "Femme libérée" },
  { id: "respire", artist: "Mickey 3D", title: "Respire" },
  { id: "lete-indien", artist: "Joe Dassin", title: "L'Été indien" },
  { id: "la-terre-est-ronde", artist: "Orelsan", title: "La Terre est ronde" },
  { id: "les-demons-de-minuit", artist: "Images", title: "Les Démons de minuit" },
  { id: "hier-encore", artist: "Charles Aznavour", title: "Hier encore" },
  { id: "tomber-la-chemise", artist: "Zebda", title: "Tomber la chemise" },
  { id: "ma-philosophie", artist: "Amel Bent", title: "Ma philosophie" },
  { id: "les-mots-bleus", artist: "Christophe", title: "Les Mots bleus" },
  { id: "cendrillon", artist: "Téléphone", title: "Cendrillon" },
  { id: "petit-pays", artist: "Gaël Faye", title: "Petit pays" },
  { id: "pour-que-tu-maimes-encore", artist: "Céline Dion", title: "Pour que tu m'aimes encore" },
  { id: "comme-dhabitude", artist: "Claude François", title: "Comme d'habitude" },
  { id: "tout-le-bonheur-du-monde", artist: "Sinsemilia", title: "Tout le bonheur du monde" },
  { id: "les-lacs-du-connemara", artist: "Michel Sardou", title: "Les Lacs du Connemara" },
  { id: "le-dernier-jour-du-disco", artist: "Juliette Armanet", title: "Le Dernier Jour du disco" },
  { id: "resiste", artist: "France Gall", title: "Résiste" },
];

const NOVEMBER_2026: readonly CatalogEntry[] = [
  { id: "non-je-ne-regrette-rien", artist: "Édith Piaf", title: "Non, je ne regrette rien" },
  { id: "la-vie-en-rose", artist: "Édith Piaf", title: "La Vie en rose" },
  { id: "ne-me-quitte-pas", artist: "Jacques Brel", title: "Ne me quitte pas" },
  { id: "la-boheme", artist: "Charles Aznavour", title: "La Bohème" },
  { id: "le-poinconneur-des-lilas", artist: "Serge Gainsbourg", title: "Le Poinçonneur des Lilas" },
  { id: "ella-elle-la", artist: "France Gall", title: "Ella, elle l'a" },
  { id: "un-autre-monde", artist: "Téléphone", title: "Un autre monde" },
  { id: "laventurier", artist: "Indochine", title: "L'Aventurier" },
  { id: "mistral-gagnant", artist: "Renaud", title: "Mistral gagnant" },
  { id: "la-corrida", artist: "Francis Cabrel", title: "La Corrida" },
  { id: "envole-moi", artist: "Jean-Jacques Goldman", title: "Envole-moi" },
  { id: "desenchantee", artist: "Mylène Farmer", title: "Désenchantée" },
  { id: "casser-la-voix", artist: "Patrick Bruel", title: "Casser la voix" },
  { id: "nes-sous-la-meme-etoile", artist: "IAM", title: "Nés sous la même étoile" },
  { id: "caroline", artist: "MC Solaar", title: "Caroline" },
  { id: "en-apesanteur", artist: "Calogero", title: "En apesanteur" },
  { id: "alors-on-danse", artist: "Stromae", title: "Alors on danse" },
  { id: "papaoutai", artist: "Stromae", title: "Papaoutai" },
  { id: "je-veux", artist: "Zaz", title: "Je veux" },
  { id: "on-sattache", artist: "Christophe Maé", title: "On s'attache" },
  { id: "pas-la", artist: "Vianney", title: "Pas là" },
  { id: "balance-ton-quoi", artist: "Angèle", title: "Balance ton quoi" },
  { id: "avenir", artist: "Louane", title: "Avenir" },
  { id: "la-grenade", artist: "Clara Luciani", title: "La Grenade" },
  { id: "paris-seychelles", artist: "Julien Doré", title: "Paris-Seychelles" },
  { id: "romeo-kiffe-juliette", artist: "Grand Corps Malade", title: "Roméo kiffe Juliette" },
  { id: "dommage", artist: "Bigflo & Oli", title: "Dommage" },
  { id: "on-brulera", artist: "Pomme", title: "On brûlera" },
  { id: "mon-amour", artist: "Slimane", title: "Mon amour" },
  { id: "jai-cherche", artist: "Amir", title: "J'ai cherché" },
];

/**
 * Which list plays when, keyed by UTC month (YYYY-MM), in order and with no
 * month missing from the first one on. The archives replay any of the last 30
 * days, so a month already played is never edited.
 */
export const months: Readonly<Record<string, readonly CatalogEntry[]>> = {
  "2026-10": OCTOBER_2026,
  "2026-11": NOVEMBER_2026,
};

/** Every song the Worker may serve, whatever the day: a round names its song by one of these ids. */
export const catalog: CatalogEntry[] = Object.values(months).flat();

/**
 * The song the Worker falls back to when LRCLIB can't be reached for any
 * catalog entry (its lyrics live in songs.ts). Named here so anything that has
 * to cover every song the Worker can serve — the local KV loader, for one —
 * can do so without importing songs.ts, which only runs inside a Worker.
 */
export const FALLBACK_SONG_ID = "le-refuge-de-novembre";

export { FIRST_SONG_DAY };

/** The UTC month (YYYY-MM) `date` falls in. */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Whether the game had a song on the UTC day `date` falls on. */
export function hasScheduledSong(date: Date): boolean {
  return date.toISOString().slice(0, 10) >= FIRST_SONG_DAY;
}

/**
 * The list playing in a month: its own, or — should a month have gone
 * unlisted despite the test — the last one listed before it, replayed rather
 * than serving nothing. Months before the first one, which no player ever saw,
 * get the first list.
 */
function listOf(month: string): readonly CatalogEntry[] {
  const keys = Object.keys(months).sort();
  let current = keys[0];
  for (const key of keys) {
    if (key <= month) current = key;
  }
  return months[current];
}

/** The day's month list reordered to start at its pick, wrapping around — index 0 is the song of the day, the rest is the fallback order if it can't be resolved. */
export function catalogRotation(date: Date = new Date()): CatalogEntry[] {
  const entries = listOf(monthKey(date));
  const startIndex = (date.getUTCDate() - 1) % entries.length;
  return entries.map((_, index) => entries[(startIndex + index) % entries.length]);
}

/** Deterministic pick for a given date (UTC day boundary), no stored state needed. */
export function pickDailyEntry(date: Date = new Date()): CatalogEntry {
  return catalogRotation(date)[0];
}
