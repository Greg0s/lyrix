/**
 * The daily song rotates at UTC midnight (see worker/src/catalog.ts), for
 * everyone at once, whatever their time zone.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days the archives offer: today and the 29 before it. */
export const ARCHIVE_DAYS = 30;

/**
 * The first UTC day the game had a song (worker/src/catalog.ts's schedule
 * starts on it): the archives show older days as unavailable.
 */
export const FIRST_SONG_DAY = "2026-09-12";

/** The UTC day `date` falls on, as YYYY-MM-DD: how every day-based thing in the game is keyed. */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Whether `value` is a real calendar day written YYYY-MM-DD (so not 2026-02-30). */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && utcDay(date) === value;
}

/** Midnight UTC of a YYYY-MM-DD day. */
export function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** The days the archives span on `now`'s UTC day, newest first: today and the ARCHIVE_DAYS - 1 before it. */
export function archiveDays(now: Date = new Date()): string[] {
  const today = dayStart(utcDay(now)).getTime();
  return Array.from({ length: ARCHIVE_DAYS }, (_, back) => utcDay(new Date(today - back * DAY_MS)));
}

/** Whether `day` had a song: never before FIRST_SONG_DAY. */
export function hasSong(day: string): boolean {
  return day >= FIRST_SONG_DAY;
}

/** Whether `day` can be played on `now`'s UTC day: one of the archives' days that had a song, never one to come. */
export function isPlayableDay(day: string, now: Date = new Date()): boolean {
  return isDayKey(day) && hasSong(day) && archiveDays(now).includes(day);
}

/** Milliseconds from `nowMs` until the next UTC midnight: always in (0, 24 h]. */
export function msUntilNextSong(nowMs: number): number {
  return DAY_MS - (((nowMs % DAY_MS) + DAY_MS) % DAY_MS);
}

/** "HH:MM:SS", rounded up to the second so it never shows 00:00:00 before the song has actually changed. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
