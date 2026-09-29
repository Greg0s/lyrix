import type { GuessResult, RoundView } from "../game/types";
import { API_BASE, apiUrl } from "./base";

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

export async function fetchRound(signal?: AbortSignal): Promise<RoundView> {
  const response = await fetch(apiUrl("/api/round"), { signal });
  return parseJsonResponse<RoundView>(response);
}

export async function submitGuess(state: string, word: string): Promise<GuessResult> {
  const response = await fetch(`${API_BASE}/api/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, word }),
  });
  return parseJsonResponse<GuessResult>(response);
}
