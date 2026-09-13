import type { Song } from "../../src/game/types";
import { catalog, catalogRotation } from "./catalog";
import { getCachedSong, putCachedSong } from "./cache";
import { resolveFromLrclib } from "./resolveSong";

// How many catalog entries after the day's pick to try before giving up on
// LRCLIB entirely for the day. Bounds the worst-case latency of a full outage
// (each attempt is a real HTTP round trip) while still tolerating a handful
// of individually unavailable songs.
const MAX_FALLBACK_ATTEMPTS = 5;

// Last-resort song, used only if LRCLIB can't be resolved for the daily pick
// or any of its fallbacks, so `/api/round` never fails outright. Also handled
// directly in getSongById so a round already in progress on this song can
// still have its guesses verified.
const EMERGENCY_FALLBACK_SONG: Song = {
  id: "le-refuge-de-novembre",
  title: "Le refuge de novembre",
  artist: "Anaïs Verger",
  sections: [
    {
      label: "Couplet 1",
      lines: [
        "Le vent referme la porte du jardin,",
        "Les feuilles tombent, doucement, sans bruit.",
        "Je rentre à pas lents dans la maison,",
        "La lampe s'allume au bout du couloir.",
      ],
    },
    {
      label: "Refrain",
      lines: [
        "On est bien, on est là,",
        "Le monde attendra demain.",
        "Le refuge de novembre",
        "Nous garde jusqu'au matin.",
      ],
    },
    {
      label: "Couplet 2",
      lines: [
        "Le thé fume encore sur la table basse,",
        "Les mots se posent, tranquilles, sans façon.",
        "Dehors la ville s'endort sous la pluie,",
        "Ici dedans, rien ne presse, rien ne casse.",
      ],
    },
  ],
};

export async function getSongById(id: string): Promise<Song | null> {
  if (id === EMERGENCY_FALLBACK_SONG.id) return EMERGENCY_FALLBACK_SONG;

  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry) return null;

  const cached = await getCachedSong(id);
  if (cached) return cached;

  const song = await resolveFromLrclib(entry);
  if (song) await putCachedSong(id, song);
  return song;
}

export async function getTodaysSong(date: Date = new Date()): Promise<Song> {
  const attempts = catalogRotation(date).slice(0, MAX_FALLBACK_ATTEMPTS + 1);
  // Sequential on purpose - LRCLIB asks clients to send requests one at a
  // time rather than in parallel (see https://lrclib.net/docs), and we want
  // to stop at the first success rather than racing speculative lookups.
  for (const entry of attempts) {
    const song = await getSongById(entry.id);
    if (song) return song;
  }
  return EMERGENCY_FALLBACK_SONG;
}
