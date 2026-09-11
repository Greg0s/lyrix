import { normalize } from "../../src/game/normalize";
import type { CatalogEntry } from "./catalog";

const SEARCH_URL = "https://lrclib.net/api/search";
// LRCLIB requires clients to identify themselves (see https://lrclib.net/docs).
const CLIENT_HEADER = "Lyrix/0.1 (+https://github.com/Greg0s/lyrix)";

/** Only the fields we actually use — LRCLIB's `trackName`/`name` fields are ignored on purpose (see lyrics.ts / songs.ts) since the puzzle's own catalog title is authoritative. */
export interface LrclibTrack {
  artistName: string;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

// LRCLIB's data isn't guaranteed clean (see docs/LEARNINGS.md), so this both
// validates and normalizes rather than trusting a plain type-cast.
export function parseLrclibTrack(value: unknown): LrclibTrack | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.artistName !== "string") return null;

  return {
    artistName: candidate.artistName,
    instrumental: candidate.instrumental === true,
    plainLyrics: typeof candidate.plainLyrics === "string" ? candidate.plainLyrics : null,
    syncedLyrics: typeof candidate.syncedLyrics === "string" ? candidate.syncedLyrics : null,
  };
}

// Never throws: any failure (network, non-2xx, malformed body) surfaces as
// "no results" so callers can move on to the next catalog candidate.
export async function searchTrack(entry: CatalogEntry): Promise<LrclibTrack[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("track_name", entry.title);
  url.searchParams.set("artist_name", entry.artist);

  let response: Response;
  try {
    response = await fetch(url, { headers: { "Lrclib-Client": CLIENT_HEADER } });
  } catch {
    return [];
  }
  if (!response.ok) return [];

  const body: unknown = await response.json().catch(() => null);
  if (!Array.isArray(body)) return [];
  return body.map(parseLrclibTrack).filter((track): track is LrclibTrack => track !== null);
}

function hasUsableLyrics(track: LrclibTrack): boolean {
  return !track.instrumental && (Boolean(track.plainLyrics?.trim()) || Boolean(track.syncedLyrics?.trim()));
}

/** Prefers a result whose artist matches the catalog entry (search is fuzzy and can return unrelated tracks); falls back to the first usable result otherwise. */
export function bestMatch(tracks: LrclibTrack[], entry: CatalogEntry): LrclibTrack | null {
  const usable = tracks.filter(hasUsableLyrics);
  const artistKey = normalize(entry.artist);
  return usable.find((track) => normalize(track.artistName) === artistKey) ?? usable[0] ?? null;
}
