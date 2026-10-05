import { isDayKey, isPlayableDay, utcDay } from "./game/daily";

/**
 * The game's screens, one address each, so the browser's Back button and a
 * shared link work: today's song (`/`), the archives (`/archives`), a day of
 * the archives (`/archives/2026-09-26`), and the rules (`/comment-jouer`).
 * Any other path is today's song (an invite link, /salon/<code>, is read by
 * GameScreen on top of that).
 */
export type Route = { name: "today" } | { name: "archives" } | { name: "day"; day: string } | { name: "help" };

export const TODAY: Route = { name: "today" };
export const ARCHIVES: Route = { name: "archives" };
export const HELP: Route = { name: "help" };

const ARCHIVES_PATH = "/archives";
const HELP_PATH = "/comment-jouer";

/**
 * The screen a path shows on `now`'s day. Today's own day is today's song;
 * a day the archives don't offer (too old, to come, malformed) is the
 * archives themselves, since that is where the player was going.
 */
export function parseRoute(pathname: string, now: Date = new Date()): Route {
  const path = pathname.replace(/\/+$/, "");
  if (path === ARCHIVES_PATH) return ARCHIVES;
  if (path === HELP_PATH) return HELP;
  if (!path.startsWith(`${ARCHIVES_PATH}/`)) return TODAY;
  const day = path.slice(ARCHIVES_PATH.length + 1);
  if (isDayKey(day) && day === utcDay(now)) return TODAY;
  return isPlayableDay(day, now) ? { name: "day", day } : ARCHIVES;
}

export function routePath(route: Route): string {
  if (route.name === "archives") return ARCHIVES_PATH;
  if (route.name === "day") return `${ARCHIVES_PATH}/${route.day}`;
  if (route.name === "help") return HELP_PATH;
  return "/";
}

export function isArchivesPath(pathname: string): boolean {
  return pathname === ARCHIVES_PATH || pathname.startsWith(`${ARCHIVES_PATH}/`);
}

export function sameRoute(a: Route, b: Route): boolean {
  return routePath(a) === routePath(b);
}

/**
 * A page shown over the round rather than a round itself (the archives, the
 * rules): the round left stays loaded under it, and showing one moves no
 * room's day.
 */
export function isPageRoute(route: Route): route is { name: "archives" } | { name: "help" } {
  return route.name === "archives" || route.name === "help";
}
