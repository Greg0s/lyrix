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

// An LRC timestamp: in brackets at the start of a line (repeated when the same
// line is sung at several points), or in angle brackets mid-line in enhanced
// LRC, which times individual words. Minutes and the fraction are usually two
// digits each, but neither is guaranteed and some files carry an hours field.
const TIMESTAMP = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.:]\d{1,3})?`;
const LEADING_TIMESTAMPS = new RegExp(String.raw`^(?:\[${TIMESTAMP}\]\s*)+`);
const WORD_TIMESTAMPS = new RegExp(String.raw`<${TIMESTAMP}>`, "g");

// A whole line in square brackets carries no lyrics: an LRC id tag
// ("[ar:Stromae]", which would otherwise hand the player the artist the round
// only reveals on a win, or "[ti:…]" the title), a section header ("[Refrain]",
// "[Couplet 1]"), or an "[Instrumental]" marker.
const BRACKETED_LINE = /^\[[^\]]*\]$/;
// The same marker written in parentheses, or on its own. Parentheses are
// otherwise left alone: they mark backing vocals, which are sung.
const INSTRUMENTAL_LINE = /^\(?\s*instrumentals?(?:\s+[^\s)]+)?\s*\)?$/i;
// Filler LRC files use to carry an instrumental break: "♪", "***", "- - -".
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

function isLyricLine(line: string): boolean {
  if (!HAS_LETTER_OR_DIGIT.test(line)) return false;
  if (BRACKETED_LINE.test(line)) return false;
  return !INSTRUMENTAL_LINE.test(line);
}

/**
 * Drops everything in a lyrics blob that isn't sung — timestamps, id tags,
 * section headers, instrumental filler — and evens out the spacing, so a
 * player is never asked to guess a word LRCLIB's formatting put there.
 *
 * Blank lines are kept exactly where they are: parseSections needs them to
 * tell one section from the next, and a paragraph that was nothing but
 * filler simply disappears once its lines are gone.
 */
export function cleanLyrics(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(LEADING_TIMESTAMPS, "").replace(WORD_TIMESTAMPS, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length === 0 || isLyricLine(line))
    .join("\n");
}

/** Prefers plain lyrics; some LRCLIB entries only have synced (LRC) lyrics, so those are used as a fallback. Returns null when nothing sung survives the cleanup, so the caller can move on to another candidate. */
export function plainLyricsFrom(track: LrclibTrack): string | null {
  const source = track.plainLyrics?.trim() ? track.plainLyrics : track.syncedLyrics;
  if (!source?.trim()) return null;

  const cleaned = cleanLyrics(sanitize(source)).trim();
  return cleaned.length > 0 ? cleaned : null;
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
