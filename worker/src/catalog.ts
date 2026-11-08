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
// Spares, should `npm run catalog:check` refuse a song before its day: "Belle"
// (Garou, Daniel Lavoie, Patrick Fiori), "Tous les cris les SOS" (Daniel
// Balavoine), "La Seine" (Vanessa Paradis, -M-), "Le Temps de l'amour"
// (Françoise Hardy).

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

const DECEMBER_2026: readonly CatalogEntry[] = [
  { id: "quand-la-musique-est-bonne", artist: "Jean-Jacques Goldman", title: "Quand la musique est bonne" },
  { id: "djadja", artist: "Aya Nakamura", title: "Djadja" },
  { id: "la-javanaise", artist: "Serge Gainsbourg", title: "La Javanaise" },
  { id: "lhymne-de-nos-campagnes", artist: "Tryo", title: "L'Hymne de nos campagnes" },
  { id: "week-end-a-rome", artist: "Étienne Daho", title: "Week-end à Rome" },
  { id: "laigle-noir", artist: "Barbara", title: "L'Aigle noir" },
  { id: "toi-plus-moi", artist: "Grégoire", title: "Toi + Moi" },
  { id: "le-chanteur", artist: "Daniel Balavoine", title: "Le Chanteur" },
  { id: "santiano", artist: "Hugues Aufray", title: "Santiano" },
  { id: "bella", artist: "Maître Gims", title: "Bella" },
  { id: "jai-encore-reve-delle", artist: "Il était une fois", title: "J'ai encore rêvé d'elle" },
  { id: "amsterdam", artist: "Jacques Brel", title: "Amsterdam" },
  { id: "jai-demande-a-la-lune", artist: "Indochine", title: "J'ai demandé à la lune" },
  { id: "mademoiselle-chante-le-blues", artist: "Patricia Kaas", title: "Mademoiselle chante le blues" },
  { id: "andalouse", artist: "Kendji Girac", title: "Andalouse" },
  { id: "les-feuilles-mortes", artist: "Yves Montand", title: "Les Feuilles mortes" },
  { id: "la-groupie-du-pianiste", artist: "Michel Berger", title: "La Groupie du pianiste" },
  { id: "la-boulette", artist: "Diam's", title: "La Boulette" },
  { id: "pour-un-flirt", artist: "Michel Delpech", title: "Pour un flirt" },
  { id: "joe-le-taxi", artist: "Vanessa Paradis", title: "Joe le taxi" },
  { id: "la-montagne", artist: "Jean Ferrat", title: "La Montagne" },
  { id: "sous-le-vent", artist: "Garou & Céline Dion", title: "Sous le vent" },
  { id: "le-bal-masque", artist: "La Compagnie Créole", title: "Le Bal masqué" },
  { id: "emmenez-moi", artist: "Charles Aznavour", title: "Emmenez-moi" },
  { id: "petit-papa-noel", artist: "Tino Rossi", title: "Petit Papa Noël" },
  { id: "christine", artist: "Christine and the Queens", title: "Christine" },
  { id: "les-champs-elysees", artist: "Joe Dassin", title: "Les Champs-Élysées" },
  { id: "il-est-libre-max", artist: "Hervé Cristiani", title: "Il est libre Max" },
  { id: "lettre-a-france", artist: "Michel Polnareff", title: "Lettre à France" },
  { id: "fais-moi-une-place", artist: "Julien Clerc", title: "Fais-moi une place" },
  { id: "allumer-le-feu", artist: "Johnny Hallyday", title: "Allumer le feu" },
];

/**
 * Which list plays when, keyed by UTC month (YYYY-MM), in order and with no
 * month missing from the first one on. The archives replay any of the last 30
 * days, so a month already played is never edited.
 */
export const months: Readonly<Record<string, readonly CatalogEntry[]>> = {
  "2026-10": OCTOBER_2026,
  "2026-11": NOVEMBER_2026,
  "2026-12": DECEMBER_2026,
};

/** Every song the Worker may serve, whatever the day: a round names its song by one of these ids. */
export const catalog: CatalogEntry[] = Object.values(months).flat();

/**
 * The made-up song dev and e2e play when LRCLIB can't be reached (its lyrics
 * live in songs.ts, see SongsEnv.DEV_STANDIN_SONG); never served in
 * production. Named here so anything that has to cover every song a dev
 * Worker can serve - the local KV loader, for one - can do so without
 * importing songs.ts, which only runs inside a Worker.
 */
export const DEV_STANDIN_SONG_ID = "le-refuge-de-novembre";

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
