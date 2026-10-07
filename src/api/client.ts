import type { GuessAnswer, RoundView } from "../game/types";
import { API_BASE, apiUrl, GUESS_TIMEOUT_MS, ROUND_LOAD_TIMEOUT_MS, withTimeout } from "./base";

interface ErrorBody {
  error: string;
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).error === "string";
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(isErrorBody(body) ? body.error : `request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Today's round, or with `day` (YYYY-MM-DD) the round of a day the archives hold. Gives up after ROUND_LOAD_TIMEOUT_MS. */
export function fetchRound(signal?: AbortSignal, day?: string): Promise<RoundView> {
  const path = day === undefined ? "/api/round" : `/api/round?day=${encodeURIComponent(day)}`;
  return withTimeout(
    ROUND_LOAD_TIMEOUT_MS,
    async (timed) => parseJsonResponse<RoundView>(await fetch(apiUrl(path), { signal: timed })),
    signal
  );
}

/**
 * A round's view rebuilt from sealed states of it: one to resume a saved day,
 * several to merge them. `day` names the round of a state sealed before the
 * archives, which doesn't carry one. Gives up after ROUND_LOAD_TIMEOUT_MS.
 */
export function resumeRound(states: readonly string[], day: string, signal?: AbortSignal): Promise<RoundView> {
  return withTimeout(
    ROUND_LOAD_TIMEOUT_MS,
    async (timed) => {
      const response = await fetch(`${API_BASE}/api/round/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ states, day }),
        signal: timed,
      });
      return parseJsonResponse<RoundView>(response);
    },
    signal
  );
}

/**
 * Asks for what the guess changed (a GuessDelta, see src/game/delta.ts); a full
 * view comes back instead on a win, or from a Worker deployed before deltas.
 * Throws when the guess couldn't be checked, a network that never answers
 * included (GUESS_TIMEOUT_MS).
 */
export function submitGuess(state: string, word: string): Promise<GuessAnswer> {
  return withTimeout(GUESS_TIMEOUT_MS, async (signal) => {
    const response = await fetch(`${API_BASE}/api/guess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, word, delta: true }),
      signal,
    });
    return parseJsonResponse<GuessAnswer>(response);
  });
}
