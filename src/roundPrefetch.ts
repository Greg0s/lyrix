import { fetchRound } from "./api/client";
import { utcDay } from "./game/daily";
import type { RoundView } from "./game/types";
import { parseRoute } from "./routes";
import { loadSavedDay } from "./roundStorage";

/**
 * Today's round, asked for as soon as the page's script runs rather than once
 * React has rendered and useGame's effect has run: on a first visit that load
 * is what the loading screen waits for, and it used to start only after the
 * whole first render. Only when the round would be fetched fresh anyway: a
 * round saved with its view needs no network, and one saved as a state alone
 * is resumed (POST /api/round/resume), not fetched. Never for a day of the
 * archives, which useGame loads on its own.
 */
let prefetched: Promise<RoundView> | null = null;

export function prefetchTodayRound(
  pathname: string = window.location.pathname,
  storage: Storage | undefined = globalThis.localStorage
): void {
  if (prefetched || parseRoute(pathname).name === "day") return;
  // Saved today, with its view or not: not fetched fresh.
  if (loadSavedDay(utcDay(), storage)) return;
  prefetched = fetchRound();
  // Whoever takes it handles its failure; until then it is no unhandled rejection.
  prefetched.catch(() => {});
}

/** The round prefetchTodayRound asked for, once: the next load of today's round fetches its own. */
export function takePrefetchedRound(): Promise<RoundView> | null {
  const taken = prefetched;
  prefetched = null;
  return taken;
}
