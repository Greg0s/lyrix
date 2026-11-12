import { Hono } from "hono";
import { catalog } from "./catalog";
import { bestDeezerMatch, DeezerUnavailableError, fetchDeezerImage, searchDeezer } from "./deezer";
import type { SongsEnv } from "./songs";

/**
 * A song's album cover, shown on the victory panel (TitleGuess), and its
 * Deezer track, kept for the extract a later version will play. Found on
 * Deezer once, ever, by the Worker (deezer.ts), then kept in the SONGS
 * namespace next to the song's lyrics (`media:<id>`), and served by the
 * Worker itself: a player's browser never asks anyone but the site and its
 * Worker for anything (tests/e2e/privacy.spec.ts).
 *
 * A cover names its song, so it only ever reaches a player who won it: a
 * view carries its address (RoundView.cover) only once `victory` is true,
 * and that address names the song by a token nobody can make up or read -
 * a MAC of its id under STATE_SECRET, the same for every player, so the
 * browser keeps the image for good.
 */

export interface CoverEnv extends SongsEnv {
  STATE_SECRET: string;
}

/** What is kept of a song's media: its Deezer track (null: Deezer has none), and its cover when the track has one. */
export interface SongMedia {
  deezer: { trackId: number; albumId: number } | null;
  cover?: { contentType: string; base64: string };
}

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function mediaKey(id: string): string {
  return `media:${id}`;
}

function isSongMedia(value: unknown): value is SongMedia {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const deezer = candidate.deezer as Record<string, unknown> | null | undefined;
  const cover = candidate.cover as Record<string, unknown> | undefined;
  return (
    (deezer === null ||
      (typeof deezer === "object" && typeof deezer.trackId === "number" && typeof deezer.albumId === "number")) &&
    (cover === undefined ||
      (typeof cover === "object" &&
        cover !== null &&
        typeof cover.contentType === "string" &&
        typeof cover.base64 === "string"))
  );
}

// ---------- Tokens ----------

/** How many bytes of the MAC a token keeps: 128 bits, more than enough to never be guessed. */
const TOKEN_BYTES = 16;

const macKeys = new Map<string, Promise<CryptoKey>>();
/** Every catalog song's token, by secret: the route's way back from a token to its song. */
const tokenMaps = new Map<string, Promise<Map<string, string>>>();
/** Each song's token, by secret then id. */
const tokens = new Map<string, Map<string, Promise<string>>>();

function macKey(secret: string): Promise<CryptoKey> {
  let key = macKeys.get(secret);
  if (!key) {
    // Its own key, derived apart from the round state's (state.ts): a token is no use against a state.
    key = crypto.subtle
      .importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"])
      .then((material) =>
        crypto.subtle.deriveKey(
          { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: encoder.encode("lyrix cover v1") },
          material,
          { name: "HMAC", hash: "SHA-256", length: 256 },
          false,
          ["sign"]
        )
      );
    key.catch(() => macKeys.delete(secret));
    macKeys.set(secret, key);
  }
  return key;
}

/** The token a won round's cover is asked for by: the same for every player, and for ever. */
export function coverToken(songId: string, secret: string): Promise<string> {
  let bySong = tokens.get(secret);
  if (!bySong) {
    bySong = new Map();
    tokens.set(secret, bySong);
  }
  let token = bySong.get(songId);
  if (!token) {
    token = macKey(secret).then(async (key) => {
      const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(songId));
      return toBase64Url(new Uint8Array(mac).subarray(0, TOKEN_BYTES));
    });
    bySong.set(songId, token);
  }
  return token;
}

/** The catalog song a token stands for, or null. */
export async function songOfCoverToken(token: string, secret: string): Promise<string | null> {
  let map = tokenMaps.get(secret);
  if (!map) {
    map = Promise.all(catalog.map(async (entry) => [await coverToken(entry.id, secret), entry.id] as const)).then(
      (pairs) => new Map(pairs)
    );
    tokenMaps.set(secret, map);
  }
  return (await map).get(token) ?? null;
}

/** Whether a song can have a cover at all: only a catalog song is ever looked up (never dev's stand-in). */
export function hasCoverLookup(songId: string): boolean {
  return catalog.some((entry) => entry.id === songId);
}

// ---------- Media ----------

/** Media this isolate holds, by song id; a cover is a few tens of kilobytes. Bounded, least recently used out. */
const memoizedMedia = new Map<string, SongMedia>();
const MAX_MEMOIZED_MEDIA = 40;
const resolvingMedia = new Map<string, Promise<SongMedia | null>>();

/** For tests: drops every memo above. */
export function resetCoverMemo(): void {
  macKeys.clear();
  tokenMaps.clear();
  tokens.clear();
  memoizedMedia.clear();
  resolvingMedia.clear();
}

