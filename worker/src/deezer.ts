import { normalize } from "../../src/game/normalize";
import type { CatalogEntry } from "./catalog";

/**
 * Deezer's public API (https://developers.deezer.com/api), asked by the
 * Worker alone - never by a player's browser, which only ever talks to the
 * site and its Worker (CLAUDE.md, "No consent banner"). One search finds a
 * catalog song's track: its album cover, shown once the round is won, and its
 * track id, kept for the 30-second extract a later version will play (Deezer
 * signs a preview's address for a limited time, so the id is what lasts).
 * No key is needed.
 */

const SEARCH_URL = "https://api.deezer.com/search";

/** Only the fields we use, validated rather than cast: the API's answer is someone else's data. */
export interface DeezerTrack {
  id: number;
  title: string;
  artist: string;
  albumId: number;
  /** Set on another take of the song ("(Live)", "(Remasterisé en 2009)"): its title_version. */
  version: string;
  /** The album's cover, 250x250 JPEG: three times the size the victory panel shows it at. */
  cover: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Only https addresses on Deezer's own image hosts: the Worker fetches what this returns. */
function isDeezerImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "dzcdn.net" || url.hostname.endsWith(".dzcdn.net"));
  } catch {
    return false;
  }
}

export function parseDeezerTrack(value: unknown): DeezerTrack | null {
  const candidate = record(value);
  const artist = record(candidate?.artist);
  const album = record(candidate?.album);
  if (!candidate || !artist || !album) return null;
  if (typeof candidate.id !== "number" || typeof candidate.title !== "string") return null;
  if (typeof artist.name !== "string" || typeof album.id !== "number") return null;
  return {
    id: candidate.id,
    title: typeof candidate.title_short === "string" ? candidate.title_short : candidate.title,
    artist: artist.name,
    albumId: album.id,
    version: typeof candidate.title_version === "string" ? candidate.title_version.trim() : "",
    cover: isDeezerImage(album.cover_medium) ? album.cover_medium : null,
  };
}

/**
 * Deezer couldn't be asked: the network failed, it took too long, it answered
 * with an error, or with its quota error (sent with a 200: `{"error": …}`).
 * Says nothing about the song, unlike a search that found nothing: a caller
 * must never keep "no cover" because of it (CLAUDE.md: a dependency that
 * didn't answer is never an empty result).
 */
export class DeezerUnavailableError extends Error {
  constructor(readonly entryId: string, readonly reason: string) {
    super(`Deezer couldn't be asked about "${entryId}": ${reason}`);
    this.name = "DeezerUnavailableError";
  }
}

/** How long one request may take. */
export const DEEZER_TIMEOUT_MS = 5_000;

async function fetchWithTimeout(url: string | URL): Promise<Response | string> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(DEEZER_TIMEOUT_MS) });
  } catch (error) {
    return error instanceof Error && error.name === "TimeoutError" ? "timed out" : "network error";
  }
}

/** Deezer's results for a catalog entry; an empty list when it has none. Throws DeezerUnavailableError when it couldn't answer. */
export async function searchDeezer(entry: CatalogEntry): Promise<DeezerTrack[]> {
  const url = new URL(SEARCH_URL);
  // A plain query: Deezer's documented advanced search (`artist:"…" track:"…"`)
  // finds nothing once both fields are set (docs/LEARNINGS.md, 2026-11-13), so
  // the results are narrowed to the entry's artist here, by bestDeezerMatch.
  url.searchParams.set("q", `${entry.artist} ${entry.title}`);
  url.searchParams.set("limit", "25");

  const response = await fetchWithTimeout(url);
  if (typeof response === "string") throw new DeezerUnavailableError(entry.id, response);
  if (!response.ok) throw new DeezerUnavailableError(entry.id, `HTTP ${response.status}`);
  const body = record(await response.json().catch(() => null));
  if (!body) throw new DeezerUnavailableError(entry.id, "malformed body");
  const error = record(body.error);
  if (error) throw new DeezerUnavailableError(entry.id, `error ${String(error.code)}: ${String(error.message)}`);
  if (!Array.isArray(body.data)) throw new DeezerUnavailableError(entry.id, "malformed body");
  return body.data.map(parseDeezerTrack).filter((track): track is DeezerTrack => track !== null);
}

/** A title as compared: case, accents and punctuation aside ("Moi... Lolita", "moi lolita"). */
function titleKey(title: string): string {
  return normalize(title).replace(/[^\p{L}\p{N}]+/gu, "");
}

function sameArtist(found: string, wanted: string): boolean {
  const a = normalize(found);
  const b = normalize(wanted);
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * The entry's own track among the results, or null: only by its artist, the
 * same title preferred, the original take over another (a live or remastered
 * one is still the song, and its album still the song's). Never
 * the first result regardless, as LRCLIB's lookup falls back to: a wrong
 * cover is worse than the panel's own, with the song's year on it.
 */
export function bestDeezerMatch(tracks: readonly DeezerTrack[], entry: CatalogEntry): DeezerTrack | null {
  const byArtist = tracks.filter((track) => sameArtist(track.artist, entry.artist));
  const title = titleKey(entry.title);
  const sameTitle = byArtist.filter((track) => titleKey(track.title) === title);
  return sameTitle.find((track) => track.version === "") ?? sameTitle[0] ?? byArtist[0] ?? null;
}

/** A cover's bytes, or why they couldn't be had (always worth trying again: the address came from Deezer). */
export async function fetchDeezerImage(entryId: string, url: string): Promise<{ contentType: string; bytes: ArrayBuffer }> {
  const response = await fetchWithTimeout(url);
  if (typeof response === "string") throw new DeezerUnavailableError(entryId, `cover: ${response}`);
  if (!response.ok) throw new DeezerUnavailableError(entryId, `cover: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw new DeezerUnavailableError(entryId, `cover: ${contentType || "no type"}`);
  return { contentType, bytes: await response.arrayBuffer() };
}
