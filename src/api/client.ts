import type { GuessResult, RoundView } from "../game/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

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

export async function fetchRound(excludeSongId?: string, signal?: AbortSignal): Promise<RoundView> {
  const url = new URL("/api/round", API_BASE || window.location.origin);
  if (excludeSongId) url.searchParams.set("exclude", excludeSongId);
  const response = await fetch(url, { signal });
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
