import type { TriedWord } from "./hooks/useGame";
import { parseNearSlots } from "./game/slots";
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

// Parses rather than type-guards, so a round saved before proximity scoring
// existed (no `score` field), or before close words were shown in the lyrics
// (no `near` field), still loads instead of being thrown away, which would
// silently restart the player's one puzzle of the day.
function parseTriedWord(value: unknown): TriedWord | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.key !== "string" || typeof candidate.display !== "string") return null;
  if (typeof candidate.found !== "boolean") return null;
  const score = typeof candidate.score === "number" && Number.isFinite(candidate.score) ? candidate.score : null;
  return {
    key: candidate.key,
    display: candidate.display,
    found: candidate.found,
    score,
    near: parseNearSlots(candidate.near),
  };
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

function parseSavedRound(value: unknown): SavedRound | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.date !== "string" || !isRoundView(candidate.round)) return null;
  if (!Array.isArray(candidate.triedWords)) return null;

  const triedWords: TriedWord[] = [];
  for (const entry of candidate.triedWords) {
    const word = parseTriedWord(entry);
    if (!word) return null;
    triedWords.push(word);
  }
  return { date: candidate.date, round: candidate.round, triedWords };
}

/** Only returns a result when it was saved for today - a leftover round from a previous day is treated as absent. */
export function loadSavedRound(
  storage: Storage | undefined = globalThis.localStorage
): { round: RoundView; triedWords: TriedWord[] } | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseSavedRound(JSON.parse(raw) as unknown);
    if (!parsed || parsed.date !== todayKey()) return null;
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

/**
 * Persisting the round is a nice-to-have, and it is not small: a real song's
 * masked view is hundreds of tokens, so serializing it and handing it to
 * localStorage (a synchronous, disk-backed write) cost a few milliseconds
 * right where the player is waiting to see their guess appear. So the write
 * is scheduled instead of done inline, and only the latest one survives: two
 * guesses in quick succession write once, not twice.
 */
interface PendingWrite {
  round: RoundView;
  triedWords: TriedWord[];
  storage: Storage;
}

let pendingWrite: PendingWrite | null = null;
let cancelScheduled: (() => void) | null = null;
let flushOnHideRegistered = false;

function schedule(run: () => void): () => void {
  // An idle callback where there is one, so the write waits for a gap in the
  // player's own activity; the timeout keeps it from being put off for ever.
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(run, { timeout: 1000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 0);
  return () => clearTimeout(handle);
}

/** Writes whatever is still pending, now. Safe to call when nothing is. */
export function flushSavedRound(): void {
  cancelScheduled?.();
  cancelScheduled = null;
  const pending = pendingWrite;
  pendingWrite = null;
  if (pending) saveRound(pending.round, pending.triedWords, pending.storage);
}

function registerFlushOnHide(): void {
  if (flushOnHideRegistered || typeof window === "undefined") return;
  flushOnHideRegistered = true;
  // A deferred write must not be lost to a tab being closed or backgrounded.
  // Both events, because neither covers it alone: a phone can discard a
  // backgrounded tab without ever firing pagehide, and a same-document
  // navigation fires pagehide without the page being hidden first.
  window.addEventListener("pagehide", flushSavedRound);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSavedRound();
  });
}

/** Same as saveRound, off the critical path. The newest call wins; see flushSavedRound. */
export function saveRoundSoon(
  round: RoundView,
  triedWords: TriedWord[],
  storage: Storage | undefined = globalThis.localStorage
): void {
  if (!storage) return;
  registerFlushOnHide();
  pendingWrite = { round, triedWords, storage };
  cancelScheduled ??= schedule(flushSavedRound);
}
