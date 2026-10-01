import type { TriedWord } from "./hooks/useGame";
import type { ArchiveEntry } from "./game/archive";
import { archiveDays, isDayKey, utcDay } from "./game/daily";
import { revealedPercent } from "./game/progress";
import { parseNearSlots } from "./game/slots";
import type { DisplayToken, RoundView } from "./game/types";

export type { ArchiveEntry };

/**
 * One round per day, so the archives can resume any of the last ARCHIVE_DAYS:
 *
 * - `lyrix:day:<day>`: the sealed state and the words tried. A few kilobytes:
 *   the Worker rebuilds the view from the state (POST /api/round/resume).
 * - `lyrix:view:<day>`: the whole masked view, for today only, so a reload
 *   resumes today's round without waiting on the network. A view is tens of
 *   kilobytes (about 47 KB for a 450-word song), thirty of them would crowd
 *   localStorage's few megabytes.
 * - `lyrix:archive`: a summary per day (title as left, share revealed, tries,
 *   won), all the archives screen reads.
 *
 * Days that left the window are deleted, and a past day's view with them.
 */
const DAY_PREFIX = "lyrix:day:";
const VIEW_PREFIX = "lyrix:view:";
const ARCHIVE_KEY = "lyrix:archive";
/** Before the archives: one round, today's, forgotten at midnight. */
const LEGACY_KEY = "lyrix:round";

export interface SavedDay {
  state: string;
  triedWords: TriedWord[];
  /** Only for today's round: the view it can resume from without the network. */
  round?: RoundView;
}

// Parses rather than type-guards, so a round saved before proximity scoring
// existed (no `score` field), or before close words were shown in the lyrics
// (no `near` field), still loads instead of being thrown away, which would
// silently restart the player's puzzle.
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

function parseTriedWords(value: unknown): TriedWord[] | null {
  if (!Array.isArray(value)) return null;
  const triedWords: TriedWord[] = [];
  for (const entry of value) {
    const word = parseTriedWord(entry);
    if (!word) return null;
    triedWords.push(word);
  }
  return triedWords;
}

function isRoundView(value: unknown): value is RoundView {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.state === "string" &&
    typeof candidate.victory === "boolean" &&
    typeof candidate.title === "object" &&
    candidate.title !== null &&
    Array.isArray(candidate.sections)
  );
}

function isDisplayToken(value: unknown): value is DisplayToken {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.text === "string" && typeof candidate.isWord === "boolean" && typeof candidate.revealed === "boolean";
}

function parseArchiveEntry(value: unknown): ArchiveEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.title) || !candidate.title.every(isDisplayToken)) return null;
  if (typeof candidate.percent !== "number" || typeof candidate.tries !== "number") return null;
  if (typeof candidate.victory !== "boolean") return null;
  return {
    title: candidate.title,
    percent: candidate.percent,
    victory: candidate.victory,
    tries: candidate.tries,
    ...(typeof candidate.artist === "string" ? { artist: candidate.artist } : {}),
  };
}

function readJson(storage: Storage, key: string): unknown {
  const raw = storage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as unknown);
}

function readDay(storage: Storage, day: string): { state: string; triedWords: TriedWord[] } | null {
  const value = readJson(storage, DAY_PREFIX + day);
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const triedWords = parseTriedWords(candidate.triedWords);
  if (typeof candidate.state !== "string" || !triedWords) return null;
  return { state: candidate.state, triedWords };
}

function readArchive(storage: Storage): Record<string, ArchiveEntry> {
  const value = readJson(storage, ARCHIVE_KEY);
  const archive: Record<string, ArchiveEntry> = {};
  if (typeof value !== "object" || value === null) return archive;
  for (const [day, raw] of Object.entries(value)) {
    const entry = parseArchiveEntry(raw);
    if (isDayKey(day) && entry) archive[day] = entry;
  }
  return archive;
}

/** What the archives keep of a round: never a hidden word's text, dev or post-victory hint included. */
function summarize(round: RoundView, triedWords: readonly TriedWord[]): ArchiveEntry {
  return {
    title: round.title.tokens.map(({ text, isWord, revealed }) => ({ text, isWord, revealed })),
    percent: revealedPercent(round),
    victory: round.victory,
    tries: triedWords.length,
    ...(round.victory && round.artist !== undefined ? { artist: round.artist } : {}),
  };
}

/** The day a round is the song of; a view from before the archives (no `day`) is today's. */
function dayOf(round: RoundView, now: Date): string {
  return isDayKey(round.day) ? round.day : utcDay(now);
}

function storageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

/**
 * Brings storage in line with `now`: the round saved before the archives
 * becomes its day's entry (yesterday's included, which used to be lost at
 * midnight), days that left the window go, and so does any view but today's.
 */
