import type { HintId } from "../../src/game/types";
import { DEV_STANDIN_SONG_ID } from "./catalog";

/**
 * What each song's hints say (src/game/hints.ts), by catalog id. Server-only,
 * like the lyrics: a hint's text is sent only once its hint is revealed, or
 * once the round is won. Curated by hand: LRCLIB knows no year, genre or
 * artist. Every catalog id needs an entry, and no hint may share a word with
 * its song's title or artist (tests/unit/worker/songFacts.test.ts). A song
 * with no entry simply has no hints.
 */

/** A solo artist (by gender, as French writes "un artiste" or "une artiste"), a group or a duo. */
export type ArtistKind = "man" | "woman" | "group" | "duo";

/** Where the artist is from, as the hint's adjective says it. */
export type ArtistOrigin = "fr" | "be" | "qc" | "fr-rw";

export type SongStyle =
  | "Chanson"
  | "Variété"
  | "Pop"
  | "Rock"
  | "Rap"
  | "Slam"
  | "Électro"
  | "Folk"
  | "Reggae"
  | "R'n'B";

export interface SongFacts {
  /** Release year; the hint shows its decade. */
  year: number;
  artist: ArtistKind;
  origin: ArtistOrigin;
  style: SongStyle;
}

const ORIGIN_ADJECTIVES: Readonly<Record<ArtistOrigin, { masculine: string; feminine: string }>> = {
  fr: { masculine: "français", feminine: "française" },
  be: { masculine: "belge", feminine: "belge" },
  qc: { masculine: "québécois", feminine: "québécoise" },
  "fr-rw": { masculine: "franco-rwandais", feminine: "franco-rwandaise" },
};

