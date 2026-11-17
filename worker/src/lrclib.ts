import { normalize } from "../../src/game/normalize";
import { sameArtist } from "./artist";
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

/**
 * LRCLIB couldn't be asked: the network failed, it took too long, or it
 * answered with an error (it sheds load with `503 ServerOverloaded`, see
 * docs/LEARNINGS.md, 2026-10-01). Says nothing about the song, unlike an
 * answer with no usable result: a caller must never move on to another song
 * because of it, or the day's song would depend on LRCLIB's health that hour.
 */
export class LrclibUnavailableError extends Error {
  constructor(readonly entryId: string, readonly reason: string) {
    super(`LRCLIB couldn't be asked about "${entryId}": ${reason}`);
    this.name = "LrclibUnavailableError";
  }
}

/** How long LRCLIB may take to start answering a search: it usually does in well under a second. */
export const SEARCH_TIMEOUT_MS = 5_000;

/**
 * How long reading the answer may take once it has started. A popular song's
 * search returns every copy of its lyrics (345 kB for "Tous les cris les SOS"),
 * and one timeout over both steps cut such a body off mid-read and called it
 * malformed (docs/LEARNINGS.md, 2026-11-16).
 */
export const BODY_TIMEOUT_MS = 20_000;

/** Waits before each new attempt after LRCLIB couldn't be asked, one at a time (see https://lrclib.net/docs). */
export const SEARCH_RETRY_DELAYS_MS: readonly number[] = [250, 750];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One search, or why LRCLIB couldn't answer it. */
async function searchOnce(url: URL): Promise<unknown[] | string> {
  const controller = new AbortController();
  let timedOut = false;
  const abortAfter = (ms: number) =>
    setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);

  let timer = abortAfter(SEARCH_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(url, { headers: { "Lrclib-Client": CLIENT_HEADER }, signal: controller.signal });
    } catch {
      return timedOut ? "timed out" : "network error";
    }
    if (!response.ok) return `HTTP ${response.status}`;

    clearTimeout(timer);
    timer = abortAfter(BODY_TIMEOUT_MS);
    let text: string;
    try {
      text = await response.text();
    } catch {
      return timedOut ? "timed out reading the answer" : "network error reading the answer";
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return "malformed body";
    }
    return Array.isArray(body) ? body : "malformed body";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * LRCLIB's results for a catalog entry; an empty list when it has none.
 * Throws LrclibUnavailableError when LRCLIB couldn't answer, after trying
 * again a couple of times: a missing song and a busy LRCLIB are not the same.
 */
export async function searchTrack(
  entry: CatalogEntry,
  retryDelaysMs: readonly number[] = SEARCH_RETRY_DELAYS_MS
): Promise<LrclibTrack[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("track_name", entry.title);
  url.searchParams.set("artist_name", entry.artist);

  let outcome = await searchOnce(url);
  for (const delay of retryDelaysMs) {
    if (typeof outcome !== "string") break;
    await sleep(delay);
    outcome = await searchOnce(url);
  }
  if (typeof outcome === "string") throw new LrclibUnavailableError(entry.id, outcome);
  return outcome.map(parseLrclibTrack).filter((track): track is LrclibTrack => track !== null);
}

function hasUsableLyrics(track: LrclibTrack): boolean {
  return !track.instrumental && (Boolean(track.plainLyrics?.trim()) || Boolean(track.syncedLyrics?.trim()));
}

/**
 * The entry's own lyrics: a usable result by its artist, the exact credit
 * preferred (search is fuzzy and can return unrelated tracks). Null when no
 * result is theirs: the first result used to be taken regardless, and another
 * artist's song of the same title would have been played, and kept for good.
 * Null moves the day's pick to the next song, as for a song with no lyrics.
 */
export function bestMatch(tracks: LrclibTrack[], entry: CatalogEntry): LrclibTrack | null {
  const usable = tracks.filter(hasUsableLyrics);
  const artistKey = normalize(entry.artist);
  return (
    usable.find((track) => normalize(track.artistName) === artistKey) ??
    usable.find((track) => sameArtist(track.artistName, entry.artist)) ??
    null
  );
}
