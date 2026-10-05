import { ARCHIVE_DAYS } from "../../src/game/daily";
import type { Song } from "../../src/game/types";
import { catalog, catalogRotation, FALLBACK_SONG_ID, type CatalogEntry } from "./catalog";
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
  id: FALLBACK_SONG_ID,
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

// Songs resolved by this isolate, on top of the (cross-isolate, cross-colo)
// Cache API layer. Two reasons, both about the request path rather than about
// LRCLIB: a Cache API hit still costs a lookup plus a JSON parse of the whole
// lyrics on every single guess, and a freshly parsed object would also defeat
// the per-song analysis cache (see src/game/analyze.ts), making every guess
// re-tokenize the song. Keeping one object per id gives both layers something
// stable to hang on to.
//
// A song's lyrics never change once resolved, so there is no invalidation: a
// new isolate is the refresh. Bounded anyway, least recently used first out:
// the archives put a song of each of the last ARCHIVE_DAYS days in play, plus
// a fallback or two. A song is a few kilobytes of text.
const MAX_MEMOIZED_SONGS = ARCHIVE_DAYS + 4;

/** By id, least recently used first (a Map iterates in insertion order, and a hit is re-inserted). */
const memoizedSongs = new Map<string, Song>();

function memoize(song: Song): Song {
  memoizedSongs.delete(song.id);
  memoizedSongs.set(song.id, song);
  // Map iterates in insertion order, so the first key is the oldest entry.
  if (memoizedSongs.size > MAX_MEMOIZED_SONGS) {
    const oldest = memoizedSongs.keys().next();
    if (!oldest.done) memoizedSongs.delete(oldest.value);
  }
  return song;
}

/**
 * Songs being resolved right now, by id. A cold isolate can be handed several
 * requests for the same song at once - above all at UTC midnight, when every
 * player moves to the new one and no cache holds it yet - and each used to
 * run its own Cache API lookup and LRCLIB search. They now share the first
 * one's. Dropped once settled: a song that couldn't be resolved is tried
 * again by the next request, as before.
 */
const resolving = new Map<string, Promise<Song | null>>();

/** Drops the isolate's memoized songs. For tests: production never needs it, since a resolved song never changes. */
export function resetSongMemo(): void {
  memoizedSongs.clear();
  resolving.clear();
}

async function resolve(id: string, entry: CatalogEntry): Promise<Song | null> {
  const cached = await getCachedSong(id);
  if (cached) return memoize(cached);

  const song = await resolveFromLrclib(entry);
  if (song) {
    await putCachedSong(id, song);
    return memoize(song);
  }
  return song;
}

export async function getSongById(id: string): Promise<Song | null> {
  if (id === EMERGENCY_FALLBACK_SONG.id) return EMERGENCY_FALLBACK_SONG;

  const memoized = memoizedSongs.get(id);
  if (memoized) return memoize(memoized);

  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry) return null;

  const pending = resolving.get(id);
  if (pending) return pending;
  const resolution = resolve(id, entry).finally(() => resolving.delete(id));
  resolving.set(id, resolution);
  return resolution;
}

/** The song of the UTC day `date` falls on, falling back along that day's rotation when LRCLIB fails for its pick. */
export async function getSongOfDay(date: Date = new Date()): Promise<Song> {
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