export const SONG_FACTS: Readonly<Record<string, SongFacts>> = {
  "non-je-ne-regrette-rien": { year: 1960, artist: "woman", origin: "fr", style: "Chanson" },
  "la-vie-en-rose": { year: 1947, artist: "woman", origin: "fr", style: "Chanson" },
  "ne-me-quitte-pas": { year: 1959, artist: "man", origin: "be", style: "Chanson" },
  "la-boheme": { year: 1965, artist: "man", origin: "fr", style: "Chanson" },
  "le-poinconneur-des-lilas": { year: 1958, artist: "man", origin: "fr", style: "Chanson" },
  "ella-elle-la": { year: 1987, artist: "woman", origin: "fr", style: "Pop" },
  "un-autre-monde": { year: 1984, artist: "group", origin: "fr", style: "Rock" },
  laventurier: { year: 1982, artist: "group", origin: "fr", style: "Rock" },
  "mistral-gagnant": { year: 1985, artist: "man", origin: "fr", style: "Chanson" },
  "la-corrida": { year: 1994, artist: "man", origin: "fr", style: "Chanson" },
  "envole-moi": { year: 1984, artist: "man", origin: "fr", style: "Pop" },
  desenchantee: { year: 1991, artist: "woman", origin: "fr", style: "Pop" },
  "casser-la-voix": { year: 1989, artist: "man", origin: "fr", style: "Variété" },
  "nes-sous-la-meme-etoile": { year: 1997, artist: "group", origin: "fr", style: "Rap" },
  caroline: { year: 1991, artist: "man", origin: "fr", style: "Rap" },
  "en-apesanteur": { year: 2002, artist: "man", origin: "fr", style: "Pop" },
  "alors-on-danse": { year: 2009, artist: "man", origin: "be", style: "Électro" },
  papaoutai: { year: 2013, artist: "man", origin: "be", style: "Pop" },
  "je-veux": { year: 2010, artist: "woman", origin: "fr", style: "Chanson" },
  "on-sattache": { year: 2007, artist: "man", origin: "fr", style: "Pop" },
  "pas-la": { year: 2014, artist: "man", origin: "fr", style: "Pop" },
  "balance-ton-quoi": { year: 2019, artist: "woman", origin: "be", style: "Pop" },
  avenir: { year: 2014, artist: "woman", origin: "fr", style: "Pop" },
  "la-grenade": { year: 2018, artist: "woman", origin: "fr", style: "Pop" },
  "paris-seychelles": { year: 2013, artist: "man", origin: "fr", style: "Pop" },
  "romeo-kiffe-juliette": { year: 2010, artist: "man", origin: "fr", style: "Slam" },
  dommage: { year: 2017, artist: "duo", origin: "fr", style: "Rap" },
  "on-brulera": { year: 2017, artist: "woman", origin: "fr", style: "Folk" },
  "mon-amour": { year: 2024, artist: "man", origin: "fr", style: "Variété" },
  "jai-cherche": { year: 2016, artist: "man", origin: "fr", style: "Pop" },
  "derniere-danse": { year: 2013, artist: "woman", origin: "fr", style: "Pop" },
  "les-copains-dabord": { year: 1964, artist: "man", origin: "fr", style: "Chanson" },
  "foule-sentimentale": { year: 1993, artist: "man", origin: "fr", style: "Chanson" },
  "femme-liberee": { year: 1984, artist: "group", origin: "fr", style: "Pop" },
  respire: { year: 2003, artist: "group", origin: "fr", style: "Rock" },
  "lete-indien": { year: 1975, artist: "man", origin: "fr", style: "Variété" },
  "la-terre-est-ronde": { year: 2011, artist: "man", origin: "fr", style: "Rap" },
  "les-demons-de-minuit": { year: 1986, artist: "group", origin: "fr", style: "Pop" },
  "hier-encore": { year: 1964, artist: "man", origin: "fr", style: "Chanson" },
  "tomber-la-chemise": { year: 1998, artist: "group", origin: "fr", style: "Rock" },
  "ma-philosophie": { year: 2004, artist: "woman", origin: "fr", style: "R'n'B" },
  "les-mots-bleus": { year: 1974, artist: "man", origin: "fr", style: "Variété" },
  cendrillon: { year: 1982, artist: "group", origin: "fr", style: "Rock" },
  "petit-pays": { year: 2013, artist: "man", origin: "fr-rw", style: "Rap" },
  "pour-que-tu-maimes-encore": { year: 1995, artist: "woman", origin: "qc", style: "Pop" },
  "comme-dhabitude": { year: 1967, artist: "man", origin: "fr", style: "Variété" },
  "tout-le-bonheur-du-monde": { year: 2004, artist: "group", origin: "fr", style: "Reggae" },
  "les-lacs-du-connemara": { year: 1981, artist: "man", origin: "fr", style: "Variété" },
  // Pop, not disco: the title has the word.
  "le-dernier-jour-du-disco": { year: 2021, artist: "woman", origin: "fr", style: "Pop" },
  resiste: { year: 1981, artist: "woman", origin: "fr", style: "Pop" },
  "la-tribu-de-dana": { year: 1998, artist: "group", origin: "fr", style: "Rap" },
  "elle-a-les-yeux-revolver": { year: 1985, artist: "man", origin: "fr", style: "Pop" },
  "moi-lolita": { year: 2000, artist: "woman", origin: "fr", style: "Pop" },
  "le-sud": { year: 1975, artist: "man", origin: "fr", style: "Chanson" },
  "sauver-lamour": { year: 1985, artist: "man", origin: "fr", style: "Pop" },
  "cest-quand-le-bonheur": { year: 2005, artist: "man", origin: "fr", style: "Chanson" },
  "il-est-cinq-heures-paris-seveille": { year: 1968, artist: "man", origin: "fr", style: "Pop" },
  "le-vent-nous-portera": { year: 2001, artist: "group", origin: "fr", style: "Rock" },
  "les-corons": { year: 1982, artist: "man", origin: "fr", style: "Variété" },
  "une-belle-histoire": { year: 1972, artist: "man", origin: "fr", style: "Variété" },
  // The made-up song dev and e2e play (songs.ts): never served in production.
  [DEV_STANDIN_SONG_ID]: { year: 1996, artist: "woman", origin: "fr", style: "Chanson" },
};

/** "Années 60", "Années 2000": how French names a decade, the twentieth century's by its last two digits. */
export function decadeText(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `Années ${decade < 2000 ? String(decade % 100).padStart(2, "0") : decade}`;
}

/** "Un artiste français", "Une artiste belge", "Un groupe français", "Un duo français". */
export function artistTypeText({ artist, origin }: Pick<SongFacts, "artist" | "origin">): string {
  const { masculine, feminine } = ORIGIN_ADJECTIVES[origin];
  if (artist === "woman") return `Une artiste ${feminine}`;
  if (artist === "group") return `Un groupe ${masculine}`;
  if (artist === "duo") return `Un duo ${masculine}`;
  return `Un artiste ${masculine}`;
}

/** Every hint's text for a song; null for a song with no facts, which has no hints. */
export function hintValues(songId: string): Record<HintId, string> | null {
  if (!Object.prototype.hasOwnProperty.call(SONG_FACTS, songId)) return null;
  const facts = SONG_FACTS[songId] as SongFacts;
  return { era: decadeText(facts.year), artistType: artistTypeText(facts), style: facts.style };
}
