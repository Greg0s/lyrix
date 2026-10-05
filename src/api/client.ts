import type { GuessResult, RoundView } from "../game/types";
import { API_BASE, apiUrl, GUESS_TIMEOUT_MS, withTimeout } from "./base";

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

/** Today's round, or with `day` (YYYY-MM-DD) the round of a day the archives hold. */
export async function fetchRound(signal?: AbortSignal, day?: string): Promise<RoundView> {
  const path = day === undefined ? "/api/round" : `/api/round?day=${encodeURIComponent(day)}`;
  const response = await fetch(apiUrl(path), { signal });
  return parseJsonResponse<RoundView>(response);
}

/**
 * A round's view rebuilt from sealed states of it: one to resume a saved day,
 * several to merge them. `day` names the round of a state sealed before the
 * archives, which doesn't carry one.
 */
export async function resumeRound(states: readonly string[], day: string, signal?: AbortSignal): Promise<RoundView> {
  const response = await fetch(`${API_BASE}/api/round/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ states, day }),
    signal,
  });
  return parseJsonResponse<RoundView>(response);
}

/** Throws when the guess couldn't be checked, a network that never answers included (GUESS_TIMEOUT_MS). */
export function submitGuess(state: string, word: string): Promise<GuessResult> {
  return withTimeout(GUESS_TIMEOUT_MS, async (signal) => {
    const response = await fetch(`${API_BASE}/api/guess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, word }),
      signal,
    });
    return parseJsonResponse<GuessResult>(response);
  });
}
