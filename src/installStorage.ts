import type { ArchiveEntry } from "./game/archive";
import { isDayKey, utcDay } from "./game/daily";

/**
 * When the offer to install Lyrix (InstallOffer.tsx) was turned down.
 * "Plus tard" hides it for `SNOOZE_DAYS` days; turned down `MAX_DISMISSALS`
 * times, it is never made again unasked (the rules' page still offers it).
 */
export const INSTALL_STORAGE_KEY = "lyrix:install-dismissed";

export const SNOOZE_DAYS = 14;
export const MAX_DISMISSALS = 3;

/**
 * Songs a player must have found before being offered it: one found could be
 * a passing visit, two mean they came back for another (decided with the developer).
 */
export const SONGS_FOUND_TO_OFFER = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

interface InstallDismissals {
  count: number;
  /** The last day it was turned down, YYYY-MM-DD, UTC. */
  lastDay: string;
}

function parseDismissals(value: unknown): InstallDismissals | null {
  if (typeof value !== "object" || value === null) return null;
  const { count, lastDay } = value as Record<string, unknown>;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1) return null;
  if (!isDayKey(lastDay)) return null;
  return { count, lastDay };
}

function loadDismissals(storage: Storage | undefined): InstallDismissals | null {
  try {
    const raw = storage?.getItem(INSTALL_STORAGE_KEY);
    return raw ? parseDismissals(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Whether the player said no recently enough, or often enough, not to be asked again unasked. */
export function isInstallOfferSnoozed(
  now: Date = new Date(),
  storage: Storage | undefined = globalThis.localStorage
): boolean {
  const entry = loadDismissals(storage);
  if (!entry) return false;
  if (entry.count >= MAX_DISMISSALS) return true;
  const since = Date.parse(`${utcDay(now)}T00:00:00Z`) - Date.parse(`${entry.lastDay}T00:00:00Z`);
  return since < SNOOZE_DAYS * DAY_MS;
}

export function dismissInstallOffer(
  now: Date = new Date(),
  storage: Storage | undefined = globalThis.localStorage
): void {
  const count = (loadDismissals(storage)?.count ?? 0) + 1;
  try {
    storage?.setItem(INSTALL_STORAGE_KEY, JSON.stringify({ count, lastDay: utcDay(now) }));
  } catch {
    // Persistence is a nice-to-have (private browsing, quota): never fatal.
  }
}

/** Songs found, from the archives' summary index (loadArchive): today's and the days of the archives alike. */
export function songsFound(archive: Readonly<Record<string, ArchiveEntry>>): number {
  return Object.values(archive).filter((entry) => entry.victory).length;
}

/** Whether a player who found these songs, and hasn't turned it down lately, is to be offered it. */
export function isInstallOfferDue(
  archive: Readonly<Record<string, ArchiveEntry>>,
  now: Date = new Date(),
  storage: Storage | undefined = globalThis.localStorage
): boolean {
  return songsFound(archive) >= SONGS_FOUND_TO_OFFER && !isInstallOfferSnoozed(now, storage);
}
