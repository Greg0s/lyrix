import type { Section } from "../../src/game/types";
import type { LrclibTrack } from "./lrclib";

function isKeptControlChar(code: number): boolean {
  return code === 9 || code === 10; // tab, newline
}

// LRCLIB has been observed to leak stray control characters into text fields
// (a unit separator joining two title variants, in one case seen live) -
// strip any other character below code point 32, and normalize line endings.
function sanitize(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  return Array.from(normalized)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 || isKeptControlChar(code);
    })
    .join("")
    .trim();
}

const LEADING_TIMESTAMPS = /^(\[\d{2}:\d{2}(?:\.\d{1,3})?\])+\s*/;

function stripSyncedTimestamps(syncedLyrics: string): string {
  return syncedLyrics
    .split("\n")
    .map((line) => line.replace(LEADING_TIMESTAMPS, ""))
    .join("\n");
}

/** Prefers plain lyrics; some LRCLIB entries only have synced (LRC) lyrics, so those are used as a fallback with timestamp tags stripped. */
export function plainLyricsFrom(track: LrclibTrack): string | null {
  if (track.plainLyrics?.trim()) return sanitize(track.plainLyrics);
  if (track.syncedLyrics?.trim()) return sanitize(stripSyncedTimestamps(track.syncedLyrics));
  return null;
}

/** Splits lyrics into blank-line-separated paragraphs. LRCLIB gives no verse/chorus structure, so sections are generically numbered, matching the style of the original placeholder data. */
export function parseSections(plainLyrics: string): Section[] {
  return plainLyrics
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    )
    .filter((lines) => lines.length > 0)
    .map((lines, index) => ({ label: `Couplet ${index + 1}`, lines }));
}
