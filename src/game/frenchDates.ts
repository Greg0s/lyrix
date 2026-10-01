import { dayStart, utcDay } from "./daily";

/**
 * Days as the archives write them, in French: a day is a UTC calendar day
 * (YYYY-MM-DD, see daily.ts), so it is formatted in UTC too, never in the
 * player's time zone, which would put 26 September on the 25th in Montréal.
 */
const weekdayLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

const DAY_MS = 24 * 60 * 60 * 1000;

/** 26 for 2026-09-26. */
export function dayOfMonth(day: string): number {
  return Number(day.slice(8, 10));
}

/** "26", or "1er" for the first of the month, as French writes it. */
export function dayOfMonthLabel(day: string): string {
  const date = dayOfMonth(day);
  return date === 1 ? "1er" : String(date);
}

/** "samedi 26 septembre". */
export function longDayLabel(day: string): string {
  const date = dayStart(day);
  return `${weekdayLong.format(date)} ${dayOfMonthLabel(day)} ${monthLong.format(date)}`;
}

/** "26 sept.", "1er oct.". */
export function shortDayLabel(day: string): string {
  return `${dayOfMonthLabel(day)} ${monthAbbreviation(day)}`;
}

/** "sam.". */
export function weekdayAbbreviation(day: string): string {
  return weekdayShort.format(dayStart(day));
}

/** "sept.". */
export function monthAbbreviation(day: string): string {
  return monthShort.format(dayStart(day));
}

/** "aujourd'hui", "hier", "il y a 4 jours", from `now`'s UTC day. */
export function relativeDayLabel(day: string, now: Date = new Date()): string {
  const days = Math.round((dayStart(utcDay(now)).getTime() - dayStart(day).getTime()) / DAY_MS);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