function memoize(id: string, media: SongMedia): SongMedia {
  memoizedMedia.delete(id);
  memoizedMedia.set(id, media);
  if (memoizedMedia.size > MAX_MEMOIZED_MEDIA) {
    const oldest = memoizedMedia.keys().next();
    if (!oldest.done) memoizedMedia.delete(oldest.value);
  }
  return media;
}

// A song's media never change once found: KV's edge cache may keep them as long as it likes.
const MEDIA_KV_CACHE_TTL_SECONDS = 60 * 60 * 24;

async function storedMedia(id: string, env: SongsEnv): Promise<SongMedia | null> {
  if (!env.SONGS) return null;
  try {
    const raw = await env.SONGS.get(mediaKey(id), { cacheTtl: MEDIA_KV_CACHE_TTL_SECONDS });
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSongMedia(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function findMedia(id: string, env: SongsEnv): Promise<SongMedia | null> {
  const stored = await storedMedia(id, env);
  if (stored) return memoize(id, stored);

  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry) return null;
  const track = bestDeezerMatch(await searchDeezer(entry), entry);
  const media: SongMedia = { deezer: track ? { trackId: track.id, albumId: track.albumId } : null };
  if (track?.cover) {
    const image = await fetchDeezerImage(id, track.cover);
    media.cover = { contentType: image.contentType, base64: toBase64(new Uint8Array(image.bytes)) };
  }
  if (env.SONGS) {
    try {
      await env.SONGS.put(mediaKey(id), JSON.stringify(media));
    } catch (error) {
      console.warn(`covers: couldn't write "${mediaKey(id)}" to the SONGS namespace`, error);
    }
  }
  return memoize(id, media);
}

/**
 * A catalog song's media: from this isolate, the SONGS namespace, then
 * Deezer, kept once found (a track Deezer doesn't have included). Null for a
 * song outside the catalog. Throws DeezerUnavailableError when Deezer
 * couldn't be asked: nothing is kept then, and the next request tries again.
 */
export async function getSongMedia(id: string, env: SongsEnv): Promise<SongMedia | null> {
  const memoized = memoizedMedia.get(id);
  if (memoized) return memoize(id, memoized);
  let pending = resolvingMedia.get(id);
  if (!pending) {
    pending = findMedia(id, env).finally(() => resolvingMedia.delete(id));
    resolvingMedia.set(id, pending);
  }
  return pending;
}

/**
 * The scheduled run's part (index.ts): the media of the songs the run just
 * prepared, so a cover is ready before its day. Stops at the first Deezer
 * failure, like the songs' run at LRCLIB's; a song Deezer doesn't have is
 * logged, for the catalog's next check. Never throws.
 */
export async function prepareCovers(songIds: readonly string[], env: SongsEnv): Promise<void> {
  for (const id of new Set(songIds)) {
    try {
      const media = await getSongMedia(id, env);
      if (media && !media.cover) console.warn(`covers: Deezer has no cover for "${id}": its panel shows the year alone.`);
    } catch (error) {
      if (error instanceof DeezerUnavailableError) {
        console.warn(`covers: ${error.message}`);
        return;
      }
      console.error(`covers: preparing "${id}" failed`, error);
    }
  }
}

// ---------- Route ----------

/** How long a cover may be kept: for ever, its address changing with its song. */
const COVER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
/** How long "no cover" may be kept: a day, in case a later look finds one. */
const NO_COVER_MAX_AGE_SECONDS = 60 * 60 * 24;
const COVER_RETRY_AFTER_SECONDS = 30;

export const coverRoutes = new Hono<{ Bindings: CoverEnv }>();

// GET /api/cover/<token>: a won round's cover (RoundView.cover). An unknown
// token and a song without a cover get the same 404, and the panel keeps its
// own sleeve, the song's year on it.
coverRoutes.get("/:token", async (c) => {
  const id = await songOfCoverToken(c.req.param("token"), c.env.STATE_SECRET);
  let media: SongMedia | null = null;
  if (id !== null) {
    try {
      media = await getSongMedia(id, c.env);
    } catch (error) {
      if (!(error instanceof DeezerUnavailableError)) throw error;
      console.warn(`covers: ${error.message}`);
      c.header("Retry-After", String(COVER_RETRY_AFTER_SECONDS));
      c.header("Cache-Control", "no-store");
      return c.json({ error: "the cover is unavailable, try again" }, 503);
    }
  }
  if (!media?.cover) {
    c.header("Cache-Control", `public, max-age=${NO_COVER_MAX_AGE_SECONDS}`);
    return c.json({ error: "no cover" }, 404);
  }
  return new Response(fromBase64(media.cover.base64), {
    headers: {
      "Content-Type": media.cover.contentType,
      "Cache-Control": `public, max-age=${COVER_MAX_AGE_SECONDS}, immutable`,
    },
  });
});
