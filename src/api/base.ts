/**
 * Where the Worker answers. In production Pages and the Worker are on
 * different origins, so the build gets the Worker's absolute URL (see the
 * deploy job in .github/workflows/ci.yml and docs/LEARNINGS.md, 2026-09-12);
 * in dev it is unset, and vite.config.ts proxies same-origin /api calls.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function apiUrl(path: string): URL {
  return new URL(path, API_BASE || window.location.origin);
}

/**
 * How long a guess may take before the player is told it couldn't be sent.
 * A request a phone's flaky network leaves hanging never settles on its own,
 * and the dock refuses a new guess while one is in flight: without a limit,
 * the game would stop answering, without a word of why.
 */
export const GUESS_TIMEOUT_MS = 10_000;

/**
 * How long loading a round may take: longer than a guess, since a cold
 * Worker may have to try LRCLIB for several catalog songs in a row before
 * one answers (worker/src/songs.ts). Past it, the retry screen shows.
 */
export const ROUND_LOAD_TIMEOUT_MS = 20_000;

/** How long creating or joining a room may take before the dialog says the rooms are unavailable. */
export const ROOM_ENTRY_TIMEOUT_MS = 10_000;

/**
 * Runs `request` with a signal that aborts it after `ms`, reading its body
 * included: the limit is lifted only once `request` has settled. An `outer`
 * signal still aborts it too, with its own reason (an AbortError), so a
 * superseded request stays told apart from one that timed out.
 */
export async function withTimeout<T>(
  ms: number,
  request: (signal: AbortSignal) => Promise<T>,
  outer?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("request timed out", "TimeoutError")), ms);
  const abort = () => controller.abort(outer?.reason);
  if (outer?.aborted) abort();
  outer?.addEventListener("abort", abort);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", abort);
  }
}

/**
 * The request never got a usable answer from the Worker: the network failed
 * (fetch's TypeError) or it took too long. Unlike an error the Worker sent,
 * it says nothing about what was asked, so it is worth trying again as is.
 */
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof DOMException && error.name === "TimeoutError");
}
