export interface CatalogEntry {
  id: string;
  artist: string;
  title: string;
}

// Curated starter list of well-known French-language songs spanning several
// decades, chosen for being easy to find on a crowd-sourced lyrics database.
// LRCLIB has no "popular songs" endpoint, so this list is what drives which
// song shows up each day — feel free to edit it.
export const catalog: CatalogEntry[] = [
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

function daysSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/** The catalog reordered to start at today's pick, wrapping around — index 0 is the song of the day, the rest is the fallback order if it can't be resolved. */
export function catalogRotation(date: Date = new Date()): CatalogEntry[] {
  const startIndex = ((daysSinceEpoch(date) % catalog.length) + catalog.length) % catalog.length;
  return catalog.map((_, offset) => catalog[(startIndex + offset) % catalog.length]);
}

/** Deterministic pick for a given date (UTC day boundary): cycles through the whole catalog before repeating, no stored state needed. */
export function pickDailyEntry(date: Date = new Date()): CatalogEntry {
  return catalogRotation(date)[0];
}
