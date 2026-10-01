/**
 * The daily song rotates at UTC midnight (see worker/src/catalog.ts), for
 * everyone at once, whatever their time zone.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days the archives offer: today and the 29 before it. */
export const ARCHIVE_DAYS = 30;

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
