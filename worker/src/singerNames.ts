/**
 * Who a player is called in a room when they left "Ton pseudo" empty: a French-speaking
 * singer, drawn at random. Each name fits PSEUDO_MAX_LENGTH and is already what
 * `sanitizePseudo` would keep (tests/unit/worker/singerNames.test.ts).
 */
export const MALE_SINGERS: readonly string[] = [
  "Charles Aznavour",
  "Jacques Brel",
  "Georges Brassens",
  "Léo Ferré",
  "Serge Gainsbourg",
  "Johnny Hallyday",
  "Claude François",
  "Joe Dassin",
  "Michel Sardou",
  "Renaud",
  "Alain Souchon",
  "Laurent Voulzy",
  "Francis Cabrel",
  "Daniel Balavoine",
  "Michel Berger",
  "Jean Ferrat",
  "Gilbert Bécaud",
  "Yves Montand",
  "Henri Salvador",
  "Charles Trenet",
  "Julien Doré",
  "Julien Clerc",
  "Eddy Mitchell",
  "Michel Polnareff",
  "Christophe",
  "Étienne Daho",
  "Alain Bashung",
  "Benjamin Biolay",
  "Vianney",
  "Calogero",
  "Pascal Obispo",
  "Patrick Bruel",
  "Florent Pagny",
  "Hervé Vilard",
  "Michel Delpech",
  "Nino Ferrer",
  "Guy Béart",
  "Bénabar",
  "Matthieu Chedid",
  "Stromae",
  "Soprano",
  "Orelsan",
  "MC Solaar",
  "Oxmo Puccino",
  "Kendji Girac",
  "Pierre Perret",
  "Marc Lavoine",
  "Bertrand Cantat",
  "Gaëtan Roussel",
  "J-J Goldman",
];

export const FEMALE_SINGERS: readonly string[] = [
  "Édith Piaf",
  "Barbara",
  "Dalida",
  "Françoise Hardy",
  "Sylvie Vartan",
  "Mireille Mathieu",
  "Juliette Gréco",
  "Régine",
  "Nana Mouskouri",
  "Céline Dion",
  "Lara Fabian",
  "Patricia Kaas",
  "Véronique Sanson",
  "Isabelle Boulay",
  "Zazie",
  "Vanessa Paradis",
  "Alizée",
  "Jenifer",
  "Amel Bent",
  "Camille",
  "Louane",
  "Angèle",
  "Zaz",
  "Yelle",
  "Clara Luciani",
  "Vitaa",
  "Indila",
  "Aya Nakamura",
  "Hoshi",
  "Pomme",
  "Jain",
  "Juliette Armanet",
  "Catherine Ringer",
  "Catherine Lara",
  "Sheila",
  "Chantal Goya",
  "France Gall",
  "Jane Birkin",
  "Nicoletta",
  "Mylène Farmer",
  "Axelle Red",
  "Natasha St-Pier",
  "Diam's",
  "Hélène Ségara",
  "Nolwenn Leroy",
  "Cœur de pirate",
  "Anne Sylvestre",
  "Marie Laforêt",
  "Joyce Jonathan",
  "Barbara Pravi",
];

const SINGERS: readonly string[] = [...MALE_SINGERS, ...FEMALE_SINGERS];

/** A uniform integer in [0, bound), by rejection sampling so no name is likelier than another. */
function randomBelow(bound: number): number {
  const limit = 0x100000000 - (0x100000000 % bound);
  const draw = new Uint32Array(1);
  do {
    crypto.getRandomValues(draw);
  } while (draw[0] >= limit);
  return draw[0] % bound;
}

/**
 * A singer no one in the room already goes by (compared ignoring case), or null
 * when every name is taken: the member is then "Joueur N", like before.
 */
export function pickSingerName(taken: Iterable<string | null>): string | null {
  const used = new Set<string>();
  for (const name of taken) if (name) used.add(name.toLowerCase());
  const free = SINGERS.filter((name) => !used.has(name.toLowerCase()));
  return free.length === 0 ? null : free[randomBelow(free.length)];
}
