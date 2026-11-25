import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { entryOf, pushedEntry, replacedEntry, stepsBackToPlay } from "../historyEntries";
import { prefersReducedMotion } from "../reducedMotion";
import { isArchivesPath, parseRoute, routePath, routeTitle, sameRoute, type Route } from "../routes";
import { countView } from "../stats";
import { tabOf } from "../tabs";
import { isLayerEntry } from "./useBackCloses";

interface Shown {
  route: Route;
  /**
   * The round the game plays: null for today's song, or a day of the
   * archives. Kept while a page (the archives, the rules) is shown, so the
   * round left stays loaded and coming back to it is instant.
   */
  gameDay: string | null;
}

function show(route: Route, previous: string | null): Shown {
  if (route.name === "day") return { route, gameDay: route.day };
  if (route.name === "today") return { route, gameDay: null };
  return { route, gameDay: previous };
}

/**
 * The screen shown, kept in step with the address bar through the History
 * API: `navigate` pushes an entry, so Back returns to the previous screen,
 * and Back itself (popstate) is followed. No router library: four screens
 * don't need one.
 */
export interface NavigateOptions {
  /** Replaces the screen shown in history instead of adding one: Back skips it. */
  replace?: boolean;
  /** Counted as a screen viewed (stats.ts), unless false: a screen the address is only corrected to. */
  count?: boolean;
  /** Where the new screen is scrolled to once shown: its top unless given. */
  scroll?: number;
}

export function useRoute(): {
  route: Route;
  gameDay: string | null;
  navigate: (to: Route, options?: NavigateOptions) => void;
  navigateTab: (to: Route) => void;
} {
  const [shown, setShown] = useState(() => show(parseRoute(window.location.pathname), null));
  // What is on screen, for navigate to compare against without a state updater
  // (React may run one twice, which would push the address twice).
  const current = useRef(shown.route);

  // An archives address the archives don't serve (a day gone, or today's)
  // is replaced by the screen shown instead, so the address bar tells the truth.
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (!isArchivesPath(pathname)) return;
    const path = routePath(parseRoute(pathname));
    if (path !== pathname) window.history.replaceState(window.history.state, "", `${path}${search}${hash}`);
  }, []);

  // The first entry gets its place (historyEntries.ts); a reload keeps the one it had.
  useEffect(() => {
    const state: unknown = window.history.state;
    if (typeof state === "object" && state !== null && "lyrixIndex" in state) return;
    const route = current.current;
    window.history.replaceState(replacedEntry(entryOf(state), routePath(route), tabOf(route) === "play"), "");
  }, []);

  useEffect(() => {
    const follow = () => {
      const route = parseRoute(window.location.pathname);
      // Back closing a dialog or a sheet (useBackCloses): the screen under it stays.
      if (sameRoute(current.current, route)) return;
      current.current = route;
      countView(route);
      setShown((previous) => show(route, previous.gameDay));
    };
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, []);

  // Where the screen navigate just showed is to be scrolled, once it is.
  const pendingScroll = useRef<number | null>(null);
  const navigate = useCallback((to: Route, options?: NavigateOptions) => {
    if (sameRoute(current.current, to)) return;
    current.current = to;
    // An open dialog's own entry (useBackCloses) is replaced: Back from the new
    // screen goes to the one under the dialog, not to a dialog no longer there.
    const path = routePath(to);
    const isPlay = tabOf(to) === "play";
    const state: unknown = window.history.state;
    if (options?.replace || isLayerEntry(state)) {
      window.history.replaceState(replacedEntry(state, path, isPlay), "", path);
    } else {
      window.history.pushState(pushedEntry(state, path, isPlay), "", path);
    }
    if (options?.count !== false) countView(to);
    // A new screen starts at its top, as a page would, unless it was left
    // further down (navigateTab): then once it is shown.
    document.documentElement.scrollTop = 0;
    pendingScroll.current = options?.scroll ? options.scroll : null;
    setShown((previous) => show(to, previous.gameDay));
  }, []);
  useLayoutEffect(() => {
    const top = pendingScroll.current;
    pendingScroll.current = null;
    if (top !== null) window.scrollTo(0, top);
  }, [shown.route]);

  /**
   * The tab bar's way between screens (a tap, a swipe), as an installed app's
   * (asked for by the developer):
   * - Back from any tab goes to « Jouer », then out of the app: leaving
   *   « Jouer » adds a history entry, going from any other tab replaces it.
   * - Each screen is found where it was left (by address: today's round and
   *   a day's each keep their own).
   * - The tab already shown scrolls back to its top.
   */
  const tabScroll = useRef(new Map<string, number>());
  const navigateTab = useCallback(
    (to: Route) => {
      const from = current.current;
      if (sameRoute(from, to)) {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
        return;
      }
      tabScroll.current.set(routePath(from), window.scrollY);
      const scroll = tabScroll.current.get(routePath(to));
      // « Jouer », its entry right there below: back to it, rather than one more on top.
      const steps = isLayerEntry(window.history.state) ? null : stepsBackToPlay(window.history.state, routePath(to));
      if (steps !== null) {
        // Shown at once, as a tap expects (the popstate that follows finds it there).
        current.current = to;
        countView(to);
        pendingScroll.current = scroll ?? null;
        setShown((previous) => show(to, previous.gameDay));
        window.history.go(steps);
        return;
      }
      navigate(to, { replace: tabOf(from) !== "play", scroll });
    },
    [navigate]
  );

  // The tab names the screen, as a page of its own would. A string, so
  // nothing runs again until the screen actually changes.
  const title = routeTitle(shown.route);
  useEffect(() => {
    document.title = title;
  }, [title]);

  return { route: shown.route, gameDay: shown.gameDay, navigate, navigateTab };
}