function tidy(storage: Storage, now: Date): void {
  const today = utcDay(now);
  const window = new Set(archiveDays(now));

  const legacy = readJson(storage, LEGACY_KEY);
  if (legacy !== null) {
    storage.removeItem(LEGACY_KEY);
    const candidate = legacy as Record<string, unknown>;
    const triedWords = parseTriedWords(candidate.triedWords);
    if (typeof candidate.date === "string" && window.has(candidate.date) && isRoundView(candidate.round) && triedWords) {
      const round: RoundView = { ...candidate.round, day: candidate.date };
      write(storage, round, triedWords, today);
    }
  }

  const archive = readArchive(storage);
  let archiveChanged = false;
  for (const key of storageKeys(storage)) {
    if (key.startsWith(DAY_PREFIX) && !window.has(key.slice(DAY_PREFIX.length))) storage.removeItem(key);
    if (key.startsWith(VIEW_PREFIX) && key.slice(VIEW_PREFIX.length) !== today) storage.removeItem(key);
  }
  for (const day of Object.keys(archive)) {
    if (window.has(day)) continue;
    delete archive[day];
    archiveChanged = true;
  }
  if (archiveChanged) storage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
}

// Tidied once per storage per page: a day rolling over while the page stays
// open is caught by the next save.
const tidiedOn = new WeakMap<Storage, string>();

function tidyOnce(storage: Storage, now: Date): void {
  const today = utcDay(now);
  if (tidiedOn.get(storage) === today) return;
  tidiedOn.set(storage, today);
  tidy(storage, now);
}

function write(storage: Storage, round: RoundView, triedWords: TriedWord[], today: string): void {
  const day = isDayKey(round.day) ? round.day : today;
  storage.setItem(DAY_PREFIX + day, JSON.stringify({ state: round.state, triedWords }));
  const archive = readArchive(storage);
  archive[day] = summarize(round, triedWords);
  storage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  // Last: the largest write, and the only one a full storage may refuse
  // without costing the day its progress.
  if (day === today) storage.setItem(VIEW_PREFIX + day, JSON.stringify(round));
}

/** Today's round, ready to show without the network: only when its view was saved with it. */
export function loadSavedRound(
  storage: Storage | undefined = globalThis.localStorage,
  now: Date = new Date()
): { round: RoundView; triedWords: TriedWord[] } | null {
  const saved = loadSavedDay(utcDay(now), storage, now);
  return saved?.round ? { round: saved.round, triedWords: saved.triedWords } : null;
}

/** What is saved of a day's round: its state and tried words, plus its view when it is today's. */
export function loadSavedDay(
  day: string,
  storage: Storage | undefined = globalThis.localStorage,
  now: Date = new Date()
): SavedDay | null {
  if (!storage) return null;
  try {
    tidyOnce(storage, now);
    const saved = readDay(storage, day);
    if (!saved) return null;
    if (day !== utcDay(now)) return saved;
    const view = readJson(storage, VIEW_PREFIX + day);
    // Written together; should one write have failed, the view must not
    // stand for another state than the one the round carries on with.
    return isRoundView(view) && view.state === saved.state ? { ...saved, round: view } : saved;
  } catch {
    return null;
  }
}

/** Every day of the window the player has played, by day. */
export function loadArchive(
  storage: Storage | undefined = globalThis.localStorage,
  now: Date = new Date()
): Record<string, ArchiveEntry> {
  if (!storage) return {};
  try {
    tidyOnce(storage, now);
    return readArchive(storage);
  } catch {
    return {};
  }
}

export function saveRound(
  round: RoundView,
  triedWords: TriedWord[],
  storage: Storage | undefined = globalThis.localStorage,
  now: Date = new Date()
): void {
  if (!storage) return;
  try {
    tidyOnce(storage, now);
    write(storage, { ...round, day: dayOf(round, now) }, triedWords, utcDay(now));
  } catch {
    // localStorage can throw (private browsing, quota, disabled storage) - persistence is a nice-to-have, never fatal.
  }
}

/**
 * Persisting the round is a nice-to-have, and it is not small: a real song's
 * masked view is hundreds of tokens, so serializing it and handing it to
 * localStorage (a synchronous, disk-backed write) cost a few milliseconds
 * right where the player is waiting to see their guess appear. So the write
 * is scheduled instead of done inline, and only the latest one per day
 * survives: two guesses in quick succession write once, not twice.
 */
interface PendingWrite {
  round: RoundView;
  triedWords: TriedWord[];
  storage: Storage;
}

const pendingWrites = new Map<string, PendingWrite>();
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
  const pending = [...pendingWrites.values()];
  pendingWrites.clear();
  for (const write of pending) saveRound(write.round, write.triedWords, write.storage);
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

/** Same as saveRound, off the critical path. The newest call per day wins; see flushSavedRound. */
export function saveRoundSoon(
  round: RoundView,
  triedWords: TriedWord[],
  storage: Storage | undefined = globalThis.localStorage
): void {
  if (!storage) return;
  registerFlushOnHide();
  pendingWrites.set(dayOf(round, new Date()), { round, triedWords, storage });
  cancelScheduled ??= schedule(flushSavedRound);
}
