import { useCallback, useEffect, useRef, useState } from "react";
import { isArchivesPath, parseRoute, routePath, routeTitle, sameRoute, type Route } from "../routes";
import { countView } from "../stats";
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
}

export function useRoute(): {
  route: Route;
  gameDay: string | null;
  navigate: (to: Route, options?: NavigateOptions) => void;
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

  const navigate = useCallback((to: Route, options?: NavigateOptions) => {
    if (sameRoute(current.current, to)) return;
    current.current = to;
    // An open dialog's own entry (useBackCloses) is replaced: Back from the new
    // screen goes to the one under the dialog, not to a dialog no longer there.
    if (options?.replace || isLayerEntry(window.history.state)) {
      window.history.replaceState(null, "", routePath(to));
    } else {
      window.history.pushState(null, "", routePath(to));
    }
    if (!options?.replace) countView(to);
    // A new screen starts at its top, as a page would.
    document.documentElement.scrollTop = 0;
    setShown((previous) => show(to, previous.gameDay));
  }, []);

  // The tab names the screen, as a page of its own would. A string, so
  // nothing runs again until the screen actually changes.
  const title = routeTitle(shown.route);
  useEffect(() => {
    document.title = title;
  }, [title]);

  return { route: shown.route, gameDay: shown.gameDay, navigate };
}
