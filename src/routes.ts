import { isDayKey, isPlayableDay, utcDay } from "./game/daily";

/**
 * The game's screens, one address each, so the browser's Back button and a
 * shared link work: today's song (`/`), the archives (`/archives`), and a day
 * of the archives (`/archives/2026-09-26`). Any other path is today's song
 * (an invite link, /salon/<code>, is read by GameScreen on top of that).
 */
export type Route = { name: "today" } | { name: "archives" } | { name: "day"; day: string };

export const TODAY: Route = { name: "today" };
export const ARCHIVES: Route = { name: "archives" };

const ARCHIVES_PATH = "/archives";

/**
 * The screen a path shows on `now`'s day. Today's own day is today's song;
 * a day the archives don't offer (too old, to come, malformed) is the
 * archives themselves, since that is where the player was going.
 */
export function parseRoute(pathname: string, now: Date = new Date()): Route {
  const path = pathname.replace(/\/+$/, "");
  if (path === ARCHIVES_PATH) return ARCHIVES;
  if (!path.startsWith(`${ARCHIVES_PATH}/`)) return TODAY;
  const day = path.slice(ARCHIVES_PATH.length + 1);
  if (isDayKey(day) && day === utcDay(now)) return TODAY;
  return isPlayableDay(day, now) ? { name: "day", day } : ARCHIVES;
}

export function routePath(route: Route): string {
  if (route.name === "archives") return ARCHIVES_PATH;
  if (route.name === "day") return `${ARCHIVES_PATH}/${route.day}`;
  return "/";
}

export function isArchivesPath(pathname: string): boolean {
  return pathname === ARCHIVES_PATH || pathname.startsWith(`${ARCHIVES_PATH}/`);
}

export function sameRoute(a: Route, b: Route): boolean {
  return routePath(a) === routePath(b);
}
