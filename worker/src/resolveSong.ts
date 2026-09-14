import { tokenize } from "../../src/game/tokenize";
import type { Section, Song } from "../../src/game/types";
import type { CatalogEntry } from "./catalog";
import { bestMatch, searchTrack } from "./lrclib";
import { parseSections, plainLyricsFrom } from "./lyrics";

/**
 * A resolved song still has to be worth playing. LRCLIB is crowd-sourced, and
 * an entry that isn't marked instrumental can still come back as a stub: a
 * "paroles non disponibles" note, a single chorus line, a tag-only file whose
 * every line the cleanup dropped. Below this many words there is no puzzle
 * left, so the caller moves on to the next catalog candidate instead of
 * serving a round that is over in three guesses.
 */
export const MIN_LYRIC_WORDS = 20;

function wordCount(sections: Section[]): number {
  let total = 0;
  for (const section of sections) {
    for (const line of section.lines) {
      total += tokenize(line).filter((token) => token.isWord).length;
    }
  }
  return total;
}

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
  if (wordCount(sections) < MIN_LYRIC_WORDS) return null;

  return { id: entry.id, title: entry.title, artist: entry.artist, sections };
}
