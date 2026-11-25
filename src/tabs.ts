import { EVENTS, type TrackedEvent } from "./analytics";
import { ARCHIVES, HELP, ROOM, TODAY, type Route } from "./routes";

/**
 * The tab bar's tabs, in order along the bottom edge (TabBar): the round,
 * the archives, the room's page, "Plus" (the rules). A swipe moves to the
 * one beside the screen shown (useSwipeTabs).
 */
export type TabName = "play" | "archives" | "room" | "more";

export const TAB_ORDER: readonly TabName[] = ["play", "archives", "room", "more"];

/** The tab a screen is under, or null for one under none (the legal notice). */
export function tabOf(route: Route): TabName | null {
  if (route.name === "today" || route.name === "day") return "play";
  if (route.name === "archives") return "archives";
  if (route.name === "room") return "room";
  if (route.name === "help") return "more";
  return null;
}

/**
 * Where a tab goes from the screen shown. "Jouer" on a day of the archives is
 * that day's round, the screen shown; anywhere else, today's song.
 */
export function tabRoute(tab: TabName, shown: Route): Route {
  if (tab === "archives") return ARCHIVES;
  if (tab === "room") return ROOM;
  if (tab === "more") return HELP;
  return shown.name === "day" ? shown : TODAY;
}

/** The click Umami counts for a tab, as the tab bar's link counts it; none for "Jouer". */
export function tabEvent(tab: TabName): TrackedEvent | null {
  if (tab === "archives") return EVENTS.openArchives;
  if (tab === "room") return EVENTS.openMultiplayer;
  if (tab === "more") return EVENTS.openHelp;
  return null;
}

/**
 * The tab a swipe goes to: the next one for a finger moving left (as a page
 * slides in from the right), the previous one for a finger moving right.
 * None past either end, and none from a screen under no tab.
 */
export function swipedTab(route: Route, direction: "left" | "right"): TabName | null {
  const current = tabOf(route);
  if (current === null) return null;
  const index = TAB_ORDER.indexOf(current) + (direction === "left" ? 1 : -1);
  return TAB_ORDER[index] ?? null;
}
