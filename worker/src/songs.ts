import { ARCHIVE_DAYS, utcDay } from "../../src/game/daily";
import type { Song } from "../../src/game/types";
import { catalog, catalogRotation, DEV_STANDIN_SONG_ID, type CatalogEntry } from "./catalog";
import { getCachedSong, putCachedSong } from "./cache";
import { LrclibUnavailableError } from "./lrclib";
import { resolveFromLrclib } from "./resolveSong";

// How many catalog entries after the day's pick to try when LRCLIB has no
// usable lyrics for it. Only an answer counts: LRCLIB failing to answer never
// moves the day to another song (see getSongOfDay).
const MAX_FALLBACK_ATTEMPTS = 5;

/**
 * Where songs are kept once resolved, and which song each day got: a KV
 * namespace (worker/wrangler.toml), so LRCLIB is asked about a song once,
 * ever, rather than by every new isolate in every datacenter.
 */
export interface SongsKv {
  get(key: string, options?: { cacheTtl?: number }): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface SongsEnv {
  /** Optional: unbound (local dev, tests), songs come from the Cache API and LRCLIB alone, as before. */
  SONGS?: SongsKv;
  /**
   * Dev/e2e only, never set in production: when LRCLIB can't give the day's
   * song, the stand-in below is played instead, so the game still runs where
   * lrclib.net is out of reach (a cloud sandbox). In production that is a
   * 503 the client tries again: a made-up song played for real is how a
   * room spent a morning on it (docs/LEARNINGS.md, 2026-10-18).
   */
  DEV_STANDIN_SONG?: string;
}

/**
 * The day's song couldn't be had: LRCLIB didn't answer, and no copy of it is
 * kept. Answered with a 503, never with another song.
 */
export class SongUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SongUnavailableError";
  }
}

// A song's lyrics never change once resolved: KV's edge cache may keep them as long as it likes.
const SONG_KV_CACHE_TTL_SECONDS = 60 * 60 * 24;

function songKey(id: string): string {
  return `song:${id}`;
}

function dayKey(day: string): string {
  return `day:${day}`;
}

// The stand-in for dev and e2e (see SongsEnv.DEV_STANDIN_SONG). Also opened
// by id under that flag, so a round already in progress on it can still have
// its guesses verified.
const STANDIN_SONG: Song = {
  id: DEV_STANDIN_SONG_ID,
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

/**
 * Each day's song id, once known: read from (or written to) the SONGS
 * namespace once per isolate rather than on every round asked for.
 */
const daySongIds = new Map<string, string>();

/** Drops the isolate's memoized songs. For tests: production never needs it, since a resolved song never changes. */
export function resetSongMemo(): void {
  memoizedSongs.clear();
  resolving.clear();
  daySongIds.clear();
}

function isSongOf(value: unknown, id: string): value is Song {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.id === id &&
    typeof candidate.title === "string" &&
    typeof candidate.artist === "string" &&
    Array.isArray(candidate.sections)
  );
}

/** The copy of a song kept in KV, if any. A namespace that fails to answer is only a missed copy: LRCLIB is next. */
async function storedSong(id: string, env: SongsEnv): Promise<Song | null> {
  if (!env.SONGS) return null;
  try {
    const raw = await env.SONGS.get(songKey(id), { cacheTtl: SONG_KV_CACHE_TTL_SECONDS });
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSongOf(parsed, id) ? parsed : null;
  } catch {
    return null;
  }
}

/** Best effort, like every write here: a failed one only means the next isolate asks again. */
async function store(env: SongsEnv, key: string, value: string): Promise<void> {
  if (!env.SONGS) return;
  try {
    await env.SONGS.put(key, value);
  } catch (error) {
    console.warn(`songs: couldn't write "${key}" to the SONGS namespace`, error);
  }
}

/** Null when LRCLIB has nothing usable for the entry; throws LrclibUnavailableError when it couldn't be asked. */
async function resolve(id: string, entry: CatalogEntry, env: SongsEnv): Promise<Song | null> {
  const cached = await getCachedSong(id);
  if (cached) return memoize(cached);

  const stored = await storedSong(id, env);
  if (stored) {
    await putCachedSong(id, stored);
    return memoize(stored);
  }

  const song = await resolveFromLrclib(entry);
  if (song) {
    await Promise.all([putCachedSong(id, song), store(env, songKey(id), JSON.stringify(song))]);
    return memoize(song);
  }
  return song;
}

/**
 * The song a catalog id names: from this isolate, the Cache API, the SONGS
 * namespace, then LRCLIB. Null for an id nobody can play (not in the catalog,
 * or no usable lyrics on LRCLIB). Throws SongUnavailableError when LRCLIB
 * couldn't be asked: a round on that song is still a round on that song, and
 * its player is told to try again, never that their round is gone.
 */
export async function getSongById(id: string, env: SongsEnv = {}): Promise<Song | null> {
  if (id === STANDIN_SONG.id) return env.DEV_STANDIN_SONG === "1" ? STANDIN_SONG : null;

  const memoized = memoizedSongs.get(id);
  if (memoized) return memoize(memoized);

  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry) return null;

  let pending = resolving.get(id);
  if (!pending) {
    pending = resolve(id, entry, env).finally(() => resolving.delete(id));
    resolving.set(id, pending);
  }
  try {
    return await pending;
  } catch (error) {
    if (!(error instanceof LrclibUnavailableError)) throw error;
    console.warn(`songs: ${error.message}`);
    throw new SongUnavailableError(error.message);
  }
}

/** The song id kept for a day, if one was: once a day has had a song, it keeps it. */
async function pinnedSongId(day: string, env: SongsEnv): Promise<string | null> {
  const known = daySongIds.get(day);
  if (known !== undefined) return known;
  if (!env.SONGS) return null;
  try {
    const id = await env.SONGS.get(dayKey(day));
    if (id !== null) daySongIds.set(day, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * The song of the UTC day `date` falls on: the day's pick or, when LRCLIB has
 * no usable lyrics for it, the next entry of the day's rotation that has.
 * Whichever it was, the day keeps it from then on (SONGS namespace): a day's
 * song never changes once played. Throws SongUnavailableError when LRCLIB
 * can't be asked: moving on to the next entry then would make the day's song
 * depend on LRCLIB's health that hour.
 */
export async function getSongOfDay(date: Date = new Date(), env: SongsEnv = {}): Promise<Song> {
  const day = utcDay(date);
  const pinned = await pinnedSongId(day, env);
  if (pinned !== null) {
    const song = await getSongById(pinned, env);
    if (song) return song;
  }

  const attempts = catalogRotation(date).slice(0, MAX_FALLBACK_ATTEMPTS + 1);
  // Sequential on purpose - LRCLIB asks clients to send requests one at a
  // time rather than in parallel (see https://lrclib.net/docs), and we want
  // to stop at the first success rather than racing speculative lookups.
  for (const entry of attempts) {
    let song: Song | null;
    try {
      song = await getSongById(entry.id, env);
    } catch (error) {
      if (error instanceof SongUnavailableError && env.DEV_STANDIN_SONG === "1") return STANDIN_SONG;
      throw error;
    }
    if (song) {
      if (pinned !== song.id) {
        daySongIds.set(day, song.id);
        await store(env, dayKey(day), song.id);
      }
      return song;
    }
  }
  if (env.DEV_STANDIN_SONG === "1") return STANDIN_SONG;
  throw new SongUnavailableError(`no song of ${day}'s rotation has usable lyrics on LRCLIB`);
}
