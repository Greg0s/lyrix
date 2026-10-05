import { useCallback, useEffect, useRef, useState } from "react";
import { isArchivesPath, isPageRoute, parseRoute, routePath, sameRoute, TODAY, type Route } from "../routes";

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
 * Marks the history entries `navigate` pushed: the entry before one of them
 * is a screen of the game, so going back to it is closing a page. An entry
 * the player landed on from outside (a link, a typed address) has no mark.
 */
const PUSHED = { lyrix: true } as const;

function pushedByTheGame(): boolean {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && "lyrix" in state && state.lyrix === true;
}

/**
 * The screen shown, kept in step with the address bar through the History
 * API: `navigate` pushes an entry, so Back returns to the previous screen,
 * and Back itself (popstate) is followed. No router library: four screens
 * don't need one. `closePage` leaves a page (the archives, the rules) for
 * where the player was: Back, when the game brought them there, or today's
 * round when they arrived on the page from a link.
 */
export function useRoute(): {
  route: Route;
  gameDay: string | null;
  navigate: (to: Route) => void;
  closePage: () => void;
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
    window.history.pushState(PUSHED, "", routePath(to));
    // A new screen starts at its top, as a page would.
    document.documentElement.scrollTop = 0;
    setShown((previous) => show(to, previous.gameDay));
  }, []);

  const closePage = useCallback(() => {
    if (!isPageRoute(current.current)) return;
    // popstate brings the screen left back, as the browser's Back would.
    if (pushedByTheGame()) {
      window.history.back();
      return;
    }
    current.current = TODAY;
    // In place of the page: Back from today's round leaves the game, as it
    // would have from the page.
    window.history.replaceState(null, "", routePath(TODAY));
    document.documentElement.scrollTop = 0;
    setShown((previous) => show(TODAY, previous.gameDay));
  }, []);

  return { route: shown.route, gameDay: shown.gameDay, navigate, closePage };
}
