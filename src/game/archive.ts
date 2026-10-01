import { ARCHIVE_DAYS, archiveDays, hasSong, utcDay } from "./daily";
import type { RoomDaySummary } from "./room";
import type { DisplayToken } from "./types";

/** What the archives keep of a day the player has played (src/roundStorage.ts writes it). */
export interface ArchiveEntry {
  /** The title as the player left it: found words spelled out, the others blanks of their length. */
  title: DisplayToken[];
  /** Share of the round's words revealed, 0-100. */
  percent: number;
  victory: boolean;
  /** Only once won. */
  artist?: string;
  /** How many words were tried. */
  tries: number;
  /** In a room: the group's progress on the day, not the player's own. */
  byGroup?: boolean;
  /** In a room: the group found the song without the player, who hasn't asked for the answer. */
  groupFound?: boolean;
}

/**
 * How a day of the archives shows: today's song; a song found; one started; a
 * day never played (its title's shape unknown, so nothing of it is shown);
 * or a day before the game had songs, which can't be played.
 */
export type ArchiveStatus = "today" | "solved" | "progress" | "new" | "unavailable";

export interface ArchiveDay {
  day: string;
  status: ArchiveStatus;
  /** What the player left on it; null for a day never played, and always for an unavailable one. */
  entry: ArchiveEntry | null;
  /** The oldest day of the window, gone from the archives tomorrow, and still to find. */
  leaving: boolean;
}

export interface ArchiveOverview {
  /** Every day of the window, newest first. */
  days: ArchiveDay[];
  /** Songs found, today's included. */
  solved: number;
  /** Days of the window that had a song. */
  playable: number;
}

function statusOf(day: string, today: string, entry: ArchiveEntry | null): ArchiveStatus {
  if (!hasSong(day)) return "unavailable";
  if (day === today) return "today";
  if (!entry) return "new";
  if (entry.victory) return "solved";
  return entry.tries > 0 ? "progress" : "new";
}

/** The archives as the player sees them on `now`'s day, from what they saved (loadArchive). */
export function archiveOverview(entries: Readonly<Record<string, ArchiveEntry>>, now: Date = new Date()): ArchiveOverview {
  const today = utcDay(now);
  const window = archiveDays(now);
  const oldest = window[ARCHIVE_DAYS - 1];
  const days = window.map((day): ArchiveDay => {
    const entry = hasSong(day) ? (entries[day] ?? null) : null;
    const status = statusOf(day, today, entry);
    // A day only shows what was played of it: one opened without a guess is still to discover.
    const shown = status === "new" ? null : entry;
    return { day, status, entry: shown, leaving: day === oldest && status !== "unavailable" && status !== "solved" };
  });
  return {
    days,
    solved: days.filter((day) => day.entry?.victory).length,
    playable: days.filter((day) => day.status !== "unavailable").length,
  };
}

/** Past days of the window that had a song and aren't found yet, newest first. */
export function daysToFind(entries: Readonly<Record<string, ArchiveEntry>>, now: Date = new Date()): string[] {
  return archiveOverview(entries, now)
    .days.filter((day) => day.status === "new" || day.status === "progress")
    .map((day) => day.day);
}

/** The day the archives suggest after `except`: the most recent still to find. */
export function nextDayToFind(
  entries: Readonly<Record<string, ArchiveEntry>>,
  except: string,
  now: Date = new Date()
): string | null {
  return daysToFind(entries, now).find((day) => day !== except) ?? null;
}

/**
 * A day a room played, as the archives show it to one member: the group's
 * progress, but never the title of a day the group found without them, unless
 * they asked for the answer - then it reads as it stood before the winning word.
 */
export function groupEntry(summary: RoomDaySummary, you: string, revealed: boolean): ArchiveEntry {
  const tries = summary.guesses;
  if (summary.victory && summary.winner?.id !== you && !revealed) {
    const masked = summary.title.map((token) =>
      token.isWord ? { ...token, text: "_".repeat(token.text.length), revealed: false } : token
    );
    return {
      title: summary.titleBeforeWin ?? masked,
      percent: summary.percent,
      victory: false,
      tries,
      byGroup: true,
      groupFound: true,
    };
  }
  return {
    title: summary.title,
    percent: summary.percent,
    victory: summary.victory,
    tries,
    byGroup: true,
    ...(summary.artist !== undefined ? { artist: summary.artist } : {}),
  };
}

/**
 * The archives in a room: each day as far as the player got, alone or with
 * the group. A day the player found stays theirs; otherwise the group's
 * progress shows when it is further along (or found).
 */
export function withGroupDays(
  own: Readonly<Record<string, ArchiveEntry>>,
  group: Readonly<Record<string, ArchiveEntry>>
): Record<string, ArchiveEntry> {
  const merged: Record<string, ArchiveEntry> = { ...own };
  for (const [day, entry] of Object.entries(group)) {
    const mine = own[day];
    if (mine?.victory) continue;
    if (!mine || entry.victory || entry.percent >= mine.percent) merged[day] = entry;
  }
  return merged;
}

/** "1 essai", "41 essais". */
export function triesLabel(tries: number): string {
  return `${tries} ${tries > 1 ? "essais" : "essai"}`;
}

// What a cover's title has to fit in, in pixels: its width less its padding,
// and the height left between its top and bottom rows.
const COVER_TEXT_WIDTH = 140;
const COVER_TEXT_HEIGHT = 96;
const MAX_TITLE_SIZE = 30;
const MIN_TITLE_SIZE = 14;
// Bricolage Grotesque at weight 800: an average glyph is a little over half
// the font size wide, and lines sit at 1.04.
const GLYPH_WIDTH = 0.6;
const LINE_HEIGHT = 1.04;

function linesAt(words: readonly string[], size: number): number {
  const perLine = Math.floor(COVER_TEXT_WIDTH / (size * GLYPH_WIDTH));
  let lines = 1;
  let used = 0;
  for (const word of words) {
    if (word.length > perLine) return Number.POSITIVE_INFINITY;
    const needed = used === 0 ? word.length : used + 1 + word.length;
    if (needed > perLine) {
      lines += 1;
      used = word.length;
    } else {
      used = needed;
    }
  }
  return lines;
}

/**
 * The font size, in pixels, a found song's title is set at on its cover: as
 * large as fits, so "Caroline" fills it and "Il est cinq heures, Paris
 * s'éveille" still does without overflowing it. A word is never broken,
 * but a hyphenated one may wrap at its hyphen, as the browser does.
 */
export function coverTitleSize(title: string): number {
  // A line may also break after a hyphen ("Paris-Seychelles").
  const words = title.split(/[\s-]+/).filter((word) => word.length > 0);
  for (let size = MAX_TITLE_SIZE; size > MIN_TITLE_SIZE; size--) {
    if (linesAt(words, size) * size * LINE_HEIGHT <= COVER_TEXT_HEIGHT) return size;
  }
  return MIN_TITLE_SIZE;
}
