/**
 * The game's statistics, written to Workers Analytics Engine (the EVENTS
 * dataset, worker/wrangler.toml) and read back by `npm run stats`
 * (scripts/stats.ts): audience (a visit's report, POST /api/visit) and play
 * (a round started, won, a hint revealed, a room created or joined), and
 * the songs prepared ahead of their day (worker/src/prepare.ts), and the
 * errors players' browsers report (worker/src/clientError.ts).
 *
 * Nothing in them tells one player from another: no IP address, no
 * identifier, no pseudo, no word typed. Only what the request itself was
 * about, and the visitor's country and kind of device, which Cloudflare
 * reads off the request. The legal page (LegalNotice.tsx) says exactly this.
 *
 * A data point is the event's name (blob1, and its index), then its fields
 * in the order EVENT_FIELDS lists them: strings as blob2, blob3..., numbers
 * as double1, double2... The stats script builds its queries from the same
 * table, so the two can't drift apart. Never reorder or rename a field that
 * has shipped: the points already written keep their positions; add new
 * fields at the end.
 *
 * With no EVENTS binding (the unit tests, a Worker deployed without it),
 * nothing is recorded and the game plays exactly the same.
 */
export const EVENT_FIELDS = {
  /** A page's report (src/game/visit.ts): `landed` is 1 for a visit's first, the rest count views per screen. */
  visit: {
    blobs: ["entry", "referrer", "source", "medium", "campaign", "device", "country", "display"],
    doubles: ["landed", "today", "day", "archives", "help", "legal"],
  },
  /** A solo round's first guess: someone actually playing a day, on one device. */
  start: { blobs: ["mode", "kind", "day"], doubles: [] },
  /** The guess that completed a round's title, solo or in a room, with the guesses and hints it took. */
  win: { blobs: ["mode", "kind", "day", "song"], doubles: ["tries", "hints"] },
  /** A hint revealed, after how many guesses. */
  hint: { blobs: ["mode", "kind", "hint"], doubles: ["tries"] },
  /** A room created or joined, and how many members it has then. */
  room: { blobs: ["action"], doubles: ["members"] },
  /** A day's song prepared ahead (worker/src/prepare.ts): ready, played on a fallback, missing, or LRCLIB down. */
  prepare: { blobs: ["day", "outcome", "song"], doubles: ["ahead"] },
  /** An error a player's browser met (worker/src/clientError.ts): what and where, never who. */
  error: { blobs: ["kind", "page", "message", "source"], doubles: ["line"] },
} as const;

export type EventName = keyof typeof EVENT_FIELDS;
type BlobField<E extends EventName> = (typeof EVENT_FIELDS)[E]["blobs"][number];
type DoubleField<E extends EventName> = (typeof EVENT_FIELDS)[E]["doubles"][number];
export type EventValues<E extends EventName> = { [F in BlobField<E>]: string } & { [F in DoubleField<E>]: number };

/** What a round is to the day it is played on: today's song, or a day of the archives. */
export type RoundKind = "today" | "archive";

export function roundKind(day: string, today: string): RoundKind {
  return day === today ? "today" : "archive";
}

/** The Analytics Engine binding, as much of it as the Worker uses. */
export interface EventsDataset {
  writeDataPoint(point: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void;
}

export interface EventsEnv {
  /** Optional: unbound, nothing is recorded (see above). */
  EVENTS?: EventsDataset;
}

/** The dataset's columns for one of an event's fields, as the SQL API names them. */
export function columnOf<E extends EventName>(event: E, field: BlobField<E> | DoubleField<E>): string {
  const { blobs, doubles } = EVENT_FIELDS[event];
  const blob = (blobs as readonly string[]).indexOf(field);
  if (blob >= 0) return `blob${blob + 2}`;
  const double = (doubles as readonly string[]).indexOf(field);
  if (double >= 0) return `double${double + 1}`;
  throw new Error(`events: "${event}" has no field "${field}"`);
}

/**
 * Records `event`. Never throws and never waits: a statistic that couldn't
 * be written is only a statistic missing, never a guess that failed.
 */
export function recordEvent<E extends EventName>(env: EventsEnv, event: E, values: EventValues<E>): void {
  const dataset = env.EVENTS;
  if (!dataset) return;
  const { blobs, doubles } = EVENT_FIELDS[event];
  const fields = values as Record<string, string | number>;
  try {
    dataset.writeDataPoint({
      indexes: [event],
      blobs: [event, ...blobs.map((field) => String(fields[field]))],
      doubles: doubles.map((field) => Number(fields[field])),
    });
  } catch (error) {
    console.warn(`events: couldn't record "${event}"`, error);
  }
}

/** Mobile, tablet or desktop, from a User-Agent header: all a report keeps of it. */
export function deviceOf(userAgent: string | undefined): "mobile" | "tablet" | "desktop" {
  if (!userAgent) return "desktop";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return "mobile";
  return "desktop";
}
