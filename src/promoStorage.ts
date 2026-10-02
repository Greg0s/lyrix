import { isDayKey, utcDay } from "./game/daily";

/**
 * When the "Chercher à plusieurs" card was closed. Closed, it stays hidden for
 * the rest of the (UTC) day; closed `MONTHLY_DISMISSALS` times in one calendar
 * month, it stays hidden until the next one. The header's button still opens
 * the multiplayer dialog either way.
 */
export const PROMO_STORAGE_KEY = "lyrix:promo-dismissed";

export const MONTHLY_DISMISSALS = 5;

interface PromoDismissals {
  /** YYYY-MM, UTC. */
  month: string;
  /** Times closed in `month`. */
  count: number;
  /** The last day it was closed, YYYY-MM-DD, UTC. */
  lastDay: string;
}

function parseDismissals(value: unknown): PromoDismissals | null {
  if (typeof value !== "object" || value === null) return null;
  const { month, count, lastDay } = value as Record<string, unknown>;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) return null;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
  if (!isDayKey(lastDay)) return null;
  return { month, count, lastDay };
}

function loadDismissals(storage: Storage | undefined): PromoDismissals | null {
  try {
    const raw = storage?.getItem(PROMO_STORAGE_KEY);
    return raw ? parseDismissals(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function isPromoDismissed(
  now: Date = new Date(),
  storage: Storage | undefined = globalThis.localStorage
): boolean {
  const entry = loadDismissals(storage);
  if (!entry) return false;
  const today = utcDay(now);
  return entry.lastDay === today || (entry.month === today.slice(0, 7) && entry.count >= MONTHLY_DISMISSALS);
}

export function dismissPromo(now: Date = new Date(), storage: Storage | undefined = globalThis.localStorage): void {
  const today = utcDay(now);
  const month = today.slice(0, 7);
  const entry = loadDismissals(storage);
  const count = entry?.month === month ? entry.count + 1 : 1;
  try {
    storage?.setItem(PROMO_STORAGE_KEY, JSON.stringify({ month, count, lastDay: today }));
  } catch {
    // Persistence is a nice-to-have (private browsing, quota): never fatal.
  }
}
