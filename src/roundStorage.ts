import type { TriedWord } from "./hooks/useGame";
import type { RoundView } from "./game/types";

const STORAGE_KEY = "lyrix:round";

interface SavedRound {
  date: string;
  round: RoundView;
  triedWords: TriedWord[];
}

/** UTC day key, matching the Worker's rollover boundary (see worker/src/catalog.ts's pickDailyEntry). */
export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function isTriedWord(value: unknown): value is TriedWord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === "string" && typeof candidate.display === "string" && typeof candidate.found === "boolean"
  );
}

function isRoundView(value: unknown): value is RoundView {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.songId === "string" &&
    typeof candidate.state === "string" &&
    typeof candidate.victory === "boolean" &&
    typeof candidate.title === "object" &&
    candidate.title !== null &&
    Array.isArray(candidate.sections)
  );
}

function isSavedRound(value: unknown): value is SavedRound {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.date === "string" &&
    isRoundView(candidate.round) &&
    Array.isArray(candidate.triedWords) &&
    candidate.triedWords.every(isTriedWord)
  );
}

/** Only returns a result when it was saved for today - a leftover round from a previous day is treated as absent. */
export function loadSavedRound(
  storage: Storage | undefined = globalThis.localStorage
): { round: RoundView; triedWords: TriedWord[] } | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSavedRound(parsed) || parsed.date !== todayKey()) return null;
    return { round: parsed.round, triedWords: parsed.triedWords };
  } catch {
    return null;
  }
}

export function saveRound(
  round: RoundView,
  triedWords: TriedWord[],
  storage: Storage | undefined = globalThis.localStorage
): void {
  if (!storage) return;
  try {
    const saved: SavedRound = { date: todayKey(), round, triedWords };
    storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // localStorage can throw (private browsing, quota, disabled storage) - persistence is a nice-to-have, never fatal.
  }
}
