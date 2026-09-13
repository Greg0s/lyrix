import type { Section, Song } from "../../src/game/types";
import type { CatalogEntry } from "./catalog";
import { bestMatch, searchTrack } from "./lrclib";
import { parseSections, plainLyricsFrom } from "./lyrics";

/**
 * Turning one catalog entry into a playable song, straight from LRCLIB.
 *
 * Split out of songs.ts so it stays free of Workers-only globals (the Cache
 * API): the offline similarity-table builder needs exactly this step, and
 * runs under plain Node. Returns null rather than throwing whenever LRCLIB
 * has nothing usable, so callers can move on to the next candidate.
 */
export async function resolveFromLrclib(entry: CatalogEntry): Promise<Song | null> {
  const tracks = await searchTrack(entry);
  const match = bestMatch(tracks, entry);
  if (!match) return null;

  const lyrics = plainLyricsFrom(match);
  if (!lyrics) return null;

  const sections: Section[] = parseSections(lyrics);
  if (sections.length === 0) return null;

  return { id: entry.id, title: entry.title, artist: entry.artist, sections };
}
