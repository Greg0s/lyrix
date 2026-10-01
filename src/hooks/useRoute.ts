import { useCallback, useEffect, useRef, useState } from "react";
import { isArchivesPath, parseRoute, routePath, sameRoute, type Route } from "../routes";

interface Shown {
  route: Route;
  /**
   * The round the game plays: null for today's song, or a day of the
   * archives. Kept while the archives screen is shown, so the round left
   * stays loaded and coming back to it is instant.
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
 * and Back itself (popstate) is followed. No router library: three screens
 * don't need one.
 */
export function useRoute(): { route: Route; gameDay: string | null; navigate: (to: Route) => void } {
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
      current.current = parseRoute(window.location.pathname);
      const route = current.current;
      setShown((previous) => show(route, previous.gameDay));
    };
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, []);

  const navigate = useCallback((to: Route) => {
    if (sameRoute(current.current, to)) return;
    current.current = to;
    window.history.pushState(null, "", routePath(to));
    // A new screen starts at its top, as a page would.
    document.documentElement.scrollTop = 0;
    setShown((previous) => show(to, previous.gameDay));
  }, []);

  return { route: shown.route, gameDay: shown.gameDay, navigate };
}
