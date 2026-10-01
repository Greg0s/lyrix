import { FIRST_SONG_DAY } from "../../src/game/daily";

export interface CatalogEntry {
  id: string;
  artist: string;
  title: string;
}

// Well-known French-language songs spanning several decades, chosen for being
// easy to find on a crowd-sourced lyrics database. LRCLIB has no "popular
// songs" endpoint, so these lists, played in the order the schedule below
// sets, are what decides the song of each day.
//
// An id is a slug of the title. Never change or remove one that has been
// played: a round in progress, or an archived one, names its song by id.

// The first list, played since launch.
const LAUNCH_SONGS: readonly CatalogEntry[] = [
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

// Joined on 2026-10-12, so the archives (the last 30 days) never hold
// tomorrow's song: with only the 30 songs above, the oldest day in the window
// would always be the song coming back the next day. Decades interleaved, so
// two days running rarely sound alike. Spares, should `npm run catalog:check`
// refuse one of these before that date: "Nuit de folie" (Début de Soirée),
// "Quand la musique est bonne" (Jean-Jacques Goldman), "L'Hymne de nos
// campagnes" (Tryo), "Belle" (Garou, Daniel Lavoie, Patrick Fiori),
// "Andalouse" (Kendji Girac).
const OCTOBER_2026_SONGS: readonly CatalogEntry[] = [
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
];

/** Every song the Worker may serve, whatever the day: a round names its song by one of these ids. */
export const catalog: CatalogEntry[] = [...LAUNCH_SONGS, ...OCTOBER_2026_SONGS];

/**
 * The song the Worker falls back to when LRCLIB can't be reached for any
 * catalog entry (its lyrics live in songs.ts). Named here so anything that has
 * to cover every song the Worker can serve — the local KV loader, for one —
 * can do so without importing songs.ts, which only runs inside a Worker.
 */
export const FALLBACK_SONG_ID = "le-refuge-de-novembre";

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 of the UTC day `date` falls on. */
function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

function parseDay(day: string): number {
  return dayNumber(new Date(`${day}T00:00:00Z`));
}

/**
 * A run of days that plays one list of songs, in order, wrapping around: the
 * day `anchor` plays `entries[0]`, the next day `entries[1]`, and so on.
 */
export interface ScheduleSegment {
  /** The first UTC day (YYYY-MM-DD) it plays; it lasts until the next segment's. */
  from: string;
  anchor: string;
  entries: readonly CatalogEntry[];
}

/**
 * Which list plays when. The archives replay any of the last 30 days, so the
 * song of a day that has been played must never change: a new song is never
 * slipped into a list already playing (every later day would shift), it
 * joins a new segment starting on a day not yet played. Pinned day by day in
 * tests/unit/worker/catalog.test.ts.
 */
export const schedule: readonly ScheduleSegment[] = [
  // The launch formula, unchanged: days since the epoch, modulo the list. The
  // game went live late on 2026-09-11 (UTC), so the 12th is its first full day.
  { from: FIRST_SONG_DAY, anchor: "1970-01-01", entries: LAUNCH_SONGS },
  // The new songs first, so that none of the next 30 days repeats a song the
  // archives still hold; then the whole catalog comes round every 60 days.
  { from: "2026-10-12", anchor: "2026-10-12", entries: [...OCTOBER_2026_SONGS, ...LAUNCH_SONGS] },
];

export { FIRST_SONG_DAY };

/** Whether the game had a song on the UTC day `date` falls on. */
export function hasScheduledSong(date: Date): boolean {
  return dayNumber(date) >= parseDay(FIRST_SONG_DAY);
}

/** The segment playing on a given day: the first one for days before it, which no player ever saw. */
function segmentOn(day: number): ScheduleSegment {
  let current = schedule[0];
  for (const segment of schedule) {
    if (parseDay(segment.from) <= day) current = segment;
  }
  return current;
}

/** The day's list reordered to start at its pick, wrapping around — index 0 is the song of the day, the rest is the fallback order if it can't be resolved. */
export function catalogRotation(date: Date = new Date()): CatalogEntry[] {
  const day = dayNumber(date);
  const { anchor, entries } = segmentOn(day);
  const offset = day - parseDay(anchor);
  const startIndex = ((offset % entries.length) + entries.length) % entries.length;
  return entries.map((_, index) => entries[(startIndex + index) % entries.length]);
}

/** Deterministic pick for a given date (UTC day boundary), no stored state needed. */
export function pickDailyEntry(date: Date = new Date()): CatalogEntry {
  return catalogRotation(date)[0];
}
