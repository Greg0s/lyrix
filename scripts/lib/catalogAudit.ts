import { tokenize } from "../../src/game/tokenize";
import type { Song } from "../../src/game/types";
import type { CatalogEntry } from "../../worker/src/catalog";

/**
 * What one catalog entry looks like once LRCLIB has been asked for it. The
 * catalog is hand-written, LRCLIB is crowd-sourced, and nothing in the test
 * suite can tell you whether the two still agree — that needs the network.
 * check-catalog.ts does the asking; everything here is pure, so the reporting
 * itself stays unit-tested.
 */
export interface CatalogAudit {
  id: string;
  label: string;
  resolved: boolean;
  sections: number;
  words: number;
  warnings: string[];
}

/** Formatting the Worker's cleanup is meant to have removed. Anything left is a new LRCLIB quirk worth a look — see worker/src/lyrics.ts. */
const LEFTOVERS: { pattern: RegExp; note: string }[] = [
  { pattern: /\[[^\]]*\]/, note: "bracketed annotation" },
  { pattern: /[♪♫♬]/, note: "musical-note filler" },
  { pattern: /\d{1,2}:\d{2}/, note: "what looks like a timestamp" },
];

/** Above resolveSong.ts's hard floor, but still thin enough that LRCLIB is probably serving an excerpt rather than the whole song. */
export const SHORT_SONG_WORDS = 60;

function wordCount(lines: string[]): number {
  return lines.reduce((total, line) => total + tokenize(line).filter((token) => token.isWord).length, 0);
}

export function auditSong(entry: CatalogEntry, song: Song | null): CatalogAudit {
  const label = `${entry.artist} - ${entry.title}`;
  if (!song) return { id: entry.id, label, resolved: false, sections: 0, words: 0, warnings: [] };

  const lines = song.sections.flatMap((section) => section.lines);
  const words = wordCount(lines);
  const warnings: string[] = [];

  for (const { pattern, note } of LEFTOVERS) {
    const offending = lines.find((line) => pattern.test(line));
    if (offending !== undefined) warnings.push(`${note} survived the cleanup: ${JSON.stringify(offending)}`);
  }
  if (words < SHORT_SONG_WORDS) {
    warnings.push(`only ${words} words — LRCLIB may be serving an excerpt for this entry`);
  }

  return { id: entry.id, label, resolved: true, sections: song.sections.length, words, warnings };
}

const ID_COLUMN = 26;
const WARNING_INDENT = " ".repeat("  FAIL  ".length + ID_COLUMN);

export function formatAudit(audit: CatalogAudit): string {
  const id = audit.id.padEnd(ID_COLUMN);
  const head = audit.resolved
    ? `  ok    ${id} ${audit.sections} sections, ${audit.words} words`
    : `  FAIL  ${id} no usable lyrics on LRCLIB`;
  return [head, ...audit.warnings.map((warning) => `${WARNING_INDENT} ! ${warning}`)].join("\n");
}

export function summarizeAudits(audits: CatalogAudit[]): { resolved: number; failed: number; warned: number } {
  return {
    resolved: audits.filter((audit) => audit.resolved).length,
    failed: audits.filter((audit) => !audit.resolved).length,
    warned: audits.filter((audit) => audit.warnings.length > 0).length,
  };
}

/**
 * What to say about the entries that didn't resolve. searchTrack swallows every
 * failure into "no results" so the Worker can move on, which means a blocked or
 * down LRCLIB looks exactly like a wrong artist/title — except that it takes the
 * whole catalog down with it, and one bad entry doesn't.
 */
export function failureAdvice(audits: CatalogAudit[]): string | null {
  const { resolved, failed } = summarizeAudits(audits);
  if (failed === 0) return null;
  if (resolved === 0 && audits.length > 1) {
    return (
      "Every entry failed, which is far likelier to mean LRCLIB was unreachable (outage, rate limit, " +
      "a proxy in the way) than that the whole catalog is wrong. Confirm lrclib.net answers from this " +
      "machine before editing worker/src/catalog.ts."
    );
  }
  return (
    "An unresolved entry is not fatal: the day it comes up, the Worker falls through to the next catalog " +
    "song. Fix it by correcting the artist/title in worker/src/catalog.ts to match LRCLIB's spelling, or " +
    "by replacing the entry."
  );
}

/** Catalog ids key the day's pick, the song cache and the KV similarity tables, so a duplicate silently makes two entries share one round. */
export function duplicateCatalogIds(entries: CatalogEntry[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) duplicates.add(entry.id);
    seen.add(entry.id);
  }
  return [...duplicates];
}
